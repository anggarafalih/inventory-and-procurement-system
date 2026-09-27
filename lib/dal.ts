import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSessionCookie } from "@/lib/session";
import { can, type Permission } from "@/lib/rbac";

/// Data Access Layer. Every server component / server action / route handler that
/// touches protected data goes through `getCurrentUser()` (or `requireUser`).
/// `cache()` dedupes the work within a single request render pass.

export const getSession = cache(async () => {
  return readSessionCookie();
});

export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session?.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      departmentId: true,
      department: { select: { id: true, name: true, code: true } },
    },
  });

  if (!user || !user.isActive) return null;
  return user;
});

export type CurrentUser = NonNullable<
  Awaited<ReturnType<typeof getCurrentUser>>
>;

/// Redirects to /login when there is no valid session. Use in protected pages.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/// Redirects to /login when unauthenticated, or /dashboard when the user lacks
/// the permission. Use for role-gated pages.
export async function requirePermission(
  permission: Permission,
): Promise<CurrentUser> {
  const user = await requireUser();
  if (!can(user.role, permission)) redirect("/dashboard");
  return user;
}
