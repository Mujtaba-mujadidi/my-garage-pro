import { InvoiceLineType } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class InvoiceLineInputDto {
  @IsEnum(InvoiceLineType)
  lineType!: InvoiceLineType;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPriceNet!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  vatRatePercent?: number;
}

export class CreateInvoiceDto {
  @IsUUID()
  customerId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleRegistration?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines!: InvoiceLineInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsBoolean()
  sendImmediately?: boolean;
}
