import { BodyworkJobSource } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateBodyworkJobDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsEnum(BodyworkJobSource)
  source?: BodyworkJobSource;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  vehicleRegistration!: string;

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
