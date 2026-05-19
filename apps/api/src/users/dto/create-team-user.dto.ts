import { IsEmail, IsString, IsUUID, MinLength } from "class-validator";

export class CreateTeamUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1)
  displayName!: string;

  @IsString()
  @MinLength(4)
  password!: string;

  @IsUUID()
  garageRoleId!: string;
}
