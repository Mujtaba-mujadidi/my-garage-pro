import { PaymentAccountType } from "@prisma/client";
import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class UpdatePaymentAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsEnum(PaymentAccountType)
  type?: PaymentAccountType;

  @IsOptional()
  @IsNumber()
  openingBalance?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
