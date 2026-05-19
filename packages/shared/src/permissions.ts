import type { UserRole } from "./roles";

export type Permission =
  | "platform.garage.manage"
  | "platform.audit.read"
  | "settings.read"
  | "settings.write"
  | "users.read"
  | "users.write"
  | "permissions.manage"
  | "customers.read"
  | "customers.write"
  | "ledger.read"
  | "ledger.write"
  | "partners.read"
  | "partners.write";

/** Super Admin only — not stored per garage. */
const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  "platform.garage.manage",
  "platform.audit.read",
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
];

/** Fallback when DB has no rows yet (e.g. before migration). */
export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  if (role === "SUPER_ADMIN") {
    return SUPER_ADMIN_PERMISSIONS.includes(permission);
  }
  return false;
}

export function superAdminPermissions(): Permission[] {
  return [...SUPER_ADMIN_PERMISSIONS];
}
