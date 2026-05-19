export declare const MODULE_KEYS: readonly ["customers", "suppliers", "repair", "bodywork", "tyres", "parts", "invoices", "ledger", "used_cars", "rental", "pco", "partners", "reports"];
export type ModuleKey = (typeof MODULE_KEYS)[number];
export declare const MODULE_LABELS: Record<ModuleKey, string>;
export declare const DEFAULT_ENABLED_MODULES: ModuleKey[];
