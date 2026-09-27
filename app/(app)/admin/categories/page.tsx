import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Disclosure, Flash, Labeled, flashFrom, inputCls } from "../_ui";
import { saveCategory } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Kategori · Admin" };

export default async function AdminCategoriesPage({
  searchParams,
}: PageProps<"/admin/categories">) {
  await requirePermission("catalog:manage");
  const flash = flashFrom(await searchParams);

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      parent: { select: { name: true } },
      _count: { select: { items: true, children: true } },
    },
  });

  const parentOptions = [
    <option key="" value="">
      — tanpa induk —
    </option>,
    ...categories.map((c) => (
      <option key={c.id} value={c.id}>
        {c.name}
      </option>
    )),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Flash {...flash} />

      <Disclosure summary="+ Tambah kategori">
        <form action={saveCategory} className="flex flex-wrap items-end gap-3">
          <Labeled label="Nama">
            <input name="name" required className={`${inputCls} w-56`} />
          </Labeled>
          <Labeled label="Induk (opsional)">
            <select name="parentId" defaultValue="" className={`${inputCls} w-56`}>
              {parentOptions}
            </select>
          </Labeled>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
          >
            Simpan
          </button>
        </form>
      </Disclosure>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Induk</th>
              <th className="px-3 py-2 font-medium text-right">Sub</th>
              <th className="px-3 py-2 font-medium text-right">Barang</th>
              <th className="px-3 py-2 font-medium">Ubah</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((c) => (
              <tr
                key={c.id}
                className="border-t border-gray-100 align-top dark:border-gray-800"
              >
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  {c.name}
                </td>
                <td className="px-3 py-2 text-gray-500">
                  {c.parent?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                  {c._count.children}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                  {c._count.items}
                </td>
                <td className="px-3 py-2">
                  <details>
                    <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                      Ubah
                    </summary>
                    <form
                      action={saveCategory}
                      className="mt-2 flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        name="name"
                        defaultValue={c.name}
                        className={`${inputCls} w-48`}
                      />
                      <select
                        name="parentId"
                        defaultValue={c.parentId ?? ""}
                        className={`${inputCls} w-48`}
                      >
                        {parentOptions}
                      </select>
                      <button
                        type="submit"
                        className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                      >
                        Simpan
                      </button>
                    </form>
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
