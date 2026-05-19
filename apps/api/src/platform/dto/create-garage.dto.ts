import { IsArray, IsOptional, IsString, Matches, MinLength } from "class-validator";
import type { ModuleKey } from "@mygaragepro/shared";

export class CreateGarageDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsOptional()
  @IsArray()
  enabledModules?: ModuleKey[];
}
