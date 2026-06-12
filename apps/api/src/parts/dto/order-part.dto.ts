import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class OrderPartDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  supplierRef?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  partNumber?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID()
  repairTaskId?: string;

  @IsOptional()
  @IsUUID()
  bodyworkTaskId?: string;
}
