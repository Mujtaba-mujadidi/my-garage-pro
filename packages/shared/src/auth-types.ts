import type { ModuleKey } from "./modules";
import type { UserRole } from "./roles";
import type { Permission } from "./permissions";

export type AuthUserDto = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  garageAccountId: string | null;
};

export type AuthGarageDto = {
  id: string;
  name: string;
  slug: string;
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
  status: string;
  enabledModules: ModuleKey[];
  createdAt: string;
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
