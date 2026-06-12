import { Type } from "class-transformer";
import { IsNumber, IsOptional, IsString, MaxLength, Min } from "class-validator";
import { StockPurchaseFieldsDto } from "../../common/dto/stock-purchase-fields.dto";

export class ReceiveTyreStockDto extends StockPurchaseFieldsDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
