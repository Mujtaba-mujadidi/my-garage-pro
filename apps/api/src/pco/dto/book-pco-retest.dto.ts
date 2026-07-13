import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min, ValidateIf } from "class-validator";

/** Queue a failed booking for retest (creates PENDING RETEST on To book). */
export class BookPcoRetestDto {
  @IsBoolean()
  hasAdditionalCharge!: boolean;

  @ValidateIf((dto: BookPcoRetestDto) => dto.hasAdditionalCharge)
  @IsNumber()
  @Min(0.01)
  additionalChargeGross?: number;

  @ValidateIf((dto: BookPcoRetestDto) => dto.hasAdditionalCharge)
  @IsString()
  @MaxLength(200)
  chargeReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}
