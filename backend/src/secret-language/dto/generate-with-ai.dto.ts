import { IsString, IsOptional, IsBoolean, IsInt, Min, Max } from "class-validator"

export class GenerateWithAiDto {
  @IsOptional()
  @IsString()
  theme?: string

  @IsOptional()
  @IsString()
  scriptType?: string

  @IsOptional()
  @IsString()
  complexity?: string

  @IsOptional()
  @IsBoolean()
  includeDigits?: boolean

  @IsOptional()
  @IsBoolean()
  includePunctuation?: boolean

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(52)
  glyphCount?: number
}
