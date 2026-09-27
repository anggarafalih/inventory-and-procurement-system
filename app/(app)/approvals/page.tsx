import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@/lib/generated/prisma";
import { formatDate, formatDateTime, rupiah } from "@/lib/format";
import {
  ApprovalDecisionBadge,
  RequestStatusBadge,
} from "../requests/_components/badges";

export const metadata: Metadata = { title: "Approval · Mayora" };

export default async function ApprovalsPage() {
  const user = await requirePermission("request:approve");

  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      decision: "PENDING",
      request: {
        status: { in: [RequestStatus.SUBMITTED, RequestStatus.IN_REVIEW] },
      },
      OR: [
        { approverId: user.id },
        { approverId: null, approverRole: user.role },
      ],
    },
    orderBy: { request: { submittedAt: "asc" } },
    include: {
      request: {
        select: {
          id: true,
          requestNo: true,
          purpose: true,
          status: true,
          currentStage: true,
          estimatedTotal: true,
          submittedAt: true,
          neededBy: true,
          department: { select: { code: true } },
          requester: { select: { name: true } },
          _count: { select: { items: true } },
        },
      },
    },
  });

  const actionable = pendingSteps.filter(
    (s) => s.sequence === s.request.currentStage,
  );
  const waiting = pendingSteps.filter(
    (s) => s.sequence !== s.request.currentStage,
  );

  const history = await prisma.approvalStep.findMany({
    where: { decidedById: user.id },
    orderBy: { decidedAt: "desc" },
    take: 15,
    include: {
      request: {
        select: { id: true, requestNo: true, purpose: true, status: true },
      },
    },
  });

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Approval
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {actionable.length} menunggu keputusan Anda · {waiting.length} antre di
          belakang.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Menunggu keputusan Anda
        </h2>
        {actionable.length === 0 ? (
          <p className="text-sm text-gray-400">Tidak ada yang perlu diputuskan.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">No.</th>
                  <th className="px-3 py-2 font-medium">Tujuan</th>
                  <th className="px-3 py-2 font-medium">Dept</th>
                  <th className="px-3 py-2 font-medium">Pemohon</th>
                  <th className="px-3 py-2 font-medium">Langkah</th>
                  <th className="px-3 py-2 font-medium text-right">Estimasi</th>
                  <th className="px-3 py-2 font-medium">Diajukan</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {actionable.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {s.request.requestNo}
                    </td>
                    <td className="max-w-xs truncate px-3 py-2 text-gray-700 dark:text-gray-300">
                      {s.request.purpose}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {s.request.department.code}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {s.request.requester.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      #{s.sequence} {s.name}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {rupiah(Number(s.request.estimatedTotal))}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {formatDate(s.request.submittedAt)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link
                        href={`/requests/${s.request.id}`}
                        className="rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                      >
                        Tinjau
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Antre di belakang
          </h2>
          <ul className="flex flex-col gap-2 text-sm">
            {waiting.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <Link
                  href={`/requests/${s.request.id}`}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {s.request.requestNo}
                </Link>
                <span className="truncate text-gray-600 dark:text-gray-400">
                  {s.request.purpose}
                </span>
                <span className="ml-auto text-xs text-gray-400">
                  menunggu langkah #{s.request.currentStage} · giliran Anda #
                  {s.sequence}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Keputusan terakhir Anda
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400">Belum ada.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {history.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-800"
              >
                <Link
                  href={`/requests/${s.request.id}`}
                  className="font-mono text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  {s.request.requestNo}
                </Link>
                <span className="truncate text-gray-600 dark:text-gray-400">
                  #{s.sequence} {s.name}
                </span>
                <span className="ml-auto flex items-center gap-2">
                  <ApprovalDecisionBadge decision={s.decision} />
                  <span className="text-xs text-gray-400">
                    {formatDateTime(s.decidedAt)}
                  </span>
                  <RequestStatusBadge status={s.request.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
