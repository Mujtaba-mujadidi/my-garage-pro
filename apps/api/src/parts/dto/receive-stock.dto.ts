import { Transform } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { coerceToNumber } from "../../common/transforms/coerce-number";
import { StockPurchaseFieldsDto } from "../../common/dto/stock-purchase-fields.dto";

export class ReceiveStockDto extends StockPurchaseFieldsDto {
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
