import { IsOptional, IsString } from "class-validator"

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  alias?: string
}
