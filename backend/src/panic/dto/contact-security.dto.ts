import { IsString, IsNotEmpty, MaxLength } from "class-validator"

export class ContactSecurityDto {
  @IsString()
  @IsNotEmpty({ message: "Message is required" })
  @MaxLength(5000, { message: "Message must be at most 5000 characters" })
  message: string
}
