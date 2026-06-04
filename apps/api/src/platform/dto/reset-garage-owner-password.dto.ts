import { IsString, MinLength } from "class-validator";

export class ResetGarageOwnerPasswordDto {
  @IsString()
  @MinLength(4)
  tempPassword!: string;
}
