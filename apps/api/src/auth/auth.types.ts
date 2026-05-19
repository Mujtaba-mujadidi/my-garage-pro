import type { ModuleKey, Permission, UserRole } from "@mygaragepro/shared";

export type JwtPayload = {
  sub: string;
  email: string;
  role: UserRole;
  garageAccountId: string | null;
};

export type RequestUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  garageAccountId: string | null;
  permissions: Permission[];
  enabledModules: ModuleKey[];
};
