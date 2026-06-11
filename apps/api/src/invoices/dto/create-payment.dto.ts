import { PaymentMethod } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

export class PaymentAllocationInputDto {
  @IsUUID()
  invoiceId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;
}

export class PaymentSplitInputDto {
  @IsUUID()
  paymentAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

export class CreatePaymentDto {
  @IsUUID()
  customerId!: string;

  @IsString()
  valueDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentAllocationInputDto)
  allocations!: PaymentAllocationInputDto[];

  /** Single payment (legacy) — use when not splitting methods/accounts. */
  @IsOptional()
  @IsUUID()
  paymentAccountId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  /** Split across methods/accounts (e.g. part cash, part bank). Sum must match total received. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentSplitInputDto)
  splits?: PaymentSplitInputDto[];
}
