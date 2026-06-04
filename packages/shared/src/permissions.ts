import type { ModuleKey } from "./modules";
import type { UserRole } from "./roles";

export type ModuleCrudPermission = `${ModuleKey}.read` | `${ModuleKey}.write`;

export type Permission =
  | "platform.garage.manage"
  | "platform.audit.read"
  | "settings.read"
  | "settings.write"
  | "users.read"
  | "users.write"
  | "permissions.manage"
  | ModuleCrudPermission;

/** Super Admin only — not stored per garage. */
const SUPER_ADMIN_PERMISSIONS: Permission[] = [
  "platform.garage.manage",
  "platform.audit.read",
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
  "permissions.manage",
  "customers.read",
  "customers.write",
  "suppliers.read",
  "suppliers.write",
  "repair.read",
  "repair.write",
  "bodywork.read",
  "bodywork.write",
  "tyres.read",
  "tyres.write",
  "parts.read",
  "parts.write",
  "invoices.read",
  "invoices.write",
  "ledger.read",
  "ledger.write",
  "used_cars.read",
  "used_cars.write",
  "rental.read",
  "rental.write",
  "pco.read",
  "pco.write",
  "partners.read",
  "partners.write",
  "reports.read",
  "reports.write",
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
