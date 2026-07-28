import { IsString } from "class-validator"

export class AddGlyphDto {
  @IsString()
  character: string

  @IsString()
  symbol: string

  @IsString()
  meaning: string

  @IsString()
  category: string
}
