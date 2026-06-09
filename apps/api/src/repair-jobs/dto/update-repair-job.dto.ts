import { RepairJobSource } from "@prisma/client";
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateRepairJobDto {
  @IsOptional()
  @IsEnum(RepairJobSource)
  source?: RepairJobSource;

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
