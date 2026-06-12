import { RepairTaskStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { CreateRepairTaskTyreDto } from "./create-repair-task-tyre.dto";
import { RepairTaskPartDto } from "./repair-task-part.dto";

export class UpdateRepairTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsEnum(RepairTaskStatus)
  status?: RepairTaskStatus;

  @IsOptional()
  @IsUUID()
  assigneeId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amountNet?: number;

  @IsOptional()
  @IsBoolean()
  useBreakdown?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  labourHours?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  labourRateNet?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RepairTaskPartDto)
  parts?: RepairTaskPartDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateRepairTaskTyreDto)
  tyre?: CreateRepairTaskTyreDto;
}
