import { TyreCondition } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";

export class CreateTyreDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  skuCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  brand?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  model?: string;

  @IsString()
  @MaxLength(40)
  size!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  loadIndex?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  speedRating?: string;

  @IsOptional()
  @IsEnum(TyreCondition)
  condition?: TyreCondition;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantityOnHand?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minQuantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  costPriceNet?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceNet?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  tradeSellPriceNet?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fittingChargeNet?: number;

  @IsOptional()
  @IsUUID("4")
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
