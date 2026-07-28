import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  UploadedFile,
  UseInterceptors,
  Res,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { createReadStream, existsSync } from "fs";
import { Response } from "express";
import { EncryptionService, EncryptionResult, Algorithm } from "./encryption.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

const encryptionStorage = diskStorage({
  destination: join(process.cwd(), "uploads", "encryption", "temp"),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

@ApiTags("Encryption")
@ApiBearerAuth()
@Controller("encryption")
export class EncryptionController {
  constructor(private readonly encryptionService: EncryptionService) {}

  @Post("keys")
  @UseGuards(JwtAuthGuard)
  async generateKey(
    @Req() req: any,
    @Body() body: { algorithm?: Algorithm },
  ) {
    return this.encryptionService.generateAESKey(body.algorithm || "AES-256-GCM", req.user.id);
  }

  @Get("keys")
  @UseGuards(JwtAuthGuard)
  async getKeys(@Req() req: any) {
    return this.encryptionService.getUserKeys(req.user.id);
  }

  @Post("keys/:id/rotate")
  @UseGuards(JwtAuthGuard)
  async rotateKey(@Req() req: any, @Param("id") id: string) {
    return this.encryptionService.rotateKey(req.user.id, id);
  }

  @Delete("keys/:id")
  @UseGuards(JwtAuthGuard)
  async revokeKey(@Req() req: any, @Param("id") id: string) {
    return this.encryptionService.revokeKey(req.user.id, id);
  }

  @Post("keys/rsa")
  @UseGuards(JwtAuthGuard)
  async generateRSAKeyPair(@Req() req: any, @Body() body: { keySize?: number }) {
    return this.encryptionService.generateRSAKeyPair(req.user.id, body.keySize || 2048);
  }

  @Post("encrypt")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: encryptionStorage, limits: { fileSize: 500 * 1024 * 1024 } }))
  async encryptFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { algorithm?: Algorithm; keyId?: string },
  ): Promise<EncryptionResult & { downloadUrl: string }> {
    if (!file) throw new BadRequestException("File is required");
    const algorithm = body.algorithm || "AES-256-GCM";
    const result = await this.encryptionService.encryptFileBuffer(file.path, algorithm, body.keyId, req.user.id);
    return { ...result, downloadUrl: `/encryption/download/${result.keyId}/${algorithm}` };
  }

  @Post("decrypt")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: encryptionStorage, limits: { fileSize: 500 * 1024 * 1024 } }))
  async decryptFile(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { keyId: string; iv: string; authTag?: string; algorithm?: Algorithm },
  ): Promise<Buffer> {
    if (!file) throw new BadRequestException("File is required");
    const { key, algorithm } = await this.encryptionService.getKeyById(body.keyId, req.user.id);
    const iv = Buffer.from(body.iv, "base64");
    const authTag = body.authTag ? Buffer.from(body.authTag, "base64") : undefined;
    return this.encryptionService.decryptFileBuffer(file.path, key, algorithm, iv, authTag);
  }

  @Get("download/:keyId/:algorithm")
  @UseGuards(JwtAuthGuard)
  async downloadEncrypted(
    @Req() req: any,
    @Param("keyId") keyId: string,
    @Param("algorithm") algorithm: string,
    @Res() res: Response,
  ) {
    const filePath = join(process.cwd(), "uploads", "encryption", "temp", `${keyId}.enc`);
    if (!existsSync(filePath)) throw new NotFoundException("Encrypted file not found");
    const stream = createReadStream(filePath);
    res.set({ "Content-Disposition": `attachment; filename="${keyId}.enc"`, "Content-Type": "application/octet-stream" });
    stream.pipe(res);
  }
}