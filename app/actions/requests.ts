"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { createRequestSchema } from "@/lib/validation";
import { nextRequestNo } from "@/lib/request-number";
import { generateApprovalSteps, resolveWorkflow } from "@/lib/requests/workflow";
import type { Prisma } from "@/lib/generated/prisma";
import { RequestStatus } from "@/lib/generated/prisma";

/// User-facing error that should roll back the transaction and be shown in the
/// form (as opposed to an unexpected crash).
class SubmitError extends Error {}

export interface SaveRequestState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

const OPEN_STATUSES: RequestStatus[] = [
  RequestStatus.DRAFT,
  RequestStatus.SUBMITTED,
  RequestStatus.IN_REVIEW,
];

/// Moves a DRAFT request into the approval pipeline: resolve the workflow by
/// value, materialise its stages into ApprovalStep rows, flip the status.
/// Runs inside the caller's transaction.
async function submitWithinTx(
  tx: Prisma.TransactionClient,
  request: { id: string; estimatedTotal: unknown; departmentId: string },
  actorId: string,
) {
  const workflow = await resolveWorkflow(tx, Number(request.estimatedTotal));
  if (!workflow) {
    throw new SubmitError(
      "Belum ada workflow approval yang dikonfigurasi. Hubungi admin.",
    );
  }

  const stepCount = await generateApprovalSteps(tx, {
    requestId: request.id,
    workflowId: workflow.id,
    requesterDepartmentId: request.departmentId,
  });

  const now = new Date();
  // A workflow with zero stages means "no approval needed" → auto-approve.
  const nextStatus =
    stepCount > 0 ? RequestStatus.SUBMITTED : RequestStatus.APPROVED;

  await tx.request.update({
    where: { id: request.id },
    data: {
      status: nextStatus,
      workflowId: workflow.id,
      currentStage: stepCount > 0 ? 1 : 0,
      submittedAt: now,
      closedAt: stepCount > 0 ? null : now,
      activities: {
        create: {
          actorId,
          action: "SUBMITTED",
          fromStatus: RequestStatus.DRAFT,
          toStatus: nextStatus,
        },
      },
    },
  });
}

/// Form action for `app/(app)/requests/new`. `mode` = "draft" | "submit".
export async function saveRequest(
  _prev: SaveRequestState | undefined,
  formData: FormData,
): Promise<SaveRequestState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sesi berakhir. Silakan masuk kembali." };
  if (!can(user.role, "request:create")) {
    return { error: "Anda tidak berwenang membuat permintaan." };
  }

  const mode = formData.get("mode") === "submit" ? "submit" : "draft";

  let itemsRaw: unknown;
  try {
    itemsRaw = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "Data barang tidak terbaca." };
  }

  const parsed = createRequestSchema.safeParse({
    departmentId: formData.get("departmentId"),
    purpose: formData.get("purpose"),
    neededBy: formData.get("neededBy") || undefined,
    items: itemsRaw,
  });
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    return {
      error: flat.formErrors[0] ?? "Periksa kembali isian formulir.",
      fieldErrors: flat.fieldErrors as Record<string, string[]>,
    };
  }
  const input = parsed.data;

  // Non-privileged users may only file for their own department.
  if (
    !can(user.role, "request:read:any") &&
    user.departmentId &&
    input.departmentId !== user.departmentId
  ) {
    return { error: "Anda hanya dapat mengajukan untuk departemen Anda." };
  }

  const lines = input.items.map((it) => ({
    itemId: it.itemId ?? null,
    name: it.name,
    description: it.description ?? null,
    quantity: it.quantity,
    unit: it.unit,
    unitPrice: it.unitPrice,
    lineTotal: Math.round(it.quantity * it.unitPrice * 100) / 100,
  }));
  const estimatedTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

  const editId = (formData.get("requestId") as string | null)?.trim() || null;
  if (editId) {
    const existing = await prisma.request.findUnique({
      where: { id: editId },
      select: { requesterId: true, status: true },
    });
    if (!existing || existing.requesterId !== user.id) {
      return { error: "Permintaan tidak ditemukan." };
    }
    if (existing.status !== RequestStatus.DRAFT) {
      return { error: "Hanya draf yang dapat diubah." };
    }
  }

  let newId: string;
  try {
    newId = await prisma.$transaction(async (tx) => {
      let request;
      if (editId) {
        await tx.requestItem.deleteMany({ where: { requestId: editId } });
        request = await tx.request.update({
          where: { id: editId },
          data: {
            departmentId: input.departmentId,
            purpose: input.purpose,
            estimatedTotal,
            neededBy: input.neededBy ?? null,
            items: { create: lines },
            activities: {
              create: {
                actorId: user.id,
                action: "UPDATED",
                toStatus: RequestStatus.DRAFT,
              },
            },
          },
        });
      } else {
        const requestNo = await nextRequestNo(tx);
        request = await tx.request.create({
          data: {
            requestNo,
            requesterId: user.id,
            departmentId: input.departmentId,
            purpose: input.purpose,
            status: RequestStatus.DRAFT,
            estimatedTotal,
            neededBy: input.neededBy ?? null,
            items: { create: lines },
            activities: {
              create: {
                actorId: user.id,
                action: "CREATED",
                toStatus: RequestStatus.DRAFT,
              },
            },
          },
        });
      }

      if (mode === "submit") {
        await submitWithinTx(tx, request, user.id);
      }
      return request.id;
    });
  } catch (e) {
    if (e instanceof SubmitError) return { error: e.message };
    console.error("saveRequest failed", e);
    return { error: "Gagal menyimpan permintaan. Coba lagi." };
  }

  revalidatePath("/requests");
  redirect(`/requests/${newId}`);
}

/// Submit an existing DRAFT (from the detail page).
export async function submitExistingRequest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("requestId") ?? "");
  const request = await prisma.request.findUnique({
    where: { id },
    select: {
      id: true,
      requesterId: true,
      status: true,
      estimatedTotal: true,
      departmentId: true,
    },
  });
  if (!request || request.requesterId !== user.id) redirect("/requests");
  if (request.status !== RequestStatus.DRAFT) redirect(`/requests/${id}`);

  try {
    await prisma.$transaction((tx) => submitWithinTx(tx, request, user.id));
  } catch (e) {
    const msg =
      e instanceof SubmitError ? e.message : "Gagal mengajukan permintaan.";
    redirect(`/requests/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/requests/${id}`);
  redirect(`/requests/${id}`);
}

/// Cancel a still-open request. Owner or a user with `request:read:any`.
export async function cancelRequest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("requestId") ?? "");
  const request = await prisma.request.findUnique({
    where: { id },
    select: { id: true, requesterId: true, status: true },
  });
  const allowed =
    request &&
    (request.requesterId === user.id || can(user.role, "request:read:any"));
  if (!allowed) redirect("/requests");
  if (!OPEN_STATUSES.includes(request.status)) redirect(`/requests/${id}`);

  await prisma.$transaction(async (tx) => {
    await tx.approvalStep.updateMany({
      where: { requestId: id, decision: "PENDING" },
      data: { decision: "SKIPPED" },
    });
    await tx.request.update({
      where: { id },
      data: {
        status: RequestStatus.CANCELLED,
        currentStage: 0,
        closedAt: new Date(),
        activities: {
          create: {
            actorId: user.id,
            action: "CANCELLED",
            fromStatus: request.status,
            toStatus: RequestStatus.CANCELLED,
          },
        },
      },
    });
  });

  revalidatePath("/requests");
  redirect(`/requests/${id}`);
}
