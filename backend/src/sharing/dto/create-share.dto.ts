import { IsString, IsOptional, IsBoolean, IsArray, IsInt, Min, Max, ValidateIf, MinLength } from "class-validator"
import { Type, Transform } from "class-transformer"

export class CreateShareDto {
  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Password must be at least 8 characters for secure sharing" })
  password?: string

  @IsOptional()
  @IsString()
  expiresAt?: string

  @IsOptional()
  @Transform(({ value }) => {
    if (value === "unlimited" || value === "0" || value === undefined || value === null) return undefined
    const n = parseInt(value, 10)
    return isNaN(n) ? undefined : n
  })
  @IsInt()
  @Min(1)
  @Max(100000)
  maxDownloads?: number

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isGeoRestricted?: boolean

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  isIPRestricted?: boolean

  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value
    if (typeof value === "string") {
      try { return JSON.parse(value) as string[] } catch { return [] }
    }
    return []
  })
  @IsArray()
  @IsString({ each: true })
  allowedIPs?: string[]
}
