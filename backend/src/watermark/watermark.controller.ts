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
  Query,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { Response } from "express";
import { WatermarkService, WatermarkResult, PaginatedResult } from "./watermark.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

const watermarkStorage = diskStorage({
  destination: join(process.cwd(), "uploads", "watermarks", "temp"),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

@ApiTags("Watermark")
@ApiBearerAuth()
@Controller("watermark")
export class WatermarkController {
  constructor(private readonly watermarkService: WatermarkService) {}

  @Post("invisible")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: watermarkStorage, limits: { fileSize: 100 * 1024 * 1024 } }))
  async createInvisible(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { text: string },
  ): Promise<WatermarkResult> {
    if (!file) throw new BadRequestException("File is required");
    if (!body.text) throw new BadRequestException("Watermark text is required");
    return this.watermarkService.createInvisible(req.user.id, file, body.text);
  }

  @Post("visible")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: watermarkStorage, limits: { fileSize: 100 * 1024 * 1024 } }))
  async createVisible(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { text: string; x?: number; y?: number; opacity?: number; fontSize?: number; color?: string },
  ): Promise<WatermarkResult> {
    if (!file) throw new BadRequestException("File is required");
    if (!body.text) throw new BadRequestException("Watermark text is required");
    return this.watermarkService.createVisible(req.user.id, file, body.text, {
      x: body.x ?? 50,
      y: body.y ?? 50,
      opacity: body.opacity ?? 50,
      fontSize: body.fontSize ?? 24,
      color: body.color ?? "#ffffff",
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Req() req: any,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
  ): Promise<PaginatedResult<WatermarkResult>> {
    return this.watermarkService.findAll(req.user.id, +page, +limit);
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) {
    return this.watermarkService.getStats(req.user.id);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async findById(@Req() req: any, @Param("id") id: string): Promise<WatermarkResult> {
    return this.watermarkService.findById(req.user.id, id);
  }

  @Post(":id/extract")
  @UseGuards(JwtAuthGuard)
  async extractInvisible(@Req() req: any, @Param("id") id: string) {
    return this.watermarkService.extractInvisible(req.user.id, id);
  }

  @Get(":id/download")
  @UseGuards(JwtAuthGuard)
  async downloadWatermarked(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const result = await this.watermarkService.downloadWatermarked(req.user.id, id);
    res.setHeader("Content-Type", result.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${result.name}"`);
    res.send(result.buffer);
  }

  @Get(":id/original")
  @UseGuards(JwtAuthGuard)
  async downloadOriginal(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const result = await this.watermarkService.downloadOriginal(req.user.id, id);
    res.setHeader("Content-Type", result.mime);
    res.setHeader("Content-Disposition", `attachment; filename="${result.name}"`);
    res.send(result.buffer);
  }

  @Post("visible/preview")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: watermarkStorage, limits: { fileSize: 100 * 1024 * 1024 } }))
  async previewVisible(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { text: string; x?: number; y?: number; opacity?: number; fontSize?: number; color?: string },
    @Res() res: Response,
  ) {
    if (!file) throw new BadRequestException("File is required");
    if (!body.text) throw new BadRequestException("Watermark text is required");
    const result = await this.watermarkService.generateVisiblePreview(file, body.text.trim(), {
      x: body.x ?? 50,
      y: body.y ?? 50,
      opacity: body.opacity ?? 50,
      fontSize: body.fontSize ?? 24,
      color: body.color ?? "#ffffff",
    });
    res.setHeader("Content-Type", result.mime);
    res.setHeader("Content-Disposition", `inline; filename="watermark-preview.png"`);
    res.send(result.buffer);
  }

  @Delete("clear/all")
  @UseGuards(JwtAuthGuard)
  async deleteAll(@Req() req: any) {
    return this.watermarkService.deleteAll(req.user.id);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  async delete(@Req() req: any, @Param("id") id: string) {
    if (id === "clear/all" || id === "clear") {
      return this.watermarkService.deleteAll(req.user.id);
    }
    return this.watermarkService.delete(req.user.id, id);
  }
}