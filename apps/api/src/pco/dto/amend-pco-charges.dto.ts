import { IsNumber, IsOptional, Min } from "class-validator";

/** Correct service charge and/or recoverable TfL slot expense on a booking. */
export class AmendPcoChargesDto {
  @IsNumber()
  @Min(0)
  chargeGross!: number;

  /** When the garage pays (or will pay) the slot — updates recoverable amount. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  slotChargeGross?: number;
}
