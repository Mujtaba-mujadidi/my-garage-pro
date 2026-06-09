import { RepairJobSource } from "@prisma/client";
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

export class CreateRepairJobDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsEnum(RepairJobSource)
  source?: RepairJobSource;

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
