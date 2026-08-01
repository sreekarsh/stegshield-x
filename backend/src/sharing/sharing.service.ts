import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { networkInterfaces } from "os"

function getLanIp(): string {
  try {
    const nets = networkInterfaces()

    // Collect all candidate IPs with metadata
    interface Candidate { ip: string; name: string; score: number }
    const candidates: Candidate[] = []

    for (const name of Object.keys(nets)) {
      // Skip obvious virtual/VPN adapters by name
      const nameLower = name.toLowerCase()
      const isVirtual = (
        nameLower.includes("virtualbox") ||
        nameLower.includes("vmware") ||
        nameLower.includes("hyper-v") ||
        nameLower.includes("vethernet") ||
        nameLower.includes("loopback") ||
        nameLower.includes("tailscale") ||
        nameLower.includes("zerotier") ||
        // "Ethernet 2", "Ethernet 3" etc are often VirtualBox host-only on Windows
        // but "Ethernet" alone or "Wi-Fi" / "WLAN" are real adapters
        /^ethernet\s+\d+$/i.test(name)
      )

      for (const net of nets[name] || []) {
        if (
          (net.family === "IPv4" || (net as any).family === 4 || String(net.family).includes("4")) &&
          !net.internal
        ) {
          const ip = net.address

          // Skip Tailscale CGNAT range (100.x.x.x)
          if (ip.startsWith("100.")) continue

          let score = 0
          if (!isVirtual) score += 100
          // Prefer Wi-Fi / real Ethernet
          if (/wi-?fi|wlan|wireless/i.test(name)) score += 50
          if (/^ethernet$/i.test(name)) score += 40
          // Prefer private ranges that suggest a real home/office network
          if (ip.startsWith("192.168.")) score += 10
          if (ip.startsWith("10.")) score += 20   // often enterprise / phone hotspot
          if (ip.startsWith("172.")) score += 5

          candidates.push({ ip, name, score })
        }
      }
    }

    // Sort descending by score and take best
    candidates.sort((a, b) => b.score - a.score)
    if (candidates.length > 0) return candidates[0].ip

    return "localhost"
  } catch {
    return "localhost"
  }
}
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
import { sanitizeIp } from "../common/utils"

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
        if (err.code === "EPERM" || err.code === "EBUSY" || err.code === "ENOENT") {
          if (i < retries - 1) await new Promise(r => setTimeout(r, delay))
        } else {
          throw err
        }
      }
    }
  }

  private makeUrl(code: string, requestHost?: string): string {
    // 1. If explicitly configured APP_URL in production (e.g. Vercel)
    const configuredUrl = process.env.APP_URL || process.env.FRONTEND_URL
    if (configuredUrl && !configuredUrl.includes("ngrok") && !configuredUrl.includes("localhost") && !configuredUrl.includes("127.0.0.1")) {
      return `${configuredUrl.replace(/\/+$/, "")}/share/${code}`
    }

    // 2. If request comes from an external host/origin (e.g. Vercel deployment)
    if (requestHost && !requestHost.includes("ngrok") && !requestHost.includes("localhost") && !requestHost.includes("127.0.0.1")) {
      let cleanHost = requestHost.trim().replace(/\/+$/, "")
      if (cleanHost.startsWith("http://") || cleanHost.startsWith("https://")) {
        return `${cleanHost}/share/${code}`
      }
      const frontendPort = process.env.FRONTEND_PORT || "3000"
      const hostPart = cleanHost.replace(/:\d+$/, "")
      return `https://${hostPart}${hostPart.includes(":") ? "" : `:${frontendPort}`}/share/${code}`
    }

    // 3. Local Development: Automatically use actual computer LAN IP so mobile QR scanners (Google Lens) work over Wi-Fi!
    const lanIp = getLanIp()
    const frontendPort = process.env.FRONTEND_PORT || "3000"
    return `http://${lanIp}:${frontendPort}/share/${code}`
  }

  private async validateLink(code: string) {
    const link = await this.prisma.sharedLink.findFirst({
      where: {
        OR: [
          { url: code },
          { id: code },
          { fileId: code },
        ],
      },
    })
    if (!link) throw new NotFoundException("Link not found or file removed")

    if (link.expiresAt && new Date() > link.expiresAt) {
      throw new ForbiddenException("This link has expired")
    }

    if (link.maxDownloads !== null && link.downloads >= link.maxDownloads) {
      throw new ForbiddenException("Maximum download limit reached for this link")
    }

    return link
  }

  private checkIpRestriction(link: { isIPRestricted: boolean; allowedIPs: string[] }, requestIp: string | undefined) {
    if (!link.isIPRestricted || !requestIp) return

    if (link.allowedIPs.length === 0) {
      throw new ForbiddenException("Access restricted by IP configuration")
    }

    const allowed = link.allowedIPs.some(cidr => this.ipMatchesCidr(requestIp, cidr))
    if (!allowed) {
      throw new ForbiddenException("Access restricted by IP configuration")
    }
  }

  private ipMatchesCidr(ip: string, cidr: string): boolean {
    try {
      const ipaddr = require("ipaddr.js")
      if (cidr.includes("/")) {
        const addr = ipaddr.parse(ip)
        const range = ipaddr.parseCIDR(cidr)
        return addr.kind() === range[0].kind() && addr.match(range)
      }
      return ip === cidr
    } catch {
      return ip === cidr
    }
  }

  private validateFileType(mimeType: string | undefined, fileName: string): void {
    if (!mimeType) return
    if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new BadRequestException(`File type "${mimeType}" is not permitted for sharing`)
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
      passwordHash = await argon2.hash(password)
    }
    
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

  getLanIpInfo() {
    const lanIp = getLanIp()
    const frontendPort = process.env.FRONTEND_PORT || "3000"
    return { lanIp, frontendPort, shareBase: `http://${lanIp}:${frontendPort}/share` }
  }

  // Resilient deletion matching by ID, URL, or FileID
  async deleteLink(idOrCode: string, userId: string) {
    const link = await this.prisma.sharedLink.findFirst({
      where: {
        OR: [
          { id: idOrCode },
          { url: idOrCode },
          { fileId: idOrCode },
        ],
      },
    })
    if (!link) throw new NotFoundException("Link not found")
    if (link.userId !== userId) throw new ForbiddenException("Access denied")

    if (link.filePath && existsSync(link.filePath)) {
      await this.safeUnlink(link.filePath)
    }
    await this.prisma.sharedLink.delete({ where: { id: link.id } })

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.SHARE_LINK_DELETE, "shared_link", { linkId: link.id, fileName: link.fileName })
    }
    return { success: true, id: link.id }
  }

  async deleteAllLinks(userId: string) {
    const links = await this.prisma.sharedLink.findMany({ where: { userId } })
    for (const link of links) {
      if (link.filePath && existsSync(link.filePath)) {
        await this.safeUnlink(link.filePath)
      }
    }
    const result = await this.prisma.sharedLink.deleteMany({ where: { userId } })

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true } })
    if (user) {
      await this.audit.logSimple(user.id, user.name, AuditActions.SHARE_LINK_DELETE, "shared_link", { count: result.count })
    }
    return { success: true, count: result.count }
  }

  async accessLink(code: string, requestIp?: string) {
    const link = await this.validateLink(code)
    this.checkIpRestriction(link, requestIp)

    if (link.isGeoRestricted) {
      throw new ForbiddenException("Geo-restriction is active on this link")
    }

    try {
      await this.audit.log(
        link.userId, "anonymous_guest",
        AuditActions.SHARE_LINK_ACCESS, "shared_link",
        sanitizeIp(requestIp), "",
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
      throw new ForbiddenException("Geo-restriction is active on this link")
    }

    if (link.password) {
      if (!password) throw new BadRequestException("Password is required for this secure file")
      const valid = await argon2.verify(link.password, password)
      if (!valid) throw new ForbiddenException("Invalid password")
    }

    if (!link.filePath || !existsSync(link.filePath)) {
      throw new NotFoundException("File no longer exists on server")
    }

    try {
      await this.audit.log(
        link.userId, "anonymous_guest",
        AuditActions.SHARE_LINK_VERIFY, "shared_link",
        sanitizeIp(requestIp), "",
        { code, fileName: link.fileName, fileSize: link.fileSize },
      )
    } catch { /* ignore audit log constraint error for public access */ }

    await this.prisma.sharedLink.update({
      where: { id: link.id },
      data: { downloads: { increment: 1 } },
    })

    const fileSize = link.fileSize || 0
    const fileName = (link.fileName || "download").replace(/["\r\n]/g, "")
    
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
    stream.on("error", (err) => {
      if (!res.headersSent) {
        res.status(500).json({ statusCode: 500, message: "Error reading file stream" })
      }
    })
    stream.pipe(res)
  }
}
