import { IsEmail, IsEnum, IsString, MinLength } from "class-validator";
import { UserRole } from "@prisma/client";

export class CreateGarageUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  displayName!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}
