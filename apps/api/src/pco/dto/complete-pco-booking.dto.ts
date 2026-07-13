import { IsBoolean, IsNumber, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from "class-validator";

export class CompletePcoBookingDto {
  @IsString()
  @Matches(/^(PASS|FAIL)$/)
  outcome!: "PASS" | "FAIL";

  @ValidateIf((dto: CompletePcoBookingDto) => dto.outcome === "PASS")
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  nextPcoExpiryDate?: string;

  @ValidateIf((dto: CompletePcoBookingDto) => dto.outcome === "FAIL")
  @IsString()
  @MaxLength(4000)
  failureReason?: string;
}
