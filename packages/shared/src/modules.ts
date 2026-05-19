import type { Permission } from "./permissions";

/** Module keys — Super Admin enables per garage (Phase 1: flags only). */
export const MODULE_KEYS = [
  "customers",
  "suppliers",
  "repair",
  "bodywork",
  "tyres",
  "parts",
  "invoices",
  "ledger",
  "used_cars",
  "rental",
  "pco",
  "partners",
  "reports",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export const MODULE_LABELS: Record<ModuleKey, string> = {
  customers: "Customers",
  suppliers: "Suppliers",
  repair: "Repair jobs",
  bodywork: "Bodywork",
  tyres: "Tyre stock",
  parts: "Parts stock",
  invoices: "Invoices",
  ledger: "Ledger",
  used_cars: "Used cars",
  rental: "Rental",
  pco: "PCO booking",
  partners: "Partners",
  reports: "Reports",
};

/** MVP defaults for a new garage (Phase 1 seed). */
export const DEFAULT_ENABLED_MODULES: ModuleKey[] = [
  "customers",
  "repair",
  "invoices",
  "ledger",
  "reports",
];

/** Short copy for Super Admin module toggles. */
export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  customers: "Customer and vehicle records",
  suppliers: "Supplier contacts and purchase orders",
  repair: "Workshop jobs and job cards",
  bodywork: "Bodyshop repairs and estimates",
  tyres: "Tyre stock and fitting",
  parts: "Parts inventory and ordering",
  invoices: "Sales and purchase invoicing",
  ledger: "Accounts, banks, and cash",
  used_cars: "Used vehicle stock and sales",
  rental: "Vehicle hire and bookings",
  pco: "Private-hire and PCO bookings",
  partners: "Partner capital and profit share",
  reports: "Business reports and dashboards",
};

/**
 * When set, the sidebar requires this permission (plus garage module enabled).
 * Modules without an entry are shown to all staff when the garage has enabled them.
 */
export const MODULE_NAV_READ_PERMISSION: Partial<Record<ModuleKey, Permission>> = {
  customers: "customers.read",
  ledger: "ledger.read",
  partners: "partners.read",
};

/** App route per module (must match Next.js pages). */
export const MODULE_PATHS: Record<ModuleKey, string> = {
  customers: "/customers",
  suppliers: "/suppliers",
  repair: "/repair",
  bodywork: "/bodywork",
  tyres: "/tyres",
  parts: "/parts",
  invoices: "/invoices",
  ledger: "/ledger",
  used_cars: "/used-cars",
  rental: "/rental",
  pco: "/pco",
  partners: "/partners",
  reports: "/reports",
};

/** Sidebar order for garage staff (dashboard is separate). */
export const SIDEBAR_MODULE_ORDER: ModuleKey[] = [
  "repair",
  "bodywork",
  "customers",
  "suppliers",
  "tyres",
  "parts",
  "invoices",
  "ledger",
  "used_cars",
  "rental",
  "pco",
  "partners",
  "reports",
];

export function moduleKeyFromSlug(slug: string): ModuleKey | null {
  const path = `/${slug}`;
  const entry = Object.entries(MODULE_PATHS).find(([, p]) => p === path);
  return entry ? (entry[0] as ModuleKey) : null;
}

export function moduleSlug(key: ModuleKey): string {
  return MODULE_PATHS[key].replace(/^\//, "");
}
