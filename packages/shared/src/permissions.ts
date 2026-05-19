import type { UserRole } from "./roles";

export type Permission =
  | "platform.garage.manage"
  | "platform.audit.read"
  | "settings.read"
  | "settings.write"
  | "users.read"
  | "users.write"
  | "ledger.read"
  | "ledger.write"
  | "partners.read"
  | "partners.write";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ["platform.garage.manage", "platform.audit.read", "settings.read", "settings.write", "users.read", "users.write"],
  OWNER: [
    "settings.read",
    "settings.write",
    "users.read",
    "users.write",
    "ledger.read",
    "ledger.write",
    "partners.read",
    "partners.write",
  ],
  MANAGER: ["settings.read", "settings.write", "users.read", "ledger.read", "partners.read"],
  MECHANIC: ["settings.read"],
  ACCOUNTANT: ["settings.read", "ledger.read"],
  READ_ONLY: ["settings.read", "ledger.read", "partners.read"],
};

export function roleHasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
