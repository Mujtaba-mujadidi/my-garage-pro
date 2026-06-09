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

export class CreatePaymentDto {
  @IsUUID()
  customerId!: string;

  @IsUUID()
  paymentAccountId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  valueDate!: string;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

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
}
