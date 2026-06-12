import { PartFitmentType } from "@prisma/client";
import { Transform, Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { coerceToNumber } from "../../common/transforms/coerce-number";
import { StockPurchaseFieldsDto } from "../../common/dto/stock-purchase-fields.dto";
import { PartFitmentRowDto } from "./part-fitment.dto";

export class CreatePartDto extends StockPurchaseFieldsDto {
  @IsString()
  @MaxLength(80)
  partNumber!: string;

  @IsString()
  @MaxLength(200)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  @IsOptional()
  @IsEnum(PartFitmentType)
  fitmentType?: PartFitmentType;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PartFitmentRowDto)
  fitments?: PartFitmentRowDto[];

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  costPriceNet?: number;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  sellPriceNet?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
