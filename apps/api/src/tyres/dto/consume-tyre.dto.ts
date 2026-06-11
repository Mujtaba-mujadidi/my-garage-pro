import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export class ConsumeTyreDto {
  @IsUUID("4")
  tyreId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID("4")
  repairTaskId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fittingChargeNet?: number;

  /** Override unit sell price ex VAT per tyre. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceNet?: number;
}
