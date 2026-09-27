"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { can, type Permission } from "@/lib/rbac";
import {
  categorySchema,
  itemSchema,
  stageSchema,
  stockAdjustSchema,
  userCreateSchema,
  userUpdateSchema,
  workflowSchema,
} from "@/lib/validation";
import { Prisma, StockMovementType } from "@/lib/generated/prisma";

/// Recoverable, user-facing error → shown as an `?error=` banner on the section.
class AdminError extends Error {}

// --- helpers -----------------------------------------------------------------

function backWith(path: string, msg?: { ok?: string; error?: string }): never {
  const q = new URLSearchParams();
  if (msg?.ok) q.set("ok", msg.ok);
  if (msg?.error) q.set("error", msg.error);
  const s = q.toString();
  redirect(s ? `${path}?${s}` : path);
}

function firstZodError(err: z.ZodError): string {
  const flat = z.flattenError(err);
  return (
    flat.formErrors[0] ??
    Object.values(flat.fieldErrors).flat()[0] ??
    "Isian tidak valid."
  );
}

/// null when the form field is missing or blank, else the trimmed string.
function opt(formData: FormData, key: string): string | null {
  const v = formData.get(key);
  return v == null || String(v).trim() === "" ? null : String(v).trim();
}

async function guard(permission: Permission, backPath: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!can(user.role, permission)) {
    backWith(backPath, { error: "Anda tidak berwenang." });
  }
  return user;
}

function dbErrorMessage(e: unknown): string {
  if (e instanceof AdminError) return e.message;
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === "P2002") {
      const t = (e.meta?.target as string[] | undefined)?.join(", ");
      return `Nilai sudah dipakai${t ? ` (${t})` : ""}.`;
    }
    if (e.code === "P2003") return "Referensi tidak valid.";
    if (e.code === "P2025") return "Data tidak ditemukan.";
  }
  console.error("admin action failed", e);
  return "Operasi gagal.";
}

// --- Items -----------------------------------------------------------------

export async function saveItem(formData: FormData): Promise<void> {
  const back = "/admin/items";
  await guard("catalog:manage", back);

  const parsed = itemSchema.safeParse({
    id: opt(formData, "id") ?? undefined,
    sku: formData.get("sku"),
    name: formData.get("name"),
    description: opt(formData, "description"),
    categoryId: formData.get("categoryId"),
    unit: formData.get("unit") || "pcs",
    unitPrice: formData.get("unitPrice") ?? 0,
    minStock: formData.get("minStock") ?? 0,
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) backWith(back, { error: firstZodError(parsed.error) });

  const { id, ...data } = parsed.data;
  let ok: string;
  try {
    if (id) {
      await prisma.item.update({ where: { id }, data });
      ok = `Barang ${data.sku} diperbarui.`;
    } else {
      await prisma.item.create({ data });
      ok = `Barang ${data.sku} ditambahkan.`;
    }
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok });
}

export async function adjustStock(formData: FormData): Promise<void> {
  const back = "/admin/items";
  const user = await guard("catalog:manage", back);

  const parsed = stockAdjustSchema.safeParse({
    itemId: formData.get("itemId"),
    delta: formData.get("delta"),
    note: opt(formData, "note"),
  });
  if (!parsed.success) backWith(back, { error: firstZodError(parsed.error) });
  const { itemId, delta, note } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      const item = await tx.item.update({
        where: { id: itemId },
        data: { stockQty: { increment: delta } },
      });
      if (item.stockQty < 0) {
        throw new AdminError("Stok tidak boleh menjadi negatif.");
      }
      await tx.stockMovement.create({
        data: {
          itemId,
          type: delta > 0 ? StockMovementType.IN : StockMovementType.OUT,
          quantity: Math.abs(delta),
          balanceAfter: item.stockQty,
          createdById: user.id,
          note: note ?? "Penyesuaian stok manual",
        },
      });
    });
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok: "Stok disesuaikan." });
}

// --- Categories ----------------------------------------------------------

export async function saveCategory(formData: FormData): Promise<void> {
  const back = "/admin/categories";
  await guard("catalog:manage", back);

  const parsed = categorySchema.safeParse({
    id: opt(formData, "id") ?? undefined,
    name: formData.get("name"),
    parentId: opt(formData, "parentId"),
  });
  if (!parsed.success) backWith(back, { error: firstZodError(parsed.error) });
  const { id, name, parentId } = parsed.data;

  if (id && parentId === id) {
    backWith(back, {
      error: "Kategori tidak bisa menjadi induk dirinya sendiri.",
    });
  }

  let ok: string;
  try {
    if (id) {
      await prisma.category.update({
        where: { id },
        data: { name, parentId: parentId ?? null },
      });
      ok = "Kategori diperbarui.";
    } else {
      await prisma.category.create({ data: { name, parentId: parentId ?? null } });
      ok = `Kategori ${name} ditambahkan.`;
    }
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok });
}

