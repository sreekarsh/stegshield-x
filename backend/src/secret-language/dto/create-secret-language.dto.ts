import { Type } from "class-transformer"
import { IsString, IsOptional, IsBoolean, IsArray, MinLength, ValidateNested } from "class-validator"

export class CreateGlyphDto {
  @IsString()
  character: string

  @IsString()
  symbol: string

  @IsString()
  meaning: string

  @IsOptional()
  @IsString()
  category?: string
}

export class CreateSecretLanguageDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsOptional()
  @IsString()
  version?: string

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGlyphDto)
  glyphs?: CreateGlyphDto[]

  @IsOptional()
  @IsBoolean()
  isShared?: boolean
}
