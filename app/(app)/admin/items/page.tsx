import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { rupiah } from "@/lib/format";
import { Disclosure, Flash, Labeled, flashFrom, inputCls } from "../_ui";
import { adjustStock, saveItem } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Barang · Admin" };

export default async function AdminItemsPage({
  searchParams,
}: PageProps<"/admin/items">) {
  await requirePermission("catalog:manage");
  const flash = flashFrom(await searchParams);

  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const catOptions = categories.map((c) => (
    <option key={c.id} value={c.id}>
      {c.name}
    </option>
  ));

  return (
    <div className="flex flex-col gap-5">
      <Flash {...flash} />

      <Disclosure summary="+ Tambah barang">
        <form
          action={saveItem}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <Labeled label="SKU">
            <input name="sku" required className={inputCls} />
          </Labeled>
          <Labeled label="Nama">
            <input name="name" required className={inputCls} />
          </Labeled>
          <Labeled label="Kategori">
            <select name="categoryId" required defaultValue="" className={inputCls}>
              <option value="" disabled>
                Pilih…
              </option>
              {catOptions}
            </select>
          </Labeled>
          <Labeled label="Satuan">
            <input name="unit" defaultValue="pcs" className={inputCls} />
          </Labeled>
          <Labeled label="Harga satuan">
            <input
              name="unitPrice"
              type="number"
              min={0}
              step="0.01"
              defaultValue={0}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Stok minimum">
            <input
              name="minStock"
              type="number"
              min={0}
              defaultValue={0}
              className={inputCls}
            />
          </Labeled>
          <Labeled label="Deskripsi (opsional)">
            <input name="description" className={inputCls} />
          </Labeled>
          <label className="flex items-center gap-2 self-end text-sm">
            <input type="checkbox" name="isActive" defaultChecked /> Aktif
          </label>
          <button
            type="submit"
            className="col-span-full w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
          >
            Simpan
          </button>
        </form>
      </Disclosure>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-medium">SKU</th>
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Kategori</th>
              <th className="px-3 py-2 font-medium text-right">Harga</th>
              <th className="px-3 py-2 font-medium text-right">Stok</th>
              <th className="px-3 py-2 font-medium text-right">Min</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const low = it.stockQty <= it.minStock;
              return (
                <tr
                  key={it.id}
                  className="border-t border-gray-100 align-top dark:border-gray-800"
                >
                  <td className="px-3 py-2 font-mono text-xs">{it.sku}</td>
                  <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                    {it.name}
                  </td>
                  <td className="px-3 py-2 text-gray-500">
                    {it.category.name}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {rupiah(Number(it.unitPrice))}
                  </td>
                  <td
                    className={`px-3 py-2 text-right tabular-nums ${low ? "font-semibold text-red-600 dark:text-red-400" : ""}`}
                  >
                    {it.stockQty}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-500">
                    {it.minStock}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {it.isActive ? "Aktif" : "Nonaktif"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <details>
                        <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                          Ubah
                        </summary>
                        <form
                          action={saveItem}
                          className="mt-2 grid grid-cols-2 gap-2"
                        >
                          <input type="hidden" name="id" value={it.id} />
                          <input
                            name="sku"
                            defaultValue={it.sku}
                            className={inputCls}
                          />
                          <input
                            name="name"
                            defaultValue={it.name}
                            className={inputCls}
                          />
                          <select
                            name="categoryId"
                            defaultValue={it.categoryId}
                            className={inputCls}
                          >
                            {catOptions}
                          </select>
                          <input
                            name="unit"
                            defaultValue={it.unit}
                            className={inputCls}
                          />
                          <input
                            name="unitPrice"
                            type="number"
                            min={0}
                            step="0.01"
                            defaultValue={Number(it.unitPrice)}
                            className={inputCls}
                          />
                          <input
                            name="minStock"
                            type="number"
                            min={0}
                            defaultValue={it.minStock}
                            className={inputCls}
                          />
                          <label className="col-span-2 flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              name="isActive"
                              defaultChecked={it.isActive}
                            />{" "}
                            Aktif
                          </label>
                          <button
                            type="submit"
                            className="col-span-2 w-fit rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                          >
                            Simpan perubahan
                          </button>
                        </form>
                      </details>

                      <details>
                        <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                          Sesuaikan stok
                        </summary>
                        <form
                          action={adjustStock}
                          className="mt-2 flex flex-wrap items-end gap-2"
                        >
                          <input type="hidden" name="itemId" value={it.id} />
                          <Labeled label="Δ (+/−)">
                            <input
                              name="delta"
                              type="number"
                              required
                              placeholder="mis. -3"
                              className={`${inputCls} w-24`}
                            />
                          </Labeled>
                          <Labeled label="Catatan">
                            <input name="note" className={`${inputCls} w-40`} />
                          </Labeled>
                          <button
                            type="submit"
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700"
                          >
                            Terapkan
                          </button>
                        </form>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
