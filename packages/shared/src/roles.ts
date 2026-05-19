/** Platform / account-level roles stored on `users.role`. */
export const USER_ROLES = ["SUPER_ADMIN", "OWNER", "STAFF"] as const;

export type UserRole = (typeof USER_ROLES)[number];

/** @deprecated Legacy enum values — migrated to STAFF + garage role. */
export const LEGACY_STAFF_ROLES = [
  "MANAGER",
  "MECHANIC",
  "ACCOUNTANT",
  "READ_ONLY",
] as const;

export const GARAGE_ACCOUNT_STATUSES = ["ACTIVE", "SUSPENDED"] as const;
export type GarageAccountStatus = (typeof GARAGE_ACCOUNT_STATUSES)[number];

export const USER_STATUSES = ["ACTIVE", "DISABLED"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];
