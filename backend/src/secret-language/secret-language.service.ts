import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import * as crypto from "crypto"
import { Prisma } from "@prisma/client"
import { PrismaService } from "../prisma/prisma.service"
import { AiService } from "../ai/ai.service"
import { CreateSecretLanguageDto } from "./dto/create-secret-language.dto"
import { UpdateSecretLanguageDto } from "./dto/update-secret-language.dto"
import { AddGlyphDto } from "./dto/add-glyph.dto"
import { EncryptMessageDto, DecryptMessageDto } from "./dto/translate-message.dto"
import { GenerateWithAiDto } from "./dto/generate-with-ai.dto"

@Injectable()
export class SecretLanguageService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
  ) {}

  async create(userId: string, dto: CreateSecretLanguageDto) {
    return this.prisma.secretLanguage.create({
      data: {
        userId,
        name: dto.name,
        version: dto.version || "1.0",
        glyphs: (dto.glyphs || []) as unknown as Prisma.InputJsonValue,
        isShared: dto.isShared || false,
      },
    })
  }

  async findAll(userId: string) {
    return this.prisma.secretLanguage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
  }

  async findOne(id: string, userId: string) {
    const language = await this.prisma.secretLanguage.findUnique({
      where: { id },
    })
    if (!language) throw new NotFoundException("Secret language not found")
    if (language.userId !== userId && !language.isShared) {
      throw new ForbiddenException("Access denied")
    }
    return language
  }

  private async findOwned(id: string, userId: string) {
    const language = await this.prisma.secretLanguage.findUnique({ where: { id } })
    if (!language) throw new NotFoundException("Secret language not found")
    if (language.userId !== userId) throw new ForbiddenException("Access denied — not the owner")
    return language
  }

  async update(id: string, userId: string, dto: UpdateSecretLanguageDto) {
    await this.findOwned(id, userId)
    const data: Prisma.SecretLanguageUpdateInput = {}
    if (dto.name !== undefined) data.name = dto.name
    if (dto.version !== undefined) data.version = dto.version
    if (dto.glyphs !== undefined) data.glyphs = dto.glyphs as unknown as Prisma.InputJsonValue
    if (dto.isShared !== undefined) data.isShared = dto.isShared
    return this.prisma.secretLanguage.update({
      where: { id },
      data,
    })
  }

  async delete(id: string, userId: string) {
    await this.findOwned(id, userId)
    return this.prisma.secretLanguage.delete({ where: { id } })
  }

  async addGlyph(id: string, userId: string, dto: AddGlyphDto) {
    const language = await this.findOwned(id, userId)
    const glyphs = (language.glyphs as any[]) || []
    const glyph = {
      id: crypto.randomUUID(),
      ...dto,
    }
    return this.prisma.secretLanguage.update({
      where: { id },
      data: { glyphs: [...glyphs, glyph] as Prisma.InputJsonValue },
    })
  }

  async removeGlyph(id: string, userId: string, glyphId: string) {
    const language = await this.findOwned(id, userId)
    const glyphs = (language.glyphs as any[]) || []
    return this.prisma.secretLanguage.update({
      where: { id },
      data: { glyphs: glyphs.filter((g: any) => g.id !== glyphId) as Prisma.InputJsonValue },
    })
  }

  async toggleShare(id: string, userId: string) {
    const language = await this.findOwned(id, userId)
    return this.prisma.secretLanguage.update({
      where: { id },
      data: { isShared: !language.isShared },
    })
  }

  async findShared() {
    return this.prisma.secretLanguage.findMany({
      where: { isShared: true },
      orderBy: { createdAt: "desc" },
    })
  }

  async generateWithAi(userId: string, dto: GenerateWithAiDto) {
    const result = await this.aiService.generateSecretLanguage({
      theme: dto.theme || "fantasy",
      scriptType: dto.scriptType || "symbolic",
      complexity: dto.complexity || "medium",
      includeDigits: dto.includeDigits ?? true,
      includePunctuation: dto.includePunctuation ?? false,
      glyphCount: dto.glyphCount || 26,
    })

    return this.prisma.secretLanguage.create({
      data: {
        userId,
        name: result.name,
        version: result.version || "1.0",
        glyphs: (result.glyphs || []) as unknown as Prisma.InputJsonValue,
        isShared: false,
      },
    })
  }

  async encryptMessage(id: string, userId: string, dto: EncryptMessageDto) {
    const language = await this.findOne(id, userId)
    const glyphs = (language.glyphs as any[]) || []
    if (glyphs.length === 0) throw new BadRequestException("Language has no glyphs")

    const map = new Map<string, any>()
    for (const g of glyphs) {
      map.set(g.character.toLowerCase(), g)
    }

    const placeholder = dto.unknownCharPlaceholder || "?"
    const result = dto.text
      .toLowerCase()
      .split("")
      .map((c) => (map.has(c) ? map.get(c)!.symbol : placeholder))
      .join("")

    return {
      original: dto.text,
      encrypted: result,
      languageId: id,
      languageName: language.name,
      glyphCount: glyphs.length,
      unknownChars: [...new Set(dto.text.toLowerCase().split("").filter((c) => !map.has(c) && !c.match(/\s/)))],
    }
  }

  async decryptMessage(id: string, userId: string, dto: DecryptMessageDto) {
    const language = await this.findOne(id, userId)
    const glyphs = (language.glyphs as any[]) || []
    if (glyphs.length === 0) throw new BadRequestException("Language has no glyphs")

    const reverseMap = new Map<string, string>()
    for (const g of glyphs) {
      reverseMap.set(g.symbol, g.character)
    }

    const delimiter = dto.delimiter || ""
    const tokens = delimiter ? dto.glyphText.split(delimiter) : dto.glyphText.split("")

    const result = tokens
      .map((token) => {
        if (reverseMap.has(token)) return reverseMap.get(token)!
        if (token.match(/\s/)) return token
        return token
      })
      .join("")

    return {
      encrypted: dto.glyphText,
      decrypted: result,
      languageId: id,
      languageName: language.name,
    }
  }
}
