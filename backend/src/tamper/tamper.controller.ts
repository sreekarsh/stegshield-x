import { Controller, Post, Get, Delete, UseGuards, Req, Param, Query, UploadedFile, UseInterceptors, BadRequestException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join } from "path"
import { existsSync, mkdirSync } from "fs"
import { TamperService } from "./tamper.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { GetReportsDto } from "../forensics/dto/get-reports.dto"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

const TAMPER_DIR = join(process.cwd(), "uploads", "tamper")
if (!existsSync(TAMPER_DIR)) mkdirSync(TAMPER_DIR, { recursive: true })

const tamperStorage = diskStorage({
  destination: TAMPER_DIR,
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + extname(file.originalname))
  },
})

@ApiTags("Tamper Detection")
@ApiBearerAuth()
@Controller("tamper")
export class TamperController {
  constructor(private tamperService: TamperService) {}

  @Post("analyze")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: tamperStorage, limits: { fileSize: 500 * 1024 * 1024 } }))
  async analyze(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("File is required")
    return this.tamperService.analyzeFile(req.user.id, file.path, file.originalname, file.mimetype)
  }

  @Get("reports")
  @UseGuards(JwtAuthGuard)
  async getReports(@Req() req: any, @Query() query: GetReportsDto) {
    return this.tamperService.getReports(req.user.id, query.page ?? 1, query.limit ?? 20)
  }

  @Get("reports/:id")
  @UseGuards(JwtAuthGuard)
  async getReport(@Req() req: any, @Param("id") id: string) {
    return this.tamperService.getReport(id, req.user.id)
  }

  @Delete("reports/:id")
  @UseGuards(JwtAuthGuard)
  async deleteReport(@Req() req: any, @Param("id") id: string) {
    return this.tamperService.deleteReport(id, req.user.id)
  }
}
