import { BodyworkJobSource } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateBodyworkJobDto {
  @IsOptional()
  @IsEnum(BodyworkJobSource)
  source?: BodyworkJobSource;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleRegistration?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleMake?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  vehicleModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customerConcern?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  panelCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  colourCode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  paintMaterialCostNet?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  outsourcedCostNet?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  vatEnabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRatePercent?: number;
}
