import { IsOptional, IsString, IsEmail } from "class-validator"

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string

  @IsOptional()
  @IsString()
  avatar?: string

  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  location?: string

  @IsOptional()
  @IsString()
  jobTitle?: string

  @IsOptional()
  @IsString()
  department?: string

  @IsOptional()
  @IsString()
  bio?: string

  @IsOptional()
  socialLinks?: Record<string, string>

  @IsOptional()
  @IsString()
  currentPassword?: string
}
