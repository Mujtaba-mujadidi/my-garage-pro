import { SupplierRefundType } from "@prisma/client";
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";
import { PaymentMethod } from "@prisma/client";

export class ReturnJobPartDto {
  @IsOptional()
  @IsIn(["STOCK", "SUPPLIER"])
  returnTo?: "STOCK" | "SUPPLIER";

  /** Required when returning an ordered part to the supplier. */
  @IsOptional()
  @IsEnum(SupplierRefundType)
  refundType?: SupplierRefundType;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  refundMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
