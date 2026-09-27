import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});
export type LoginInput = z.infer<typeof loginSchema>;

/// Line item on a new request. `itemId` links to the catalog when present;
/// `name` is always stored as a snapshot so history survives catalog edits.
export const requestItemInputSchema = z.object({
  itemId: z.cuid().optional().nullable(),
  name: z.string().min(1, "Nama barang wajib diisi").max(200),
  description: z.string().max(500).optional().nullable(),
  quantity: z.coerce.number().int().positive("Jumlah harus lebih dari 0"),
  unit: z.string().min(1).max(20).default("pcs"),
  unitPrice: z.coerce.number().nonnegative().default(0),
});
export type RequestItemInput = z.infer<typeof requestItemInputSchema>;

export const createRequestSchema = z.object({
  departmentId: z.cuid("Departemen tidak valid"),
  purpose: z.string().min(5, "Jelaskan tujuan permintaan (min. 5 karakter)").max(1000),
  neededBy: z.coerce.date().optional().nullable(),
  items: z.array(requestItemInputSchema).min(1, "Minimal satu barang"),
});
export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const approvalDecisionSchema = z.object({
  requestId: z.cuid(),
  stepId: z.cuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(1000).optional().nullable(),
});
export type ApprovalDecisionInput = z.infer<typeof approvalDecisionSchema>;

/// Query params shared by the reporting endpoints.
export const reportFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  departmentId: z.cuid().optional(),
  status: z
    .enum([
      "DRAFT",
      "SUBMITTED",
      "IN_REVIEW",
      "APPROVED",
      "REJECTED",
      "CANCELLED",
      "FULFILLED",
    ])
    .optional(),
});
export type ReportFilter = z.infer<typeof reportFilterSchema>;

// --- Admin: master data ---------------------------------------------------

const ROLE_VALUES = [
  "REQUESTER",
  "MANAGER",
  "FINANCE",
  "DIRECTOR",
  "ADMIN",
] as const;
const APPROVER_ROLE_VALUES = ["MANAGER", "FINANCE", "DIRECTOR"] as const;

export const itemSchema = z.object({
  id: z.cuid().optional(),
  sku: z
    .string()
    .trim()
    .min(2, "SKU minimal 2 karakter")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "SKU hanya huruf, angka, titik, strip"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(200),
  description: z.string().max(500).optional().nullable(),
  categoryId: z.cuid("Kategori tidak valid"),
  unit: z.string().trim().min(1).max(20).default("pcs"),
  unitPrice: z.coerce.number().nonnegative("Harga tidak boleh negatif").default(0),
  minStock: z.coerce.number().int().nonnegative().default(0),
  isActive: z.coerce.boolean().default(true),
});
export type ItemInput = z.infer<typeof itemSchema>;

export const stockAdjustSchema = z.object({
  itemId: z.cuid(),
  delta: z.coerce
    .number()
    .int("Harus bilangan bulat")
    .refine((n) => n !== 0, "Perubahan tidak boleh 0"),
  note: z.string().trim().max(300).optional().nullable(),
});

export const categorySchema = z.object({
  id: z.cuid().optional(),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  parentId: z.cuid().optional().nullable(),
});

export const userCreateSchema = z.object({
  email: z.email("Format email tidak valid"),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLE_VALUES),
  departmentId: z.cuid().optional().nullable(),
  password: z.string().min(8, "Password minimal 8 karakter").max(72),
});

export const userUpdateSchema = z.object({
  id: z.cuid(),
  name: z.string().trim().min(2).max(120),
  role: z.enum(ROLE_VALUES),
  departmentId: z.cuid().optional().nullable(),
  isActive: z.coerce.boolean().default(false),
});

export const workflowSchema = z.object({
  id: z.cuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional().nullable(),
  minAmount: z.coerce.number().nonnegative().default(0),
  maxAmount: z.coerce.number().positive().nullable().optional(),
  isActive: z.coerce.boolean().default(true),
});

export const stageSchema = z.object({
  workflowId: z.cuid(),
  sequence: z.coerce.number().int().positive("Urutan harus > 0"),
  name: z.string().trim().min(2).max(80),
  approverRole: z.enum(APPROVER_ROLE_VALUES),
  approverId: z.cuid().optional().nullable(),
});
