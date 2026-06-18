import {
  MODULE_DESCRIPTIONS,
  MODULE_KEYS,
  MODULE_LABELS,
  SIDEBAR_MODULE_ORDER,
  type ModuleKey,
} from "./modules";
import type { Permission } from "./permissions";

/** Core permissions not tied to a product module toggle. */
export const CORE_GARAGE_PERMISSIONS = [
  "settings.read",
  "settings.write",
  "users.read",
  "users.write",
  "permissions.manage",
] as const satisfies readonly Permission[];

const MODULE_CRUD_PERMISSIONS = MODULE_KEYS.flatMap(
  (key) => [`${key}.read`, `${key}.write`] as const,
);

/** All permissions assignable per garage role (excludes platform-only). */
export const GARAGE_PERMISSIONS = [
  ...CORE_GARAGE_PERMISSIONS,
  ...MODULE_CRUD_PERMISSIONS,
  "repair.work",
  "bodywork.work",
] as const satisfies readonly Permission[];

export type GaragePermission = (typeof GARAGE_PERMISSIONS)[number];

export type PermissionGroup = {
  id: string;
  label: string;
  description: string;
  read: GaragePermission;
  write: GaragePermission | null;
};

/** Always shown in the role editor (not gated by module toggles). */
export const CORE_PERMISSION_GROUPS: PermissionGroup[] = [
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
];

/** Optional UI overrides for module permission groups. */
const MODULE_GROUP_UI: Partial<
  Record<ModuleKey, { id?: string; label?: string; description?: string }>
> = {
  ledger: {
    id: "finance",
    label: "Finance",
    description: "Ledger, accounts, and banking",
  },
};

function modulePermissionGroup(moduleKey: ModuleKey): PermissionGroup {
  const ui = MODULE_GROUP_UI[moduleKey];
  return {
    id: ui?.id ?? moduleKey,
    label: ui?.label ?? MODULE_LABELS[moduleKey],
    description: ui?.description ?? MODULE_DESCRIPTIONS[moduleKey],
    read: `${moduleKey}.read` as GaragePermission,
    write: `${moduleKey}.write` as GaragePermission,
  };
}

/** All groups when every module is enabled (tests / reference). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  ...CORE_PERMISSION_GROUPS,
  ...SIDEBAR_MODULE_ORDER.map(modulePermissionGroup),
];

/** @deprecated Use permissionGroupsForGarage — maps legacy group id to module. */
export const PERMISSION_GROUP_MODULE: Partial<Record<string, ModuleKey>> = {
  customers: "customers",
  suppliers: "suppliers",
  finance: "ledger",
  partners: "partners",
};

/** Module gate per assignable permission (core permissions have no entry). */
export const PERMISSION_MODULE: Partial<Record<GaragePermission, ModuleKey>> =
  Object.fromEntries(
    MODULE_KEYS.flatMap((key) => [
      [`${key}.read`, key],
      [`${key}.write`, key],
    ]),
  ) as Partial<Record<GaragePermission, ModuleKey>>;

/** Role-editor groups for a garage: core + one row per enabled module (sidebar order). */
export function permissionGroupsForGarage(
  enabledModules: readonly ModuleKey[],
): PermissionGroup[] {
  const groups: PermissionGroup[] = [...CORE_PERMISSION_GROUPS];
  for (const key of SIDEBAR_MODULE_ORDER) {
    if (enabledModules.includes(key)) {
      groups.push(modulePermissionGroup(key));
    }
  }
  return groups;
}

export function garagePermissionsForGarage(
  enabledModules: readonly ModuleKey[],
): GaragePermission[] {
  return GARAGE_PERMISSIONS.filter((permission) => {
    const moduleKey = PERMISSION_MODULE[permission as GaragePermission];
    return moduleKey === undefined || enabledModules.includes(moduleKey);
  });
}

export function filterGaragePermissions(
  permissions: readonly GaragePermission[],
  enabledModules: readonly ModuleKey[],
): GaragePermission[] {
  const allowed = new Set(garagePermissionsForGarage(enabledModules));
  return permissions.filter((p) => allowed.has(p));
}

export type RoleAccessLevel = "none" | "view" | "full";

export function roleAccessLevelForGroup(
  group: PermissionGroup,
  permissions: readonly GaragePermission[],
): RoleAccessLevel {
  if (group.write && permissions.includes(group.write)) return "full";
  if (permissions.includes(group.read)) return "view";
  if (
    (group.id === "repair" || group.id === "bodywork") &&
    permissions.includes(`${group.id}.work` as GaragePermission)
  ) {
    return "view";
  }
  return "none";
}

/** Human-readable access summary for the roles table (counts modules, not raw permission strings). */
export function summarizeRoleAccess(
  permissions: readonly GaragePermission[],
  groups: readonly PermissionGroup[],
): string {
  const withAccess = groups
    .map((g) => roleAccessLevelForGroup(g, permissions))
    .filter((level) => level !== "none");

  if (withAccess.length === 0) return "No access";
  if (withAccess.length >= groups.length) return "Broad access";

  const full = withAccess.filter((l) => l === "full").length;
  const view = withAccess.filter((l) => l === "view").length;

  const parts: string[] = [];
  if (full > 0) parts.push(`${full} full`);
  if (view > 0) parts.push(`${view} view-only`);
  return parts.join(", ");
}

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
      "suppliers.read",
      "suppliers.write",
      "ledger.read",
      "ledger.write",
      "invoices.read",
      "invoices.write",
      "repair.read",
      "repair.write",
      "bodywork.read",
      "bodywork.write",
      "parts.read",
      "parts.write",
      "tyres.read",
      "tyres.write",
      "pco.read",
      "pco.write",
      "partners.read",
    ],
  },
  {
    slug: "mechanic",
    name: "Mechanic",
    permissions: ["repair.read", "repair.work", "bodywork.read", "bodywork.work"],
  },
  {
    slug: "staff",
    name: "Staff",
    permissions: [
      "settings.read",
      "customers.read",
      "suppliers.read",
      "ledger.read",
      "ledger.write",
      "invoices.read",
      "invoices.write",
      "repair.read",
      "repair.write",
      "bodywork.read",
      "bodywork.write",
      "parts.read",
      "parts.write",
      "tyres.read",
      "tyres.write",
      "pco.read",
      "pco.write",
      "partners.read",
    ],
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
  enabledModules: ModuleKey[];
};
