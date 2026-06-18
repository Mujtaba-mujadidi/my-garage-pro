import { PaymentMethod } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUUID, Matches } from "class-validator";

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

  @IsEnum(PaymentMethod)
  bookingPaymentMethod!: PaymentMethod;

  @IsOptional()
  chargeGross?: number;
}
