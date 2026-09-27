import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac";
import { RequestStatus } from "@/lib/generated/prisma";
import { RequestForm } from "../../new/request-form";

export const metadata: Metadata = { title: "Ubah Permintaan · Mayora" };

export default async function EditRequestPage({
  params,
}: PageProps<"/requests/[id]/edit">) {
  const user = await requireUser();
  const { id } = await params;

  const request = await prisma.request.findUnique({
    where: { id },
    include: { items: { orderBy: { id: "asc" } } },
  });
  if (!request) notFound();
  if (request.requesterId !== user.id) notFound();
  if (request.status !== RequestStatus.DRAFT) redirect(`/requests/${id}`);

  const [departments, catalogItems] = await Promise.all([
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/requests/${id}`}
          className="text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
        >
          ← {request.requestNo}
        </Link>
        <h1 className="mt-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
          Ubah Permintaan
        </h1>
      </div>

      <RequestForm
        departments={departments}
        catalog={catalogItems.map((i) => ({
          ...i,
          unitPrice: Number(i.unitPrice),
        }))}
        lockedDepartment={lockedDepartment}
        initial={{
          requestId: request.id,
          departmentId: request.departmentId,
          purpose: request.purpose,
          neededBy: request.neededBy
            ? request.neededBy.toISOString().slice(0, 10)
            : null,
          items: request.items.map((it) => ({
            itemId: it.itemId,
            name: it.name,
            unit: it.unit,
            quantity: it.quantity,
            unitPrice: Number(it.unitPrice),
          })),
        }}
      />
    </div>
  );
}
