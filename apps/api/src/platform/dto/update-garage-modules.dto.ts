import { IsArray } from "class-validator";
import type { ModuleKey } from "@mygaragepro/shared";

export class UpdateGarageModulesDto {
  @IsArray()
  enabledModules!: ModuleKey[];
}
