import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import { BillingCycle, CustomerType } from "@prisma/client";

export class CreateVehicleDto {
  @IsString()
  @MinLength(2)
  registration!: string;

  @IsOptional()
  @IsString()
  make?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  colour?: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AccountTermsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsString()
  creditLimit?: string;

  @IsOptional()
  @IsEnum(BillingCycle)
  billingCycle?: BillingCycle;

  @IsOptional()
  @IsInt()
  @Min(1)
  statementDay?: number;
}

export class CreateCustomerDto {
  @IsEnum(CustomerType)
  type!: CustomerType;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  companyName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @IsString()
  addressLine2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postcode?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  isAccountCustomer?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => AccountTermsDto)
  accountTerms?: AccountTermsDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateVehicleDto)
  vehicles?: CreateVehicleDto[];
}
