import { MODULE_LABELS, type ModuleKey, type Permission } from "@mygaragepro/shared";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  moduleKey?: ModuleKey;
  permission?: Permission;
  superAdminOnly?: boolean;
  phaseLabel?: string;
};

export const MAIN_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/repair", label: MODULE_LABELS.repair, icon: "⚙", moduleKey: "repair", phaseLabel: "Phase 6" },
  { href: "/used-cars", label: MODULE_LABELS.used_cars, icon: "🚗", moduleKey: "used_cars", phaseLabel: "Phase 10" },
  { href: "/customers", label: MODULE_LABELS.customers, icon: "👤", moduleKey: "customers", phaseLabel: "Phase 2" },
  { href: "/invoices", label: MODULE_LABELS.invoices, icon: "📄", moduleKey: "invoices", phaseLabel: "Phase 5" },
  { href: "/ledger", label: MODULE_LABELS.ledger, icon: "£", moduleKey: "ledger", permission: "ledger.read", phaseLabel: "Phase 4" },
  { href: "/tyres", label: MODULE_LABELS.tyres, icon: "◎", moduleKey: "tyres", phaseLabel: "Phase 8" },
  { href: "/parts", label: MODULE_LABELS.parts, icon: "▣", moduleKey: "parts", phaseLabel: "Phase 7" },
  { href: "/rental", label: MODULE_LABELS.rental, icon: "🔑", moduleKey: "rental", phaseLabel: "Phase 12" },
  { href: "/pco", label: MODULE_LABELS.pco, icon: "🚕", moduleKey: "pco", phaseLabel: "Post-MVP" },
  { href: "/partners", label: MODULE_LABELS.partners, icon: "🤝", moduleKey: "partners", permission: "partners.read", phaseLabel: "Phase 11" },
  { href: "/reports", label: MODULE_LABELS.reports, icon: "📈", moduleKey: "reports", phaseLabel: "Phase 13" },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: "⚙", permission: "settings.read" },
  { href: "/users", label: "Team", icon: "👥", permission: "users.read" },
  { href: "/admin", label: "Super Admin", icon: "★", superAdminOnly: true },
];
