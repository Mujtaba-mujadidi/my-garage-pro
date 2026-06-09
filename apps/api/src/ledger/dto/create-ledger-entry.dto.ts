import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { LedgerEntryDirection } from "@prisma/client";

export class CreateLedgerEntryDto {
  @IsEnum(LedgerEntryDirection)
  direction!: LedgerEntryDirection;

  @IsUUID()
  paymentAccountId!: string;

  @IsString()
  @MinLength(1)
  valueDate!: string;

  @IsNumber()
  amountGross!: number;

  @IsOptional()
  @IsNumber()
  vatAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  category?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
