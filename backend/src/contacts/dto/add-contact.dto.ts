import { IsString, IsOptional } from "class-validator"

export class AddContactDto {
  @IsString()
  contactId: string

  @IsOptional()
  @IsString()
  alias?: string
}
