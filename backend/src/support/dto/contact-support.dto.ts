import { IsString, IsNotEmpty, IsOptional, MaxLength } from "class-validator"

export class ContactSupportDto {
  @IsString()
  @IsNotEmpty({ message: "Message is required" })
  @MaxLength(5000, { message: "Message must be at most 5000 characters" })
  message: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string
}
