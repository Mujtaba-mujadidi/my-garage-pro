import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PaymentAccountType } from "@prisma/client";

export class CreatePaymentAccountDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(PaymentAccountType)
  type!: PaymentAccountType;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
