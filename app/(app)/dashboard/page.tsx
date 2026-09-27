import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@/lib/generated/prisma";

export const metadata: Metadata = { title: "Dashboard · Mayora" };

function Card({
  label,
  value,
  href,
}: {
  label: string;
  value: number | string;
  href?: string;
}) {
  const body = (
    <div className="h-full rounded-xl border border-gray-200 bg-white p-5 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700">
      <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </div>
      <div className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

export default async function DashboardPage() {
  const user = await requireUser();

  const [myOpen, toApprove, byStatus] = await Promise.all([
    prisma.request.count({
      where: {
        requesterId: user.id,
        status: {
          in: [
            RequestStatus.DRAFT,
            RequestStatus.SUBMITTED,
            RequestStatus.IN_REVIEW,
          ],
        },
      },
    }),
    prisma.approvalStep.count({
      where: { approverId: user.id, decision: "PENDING" },
    }),
    prisma.request.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const statusMap = Object.fromEntries(
    byStatus.map((r) => [r.status, r._count._all]),
  ) as Record<RequestStatus, number>;

  const lowStock = can(user.role, "catalog:manage")
    ? (
        await prisma.item.findMany({
          where: { isActive: true },
          select: { id: true, sku: true, name: true, stockQty: true, minStock: true },
        })
      ).filter((i) => i.stockQty <= i.minStock)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Halo, {user.name}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Ringkasan permintaan barang &amp; approval.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
        >
          + Buat permintaan
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card
          label="Permintaan saya (aktif)"
          value={myOpen}
          href="/requests"
        />
        <Card
          label="Menunggu approval saya"
          value={toApprove}
          href="/approvals"
        />
        <Card label="Disetujui (total)" value={statusMap.APPROVED ?? 0} />
        <Card label="Selesai (total)" value={statusMap.FULFILLED ?? 0} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Semua permintaan per status
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {Object.values(RequestStatus).map((s) => (
            <div
              key={s}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
            >
              <div className="font-medium text-gray-900 dark:text-gray-100">
                {statusMap[s] ?? 0}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s}</div>
            </div>
          ))}
        </div>
      </section>

      {lowStock.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Stok menipis ({lowStock.length})
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {lowStock.map((i) => (
              <li
                key={i.id}
                className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 dark:border-amber-900 dark:bg-amber-950/40"
              >
                <span className="font-mono text-xs text-gray-500">{i.sku}</span>
                <span className="text-gray-800 dark:text-gray-200">{i.name}</span>
                <span className="ml-auto text-xs text-amber-800 dark:text-amber-300">
                  stok {i.stockQty} / min {i.minStock}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/admin/items"
            className="mt-2 inline-block text-xs text-blue-600 hover:underline dark:text-blue-400"
          >
            Kelola stok →
          </Link>
        </section>
      ) : null}
    </div>
  );
}
