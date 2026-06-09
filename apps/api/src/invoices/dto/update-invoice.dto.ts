import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { InvoiceLineInputDto } from "./create-invoice.dto";

export class UpdateInvoiceDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  vehicleRegistration?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  depositAmount?: number;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineInputDto)
  lines?: InvoiceLineInputDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
