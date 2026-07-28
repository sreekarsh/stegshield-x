import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { PrismaService } from "../prisma/prisma.service"
import { AuditService } from "../audit/audit.service"
import { AuditActions } from "../audit/audit.constants"
import { v4 as uuid } from "uuid"
import * as argon2 from "argon2"
import { join, extname } from "path"
import { existsSync, mkdirSync, createReadStream } from "fs"
import { writeFile, unlink } from "fs/promises"
import { Response } from "express"
import { CreateShareDto } from "./dto/create-share.dto"

const ALLOWED_MIME_TYPES = [
  // Images
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/bmp", "image/tiff", "image/svg+xml",
  // Documents
  "application/pdf", "text/plain", "text/csv", "text/html", "text/markdown", "text/css", "text/javascript",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint", "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  // Archives
  "application/zip", "application/x-rar-compressed", "application/x-7z-compressed", "application/x-tar", "application/gzip",
  // Audio
  "audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/x-m4a", "audio/flac", "audio/aac",
  // Video
  "video/mp4", "video/webm", "video/x-msvideo", "video/quicktime", "video/x-matroska", "video/mpeg", "video/ogg",
  // Data & General Binary
  "application/json", "application/xml", "application/octet-stream",
]

@Injectable()
export class SharingService {
  private readonly shareDir: string
  private readonly defaultIpRestricted: boolean
  private readonly defaultMaxDownloads: number | null
  private readonly defaultExpiry: string | null
  private readonly requirePassword: boolean

  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
  ) {
    this.shareDir = join(process.cwd(), "uploads", "sharing")
    if (!existsSync(this.shareDir)) {
      mkdirSync(this.shareDir, { recursive: true })
    }
    
    // Production defaults from environment
    this.defaultIpRestricted = process.env.SHARING_DEFAULT_IP_RESTRICTED === "true"
    this.defaultMaxDownloads = process.env.SHARING_DEFAULT_MAX_DOWNLOADS ? parseInt(process.env.SHARING_DEFAULT_MAX_DOWNLOADS) : null
    this.defaultExpiry = process.env.SHARING_DEFAULT_EXPIRY || null
    this.requirePassword = process.env.SHARING_REQUIRE_PASSWORD !== "false"
  }

  private async safeUnlink(filePath: string, retries = 3, delay = 100): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        if (existsSync(filePath)) {
          await unlink(filePath)
        }
        return
      } catch (err: any) {
        if (err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'ENOENT') {
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay))
        } else {
          throw err
        }
      }
    }
  }

  private makeUrl(code: string, requestHost?: string): string {
    const configuredUrl = process.env.APP_URL || process.env.FRONTEND_URL
    if (configuredUrl && !configuredUrl.includes("ngrok")) {
      return `${configuredUrl.replace(/\/+$/, "")}/share/${code}`
    }
    if (requestHost && !requestHost.includes("ngrok")) {
      const proto = requestHost.includes("localhost") || requestHost.match(/^\d+\.\d+\.\d+\.\d+/) ? "http" : "https"
      const frontendPort = process.env.FRONTEND_PORT || "3000"
      const hostPart = requestHost.replace(/:\d+$/, "")
      const isLocal = hostPart.includes("localhost") || hostPart.match(/^\d+\.\d+\.\d+\.\d+/)
      return `${proto}://${hostPart}${isLocal ? `:${frontendPort}` : ""}/share/${code}`
    }
    return `http://localhost:3000/share/${code}`
  }

  private async validateLink(code: string) {
    const link = await this.prisma.sharedLink.findUnique({ where: { url: code } })
    if (!link) throw new NotFoundException("Link not found")

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new ForbiddenException("This link has expired")
    }

    if (link.maxDownloads !== null && link.downloads >= link.maxDownloads) {
      throw new ForbiddenException("Maximum download limit reached")
    }

    return link
  }

  private checkIpRestriction(link: { isIPRestricted: boolean; allowedIPs: string[] }, requestIp: string | undefined) {
    if (!link.isIPRestricted || !requestIp) return

    if (link.allowedIPs.length === 0) {
      throw new ForbiddenException("Access restricted by IP")
    }

    const allowed = link.allowedIPs.some(cidr => this.ipMatchesCidr(requestIp, cidr))
    if (!allowed) {
      throw new ForbiddenException("Access restricted by IP")
    }
  }

  private ipMatchesCidr(ip: string, cidr: string): boolean {
    try {
      const ipaddr = require("ipaddr.js")
      
      // If CIDR notation, use proper CIDR matching
      if (cidr.includes("/")) {
        const addr = ipaddr.parse(ip)
        const range = ipaddr.parseCIDR(cidr)
        return addr.kind() === range[0].kind() && addr.match(range)
      }
      
      // For exact IP, require exact match only
      return ip === cidr
    } catch {
      // On parsing error, require exact match
      return ip === cidr
    }
  }

  private validateFileType(mimeType: string | undefined, fileName: string): void {
    if (!mimeType) return
    
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`File type "${mimeType}" is not allowed for sharing`)
    }
    
    // Validate that file extension matches MIME type category
    const ext = extname(fileName).toLowerCase()
    const imageExts = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tiff", ".svg"]
    const docExts = [".pdf", ".txt", ".csv", ".html", ".md", ".css", ".js", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx"]
    const archiveExts = [".zip", ".rar", ".7z", ".tar", ".gz"]
    const audioExts = [".mp3", ".wav", ".ogg", ".webm", ".m4a", ".flac", ".aac"]
    const videoExts = [".mp4", ".webm", ".avi", ".mov", ".mkv", ".mpeg", ".ogg"]
    
    const isImage = mimeType.startsWith("image/")
    const isDoc = mimeType.startsWith("application/") && (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("excel") || mimeType.includes("powerpoint") || mimeType.includes("text"))
    const isArchive = mimeType.includes("zip") || mimeType.includes("rar") || mimeType.includes("7z") || mimeType.includes("tar") || mimeType.includes("gzip")
    const isAudio = mimeType.startsWith("audio/")
    const isVideo = mimeType.startsWith("video/")
    
    if (isImage && !imageExts.includes(ext)) {
      throw new BadRequestException(`File extension ${ext} does not match image MIME type`)
    }
    if (isAudio && !audioExts.includes(ext)) {
      throw new BadRequestException(`File extension ${ext} does not match audio MIME type`)
    }
    if (isVideo && !videoExts.includes(ext)) {
      throw new BadRequestException(`File extension ${ext} does not match video MIME type`)
    }
  }

  async createLink(userId: string, file: Express.Multer.File, dto: CreateShareDto, host: string) {
    if (!file) throw new BadRequestException("File is required")

    this.validateFileType(file.mimetype, file.originalname)

    const code = uuid()
    const ext = extname(file.originalname) || ""
    const storedName = `${code}${ext}`
    const filePath = join(this.shareDir, storedName)

    await writeFile(filePath, file.buffer)

    let passwordHash: string | null = null
    const password = dto.password
    if (password) {
      if (password.length < 8) {
        throw new BadRequestException("Password must be at least 8 characters")
      }
      // Use argon2 for consistent security across the application
      passwordHash = await argon2.hash(password)
    }
    
    // Apply production defaults from environment if not explicitly set
    const ipRestricted = dto.isIPRestricted !== undefined ? dto.isIPRestricted : this.defaultIpRestricted
    const maxDownloads = dto.maxDownloads !== undefined ? dto.maxDownloads : this.defaultMaxDownloads

    const link = await this.prisma.sharedLink.create({
      data: {
        userId,
        fileId: code,
        url: code,
        password: passwordHash,
        maxDownloads,
        expiresAt: dto.expiresAt && dto.expiresAt !== "null" ? (() => { const d = new Date(dto.expiresAt); return isNaN(d.getTime()) ? null : d })() : null,
        isGeoRestricted: dto.isGeoRestricted === true,
        isIPRestricted: ipRestricted,
        allowedIPs: ipRestricted ? (dto.allowedIPs || []) : [],
        filePath,
        fileName: file.originalname,
        fileSize: file.size,
      },
    })

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.SHARE_LINK_CREATE, "shared_link", {
        linkId: link.id,
        fileName: file.originalname,
        fileSize: file.size,
        hasPassword: !!passwordHash,
        expiresAt: link.expiresAt,
      })
    }

    return {
      id: link.id,
      url: this.makeUrl(code, host),
      hasPassword: !!passwordHash,
      fileName: file.originalname,
      fileSize: file.size,
      maxDownloads: link.maxDownloads,
      expiresAt: link.expiresAt,
      isGeoRestricted: link.isGeoRestricted,
      isIPRestricted: link.isIPRestricted,
      createdAt: link.createdAt,
    }
  }

  async getLinks(userId: string, host: string) {
    const links = await this.prisma.sharedLink.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    })
    return links.map(l => ({
      id: l.id,
      url: this.makeUrl(l.url, host),
      hasPassword: !!l.password,
      fileName: l.fileName,
      fileSize: l.fileSize,
      maxDownloads: l.maxDownloads,
      downloads: l.downloads,
      expiresAt: l.expiresAt,
      isGeoRestricted: l.isGeoRestricted,
      isIPRestricted: l.isIPRestricted,
      createdAt: l.createdAt,
    }))
  }

  async deleteLink(id: string, userId: string) {
    const link = await this.prisma.sharedLink.findUnique({ where: { id } })
    if (!link) throw new NotFoundException("Link not found")
    if (link.userId !== userId) throw new ForbiddenException("Access denied")

    if (link.filePath && existsSync(link.filePath)) {
      await this.safeUnlink(link.filePath)
    }
    await this.prisma.sharedLink.delete({ where: { id } })

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.SHARE_LINK_DELETE, "shared_link", { linkId: id, fileName: link.fileName })
    }
  }

  async accessLink(code: string, requestIp?: string) {
    const link = await this.validateLink(code)
    this.checkIpRestriction(link, requestIp)

    if (link.isGeoRestricted) {
      throw new ForbiddenException("Geo-restriction is not yet configured. Contact the administrator.")
    }

    try {
      await this.audit.log(
        link.userId, "anonymous_guest",
        AuditActions.SHARE_LINK_ACCESS, "shared_link",
        requestIp || "0.0.0.0", "",
        { code, fileName: link.fileName, fileSize: link.fileSize, requiresPassword: !!link.password },
      )
    } catch { /* ignore audit log constraint error for public access */ }

    return {
      valid: true,
      fileName: link.fileName,
      fileSize: link.fileSize,
      requiresPassword: !!link.password,
      downloads: link.downloads,
      maxDownloads: link.maxDownloads,
      expiresAt: link.expiresAt,
    }
  }

  async verifyAccess(code: string, password: string | undefined, requestIp: string | undefined, res: Response) {
    const link = await this.validateLink(code)
    this.checkIpRestriction(link, requestIp)

    if (link.isGeoRestricted) {
      throw new ForbiddenException("Geo-restriction is not yet configured. Contact the administrator.")
    }

    if (link.password) {
      if (!password) throw new BadRequestException("Password is required")
      const valid = await argon2.verify(link.password, password)
      if (!valid) throw new ForbiddenException("Invalid password")
    }

    if (!link.filePath || !existsSync(link.filePath)) {
      throw new NotFoundException("File not found on server")
    }

    try {
      await this.audit.log(
        link.userId, "anonymous_guest",
        AuditActions.SHARE_LINK_VERIFY, "shared_link",
        requestIp || "0.0.0.0", "",
        { code, fileName: link.fileName, fileSize: link.fileSize },
      )
    } catch { /* ignore audit log constraint error for public access */ }

    await this.prisma.sharedLink.update({
      where: { id: link.id },
      data: { downloads: { increment: 1 } },
    })

    const fileSize = link.fileSize || 0
    const fileName = (link.fileName || "download").replace(/["\r\n]/g, "")
    
    // Set appropriate Content-Type based on file extension
    const ext = extname(link.fileName || "").toLowerCase()
    let contentType = "application/octet-stream"
    
    const mimeMap: Record<string, string> = {
      ".pdf": "application/pdf",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".txt": "text/plain",
      ".csv": "text/csv",
      ".json": "application/json",
      ".xml": "application/xml",
      ".mp4": "video/mp4",
      ".mp3": "audio/mpeg",
      ".zip": "application/zip",
    }
    
    if (mimeMap[ext]) {
      contentType = mimeMap[ext]
    }
    
    res.set({
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": contentType,
      "Content-Length": fileSize.toString(),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, must-revalidate",
    })
    const stream = createReadStream(link.filePath)
    stream.pipe(res)
  }
}
