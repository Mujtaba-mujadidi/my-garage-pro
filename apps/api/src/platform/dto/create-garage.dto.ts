import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from "class-validator";
import type { ModuleKey } from "@mygaragepro/shared";

export class CreateGarageDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsString()
  @MinLength(2)
  directorOwnerName!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsString()
  @MinLength(5)
  contactNumber!: string;

  @IsString()
  @MinLength(5)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsEmail()
  ownerEmail!: string;

  @IsString()
  @MinLength(8)
  tempPassword!: string;

  @IsOptional()
  @IsArray()
  enabledModules?: ModuleKey[];
}
