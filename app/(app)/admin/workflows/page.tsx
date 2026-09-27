import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/generated/prisma";
import { rupiah } from "@/lib/format";
import { Disclosure, Flash, Labeled, flashFrom, inputCls } from "../_ui";
import { addStage, deleteStage, saveWorkflow } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Workflow · Admin" };

const APPROVER_ROLES = [Role.MANAGER, Role.FINANCE, Role.DIRECTOR];

export default async function AdminWorkflowsPage({
  searchParams,
}: PageProps<"/admin/workflows">) {
  await requirePermission("workflow:manage");
  const flash = flashFrom(await searchParams);

  const [workflows, approvers] = await Promise.all([
    prisma.approvalWorkflow.findMany({
      orderBy: { minAmount: "asc" },
      include: {
        stages: {
          orderBy: { sequence: "asc" },
          include: { approver: { select: { name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { isActive: true, role: { in: APPROVER_ROLES } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const approverOptions = [
    <option key="" value="">
      — otomatis (berdasar peran) —
    </option>,
    ...approvers.map((a) => (
      <option key={a.id} value={a.id}>
        {a.name} ({a.role})
      </option>
    )),
  ];

  return (
    <div className="flex flex-col gap-6">
      <Flash {...flash} />

      <Disclosure summary="+ Tambah workflow">
        <form action={saveWorkflow} className="flex flex-wrap items-end gap-3">
          <Labeled label="Nama">
            <input name="name" required className={`${inputCls} w-44`} />
          </Labeled>
          <Labeled label="Nilai min (Rp)">
            <input
              name="minAmount"
              type="number"
              min={0}
              defaultValue={0}
              className={`${inputCls} w-36`}
            />
          </Labeled>
          <Labeled label="Nilai maks (kosong = tak terbatas)">
            <input
              name="maxAmount"
              type="number"
              min={0}
              className={`${inputCls} w-52`}
            />
          </Labeled>
          <Labeled label="Deskripsi">
            <input name="description" className={`${inputCls} w-56`} />
          </Labeled>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked /> Aktif
          </label>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
          >
            Simpan
          </button>
        </form>
      </Disclosure>

      <div className="flex flex-col gap-4">
        {workflows.map((w) => (
          <div
            key={w.id}
            className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {w.name}{" "}
                  {!w.isActive ? (
                    <span className="text-xs font-normal text-gray-400">
                      (nonaktif)
                    </span>
                  ) : null}
                </h2>
                <p className="text-xs text-gray-500">
                  {rupiah(Number(w.minAmount))} –{" "}
                  {w.maxAmount == null
                    ? "∞"
                    : rupiah(Number(w.maxAmount))}
                  {w.description ? ` · ${w.description}` : ""}
                </p>
              </div>
            </div>

            <ol className="mt-3 flex flex-col gap-1.5 text-sm">
              {w.stages.length === 0 ? (
                <li className="text-xs text-gray-400">Belum ada tahap.</li>
              ) : (
                w.stages.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 px-2 py-1.5 dark:border-gray-800"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-xs dark:bg-gray-700">
                      {s.sequence}
                    </span>
                    <span className="text-gray-800 dark:text-gray-200">
                      {s.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {s.approverRole}
                      {s.approver ? ` · ${s.approver.name}` : " · otomatis"}
                    </span>
                    <form action={deleteStage} className="ml-auto">
                      <input type="hidden" name="stageId" value={s.id} />
                      <button
                        type="submit"
                        className="text-xs text-red-600 hover:underline dark:text-red-400"
                      >
                        hapus
                      </button>
                    </form>
                  </li>
                ))
              )}
            </ol>

            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                + Tambah tahap
              </summary>
              <form
                action={addStage}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="workflowId" value={w.id} />
                <Labeled label="Urutan">
                  <input
                    name="sequence"
                    type="number"
                    min={1}
                    defaultValue={w.stages.length + 1}
                    className={`${inputCls} w-20`}
                  />
                </Labeled>
                <Labeled label="Nama tahap">
                  <input name="name" required className={`${inputCls} w-44`} />
                </Labeled>
                <Labeled label="Peran approver">
                  <select
                    name="approverRole"
                    defaultValue="MANAGER"
                    className={`${inputCls} w-36`}
                  >
                    {APPROVER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </Labeled>
                <Labeled label="Approver spesifik (opsional)">
                  <select
                    name="approverId"
                    defaultValue=""
                    className={`${inputCls} w-56`}
                  >
                    {approverOptions}
                  </select>
                </Labeled>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                >
                  Tambah
                </button>
              </form>
            </details>

            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                Ubah workflow
              </summary>
              <form
                action={saveWorkflow}
                className="mt-2 flex flex-wrap items-end gap-2"
              >
                <input type="hidden" name="id" value={w.id} />
                <input
                  name="name"
                  defaultValue={w.name}
                  className={`${inputCls} w-40`}
                />
                <input
                  name="minAmount"
                  type="number"
                  min={0}
                  defaultValue={Number(w.minAmount)}
                  className={`${inputCls} w-32`}
                />
                <input
                  name="maxAmount"
                  type="number"
                  min={0}
                  defaultValue={w.maxAmount == null ? "" : Number(w.maxAmount)}
                  placeholder="∞"
                  className={`${inputCls} w-32`}
                />
                <input
                  name="description"
                  defaultValue={w.description ?? ""}
                  className={`${inputCls} w-52`}
                />
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    name="isActive"
                    defaultChecked={w.isActive}
                  />{" "}
                  Aktif
                </label>
                <button
                  type="submit"
                  className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                >
                  Simpan
                </button>
              </form>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
