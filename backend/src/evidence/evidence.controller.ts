import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  UseGuards,
  Req,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  Res,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { extname, join } from "path";
import { existsSync, mkdirSync } from "fs";
import { Response } from "express";
import { EvidenceService, CreateEvidenceDto, UpdateEvidenceDto, BulkOperationDto, PaginatedResult, EvidenceWithCustody } from "./evidence.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { DecoyVaultGuard } from "../decoy/decoy-vault.guard";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";

const evidenceStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const dir = join(process.cwd(), "uploads", "evidence", "temp");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

@ApiTags("Evidence")
@ApiBearerAuth()
@Controller("evidence")
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor("file", { storage: evidenceStorage, limits: { fileSize: 200 * 1024 * 1024 } }))
  async create(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { caseId?: string },
  ): Promise<EvidenceWithCustody> {
    if (!file) throw new BadRequestException("File is required");
    return this.evidenceService.create(req.user.id, file, body.caseId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, DecoyVaultGuard)
  async getAll(
    @Req() req: any,
    @Query("page") page = 1,
    @Query("limit") limit = 20,
    @Query("caseId") caseId?: string,
    @Query("status") status?: string,
    @Query("search") search?: string,
  ): Promise<PaginatedResult<EvidenceWithCustody>> {
    return this.evidenceService.findAll(req.user.id, +page, +limit, { caseId, status, search }, req.decoyMode, req.fakeVaultId);
  }

  @Get("stats")
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) {
    return this.evidenceService.getStats(req.user.id);
  }

  @Get("cases")
  @UseGuards(JwtAuthGuard)
  async getCases(@Req() req: any) {
    return this.evidenceService.getCases(req.user.id);
  }

  @Post("cases")
  @UseGuards(JwtAuthGuard)
  async createCase(@Req() req: any, @Body() body: { name: string }) {
    if (!body.name) throw new BadRequestException("Case name required");
    return this.evidenceService.createCase(req.user.id, body.name);
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard, DecoyVaultGuard)
  async getById(@Req() req: any, @Param("id") id: string): Promise<EvidenceWithCustody> {
    return this.evidenceService.findById(req.user.id, id, req.decoyMode, req.fakeVaultId);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  async update(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: UpdateEvidenceDto,
  ): Promise<EvidenceWithCustody> {
    if (body.status) {
      return this.evidenceService.updateStatus(req.user.id, id, body.status);
    }
    return this.evidenceService.update(req.user.id, id, body);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard)
  async updateStatus(
    @Req() req: any,
    @Param("id") id: string,
    @Body() body: { status: string },
  ): Promise<EvidenceWithCustody> {
    if (!body.status) throw new BadRequestException("Status is required");
    return this.evidenceService.updateStatus(req.user.id, id, body.status);
  }

  @Get(":id/download")
  @UseGuards(JwtAuthGuard, DecoyVaultGuard)
  async download(@Req() req: any, @Param("id") id: string, @Res() res: Response) {
    const result = await this.evidenceService.download(req.user.id, id, req.decoyMode, req.fakeVaultId);
    res.setHeader("Content-Type", result.type);
    res.setHeader("Content-Disposition", `attachment; filename="${result.name}"`);
    res.setHeader("Content-Length", result.buffer.length);
    res.send(result.buffer);
  }

  @Post(":id/verify")
  @UseGuards(JwtAuthGuard)
  async verifyIntegrity(@Req() req: any, @Param("id") id: string) {
    const res = await this.evidenceService.verifyIntegrity(req.user.id, id);
    return {
      verified: res.valid,
      valid: res.valid,
      hash: res.actual,
      storedHash: res.expected,
      expected: res.expected,
      actual: res.actual,
    };
  }

  @Post("bulk")
  @UseGuards(JwtAuthGuard)
  async bulkOperation(@Req() req: any, @Body() dto: BulkOperationDto) {
    if (!dto.ids || !dto.ids.length) throw new BadRequestException("IDs array required");
    if (!dto.action) throw new BadRequestException("Action required");
    return this.evidenceService.bulkOperation(req.user.id, dto);
  }

  @Post("export")
  @UseGuards(JwtAuthGuard)
  async exportManifest(@Req() req: any, @Body() body: { ids: string[] }, @Res() res: Response) {
    if (!body.ids || !body.ids.length) throw new BadRequestException("IDs array required");
    const manifest = await this.evidenceService.exportManifest(req.user.id, body.ids);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="evidence-manifest-${Date.now()}.json"`);
    res.send(manifest);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Req() req: any, @Param("id") id: string) {
    const result = await this.evidenceService.bulkOperation(req.user.id, { ids: [id], action: "delete" });
    if (result.failed.length) throw new BadRequestException(result.failed[0].error);
  }
}