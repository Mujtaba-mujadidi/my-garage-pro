import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Min } from "class-validator";

export class RecordPcoPaymentDto {
  @IsUUID()
  paymentAccountId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  valueDate?: string;
}
