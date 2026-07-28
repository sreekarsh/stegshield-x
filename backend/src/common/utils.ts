import { isIP } from "net"

export function sanitizeIp(ip?: string | null): string {
  if (!ip) return "127.0.0.1"
  let clean = String(ip).trim()
  if (clean === "::1" || clean === "::ffff:127.0.0.1" || clean.toLowerCase() === "localhost") {
    return "127.0.0.1"
  }
  if (clean.startsWith("::ffff:")) {
    clean = clean.substring(7)
  }
  if (isIP(clean) !== 0) {
    return clean
  }
  return "127.0.0.1"
}

export function extractClientIp(req: any): string {
  if (!req) return "127.0.0.1"
  const forwarded = req.headers?.["x-forwarded-for"]
  if (forwarded) {
    const candidate = (typeof forwarded === "string" ? forwarded.split(",")[0] : forwarded?.[0])?.trim()
    if (candidate && isIP(candidate) !== 0) {
      return sanitizeIp(candidate)
    }
  }
  const realIp = req.headers?.["x-real-ip"]
  if (typeof realIp === "string" && realIp.trim() && isIP(realIp.trim()) !== 0) {
    return sanitizeIp(realIp.trim())
  }
  if (typeof req.ip === "string" && req.ip.trim() && isIP(req.ip.trim()) !== 0) {
    return sanitizeIp(req.ip.trim())
  }
  if (req.connection?.remoteAddress) {
    return sanitizeIp(req.connection.remoteAddress)
  }
  if (req.socket?.remoteAddress) {
    return sanitizeIp(req.socket.remoteAddress)
  }
  return "127.0.0.1"
}
