"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { approvalDecisionSchema } from "@/lib/validation";
import { ApprovalDecision, RequestStatus } from "@/lib/generated/prisma";

/// User-facing error that rolls back the transaction and is shown as a banner
/// on the request detail page.
class DecisionError extends Error {}

const IN_APPROVAL: RequestStatus[] = [
  RequestStatus.SUBMITTED,
  RequestStatus.IN_REVIEW,
];

/// Record an APPROVE / REJECT decision on the request's currently-active step.
/// Approve advances `currentStage` to the next pending step, or closes the
/// request as APPROVED when none remain. Reject closes it and skips the rest.
export async function decideApproval(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const parsed = approvalDecisionSchema.safeParse({
    requestId: formData.get("requestId"),
    stepId: formData.get("stepId"),
    decision: formData.get("decision"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) redirect("/approvals");

  const { requestId, stepId, decision, note } = parsed.data;
  const trimmedNote = note?.trim() || null;

  if (decision === "REJECTED" && !trimmedNote) {
    redirect(
      `/requests/${requestId}?error=${encodeURIComponent(
        "Sertakan alasan penolakan.",
      )}`,
    );
  }

  try {
    await prisma.$transaction(async (tx) => {
      const step = await tx.approvalStep.findUnique({
        where: { id: stepId },
        include: {
          request: {
            select: { id: true, status: true, currentStage: true },
          },
        },
      });
      if (!step || step.requestId !== requestId) {
        throw new DecisionError("Langkah approval tidak ditemukan.");
      }

      const isAssigned = step.approverId === user.id;
      const isRoleFallback =
        step.approverId === null && step.approverRole === user.role;
      if (
        !can(user.role, "request:approve") ||
        !(isAssigned || isRoleFallback)
      ) {
        throw new DecisionError("Anda tidak berwenang memutuskan langkah ini.");
      }
      if (step.decision !== ApprovalDecision.PENDING) {
        throw new DecisionError("Langkah ini sudah diputuskan.");
      }
      if (!IN_APPROVAL.includes(step.request.status)) {
        throw new DecisionError("Permintaan tidak sedang dalam proses approval.");
      }
      if (step.sequence !== step.request.currentStage) {
        throw new DecisionError("Belum giliran langkah ini untuk diputuskan.");
      }

      const now = new Date();
      await tx.approvalStep.update({
        where: { id: step.id },
        data: {
          decision:
            decision === "APPROVED"
              ? ApprovalDecision.APPROVED
              : ApprovalDecision.REJECTED,
          decidedById: user.id,
          decidedAt: now,
          approverId: step.approverId ?? user.id,
          note: trimmedNote,
        },
      });

      if (decision === "REJECTED") {
        await tx.approvalStep.updateMany({
          where: { requestId, decision: ApprovalDecision.PENDING },
          data: { decision: ApprovalDecision.SKIPPED },
        });
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.REJECTED,
            currentStage: 0,
            closedAt: now,
            activities: {
              create: {
                actorId: user.id,
                action: "REJECTED",
                fromStatus: step.request.status,
                toStatus: RequestStatus.REJECTED,
                note: trimmedNote,
              },
            },
          },
        });
        return;
      }

      const nextStep = await tx.approvalStep.findFirst({
        where: {
          requestId,
          decision: ApprovalDecision.PENDING,
          sequence: { gt: step.sequence },
        },
        orderBy: { sequence: "asc" },
      });

      if (nextStep) {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.IN_REVIEW,
            currentStage: nextStep.sequence,
            activities: {
              create: {
                actorId: user.id,
                action: `APPROVED_STAGE_${step.sequence}`,
                fromStatus: step.request.status,
                toStatus: RequestStatus.IN_REVIEW,
                note: trimmedNote,
              },
            },
          },
        });
      } else {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.APPROVED,
            currentStage: 0,
            closedAt: now,
            activities: {
              create: {
                actorId: user.id,
                action: "APPROVED",
                fromStatus: step.request.status,
                toStatus: RequestStatus.APPROVED,
                note: trimmedNote,
              },
            },
          },
        });
      }
    });
  } catch (e) {
    const msg =
      e instanceof DecisionError ? e.message : "Gagal menyimpan keputusan.";
    redirect(`/requests/${requestId}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/approvals");
  revalidatePath(`/requests/${requestId}`);
  redirect(`/requests/${requestId}`);
}
