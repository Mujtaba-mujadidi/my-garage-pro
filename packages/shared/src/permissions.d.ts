import type { UserRole } from "./roles";
export type Permission = "platform.garage.manage" | "platform.audit.read" | "settings.read" | "settings.write" | "users.read" | "users.write" | "ledger.read" | "ledger.write" | "partners.read" | "partners.write";
export declare function roleHasPermission(role: UserRole, permission: Permission): boolean;
