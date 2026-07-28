import { IsString, MinLength, IsOptional } from "class-validator"

export class EncryptMessageDto {
  @IsString()
  @MinLength(1)
  text: string

  @IsOptional()
  @IsString()
  unknownCharPlaceholder?: string
}

export class DecryptMessageDto {
  @IsString()
  @MinLength(1)
  glyphText: string

  @IsOptional()
  @IsString()
  delimiter?: string
}
