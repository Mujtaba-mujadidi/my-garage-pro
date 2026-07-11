import { PcoSlotFeeDisposition } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";

export class CancelPcoBookingDto {
  /** Required when the booking had a slot fee (Us or Customer). */
  @IsOptional()
  @IsEnum(PcoSlotFeeDisposition)
  slotFeeDisposition?: PcoSlotFeeDisposition;

  /** Required when slotFeeDisposition is RETAINED or REFUND_REQUESTED. */
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  cancellationNote?: string;
}
