import type { ModuleKey } from "./modules";
import type { UserRole } from "./roles";
import type { Permission } from "./permissions";

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  garageAccountId: string | null;
  garageRoleId: string | null;
  garageRoleName: string | null;
  /** True when the user must set a new password before using the app. */
  mustChangePassword: boolean;
};

export type AuthGarageDto = {
  id: string;
  name: string;
  slug: string;
  /** Set when the garage is VAT-registered; required to charge VAT on jobs and invoices. */
  vatNumber: string | null;
} | null;

export type AuthSessionDto = {
  accessToken: string;
  user: AuthUserDto;
  garage: AuthGarageDto;
  enabledModules: ModuleKey[];
  permissions: Permission[];
};

export type LoginRequestDto = {
  email: string;
  password: string;
};

export type ChangePasswordRequestDto = {
  currentPassword: string;
  newPassword: string;
};

export type ResetGarageOwnerPasswordRequestDto = {
  tempPassword: string;
};

export type ResetGarageOwnerPasswordResponseDto = {
  ok: true;
  ownerEmail: string;
};

export type CreateGarageRequestDto = {
  name: string;
  slug: string;
  directorOwnerName: string;
  address: string;
  contactNumber: string;
  phoneNumber: string;
  vatNumber?: string;
  ownerEmail: string;
  tempPassword: string;
  enabledModules?: ModuleKey[];
};

export type UpdateGarageRequestDto = {
  name: string;
  slug: string;
  directorOwnerName: string;
  address: string;
  contactNumber: string;
  phoneNumber: string;
  vatNumber?: string;
  ownerEmail?: string;
};

export type SettingOptionDto = {
  id: string;
  optionType: string;
  label: string;
  value: string;
  sortOrder: number;
};

export type GarageAccountDto = {
  id: string;
  name: string;
  slug: string;
  directorOwnerName: string;
  address: string;
  contactNumber: string;
  phoneNumber: string;
  vatNumber: string | null;
  status: string;
  enabledModules: ModuleKey[];
  createdAt: string;
  ownerEmail?: string | null;
};

export type AuditLogDto = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  userEmail: string | null;
  garageName: string | null;
  createdAt: string;
};

export type TeamUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: string;
  garageRoleId: string | null;
  garageRoleName: string | null;
};
