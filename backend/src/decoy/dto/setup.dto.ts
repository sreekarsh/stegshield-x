import { IsString, MinLength, IsNotEmpty, IsOptional } from "class-validator"

export class SetupDecoyDto {
  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters" })
  fakePassword: string

  @IsString()
  @IsNotEmpty({ message: "Real vault ID is required" })
  realVaultId: string

  @IsOptional()
  @IsString()
  fakeVaultId?: string
}
