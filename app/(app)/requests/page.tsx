import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RequestStatus, type Prisma } from "@/lib/generated/prisma";
import { formatDate, rupiah } from "@/lib/format";
import { RequestStatusBadge } from "./_components/badges";

export const metadata: Metadata = { title: "Permintaan · Mayora" };

const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: "Draf",
  SUBMITTED: "Diajukan",
  IN_REVIEW: "Direview",
  APPROVED: "Disetujui",
  REJECTED: "Ditolak",
  CANCELLED: "Dibatalkan",
  FULFILLED: "Dipenuhi",
};

export default async function RequestsPage({
  searchParams,
}: PageProps<"/requests">) {
  const user = await requireUser();
  const sp = await searchParams;

  const canSeeAll = can(user.role, "request:read:any");
  const scopeAll = canSeeAll && sp.scope === "all";
  const statusFilter =
    typeof sp.status === "string" && sp.status in RequestStatus
      ? (sp.status as RequestStatus)
      : undefined;

  const where: Prisma.RequestWhereInput = {
    ...(scopeAll ? {} : { requesterId: user.id }),
    ...(statusFilter ? { status: statusFilter } : {}),
  };

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      requestNo: true,
      purpose: true,
      status: true,
      estimatedTotal: true,
      createdAt: true,
      submittedAt: true,
      department: { select: { code: true } },
      requester: { select: { name: true } },
      _count: { select: { items: true } },
    },
  });

  const mkQuery = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    if (scopeAll) q.set("scope", "all");
    if (statusFilter) q.set("status", statusFilter);
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) q.delete(k);
      else q.set(k, v);
    }
    const s = q.toString();
    return s ? `/requests?${s}` : "/requests";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Permintaan {scopeAll ? "(semua)" : "saya"}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {requests.length} permintaan
            {statusFilter ? ` · status ${STATUS_LABELS[statusFilter]}` : ""}
          </p>
        </div>
        <Link
          href="/requests/new"
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
        >
          + Buat permintaan
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {canSeeAll ? (
          <>
            <Link
              href={mkQuery({ scope: undefined })}
              className={`rounded-full border px-3 py-1 ${!scopeAll ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 dark:border-gray-700"}`}
            >
              Saya
            </Link>
            <Link
              href={mkQuery({ scope: "all" })}
              className={`rounded-full border px-3 py-1 ${scopeAll ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 dark:border-gray-700"}`}
            >
              Semua
            </Link>
            <span className="mx-1 text-gray-300 dark:text-gray-700">|</span>
          </>
        ) : null}

        <Link
          href={mkQuery({ status: undefined })}
          className={`rounded-full border px-3 py-1 ${!statusFilter ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 dark:border-gray-700"}`}
        >
          Semua status
        </Link>
        {Object.values(RequestStatus).map((s) => (
          <Link
            key={s}
            href={mkQuery({ status: s })}
            className={`rounded-full border px-3 py-1 ${statusFilter === s ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900" : "border-gray-300 dark:border-gray-700"}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-medium">No.</th>
              <th className="px-3 py-2 font-medium">Tujuan</th>
              <th className="px-3 py-2 font-medium">Dept</th>
              {scopeAll ? (
                <th className="px-3 py-2 font-medium">Pemohon</th>
              ) : null}
              <th className="px-3 py-2 font-medium text-right">Barang</th>
              <th className="px-3 py-2 font-medium text-right">Estimasi</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Dibuat</th>
            </tr>
          </thead>
          <tbody>
            {requests.length === 0 ? (
              <tr>
                <td
                  colSpan={scopeAll ? 8 : 7}
                  className="px-3 py-8 text-center text-gray-400"
                >
                  Belum ada permintaan.{" "}
                  <Link href="/requests/new" className="underline">
                    Buat yang pertama
                  </Link>
                  .
                </td>
              </tr>
            ) : (
              requests.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900/50"
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/requests/${r.id}`}
                      className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {r.requestNo}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate px-3 py-2 text-gray-700 dark:text-gray-300">
                    {r.purpose}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{r.department.code}</td>
                  {scopeAll ? (
                    <td className="px-3 py-2 text-gray-500">
                      {r.requester.name}
                    </td>
                  ) : null}
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {r._count.items}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {rupiah(Number(r.estimatedTotal))}
                  </td>
                  <td className="px-3 py-2">
                    <RequestStatusBadge status={r.status} />
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {formatDate(r.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
