import Link from "next/link";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { logout } from "@/app/actions/auth";

export default async function AppLayout({
  children,
}: LayoutProps<"/">) {
  const user = await requireUser();

  const nav = [
    { href: "/dashboard", label: "Dashboard", show: true },
    { href: "/requests", label: "Permintaan", show: true },
    {
      href: "/approvals",
      label: "Approval",
      show: can(user.role, "request:approve"),
    },
    { href: "/reports", label: "Laporan", show: can(user.role, "report:read") },
    {
      href: "/admin",
      label: "Admin",
      show:
        can(user.role, "catalog:manage") ||
        can(user.role, "user:manage") ||
        can(user.role, "workflow:manage"),
    },
  ].filter((n) => n.show);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <span className="font-semibold text-gray-900 dark:text-gray-100">
            Inventory&nbsp;/&nbsp;Request
          </span>
          <nav className="flex gap-4 text-sm">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">
              {user.name} · {user.role}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-900"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
