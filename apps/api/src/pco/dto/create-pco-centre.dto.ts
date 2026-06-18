import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

export class CreatePcoCentreDto {
  @IsString()
  @MaxLength(200)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
