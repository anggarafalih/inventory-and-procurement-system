import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";

export default async function AdminLayout({
  children,
}: LayoutProps<"/admin">) {
  const user = await requireUser();

  const sections = [
    { href: "/admin/items", label: "Barang", show: can(user.role, "catalog:manage") },
    {
      href: "/admin/categories",
      label: "Kategori",
      show: can(user.role, "catalog:manage"),
    },
    { href: "/admin/users", label: "Pengguna", show: can(user.role, "user:manage") },
    {
      href: "/admin/workflows",
      label: "Workflow",
      show: can(user.role, "workflow:manage"),
    },
  ].filter((s) => s.show);

  if (sections.length === 0) redirect("/dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Administrasi
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Kelola data master: barang, kategori, pengguna, dan workflow approval.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-md border border-gray-300 px-3 py-1.5 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
          >
            {s.label}
          </Link>
        ))}
      </nav>

      <div>{children}</div>
    </div>
  );
}
