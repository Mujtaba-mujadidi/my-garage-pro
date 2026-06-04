import {
  MODULE_LABELS,
  MODULE_NAV_READ_PERMISSION,
  MODULE_PATHS,
  SIDEBAR_MODULE_ORDER,
  type ModuleKey,
  type Permission,
} from "@mygaragepro/shared";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  moduleKey?: ModuleKey;
  permission?: Permission;
  superAdminOnly?: boolean;
  phaseLabel?: string;
};

const MODULE_ICONS: Record<ModuleKey, string> = {
  customers: "👤",
  suppliers: "📦",
  repair: "⚙",
  bodywork: "🛠",
  tyres: "◎",
  parts: "▣",
  invoices: "📄",
  ledger: "£",
  used_cars: "🚗",
  rental: "🔑",
  pco: "🚕",
  partners: "🤝",
  reports: "📈",
};

const MODULE_PHASE_LABELS: Partial<Record<ModuleKey, string>> = {
  repair: "Phase 6",
  bodywork: "Phase 6",
  suppliers: "Phase 3",
  tyres: "Phase 8",
  parts: "Phase 7",
  invoices: "Phase 5",
  ledger: "Phase 4",
  used_cars: "Phase 10",
  rental: "Phase 12",
  pco: "Post-MVP",
  partners: "Phase 11",
  reports: "Phase 13",
};

function moduleNavItem(key: ModuleKey): NavItem {
  return {
    href: MODULE_PATHS[key],
    label: MODULE_LABELS[key],
    icon: MODULE_ICONS[key],
    moduleKey: key,
    permission: MODULE_NAV_READ_PERMISSION[key],
    phaseLabel: MODULE_PHASE_LABELS[key],
  };
}

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  ...SIDEBAR_MODULE_ORDER.map(moduleNavItem),
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: "⚙", permission: "settings.read" },
  { href: "/users", label: "Team", icon: "👥", permission: "users.read" },
  { href: "/admin", label: "Super Admin", icon: "★", superAdminOnly: true },
];

/** Module keys that use the shared `[module]` placeholder route (not a dedicated page). */
export const PLACEHOLDER_MODULE_KEYS = SIDEBAR_MODULE_ORDER.filter(
  (key) => !["customers", "suppliers", "ledger", "partners"].includes(key),
);
