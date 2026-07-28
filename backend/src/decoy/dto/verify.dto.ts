import { IsString, IsNotEmpty } from "class-validator"

export class VerifyDecoyDto {
  @IsString()
  @IsNotEmpty({ message: "Password is required" })
  password: string
}
