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
