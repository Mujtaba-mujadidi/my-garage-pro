import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsUUID, Min } from "class-validator";

export const TYRE_TASK_PRICE_TIERS = ["CUSTOMER", "TRADE", "CUSTOM"] as const;
export type TyreTaskPriceTier = (typeof TYRE_TASK_PRICE_TIERS)[number];

export class CreateRepairTaskTyreDto {
  @IsUUID("4")
  tyreId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity!: number;

  @IsIn(TYRE_TASK_PRICE_TIERS)
  priceTier!: TyreTaskPriceTier;

  /** Required when priceTier is CUSTOM — unit sell price ex VAT per tyre (incl. fitting). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceNet?: number;
}
