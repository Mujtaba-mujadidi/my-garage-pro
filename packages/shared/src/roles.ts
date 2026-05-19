export const USER_ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "MECHANIC",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const GARAGE_ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type GarageAccountStatus = (typeof GARAGE_ACCOUNT_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
