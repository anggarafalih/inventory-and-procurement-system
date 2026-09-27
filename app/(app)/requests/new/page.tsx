import type { Metadata } from "next";
import Link from "next/link";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { RequestForm } from "./request-form";

export const metadata: Metadata = { title: "Buat Permintaan · Mayora" };

export default async function NewRequestPage() {
  const user = await requirePermission("request:create");

  const [departments, items] = await Promise.all([
    prisma.department.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.item.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, sku: true, name: true, unit: true, unitPrice: true },
    }),
  ]);

  const canPickAnyDept = can(user.role, "request:read:any") || !user.departmentId;
  const lockedDepartment = canPickAnyDept
    ? null
    : (departments.find((d) => d.id === user.departmentId) ?? null);

  const catalog = items.map((i) => ({ ...i, unitPrice: Number(i.unitPrice) }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/requests"
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          ← Permintaan
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Buat Permintaan Barang
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Simpan sebagai draf dulu, atau langsung ajukan untuk masuk alur
          approval sesuai nilai permintaan.
        </p>
      </div>

      <RequestForm
        departments={departments}
        catalog={catalog}
        lockedDepartment={lockedDepartment}
      />
    </div>
  );
}
