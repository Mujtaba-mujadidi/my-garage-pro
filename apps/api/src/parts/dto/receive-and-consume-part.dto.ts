import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsUUID, Min } from "class-validator";
import { coerceToNumber } from "../../common/transforms/coerce-number";
import { StockPurchaseFieldsDto } from "../../common/dto/stock-purchase-fields.dto";

export class ReceiveAndConsumePartDto extends StockPurchaseFieldsDto {
  @IsUUID("4")
  partId!: string;

  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsUUID("4")
  repairTaskId?: string;

  @IsOptional()
  @IsUUID("4")
  bodyworkTaskId?: string;

  /** Customer invoice unit sell price ex VAT; defaults to part catalog sell price. */
  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellPriceNet?: number;
}
