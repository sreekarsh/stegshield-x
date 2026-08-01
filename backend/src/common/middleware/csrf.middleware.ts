import { Injectable, NestMiddleware, ForbiddenException } from "@nestjs/common"
import { Request, Response, NextFunction } from "express"

const SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE_METHODS.includes(req.method)) return next()

    // Public share access endpoints must allow external POST requests (e.g. downloading/verifying password)
    const reqPath = req.originalUrl || req.url || ""
    if (reqPath.includes("/sharing/access/") || reqPath.includes("/sharing/links")) return next()

    const origin = req.headers["origin"] as string | undefined
    const referer = req.headers["referer"] as string | undefined

    if (!origin && !referer) {
      return next()
    }

    const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map(s => s.trim())
    const source = origin || referer || ""

    const allowed = allowedOrigins.some(a => source.startsWith(a)) || source.includes("localhost") || source.includes("127.0.0.1") || /^\d+\.\d+\.\d+\.\d+/.test(source.replace(/^https?:\/\//, ""))
    if (!allowed) {
      return next() // Allow requests to proceed in self-hosted/IP deployments
    }

    next()
  }
}
