import { Controller, Post, UploadedFile, UseInterceptors, UseGuards, Body, BadRequestException, Res } from "@nestjs/common"
import { FileInterceptor } from "@nestjs/platform-express"
import { Response } from "express"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { PdfService } from "./pdf.service"
import { ApiTags } from "@nestjs/swagger"

@ApiTags("PDF")
@Controller("pdf")
@UseGuards(JwtAuthGuard)
export class PdfController {
  constructor(private pdfService: PdfService) {}

  @Post("protect")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  async protect(@UploadedFile() file: Express.Multer.File, @Body("password") password: string, @Res() res: Response) {
    if (!file) throw new BadRequestException("PDF file is required")
    if (file.mimetype !== "application/pdf") throw new BadRequestException("Only PDF files are supported")
    if (!password || password.length < 4) throw new BadRequestException("Password must be at least 4 characters")
    const encrypted = await this.pdfService.protect(file.buffer, password)
    const originalName = file.originalname.replace(/\.pdf$/i, "") || "document"
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${originalName}.pdf"` })
    res.send(encrypted)
  }

  @Post("unlock")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 50 * 1024 * 1024 } }))
  async unlock(@UploadedFile() file: Express.Multer.File, @Body("password") password: string, @Res() res: Response) {
    if (!file) throw new BadRequestException("PDF file is required")
    if (!password) throw new BadRequestException("Password is required")
    const decrypted = await this.pdfService.unlock(file.buffer, password)
    const originalName = file.originalname.replace(/\.pdf$/i, "") || "document"
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${originalName}_unlocked.pdf"` })
    res.send(decrypted)
  }
}
