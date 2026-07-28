import { Controller, Get, Post, Body, UseGuards, Req, UploadedFile, UseInterceptors, Res } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { Response } from "express"
import { AiService } from "./ai.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags } from "@nestjs/swagger"

@ApiTags("AI")
@Controller("ai")
export class AiController {
  constructor(private aiService: AiService) {}

  @Get("health")
  async health() { return this.aiService.health() }

  @Post("chat/stream")
  @UseGuards(JwtAuthGuard)
  async chatStream(@Body() body: { messages: { role: string; content: string }[] }, @Res() res: Response) {
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")
    await this.aiService.chatStream(body.messages, res)
  }

  @Post("analyze/password")
  async analyzePassword(@Body("password") password: string) {
    return this.aiService.analyzePassword(password)
  }

  @Post("analyze/metadata-risk")
  async analyzeMetadataRisk(@Body("metadata") metadata: Record<string, any>) {
    return this.aiService.analyzeMetadataRisk(metadata)
  }

  @Post("analyze/entropy")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async analyzeEntropy(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.analyzeEntropy(file.buffer, file.originalname)
  }

  @Post("analyze/stego")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async analyzeStego(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.analyzeStego(file.buffer, file.originalname)
  }

  @Post("analyze/threat")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async analyzeThreat(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.analyzeThreat(file.buffer, file.originalname)
  }

  @Post("analyze/advanced-tamper")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async analyzeAdvancedTamper(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.analyzeAdvancedTamper(file.buffer, file.originalname)
  }

  @Post("detect/tamper")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async detectTamper(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.detectTamper(file.buffer, file.originalname)
  }

  @Post("detect/deepfake")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async detectDeepfake(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.detectDeepfake(file.buffer, file.originalname)
  }

  @Post("analyze/security")
  @UseGuards(JwtAuthGuard)
  async securityAnalysis(@Req() req: any) {
    return this.aiService.securityAnalysis({
      mfa_enabled: req.user?.isMFAEnabled || false,
      key_age_days: 0,
      old_password: false,
      recent_actions: [],
    })
  }

  @Post("generate/secret-language")
  @UseGuards(JwtAuthGuard)
  async generateSecretLanguage(@Body() body: {
    theme?: string; scriptType?: string; complexity?: string;
    includeDigits?: boolean; includePunctuation?: boolean; glyphCount?: number;
  }) {
    return this.aiService.generateSecretLanguage(body)
  }

  @Post("analyze/strings")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async extractStrings(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.extractStrings(file.buffer, file.originalname)
  }

  @Post("analyze/carve")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async carveEmbedded(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.carveEmbedded(file.buffer, file.originalname)
  }

  @Post("analyze/exif")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async analyzeExif(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.analyzeExif(file.buffer, file.originalname)
  }

  @Post("clean/metadata")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file"))
  async cleanMetadata(@UploadedFile() file: Express.Multer.File) {
    return this.aiService.cleanMetadata(file.buffer, file.originalname)
  }
}
