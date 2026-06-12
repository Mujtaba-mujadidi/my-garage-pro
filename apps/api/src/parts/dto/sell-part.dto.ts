import { PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class SellPartDto {
  @IsUUID("4")
  customerId!: string;

  @IsUUID("4")
  partId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  /** Override unit sell price ex VAT; defaults to part catalog sell price. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  sellPriceNet?: number;

  @IsOptional()
  @IsString()
  vehicleRegistration?: string;

  @IsOptional()
  @IsUUID("4")
  paymentAccountId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  valueDate?: string;
}
