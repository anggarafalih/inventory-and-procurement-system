import "server-only";

import type { ReportFilter } from "@/lib/validation";
import {
  approvalCycleTimeByApprover,
  monthlyRequestTrend,
  pendingApprovalAging,
  requestsByDepartmentStatus,
  topRequestedItems,
} from "@/lib/reports/queries";

export interface ReportColumn {
  key: string;
  label: string;
  align?: "left" | "right";
  weight?: number;
}

export interface ReportDefinition {
  slug: string;
  title: string;
  description: string;
  columns: ReportColumn[];
  run: (filter: ReportFilter) => Promise<Record<string, unknown>[]>;
}

const num = { align: "right" as const };

export const REPORTS: Record<string, ReportDefinition> = {
  "requests-by-department": {
    slug: "requests-by-department",
    title: "Rekap Permintaan per Departemen",
    description:
      "Jumlah & nilai permintaan per departemen dengan rincian status.",
    columns: [
      { key: "departmentCode", label: "Kode", weight: 0.6 },
      { key: "departmentName", label: "Departemen", weight: 1.6 },
      { key: "totalRequests", label: "Total", ...num },
      { key: "submitted", label: "Submit", ...num },
      { key: "inReview", label: "Review", ...num },
      { key: "approved", label: "Setuju", ...num },
      { key: "rejected", label: "Tolak", ...num },
      { key: "fulfilled", label: "Selesai", ...num },
      { key: "estimatedValue", label: "Estimasi (Rp)", ...num, weight: 1.2 },
      { key: "approvedValue", label: "Disetujui (Rp)", ...num, weight: 1.2 },
    ],
    run: (f) => requestsByDepartmentStatus(f),
  },

  "approval-cycle-time": {
    slug: "approval-cycle-time",
    title: "Kinerja & Waktu Approval per Approver",
    description:
      "Jumlah keputusan dan rata-rata jam untuk memutuskan tiap approver.",
    columns: [
      { key: "approverName", label: "Approver", weight: 1.6 },
      { key: "role", label: "Peran", weight: 1 },
      { key: "decided", label: "Diputuskan", ...num },
      { key: "approved", label: "Disetujui", ...num },
      { key: "rejected", label: "Ditolak", ...num },
      { key: "pending", label: "Pending", ...num },
      { key: "avgHoursToDecide", label: "Rata2 jam", ...num },
    ],
    run: (f) => approvalCycleTimeByApprover(f),
  },

  "top-items": {
    slug: "top-items",
    title: "Barang Paling Banyak Diminta",
    description: "Peringkat barang berdasar kuantitas & nilai, dengan kategori.",
    columns: [
      { key: "itemName", label: "Barang", weight: 2 },
      { key: "sku", label: "SKU", weight: 1 },
      { key: "categoryName", label: "Kategori", weight: 1.2 },
      { key: "timesRequested", label: "Kali diminta", ...num },
      { key: "totalQuantity", label: "Total qty", ...num },
      { key: "totalValue", label: "Total nilai (Rp)", ...num, weight: 1.2 },
    ],
    run: (f) => topRequestedItems(f),
  },

  "monthly-trend": {
    slug: "monthly-trend",
    title: "Tren Permintaan Bulanan",
    description: "Volume & nilai permintaan yang disubmit per bulan.",
    columns: [
      { key: "month", label: "Bulan", weight: 1.2 },
      { key: "requests", label: "Permintaan", ...num },
      { key: "approved", label: "Disetujui", ...num },
      { key: "rejected", label: "Ditolak", ...num },
      { key: "estimatedValue", label: "Estimasi (Rp)", ...num, weight: 1.4 },
    ],
    run: (f) => monthlyRequestTrend(f),
  },

  "pending-aging": {
    slug: "pending-aging",
    title: "Aging Approval Tertunda",
    description: "Permintaan yang masih menunggu keputusan, dikelompokkan umur.",
    columns: [
      { key: "bucket", label: "Rentang umur", weight: 1.4 },
      { key: "requests", label: "Permintaan", ...num },
      { key: "value", label: "Nilai (Rp)", ...num, weight: 1.4 },
    ],
    run: () => pendingApprovalAging(),
  },
};

export function getReport(slug: string): ReportDefinition | undefined {
  return REPORTS[slug];
}
