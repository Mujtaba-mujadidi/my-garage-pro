import { PaymentMethod } from "@prisma/client";
import { Transform } from "class-transformer";
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from "class-validator";
import { coerceToNumber } from "../transforms/coerce-number";

/** Purchase payment details when stock quantity increases. Amount may be 0 if unknown. */
export class StockPurchaseFieldsDto {
  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseAmountGross?: number;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  purchaseVatAmount?: number;

  @IsOptional()
  @IsUUID("4")
  paymentAccountId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsString()
  valueDate?: string;

  @IsOptional()
  @IsUUID("4")
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  purchaseReference?: string;

  @IsOptional()
  @Transform(({ value }) => coerceToNumber(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  creditAmountApplied?: number;
}

export type StockPurchaseInput = {
  amountGross: number;
  vatAmount: number;
  paymentAccountId?: string;
  paymentMethod?: PaymentMethod;
  valueDate?: Date;
  supplierId?: string;
  reference?: string;
  creditAmountApplied?: number;
};

export function normalizeStockPurchase(
  dto: StockPurchaseFieldsDto,
  fallbackReference?: string,
): StockPurchaseInput {
  const amountGross = dto.purchaseAmountGross ?? 0;
  const vatAmount = dto.purchaseVatAmount ?? 0;
  return {
    amountGross,
    vatAmount,
    paymentAccountId: dto.paymentAccountId,
    paymentMethod: dto.paymentMethod,
    valueDate: dto.valueDate ? new Date(dto.valueDate) : new Date(),
    supplierId: dto.supplierId,
    reference: dto.purchaseReference?.trim() || fallbackReference,
    creditAmountApplied: dto.creditAmountApplied ?? 0,
  };
}
