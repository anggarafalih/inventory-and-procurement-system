"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { RequestStatus, StockMovementType } from "@/lib/generated/prisma";

class FulfillError extends Error {}

/// Marks an APPROVED request FULFILLED: decrements stock for every catalogued
/// line item and writes an OUT StockMovement per item. Blocks when stock is
/// insufficient. Free-text (non-catalogue) lines are recorded in the activity
/// note but move no stock.
export async function fulfillRequest(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const id = String(formData.get("requestId") ?? "");
  if (!can(user.role, "request:fulfill")) {
    redirect(
      `/requests/${id}?error=${encodeURIComponent(
        "Anda tidak berwenang memenuhi permintaan.",
      )}`,
    );
  }
  const note = (formData.get("note") as string | null)?.trim() || null;

  try {
    await prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          requestNo: true,
          items: { select: { itemId: true, name: true, quantity: true } },
        },
      });
      if (!request) throw new FulfillError("Permintaan tidak ditemukan.");
      if (request.status !== RequestStatus.APPROVED) {
        throw new FulfillError(
          "Hanya permintaan berstatus Disetujui yang dapat dipenuhi.",
        );
      }

      // Aggregate required quantity per catalogue item.
      const needById = new Map<string, number>();
      for (const it of request.items) {
        if (!it.itemId) continue;
        needById.set(it.itemId, (needById.get(it.itemId) ?? 0) + it.quantity);
      }
      const freeTextLines = request.items.filter((it) => !it.itemId).length;

      const stockItems = await tx.item.findMany({
        where: { id: { in: [...needById.keys()] } },
        select: { id: true, name: true, stockQty: true },
      });
      const stockById = new Map(stockItems.map((i) => [i.id, i]));

      const shortfalls: string[] = [];
      for (const [itemId, need] of needById) {
        const s = stockById.get(itemId);
        if (s && need > s.stockQty) {
          shortfalls.push(`${s.name} (butuh ${need}, stok ${s.stockQty})`);
        }
      }
      if (shortfalls.length) {
        throw new FulfillError(`Stok tidak cukup — ${shortfalls.join("; ")}.`);
      }

      const now = new Date();
      for (const [itemId, need] of needById) {
        const updated = await tx.item.update({
          where: { id: itemId },
          data: { stockQty: { decrement: need } },
        });
        await tx.stockMovement.create({
          data: {
            itemId,
            requestId: request.id,
            type: StockMovementType.OUT,
            quantity: need,
            balanceAfter: updated.stockQty,
            createdById: user.id,
            note: note ?? `Pemenuhan ${request.requestNo}`,
            createdAt: now,
          },
        });
      }

      const activityNote = [
        note,
        freeTextLines > 0
          ? `${freeTextLines} baris non-katalog tidak memindahkan stok`
          : null,
      ]
        .filter(Boolean)
        .join(" · ") || null;

      await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.FULFILLED,
          closedAt: now,
          activities: {
            create: {
              actorId: user.id,
              action: "FULFILLED",
              fromStatus: RequestStatus.APPROVED,
              toStatus: RequestStatus.FULFILLED,
              note: activityNote,
            },
          },
        },
      });
    });
  } catch (e) {
    const msg =
      e instanceof FulfillError ? e.message : "Gagal memenuhi permintaan.";
    redirect(`/requests/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath(`/requests/${id}`);
  revalidatePath("/requests");
  redirect(`/requests/${id}`);
}
