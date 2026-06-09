import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class RepairTaskPartDto {
  @IsString()
  @MaxLength(500)
  description!: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPriceNet!: number;
}
