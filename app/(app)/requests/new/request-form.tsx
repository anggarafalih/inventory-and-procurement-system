"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { saveRequest, type SaveRequestState } from "@/app/actions/requests";
import { rupiah } from "@/lib/format";

interface Dept {
  id: string;
  name: string;
  code: string;
}
interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unitPrice: number;
}
interface Row {
  key: string;
  itemId: string;
  name: string;
  unit: string;
  quantity: string;
  unitPrice: string;
}

export interface RequestFormInitial {
  requestId: string;
  departmentId: string;
  purpose: string;
  neededBy: string | null;
  items: {
    itemId: string | null;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
  }[];
}

let seq = 0;
const emptyRow = (): Row => ({
  key: `r${seq++}`,
  itemId: "",
  name: "",
  unit: "pcs",
  quantity: "1",
  unitPrice: "0",
});

const inputCls =
  "w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:focus:border-gray-100";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700 dark:text-gray-300">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

export function RequestForm({
  departments,
  catalog,
  lockedDepartment,
  initial,
}: {
  departments: Dept[];
  catalog: CatalogItem[];
  lockedDepartment: Dept | null;
  initial?: RequestFormInitial;
}) {
  const [state, action, pending] = useActionState<
    SaveRequestState | undefined,
    FormData
  >(saveRequest, undefined);
  const [rows, setRows] = useState<Row[]>(
    initial && initial.items.length > 0
      ? initial.items.map((it) => ({
          key: `r${seq++}`,
          itemId: it.itemId ?? "",
          name: it.name,
          unit: it.unit,
          quantity: String(it.quantity),
          unitPrice: String(it.unitPrice),
        }))
      : [emptyRow()],
  );
  const editing = !!initial;

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const pickItem = (key: string, itemId: string) => {
    const it = catalog.find((c) => c.id === itemId);
    if (it) {
      update(key, {
        itemId,
        name: it.name,
        unit: it.unit,
        unitPrice: String(it.unitPrice),
      });
    } else {
      update(key, { itemId: "" });
    }
  };

  const total = useMemo(
    () =>
      rows.reduce(
        (s, r) => s + (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0),
        0,
      ),
    [rows],
  );

  const itemsPayload = JSON.stringify(
    rows.map((r) => ({
      itemId: r.itemId || null,
      name: r.name.trim(),
      description: null,
      quantity: Number(r.quantity) || 0,
      unit: r.unit.trim() || "pcs",
      unitPrice: Number(r.unitPrice) || 0,
    })),
  );

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="items" value={itemsPayload} />
      {editing ? (
        <input type="hidden" name="requestId" value={initial.requestId} />
      ) : null}

      {state?.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {lockedDepartment ? (
        <>
          <input
            type="hidden"
            name="departmentId"
            value={lockedDepartment.id}
          />
          <Field label="Departemen">
            <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
              {lockedDepartment.name} ({lockedDepartment.code})
            </div>
          </Field>
        </>
      ) : (
        <Field label="Departemen" error={state?.fieldErrors?.departmentId?.[0]}>
          <select
            name="departmentId"
            required
            defaultValue={initial?.departmentId ?? ""}
            className={inputCls}
          >
            <option value="" disabled>
              Pilih departemen
            </option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field
        label="Tujuan / justifikasi"
        error={state?.fieldErrors?.purpose?.[0]}
      >
        <textarea
          name="purpose"
          required
          minLength={5}
          rows={3}
          defaultValue={initial?.purpose ?? ""}
          placeholder="Contoh: penggantian 3 laptop tim developer yang sudah lambat."
          className={inputCls}
        />
      </Field>

      <Field label="Dibutuhkan sebelum (opsional)">
        <input
          type="date"
          name="neededBy"
          defaultValue={initial?.neededBy ?? ""}
          className={`${inputCls} sm:w-48`}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Daftar barang
          </h2>
          <button
            type="button"
            onClick={() => setRows((rs) => [...rs, emptyRow()])}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            + Tambah baris
          </button>
        </div>

        {state?.fieldErrors?.items?.[0] ? (
          <p className="text-xs text-red-600">{state.fieldErrors.items[0]}</p>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                <th className="px-2 py-2 font-medium">Dari katalog</th>
                <th className="px-2 py-2 font-medium">Nama barang</th>
                <th className="px-2 py-2 font-medium text-right">Qty</th>
                <th className="px-2 py-2 font-medium">Satuan</th>
                <th className="px-2 py-2 font-medium text-right">Harga satuan</th>
                <th className="px-2 py-2 font-medium text-right">Subtotal</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sub =
                  (Number(r.quantity) || 0) * (Number(r.unitPrice) || 0);
                return (
                  <tr
                    key={r.key}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-2 py-1.5">
                      <select
                        value={r.itemId}
                        onChange={(e) => pickItem(r.key, e.target.value)}
                        className={`${inputCls} min-w-40`}
                      >
                        <option value="">— barang bebas —</option>
                        {catalog.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.sku} · {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.name}
                        onChange={(e) =>
                          update(r.key, { name: e.target.value })
                        }
                        required
                        className={`${inputCls} min-w-44`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={1}
                        value={r.quantity}
                        onChange={(e) =>
                          update(r.key, { quantity: e.target.value })
                        }
                        className={`${inputCls} w-20 text-right`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        value={r.unit}
                        onChange={(e) =>
                          update(r.key, { unit: e.target.value })
                        }
                        className={`${inputCls} w-20`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={r.unitPrice}
                        onChange={(e) =>
                          update(r.key, { unitPrice: e.target.value })
                        }
                        className={`${inputCls} w-32 text-right`}
                      />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {rupiah(sub)}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setRows((rs) => rs.filter((x) => x.key !== r.key))
                          }
                          className="rounded px-2 py-1 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"
                          aria-label="Hapus baris"
                        >
                          ×
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="text-right text-sm">
          Estimasi total:{" "}
          <span className="font-semibold tabular-nums">{rupiah(total)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          name="mode"
          value="draft"
          disabled={pending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:hover:bg-gray-900"
        >
          {pending
            ? "Menyimpan…"
            : editing
              ? "Simpan perubahan"
              : "Simpan draf"}
        </button>
        <button
          type="submit"
          name="mode"
          value="submit"
          disabled={pending}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-gray-100 dark:text-gray-900"
        >
          {pending ? "Memproses…" : "Simpan & Ajukan"}
        </button>
        <Link
          href="/requests"
          className="ml-auto text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
        >
          Batal
        </Link>
      </div>
    </form>
  );
}
