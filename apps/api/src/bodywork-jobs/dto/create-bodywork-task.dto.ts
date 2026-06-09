import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { BodyworkTaskPartDto } from "./bodywork-task-part.dto";

export class CreateBodyworkTaskDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  panel?: string;

  @IsOptional()
  @IsUUID()
  assigneeId?: string;

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
