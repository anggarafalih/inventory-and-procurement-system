import { ApprovalDecision, RequestStatus } from "@/lib/generated/prisma";

const REQUEST_STATUS_META: Record<
  RequestStatus,
  { label: string; cls: string }
> = {
  DRAFT: {
    label: "Draf",
    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  SUBMITTED: {
    label: "Diajukan",
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  IN_REVIEW: {
    label: "Direview",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  APPROVED: {
    label: "Disetujui",
    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  REJECTED: {
    label: "Ditolak",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  CANCELLED: {
    label: "Dibatalkan",
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
  FULFILLED: {
    label: "Dipenuhi",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
};

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  const m = REQUEST_STATUS_META[status];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}

const DECISION_META: Record<ApprovalDecision, { label: string; cls: string }> = {
  PENDING: {
    label: "Menunggu",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  APPROVED: {
    label: "Disetujui",
    cls: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  REJECTED: {
    label: "Ditolak",
    cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  SKIPPED: {
    label: "Dilewati",
    cls: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
  },
};

export function ApprovalDecisionBadge({
  decision,
}: {
  decision: ApprovalDecision;
}) {
  const m = DECISION_META[decision];
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
