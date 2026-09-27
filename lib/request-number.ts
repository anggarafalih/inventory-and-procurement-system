import type { Prisma } from "@/lib/generated/prisma";

/// Generates the next human-friendly request number, e.g. `REQ-2026-0001`.
///
/// Pass the transaction client from `prisma.$transaction(...)` so the count and
/// the insert happen atomically. Under heavy concurrent load a dedicated
/// Postgres sequence or counter row would be more robust; this is good enough
/// for the workloads this app targets.
export async function nextRequestNo(
  tx: Prisma.TransactionClient,
  now: Date = new Date(),
): Promise<string> {
  const year = now.getUTCFullYear();
  const prefix = `REQ-${year}-`;

  const count = await tx.request.count({
    where: { requestNo: { startsWith: prefix } },
  });

  return `${prefix}${String(count + 1).padStart(4, "0")}`;
}
