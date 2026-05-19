import { IsObject } from "class-validator";
import type { ConfigurableRole, GaragePermission } from "@mygaragepro/shared";

export class UpdateRolePermissionsDto {
  @IsObject()
  grants!: Record<ConfigurableRole, GaragePermission[]>;
}
