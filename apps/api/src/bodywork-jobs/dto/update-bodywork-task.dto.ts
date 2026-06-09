import { BodyworkTaskStatus } from "@prisma/client";
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
import { BodyworkTaskPartDto } from "./bodywork-task-part.dto";

export class UpdateBodyworkTaskDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  panel?: string;

  @IsOptional()
  @IsEnum(BodyworkTaskStatus)
  status?: BodyworkTaskStatus;

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
  @Type(() => BodyworkTaskPartDto)
  parts?: BodyworkTaskPartDto[];
}
