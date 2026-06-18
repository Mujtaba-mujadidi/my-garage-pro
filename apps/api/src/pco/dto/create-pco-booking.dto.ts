import { PcoJobType, PcoPriority, PaymentMethod } from "@prisma/client";
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from "class-validator";

export class CreatePcoBookingDto {
  @IsString()
  @MaxLength(16)
  vrm!: string;

  @IsString()
  @MaxLength(200)
  registeredKeeper!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postcode?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  firstRegistrationDate!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  pcoExpiryDate!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  logbookExpiryDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsEnum(PcoJobType)
  jobType!: PcoJobType;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  jobDetails?: string;

  @IsOptional()
  @IsEnum(PcoPriority)
  priority?: PcoPriority;

  @IsOptional()
  chargeGross?: number;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  bookingDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  bookingTime?: string;

  @IsOptional()
  @IsUUID()
  bookingCentreId?: string;

  @IsOptional()
  @IsBoolean()
  clientInformed?: boolean;

  @IsOptional()
  @IsBoolean()
  clientResponded?: boolean;

  @IsOptional()
  @IsEnum(PaymentMethod)
  bookingPaymentMethod?: PaymentMethod;
}
