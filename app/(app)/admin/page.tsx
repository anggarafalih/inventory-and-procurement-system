import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { can } from "@/lib/rbac";

export default async function AdminIndexPage() {
  const user = await requireUser();
  if (can(user.role, "catalog:manage")) redirect("/admin/items");
  if (can(user.role, "user:manage")) redirect("/admin/users");
  if (can(user.role, "workflow:manage")) redirect("/admin/workflows");
  redirect("/dashboard");
}
