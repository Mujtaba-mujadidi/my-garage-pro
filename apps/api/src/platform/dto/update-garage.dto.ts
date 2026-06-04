import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class UpdateGarageDto {
  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @Matches(/^[a-z0-9-]+$/)
  slug!: string;

  @IsString()
  @MinLength(2)
  directorOwnerName!: string;

  @IsString()
  @MinLength(5)
  address!: string;

  @IsString()
  @MinLength(5)
  contactNumber!: string;

  @IsString()
  @MinLength(5)
  phoneNumber!: string;

  @IsOptional()
  @IsString()
  vatNumber?: string;

  @IsOptional()
  @IsEmail()
  ownerEmail?: string;
}
