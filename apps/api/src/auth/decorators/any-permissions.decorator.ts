import { SetMetadata } from "@nestjs/common";
import type { Permission } from "@mygaragepro/shared";

export const ANY_PERMISSIONS_KEY = "any_permissions";
export const RequireAnyPermissions = (...permissions: Permission[]) =>
  SetMetadata(ANY_PERMISSIONS_KEY, permissions);
