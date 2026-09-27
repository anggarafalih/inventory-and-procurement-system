import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { RequestStatus } from "@/lib/generated/prisma";
import { formatDate, formatDateTime, rupiah } from "@/lib/format";
import { submitExistingRequest, cancelRequest } from "@/app/actions/requests";
import { decideApproval } from "@/app/actions/approvals";
import { fulfillRequest } from "@/app/actions/fulfillment";
import {
  ApprovalDecisionBadge,
  RequestStatusBadge,
} from "../_components/badges";

export const metadata: Metadata = { title: "Detail Permintaan · Mayora" };

const OPEN: RequestStatus[] = [
  RequestStatus.DRAFT,
  RequestStatus.SUBMITTED,
  RequestStatus.IN_REVIEW,
];

export default async function RequestDetailPage({
  params,
  searchParams,
}: PageProps<"/requests/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;
  const errorMsg = typeof sp.error === "string" ? sp.error : undefined;

  const request = await prisma.request.findUnique({
    where: { id },
    include: {
      department: { select: { name: true, code: true } },
      requester: { select: { id: true, name: true, email: true } },
      workflow: { select: { name: true } },
      items: {
        orderBy: { id: "asc" },
        include: { item: { select: { sku: true } } },
      },
      approvalSteps: {
        orderBy: { sequence: "asc" },
        include: {
          approver: { select: { name: true } },
          decidedBy: { select: { name: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true } } },
      },
      stockMovements: {
        orderBy: { createdAt: "asc" },
        include: {
          item: { select: { sku: true, name: true } },
          createdBy: { select: { name: true } },
        },
      },
    },
  });

  if (!request) notFound();

  const isOwner = request.requesterId === user.id;
  const isAssignedApprover = request.approvalSteps.some(
    (s) => s.approverId === user.id,
  );
  if (!isOwner && !isAssignedApprover && !can(user.role, "request:read:any")) {
    notFound();
  }

  const canSubmit = isOwner && request.status === RequestStatus.DRAFT;
  const canCancel =
    (isOwner || can(user.role, "request:read:any")) &&
    OPEN.includes(request.status);

  const activeStep = request.approvalSteps.find(
    (s) => s.sequence === request.currentStage && s.decision === "PENDING",
  );
  const canDecide =
    !!activeStep &&
    OPEN.includes(request.status) &&
    can(user.role, "request:approve") &&
    (activeStep.approverId === user.id ||
      (activeStep.approverId === null &&
        activeStep.approverRole === user.role));

  const canFulfill =
    can(user.role, "request:fulfill") &&
    request.status === RequestStatus.APPROVED;

  const itemsTotal = request.items.reduce(
    (s, it) => s + Number(it.lineTotal),
    0,
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/requests"
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          ← Permintaan
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-xl font-semibold text-gray-900 dark:text-gray-100">
            {request.requestNo}
          </h1>
          <RequestStatusBadge status={request.status} />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-gray-700 dark:text-gray-300">
          {request.purpose}
        </p>
      </div>

      {errorMsg ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {errorMsg}
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
        <Meta label="Departemen">
          {request.department.name} ({request.department.code})
        </Meta>
        <Meta label="Pemohon">{request.requester.name}</Meta>
        <Meta label="Estimasi total">{rupiah(Number(request.estimatedTotal))}</Meta>
        <Meta label="Workflow">{request.workflow?.name ?? "—"}</Meta>
        <Meta label="Dibutuhkan sebelum">{formatDate(request.neededBy)}</Meta>
        <Meta label="Diajukan">{formatDateTime(request.submittedAt)}</Meta>
        <Meta label="Ditutup">{formatDateTime(request.closedAt)}</Meta>
        <Meta label="Dibuat">{formatDateTime(request.createdAt)}</Meta>
      </section>

      {canDecide && activeStep ? (
        <form
          action={decideApproval}
          className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="stepId" value={activeStep.id} />
          <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Keputusan Anda — langkah #{activeStep.sequence} {activeStep.name}
          </h2>
          <textarea
            name="note"
            rows={2}
            placeholder="Catatan (wajib jika menolak)…"
            className="w-full rounded-md border border-amber-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-amber-800 dark:bg-gray-900"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              name="decision"
              value="APPROVED"
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Setujui
            </button>
            <button
              type="submit"
              name="decision"
              value="REJECTED"
              className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
            >
              Tolak
            </button>
          </div>
        </form>
      ) : null}

      {canFulfill ? (
        <form
          action={fulfillRequest}
          className="flex flex-col gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40"
        >
          <input type="hidden" name="requestId" value={request.id} />
          <h2 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Penuhi permintaan
          </h2>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
            Stok tiap barang katalog akan dikurangi sesuai jumlah pada
            permintaan. Baris non-katalog tidak memindahkan stok.
          </p>
          <input
            name="note"
            placeholder="Catatan (opsional)…"
            className="w-full rounded-md border border-emerald-300 bg-white px-2 py-1.5 text-sm outline-none focus:border-emerald-500 dark:border-emerald-800 dark:bg-gray-900"
          />
          <button
            type="submit"
            className="w-fit rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Tandai dipenuhi &amp; kurangi stok
          </button>
        </form>
      ) : null}

      {(canSubmit || canCancel) && (
        <div className="flex flex-wrap gap-3">
          {canSubmit ? (
            <>
              <form action={submitExistingRequest}>
                <input type="hidden" name="requestId" value={request.id} />
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                >
                  Ajukan untuk approval
                </button>
              </form>
              <Link
                href={`/requests/${request.id}/edit`}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
              >
                Ubah
              </Link>
            </>
          ) : null}
          {canCancel ? (
            <form action={cancelRequest}>
              <input type="hidden" name="requestId" value={request.id} />
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-red-50 hover:text-red-700 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-red-950"
              >
                Batalkan
              </button>
            </form>
          ) : null}
        </div>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Barang ({request.items.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-3 py-2 font-medium">Barang</th>
                <th className="px-3 py-2 font-medium">SKU</th>
                <th className="px-3 py-2 font-medium text-right">Qty</th>
                <th className="px-3 py-2 font-medium">Satuan</th>
                <th className="px-3 py-2 font-medium text-right">Harga satuan</th>
                <th className="px-3 py-2 font-medium text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {request.items.map((it) => (
                <tr
                  key={it.id}
                  className="border-t border-gray-100 dark:border-gray-800"
                >
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {it.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-gray-500">
                    {it.item?.sku ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {it.quantity}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{it.unit}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {rupiah(Number(it.unitPrice))}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {rupiah(Number(it.lineTotal))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 dark:border-gray-700">
                <td
                  colSpan={5}
                  className="px-3 py-2 text-right text-sm font-medium"
                >
                  Total
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {rupiah(itemsTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Alur approval
        </h2>
        {request.approvalSteps.length === 0 ? (
          <p className="text-sm text-gray-400">
            Belum diajukan — alur approval dibuat saat permintaan diajukan.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {request.approvalSteps.map((s) => {
              const active =
                s.sequence === request.currentStage &&
                OPEN.includes(request.status);
              return (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                    active
                      ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
                      : "border-gray-200 dark:border-gray-800"
                  }`}
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-medium dark:bg-gray-700">
                    {s.sequence}
                  </span>
                  <span className="font-medium text-gray-800 dark:text-gray-200">
                    {s.name}
                  </span>
                  <span className="text-xs text-gray-500">
                    {s.approverRole}
                    {s.approver ? ` · ${s.approver.name}` : " · belum ditugaskan"}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <ApprovalDecisionBadge decision={s.decision} />
                    {s.decidedAt ? (
                      <span className="text-xs text-gray-400">
                        {s.decidedBy?.name} · {formatDateTime(s.decidedAt)}
                      </span>
                    ) : null}
                  </span>
                  {s.note ? (
                    <p className="w-full text-xs text-gray-500">“{s.note}”</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {request.stockMovements.length > 0 ? (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
            Pergerakan stok
          </h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 font-medium">Barang</th>
                  <th className="px-3 py-2 font-medium">Tipe</th>
                  <th className="px-3 py-2 font-medium text-right">Jumlah</th>
                  <th className="px-3 py-2 font-medium text-right">Saldo akhir</th>
                  <th className="px-3 py-2 font-medium">Oleh</th>
                  <th className="px-3 py-2 font-medium">Waktu</th>
                </tr>
              </thead>
              <tbody>
                {request.stockMovements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                      <span className="font-mono text-xs text-gray-500">
                        {m.item.sku}
                      </span>{" "}
                      {m.item.name}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{m.type}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      -{m.quantity}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {m.balanceAfter}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {m.createdBy?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {formatDateTime(m.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
          Riwayat
        </h2>
        <ul className="flex flex-col gap-2 text-sm">
          {request.activities.map((a) => (
            <li key={a.id} className="flex gap-3">
              <span className="w-32 shrink-0 text-xs text-gray-400">
                {formatDateTime(a.createdAt)}
              </span>
              <span className="text-gray-700 dark:text-gray-300">
                <span className="font-medium">{a.action}</span>
                {a.fromStatus && a.toStatus
                  ? ` · ${a.fromStatus} → ${a.toStatus}`
                  : a.toStatus
                    ? ` · ${a.toStatus}`
                    : ""}
                {a.actor ? ` · ${a.actor.name}` : ""}
                {a.note ? ` — ${a.note}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Meta({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-gray-800 dark:text-gray-200">{children}</div>
    </div>
  );
}
