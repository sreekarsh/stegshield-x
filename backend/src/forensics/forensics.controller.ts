import { Controller, Post, Get, Delete, UseGuards, Req, Query, Param, UploadedFile, UseInterceptors, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join } from "path"
import { existsSync, mkdirSync } from "fs"
import { ForensicsService } from "./forensics.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import { GetReportsDto } from "./dto/get-reports.dto"

const FORENSICS_DIR = join(process.cwd(), "uploads", "forensics")
if (!existsSync(FORENSICS_DIR)) mkdirSync(FORENSICS_DIR, { recursive: true })

const forensicsStorage = diskStorage({
  destination: FORENSICS_DIR,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + extname(file.originalname))
  },
})

const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/bmp", "image/webp", "image/tiff"]
const ALLOWED_MIME_PREFIXES = ["image/", "video/", "audio/", "text/", "application/pdf", "application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/octet-stream", "application/json", "application/xml"]

function isValidMimeType(mime: string): boolean {
  return ALLOWED_MIME_PREFIXES.some(p => mime.startsWith(p)) || IMAGE_MIME_TYPES.includes(mime)
}

@ApiTags("Forensics")
@ApiBearerAuth()
@Controller("forensics")
export class ForensicsController {
  constructor(private forensicsService: ForensicsService) {}

  @Post("analyze")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: forensicsStorage, limits: { fileSize: 500 * 1024 * 1024 } }))
  async analyze(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("File is required")
    if (!isValidMimeType(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`)
    }
    return this.forensicsService.analyzeFile(
      req.user.id,
      file.path,
      file.originalname,
      file.mimetype,
    )
  }

  @Get("reports")
  @UseGuards(JwtAuthGuard)
  async getReports(
    @Req() req: any,
    @Query() query: GetReportsDto,
  ) {
    return this.forensicsService.getReports(req.user.id, query.page ?? 1, query.limit ?? 20)
  }

  @Get("reports/:id")
  @UseGuards(JwtAuthGuard)
  async getReport(@Req() req: any, @Param("id") id: string) {
    return this.forensicsService.getReport(id, req.user.id)
  }

  @Delete("reports/:id")
  @UseGuards(JwtAuthGuard)
  async deleteReport(@Req() req: any, @Param("id") id: string) {
    return this.forensicsService.deleteReport(id, req.user.id)
  }
}
