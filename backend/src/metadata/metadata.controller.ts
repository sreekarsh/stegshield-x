import { Controller, Post, Get, UseGuards, Req, Param, Res, UploadedFile, UseInterceptors, BadRequestException, NotFoundException, ForbiddenException } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { diskStorage } from "multer"
import { extname, join, basename } from "path"
import { createReadStream, existsSync, unlinkSync } from "fs"
import { Response } from "express"
import { MetadataService } from "./metadata.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"

const ALLOWED_MIMES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/tiff",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

const metadataStorage = diskStorage({
  destination: join(process.cwd(), "uploads", "metadata"),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + extname(file.originalname))
  },
})

@ApiTags("Metadata")
@ApiBearerAuth()
@Controller("metadata")
export class MetadataController {
  constructor(private metadataService: MetadataService) {}

  @Post("analyze")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: metadataStorage, limits: { fileSize: 200 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (!ALLOWED_MIMES.includes(file.mimetype)) { cb(new BadRequestException("Unsupported file type"), false) } else { cb(null, true) } } }))
  async analyze(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("File is required")
    return this.metadataService.analyze(req.user.id, file.path, file.originalname)
  }

  @Post("clean")
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: metadataStorage, limits: { fileSize: 200 * 1024 * 1024 }, fileFilter: (_req, file, cb) => { if (!ALLOWED_MIMES.includes(file.mimetype)) { cb(new BadRequestException("Unsupported file type"), false) } else { cb(null, true) } } }))
  async clean(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException("File is required")
    return this.metadataService.clean(req.user.id, file.path, file.originalname)
  }

  @Get("download/:filename")
  @UseGuards(JwtAuthGuard)
  async download(@Req() req: any, @Param("filename") filename: string, @Res() res: Response) {
    const safeName = basename(filename)
    if (!safeName.startsWith(`cleaned-${req.user.id}-`)) throw new ForbiddenException("Access denied")
    const filePath = join(process.cwd(), "uploads", "metadata-cleaned", safeName)
    if (!existsSync(filePath)) throw new NotFoundException("Cleaned file not found")
    const stream = createReadStream(filePath)
    res.set({
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Type": "application/octet-stream",
    })
    stream.pipe(res)
  }
}
