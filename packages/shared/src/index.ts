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
export * from "./auth-types";
export * from "./customer-types";
