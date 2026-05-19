import { IsArray, IsOptional, IsString, MinLength } from "class-validator";
import type { GaragePermission } from "@mygaragepro/shared";

export class CreateGarageRoleDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsArray()
  permissions?: GaragePermission[];
}
