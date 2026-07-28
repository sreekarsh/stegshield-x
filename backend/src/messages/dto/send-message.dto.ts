import { IsString, IsOptional, IsBoolean, IsNumber, MinLength } from "class-validator"

export class SendMessageDto {
  @IsString()
  receiverId: string

  @IsString()
  @MinLength(1)
  content: string

  @IsOptional()
  @IsBoolean()
  selfDestruct?: boolean

  @IsOptional()
  @IsBoolean()
  oneTimeView?: boolean

  @IsOptional()
  @IsNumber()
  expiresIn?: number

  @IsOptional()
  @IsBoolean()
  encrypted?: boolean
}
