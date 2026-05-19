export declare const USER_ROLES: readonly ["SUPER_ADMIN", "OWNER", "MANAGER", "MECHANIC", "ACCOUNTANT", "READ_ONLY"];
export type UserRole = (typeof USER_ROLES)[number];
export declare const GARAGE_ACCOUNT_STATUSES: readonly ["ACTIVE", "SUSPENDED"];
export type GarageAccountStatus = (typeof GARAGE_ACCOUNT_STATUSES)[number];
export declare const USER_STATUSES: readonly ["ACTIVE", "DISABLED"];
export type UserStatus = (typeof USER_STATUSES)[number];
