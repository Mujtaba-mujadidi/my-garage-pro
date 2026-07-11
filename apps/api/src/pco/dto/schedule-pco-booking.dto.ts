import { PcoBookingSlotPaidBy } from "@prisma/client";
import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Matches, Min, ValidateIf } from "class-validator";

/** Book a pending PCO record at a centre (moves status to ACTIVE). */
export class SchedulePcoBookingDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  bookingDate!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  bookingTime!: string;

  @IsUUID()
  bookingCentreId!: string;

  @IsEnum(PcoBookingSlotPaidBy)
  slotPaidBy!: PcoBookingSlotPaidBy;

  @ValidateIf((dto: SchedulePcoBookingDto) => dto.slotPaidBy === PcoBookingSlotPaidBy.US)
  @IsUUID()
  slotPaymentAccountId?: string;

  @ValidateIf((dto: SchedulePcoBookingDto) => dto.slotPaidBy === PcoBookingSlotPaidBy.US)
  @IsNumber()
  @Min(0.01)
  slotChargeGross?: number;

  @ValidateIf((dto: SchedulePcoBookingDto) => dto.slotPaidBy === PcoBookingSlotPaidBy.TFL_CREDIT)
  @IsUUID()
  slotCreditSourceBookingId?: string;
}