// --- Users -------------------------------------------------------------

export async function saveUser(formData: FormData): Promise<void> {
  const back = "/admin/users";
  const admin = await guard("user:manage", back);
  const id = opt(formData, "id");

  let ok: string;
  try {
    if (id) {
      const parsed = userUpdateSchema.safeParse({
        id,
        name: formData.get("name"),
        role: formData.get("role"),
        departmentId: opt(formData, "departmentId"),
        isActive: formData.get("isActive"),
      });
      if (!parsed.success) {
        backWith(back, { error: firstZodError(parsed.error) });
      }
      const { id: uid, departmentId, ...rest } = parsed.data;

      if (uid === admin.id && (rest.role !== "ADMIN" || !rest.isActive)) {
        throw new AdminError(
          "Anda tidak dapat menurunkan peran atau menonaktifkan akun sendiri.",
        );
      }
      await prisma.user.update({
        where: { id: uid },
        data: { ...rest, departmentId: departmentId ?? null },
      });
      ok = "Pengguna diperbarui.";
    } else {
      const parsed = userCreateSchema.safeParse({
        email: formData.get("email"),
        name: formData.get("name"),
        role: formData.get("role"),
        departmentId: opt(formData, "departmentId"),
        password: formData.get("password"),
      });
      if (!parsed.success) {
        backWith(back, { error: firstZodError(parsed.error) });
      }
      const { password, departmentId, ...rest } = parsed.data;
      await prisma.user.create({
        data: {
          ...rest,
          departmentId: departmentId ?? null,
          passwordHash: await bcrypt.hash(password, 10),
        },
      });
      ok = `Pengguna ${rest.email} dibuat.`;
    }
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok });
}

export async function resetUserPassword(formData: FormData): Promise<void> {
  const back = "/admin/users";
  await guard("user:manage", back);

  const id = opt(formData, "id");
  const password = String(formData.get("password") ?? "");
  if (!id || password.length < 8) {
    backWith(back, { error: "Password baru minimal 8 karakter." });
  }
  try {
    await prisma.user.update({
      where: { id: id! },
      data: { passwordHash: await bcrypt.hash(password, 10) },
    });
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok: "Password direset." });
}

// --- Workflows ---------------------------------------------------------

export async function saveWorkflow(formData: FormData): Promise<void> {
  const back = "/admin/workflows";
  await guard("workflow:manage", back);

  const parsed = workflowSchema.safeParse({
    id: opt(formData, "id") ?? undefined,
    name: formData.get("name"),
    description: opt(formData, "description"),
    minAmount: formData.get("minAmount") ?? 0,
    maxAmount: opt(formData, "maxAmount"),
    isActive: formData.get("isActive"),
  });
  if (!parsed.success) backWith(back, { error: firstZodError(parsed.error) });
  const { id, maxAmount, minAmount, ...rest } = parsed.data;

  if (maxAmount != null && maxAmount <= minAmount) {
    backWith(back, {
      error: "Nilai maksimum harus lebih besar dari minimum.",
    });
  }

  const data = { ...rest, minAmount, maxAmount: maxAmount ?? null };
  let ok: string;
  try {
    if (id) {
      await prisma.approvalWorkflow.update({ where: { id }, data });
      ok = "Workflow diperbarui.";
    } else {
      await prisma.approvalWorkflow.create({ data });
      ok = `Workflow ${rest.name} dibuat.`;
    }
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok });
}

export async function addStage(formData: FormData): Promise<void> {
  const back = "/admin/workflows";
  await guard("workflow:manage", back);

  const parsed = stageSchema.safeParse({
    workflowId: formData.get("workflowId"),
    sequence: formData.get("sequence"),
    name: formData.get("name"),
    approverRole: formData.get("approverRole"),
    approverId: opt(formData, "approverId"),
  });
  if (!parsed.success) backWith(back, { error: firstZodError(parsed.error) });
  const { approverId, ...rest } = parsed.data;

  try {
    await prisma.approvalStage.create({
      data: { ...rest, approverId: approverId ?? null },
    });
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok: "Tahap ditambahkan." });
}

export async function deleteStage(formData: FormData): Promise<void> {
  const back = "/admin/workflows";
  await guard("workflow:manage", back);

  const stageId = opt(formData, "stageId");
  if (!stageId) backWith(back, { error: "Tahap tidak ditemukan." });
  try {
    await prisma.approvalStage.delete({ where: { id: stageId! } });
  } catch (e) {
    backWith(back, { error: dbErrorMessage(e) });
  }
  revalidatePath(back);
  backWith(back, { ok: "Tahap dihapus." });
}
