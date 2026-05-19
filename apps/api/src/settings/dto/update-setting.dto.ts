import { IsInt, IsOptional, IsString, Min } from "class-validator";

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
