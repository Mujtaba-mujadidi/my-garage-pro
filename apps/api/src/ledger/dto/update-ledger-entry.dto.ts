import { IsNumber, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class UpdateLedgerEntryDto {
  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsString()
  valueDate?: string;

  @IsOptional()
  @IsNumber()
  amountGross?: number;

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
