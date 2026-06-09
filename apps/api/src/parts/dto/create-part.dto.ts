import { PartFitmentType } from "@prisma/client";
import { Type } from "class-transformer";
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
import { PartFitmentRowDto } from "./part-fitment.dto";

export class CreatePartDto {
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
