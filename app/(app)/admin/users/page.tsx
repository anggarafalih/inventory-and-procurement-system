import type { Metadata } from "next";
import { requirePermission } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { Role } from "@/lib/generated/prisma";
import { Disclosure, Flash, Labeled, flashFrom, inputCls } from "../_ui";
import { resetUserPassword, saveUser } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Pengguna · Admin" };

export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  await requirePermission("user:manage");
  const flash = flashFrom(await searchParams);

  const [users, departments] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
      include: { department: { select: { name: true } } },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
  ]);

  const roleOptions = Object.values(Role).map((r) => (
    <option key={r} value={r}>
      {r}
    </option>
  ));
  const deptOptions = [
    <option key="" value="">
      — tanpa departemen —
    </option>,
    ...departments.map((d) => (
      <option key={d.id} value={d.id}>
        {d.name}
      </option>
    )),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Flash {...flash} />

      <Disclosure summary="+ Tambah pengguna">
        <form
          action={saveUser}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          <Labeled label="Email">
            <input name="email" type="email" required className={inputCls} />
          </Labeled>
          <Labeled label="Nama">
            <input name="name" required className={inputCls} />
          </Labeled>
          <Labeled label="Peran">
            <select name="role" defaultValue="REQUESTER" className={inputCls}>
              {roleOptions}
            </select>
          </Labeled>
          <Labeled label="Departemen">
            <select name="departmentId" defaultValue="" className={inputCls}>
              {deptOptions}
            </select>
          </Labeled>
          <Labeled label="Password awal (min. 8)">
            <input
              name="password"
              type="text"
              required
              minLength={8}
              className={inputCls}
            />
          </Labeled>
          <button
            type="submit"
            className="col-span-full w-fit rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white dark:bg-gray-100 dark:text-gray-900"
          >
            Buat
          </button>
        </form>
      </Disclosure>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-3 py-2 font-medium">Nama</th>
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Peran</th>
              <th className="px-3 py-2 font-medium">Departemen</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-t border-gray-100 align-top dark:border-gray-800"
              >
                <td className="px-3 py-2 text-gray-800 dark:text-gray-200">
                  {u.name}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-gray-500">
                  {u.email}
                </td>
                <td className="px-3 py-2 text-gray-500">{u.role}</td>
                <td className="px-3 py-2 text-gray-500">
                  {u.department?.name ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {u.isActive ? "Aktif" : "Nonaktif"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-col gap-2">
                    <details>
                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                        Ubah
                      </summary>
                      <form
                        action={saveUser}
                        className="mt-2 grid grid-cols-2 gap-2"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="name"
                          defaultValue={u.name}
                          className={inputCls}
                        />
                        <select
                          name="role"
                          defaultValue={u.role}
                          className={inputCls}
                        >
                          {roleOptions}
                        </select>
                        <select
                          name="departmentId"
                          defaultValue={u.departmentId ?? ""}
                          className={inputCls}
                        >
                          {deptOptions}
                        </select>
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            name="isActive"
                            defaultChecked={u.isActive}
                          />{" "}
                          Aktif
                        </label>
                        <button
                          type="submit"
                          className="col-span-2 w-fit rounded-md bg-gray-900 px-3 py-1 text-xs font-medium text-white dark:bg-gray-100 dark:text-gray-900"
                        >
                          Simpan
                        </button>
                      </form>
                    </details>

                    <details>
                      <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400">
                        Reset password
                      </summary>
                      <form
                        action={resetUserPassword}
                        className="mt-2 flex flex-wrap items-end gap-2"
                      >
                        <input type="hidden" name="id" value={u.id} />
                        <input
                          name="password"
                          type="text"
                          required
                          minLength={8}
                          placeholder="password baru"
                          className={`${inputCls} w-48`}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-700"
                        >
                          Reset
                        </button>
                      </form>
                    </details>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
