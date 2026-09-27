import { Role } from "@/lib/generated/prisma";

export { Role };

/// Roles that can act as an approver in a workflow stage, highest tier last.
export const APPROVER_ROLES: Role[] = [Role.MANAGER, Role.FINANCE, Role.DIRECTOR];

/// Coarse-grained capabilities. Keep this list small and check it in the DAL /
/// server actions rather than sprinkling role string comparisons everywhere.
export type Permission =
  | "request:create"
  | "request:read:any" // read every request, not just own / to-approve
  | "request:approve" // record a decision on an assigned approval step
  | "request:fulfill" // mark an approved request as fulfilled + move stock
  | "catalog:manage" // items, categories, stock adjustments
  | "workflow:manage" // approval workflows & stages
  | "user:manage" // users & departments
  | "report:read";

const MATRIX: Record<Role, Permission[]> = {
  [Role.REQUESTER]: ["request:create"],
  [Role.MANAGER]: ["request:create", "request:approve", "report:read"],
  [Role.FINANCE]: ["request:create", "request:approve", "report:read"],
  [Role.DIRECTOR]: [
    "request:create",
    "request:approve",
    "request:read:any",
    "report:read",
  ],
  [Role.ADMIN]: [
    "request:create",
    "request:read:any",
    "request:approve",
    "request:fulfill",
    "catalog:manage",
    "workflow:manage",
    "user:manage",
    "report:read",
  ],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role]?.includes(permission) ?? false;
}

export function isApproverRole(role: Role): boolean {
  return APPROVER_ROLES.includes(role);
}
