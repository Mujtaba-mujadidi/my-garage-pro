export const APP_NAME = "MyGaragePro";

export type AppEnv = "development" | "staging" | "production";

export function getAppEnv(): AppEnv {
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
  if (env === "production") return "production";
  if (env === "staging") return "staging";
  return "development";
}

export * from "./roles";
export * from "./modules";
export * from "./permissions";
export * from "./permission-matrix";
export * from "./workshop-access";
export * from "./auth-types";
export * from "./customer-types";
export * from "./supplier-types";
export * from "./ledger-types";
export * from "./vat";
export * from "./invoice-types";
export * from "./invoice-totals";
export * from "./job-quote-approval";
export * from "./repair-types";
export * from "./bodywork-types";
export * from "./part-fitment";
export * from "./part-types";
export * from "./tyre-types";
export * from "./pco-types";
export * from "./format-date";
