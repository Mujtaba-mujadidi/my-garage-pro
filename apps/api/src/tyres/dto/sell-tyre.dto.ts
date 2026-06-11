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

export class SellTyreDto {
  @IsUUID("4")
  customerId!: string;

  @IsUUID("4")
  tyreId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fittingChargeNet?: number;

  @IsOptional()
  @IsString()
  vehicleRegistration?: string;

  /** When set, record payment against the new invoice immediately. */
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
