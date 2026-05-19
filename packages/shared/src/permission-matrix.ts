import type { UserRole } from "./roles";
import type { Permission } from "./permissions";

/** Roles the garage owner can configure (not Super Admin or Owner). */
export const CONFIGURABLE_ROLES = [
  "MANAGER",
  "MECHANIC",
  "ACCOUNTANT",
  "READ_ONLY",
] as const satisfies readonly UserRole[];

export type ConfigurableRole = (typeof CONFIGURABLE_ROLES)[number];

/** All permissions assignable per garage (excludes platform-only). */
export const GARAGE_PERMISSIONS = [
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
  "permissions.manage",
  "customers.read",
  "customers.write",
  "ledger.read",
  "ledger.write",
  "partners.read",
  "partners.write",
] as const satisfies readonly Permission[];

export type GaragePermission = (typeof GARAGE_PERMISSIONS)[number];

export type PermissionGroup = {
  id: string;
  label: string;
  description: string;
  read: GaragePermission;
  write: GaragePermission | null;
};

/** UI groups for the owner permission matrix. */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "settings",
    label: "Settings",
    description: "Garage settings and configuration",
    read: "settings.read",
    write: "settings.write",
  },
  {
    id: "team",
    label: "Team users",
    description: "Invite and manage staff accounts",
    read: "users.read",
    write: "users.write",
  },
  {
    id: "customers",
    label: "Customers",
    description: "Customer and vehicle records",
    read: "customers.read",
    write: "customers.write",
  },
  {
    id: "finance",
    label: "Finance",
    description: "Ledger, accounts, and partner finances",
    read: "ledger.read",
    write: "ledger.write",
  },
  {
    id: "partners",
    label: "Partners",
    description: "Partner capital and profit share",
    read: "partners.read",
    write: "partners.write",
  },
];

/** Default grants when a garage is created or permissions are reset. */
export const DEFAULT_ROLE_PERMISSIONS: Record<ConfigurableRole, GaragePermission[]> = {
  MANAGER: [
    "settings.read",
    "settings.write",
    "users.read",
    "customers.read",
    "customers.write",
    "ledger.read",
    "partners.read",
  ],
  MECHANIC: [],
  ACCOUNTANT: ["settings.read", "customers.read", "ledger.read", "partners.read"],
  READ_ONLY: ["settings.read", "customers.read", "ledger.read", "partners.read"],
};

export function allGaragePermissionsForOwner(): GaragePermission[] {
  return [...GARAGE_PERMISSIONS];
}

export type RolePermissionMatrixDto = {
  roles: ConfigurableRole[];
  groups: PermissionGroup[];
  grants: Record<ConfigurableRole, GaragePermission[]>;
};
