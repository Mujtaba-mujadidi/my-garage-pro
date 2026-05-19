import type { Permission } from "./permissions";

/** All permissions assignable per garage role (excludes platform-only). */
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

/** UI groups for the permission editor modal. */
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

export type DefaultGarageRoleSlug = "manager" | "mechanic" | "staff";

export type DefaultGarageRoleTemplate = {
  slug: DefaultGarageRoleSlug;
  name: string;
  permissions: GaragePermission[];
};

/** Seeded when a garage is created. Owner can add more roles later. */
export const DEFAULT_GARAGE_ROLES: DefaultGarageRoleTemplate[] = [
  {
    slug: "manager",
    name: "Manager",
    permissions: [
      "settings.read",
      "settings.write",
      "users.read",
      "customers.read",
      "customers.write",
      "ledger.read",
      "partners.read",
    ],
  },
  {
    slug: "mechanic",
    name: "Mechanic",
    permissions: [],
  },
  {
    slug: "staff",
    name: "Staff",
    permissions: ["settings.read", "customers.read", "ledger.read", "partners.read"],
  },
];

export function allGaragePermissionsForOwner(): GaragePermission[] {
  return [...GARAGE_PERMISSIONS];
}

export type GarageRoleDto = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  userCount: number;
  permissions: GaragePermission[];
};

export type GarageRoleDetailDto = GarageRoleDto & {
  groups: PermissionGroup[];
};

export type GarageRoleListDto = {
  roles: GarageRoleDto[];
  groups: PermissionGroup[];
};
