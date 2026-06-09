import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateExpenseCategoryDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  label!: string;
}
