import { PartialType } from "@nestjs/mapped-types"
import { CreateSecretLanguageDto } from "./create-secret-language.dto"

export class UpdateSecretLanguageDto extends PartialType(CreateSecretLanguageDto) {}
