import { Injectable, HttpException, HttpStatus } from "@nestjs/common"
import * as http from "http"
import * as https from "https"
import { Response } from "express"

@Injectable()
export class AiService {
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor() {
    this.baseUrl = (process.env.AI_SERVICE_URL || "http://localhost:8000").replace(/['"]/g, "").trim()
    this.apiKey = (process.env.AI_API_KEY || "stegshield-ai-key-change-in-production").replace(/['"]/g, "").trim()
  }

  private getAgent(url: string) {
    return url.startsWith("https") ? https : http
  }

  private authHeaders(): Record<string, string> {
    return this.apiKey ? { "Authorization": `Bearer ${this.apiKey}` } : {}
  }

  async chatStream(messages: { role: string; content: string }[], res: Response) {
    const url = `${this.baseUrl}/chat/stream`
    const agent = this.getAgent(url)
    const parsedUrl = new URL(url)
    const body = JSON.stringify({ messages })

    // Flush headers immediately so the browser starts receiving SSE right away
    res.flushHeaders()

    return new Promise<void>((resolve) => {
      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https") ? 443 : 80),
        path: parsedUrl.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body).toString(),
          ...this.authHeaders(),
        },
        timeout: 60000,
      }

      const req = agent.request(options, (proxyRes) => {
        proxyRes.on("data", (chunk: Buffer) => {
          res.write(chunk)
        })
        proxyRes.on("end", () => {
          res.end()
          resolve()
        })
        proxyRes.on("error", () => {
          res.end()
          resolve()
        })
      })

      const sendFallback = (prefix: string) => {
        res.write(`data: ${JSON.stringify({ content: prefix })}\n\n`)
        const localResponse = this.generateLocalResponse(messages)
        // Send word-by-word for a streaming feel instead of char-by-char
        const words = localResponse.split(" ")
        for (const word of words) {
          res.write(`data: ${JSON.stringify({ content: word + " " })}\n\n`)
        }
        res.write("data: [DONE]\n\n")
        res.end()
        resolve()
      }

      req.on("error", () => sendFallback("*AI service unavailable — local response:*\n\n"))
      req.on("timeout", () => { req.destroy(); sendFallback("*AI timeout — local response:*\n\n") })

      req.write(body)
      req.end()
    })
  }

  private generateLocalResponse(messages: { role: string; content: string }[]): string {
    if (!messages.length) return this.greeting()

    const all = messages.map(m => m.content.toLowerCase()).join("\n")

    if (all.includes("password") || all.includes("passphrase") || all.includes("login"))
      return "**Password Security Tips**\n\n" +
        "• Use at least 12 characters with mixed case, numbers, and symbols\n" +
        "• Avoid common words, sequences, or repeated characters\n" +
        "• Use a unique password for every account\n" +
        "• Enable multi-factor authentication (MFA) wherever possible\n" +
        "• Consider using a password manager like Bitwarden or 1Password\n" +
        "• Change passwords immediately if you suspect a breach\n\n" +
        "For an automated strength check, upload a sample or use the Password Analyzer tool."

    if (all.includes("stego") || all.includes("steganography") || all.includes("hidden") || all.includes("embed") || all.includes("lsb"))
      return "**Steganography Detection**\n\n" +
        "Steganography hides data inside images, audio, or video files. Common techniques:\n" +
        "• **LSB (Least Significant Bit)** — alters the least significant bits of pixel data\n" +
        "• **DCT-based** — modifies frequency coefficients in JPEG images\n" +
        "• **Palette-based** — manipulates color palette entries in indexed images\n\n" +
        "Use the **Steganalysis Tool** to upload an image and detect hidden payloads via:\n" +
        "- Entropy analysis (statistical anomaly detection)\n" +
        "- LSB brute-force extraction\n" +
        "- Metadata anomaly scanning"

    if (all.includes("threat") || all.includes("malware") || all.includes("virus") || all.includes("ransomware") || all.includes("phish"))
      return "**Threat Detection & Analysis**\n\n" +
        "StegShield can analyze files for potential threats:\n" +
        "• **File entropy analysis** — detects encrypted or obfuscated payloads\n" +
        "• **String extraction** — surfaces URLs, IPs, and suspicious patterns\n" +
        "• **Embedded file carving** — recovers hidden files from containers\n\n" +
        "Upload a suspicious file to the **Threat Analyzer** for a full report."

    if (all.includes("tamper") || all.includes("manipulat") || all.includes("forgery") || all.includes("photoshop") || all.includes("edited"))
      return "**Tamper Detection**\n\n" +
        "Image tamper detection checks for:\n" +
        "• **Error Level Analysis (ELA)** — highlights compression differences\n" +
        "• **Clone detection** — finds copy-moved regions\n" +
        "• **Metadata inconsistencies** — mismatched camera/software tags\n" +
        "• **JPEG ghost detection** — reveals double-saved regions\n\n" +
        "Upload an image to the **Tamper Detector** (requires AI service for full analysis)."

    if (all.includes("deepfake") || all.includes("ai generated") || all.includes("synthetic") || all.includes("gan"))
      return "**Deepfake Detection**\n\n" +
        "Our deepfake analysis checks for:\n" +
        "• Facial inconsistency artifacts (asymmetric lighting, blending issues)\n" +
        "• Unnatural eye/blink patterns\n" +
        "• Frequency-domain anomalies\n" +
        "• Metadata that indicates AI generation tools\n\n" +
        "Upload a suspected deepfake to the **Deepfake Analyzer** (requires AI service)."

    if (all.includes("metadata") || all.includes("exif") || all.includes("privacy"))
      return "**Metadata Privacy**\n\n" +
        "Images and documents often carry hidden metadata that leaks private information:\n" +
        "• **GPS coordinates** — where the photo was taken\n" +
        "• **Camera model & settings** — device fingerprinting\n" +
        "• **Software history** — editing tools used\n" +
        "• **Timestamps** — when the file was created/modified\n\n" +
        "Use the **Metadata Privacy Tool** to analyze and strip all metadata before sharing files."

    if (all.includes("encrypt") || all.includes("cipher") || all.includes("aes") || all.includes("gcm"))
      return "**Encryption Best Practices**\n\n" +
        "• **AES-256-GCM** is our recommended cipher — authenticated encryption prevents padding oracle attacks\n" +
        "• Always use unique, cryptographically random IVs/nonces\n" +
        "• Store keys securely (never hardcode or commit to version control)\n" +
        "• Use **Image Encryption** to encrypt images with password-derived keys\n" +
        "• For maximum security, combine encryption with steganographic concealment"

    if (all.includes("forensic") || all.includes("digital forensic") || all.includes("investigat") || all.includes("carve") || all.includes("recover"))
      return "**Digital Forensics**\n\n" +
        "StegShield provides forensic tools for:\n" +
        "• **File carving** — recover deleted or embedded files from disk images\n" +
        "• **String extraction** — find URLs, IPs, email addresses, and passwords in binary data\n" +
        "• **Entropy analysis** — identify encrypted or compressed regions\n" +
        "• **Trust scoring** — assess file authenticity based on metadata consistency\n\n" +
        "Upload a file to the **Forensics Kit** for analysis."

    if (all.includes("hello") || all.includes("hi ") || all.includes("hey") || all.includes("help") || all.includes("what can"))
      return this.greeting()

    if (all.includes("trust") || all.includes("score") || all.includes("authentic"))
      return "**Trust Score Analysis**\n\n" +
        "The Trust Score Generator evaluates a file's authenticity based on:\n" +
        "• File size and type consistency\n" +
        "• Encryption status\n" +
        "• Metadata presence and anomalies\n" +
        "• Compression artifacts\n\n" +
        "Use the **Trust Score** tool for a detailed assessment."

    return this.greeting()
  }

  private greeting(): string {
    return "**Welcome to StegShield X AI Security Assistant**\n\nI can help you with password security, steganalysis, threat detection, tamper detection, deepfake analysis, metadata privacy, digital forensics, and encryption best practices. Type a question or describe what you'd like to analyze."
  }

  private async request(method: string, path: string, body?: any, file?: Buffer, filename?: string): Promise<any> {
    const url = `${this.baseUrl}${path}`
    const agent = this.getAgent(url)
    const parsedUrl = new URL(url)

    return new Promise((resolve, reject) => {
      let bodyBuffer: Buffer | null = null
      let contentType = "application/json"

      if (file) {
        const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
        contentType = `multipart/form-data; boundary=${boundary}`
        const parts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
          file,
          `\r\n--${boundary}--\r\n`,
        ]
        bodyBuffer = Buffer.concat(parts.map(p => (typeof p === "string" ? Buffer.from(p) : p)))
      } else if (body) {
        bodyBuffer = Buffer.from(JSON.stringify(body))
      }

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (url.startsWith("https") ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method,
        headers: {
          ...(contentType ? { "Content-Type": contentType } : {}),
          ...(bodyBuffer ? { "Content-Length": bodyBuffer.length.toString() } : {}),
          ...this.authHeaders(),
        },
        timeout: 30000,
      }

      const req = agent.request(options, (res) => {
        const chunks: Buffer[] = []
        res.on("data", (chunk: Buffer) => chunks.push(chunk))
        res.on("end", () => {
          const raw = Buffer.concat(chunks).toString()
          try {
            resolve(JSON.parse(raw))
          } catch {
            resolve(raw)
          }
        })
      })

      req.on("error", (err: any) => {
        const msg = err.code === "ECONNREFUSED"
          ? "AI service is not running. Start it with: uvicorn main:app --host 0.0.0.0 --port 8000"
          : err.code === "ECONNRESET"
          ? "AI service connection was reset"
          : err.message || "AI service unreachable"
        reject(new HttpException(msg, HttpStatus.BAD_GATEWAY))
      })
      req.on("timeout", () => { req.destroy(); reject(new HttpException("AI service timeout", HttpStatus.GATEWAY_TIMEOUT)) })

      if (bodyBuffer) req.write(bodyBuffer)
      req.end()
    })
  }

  async health() { return this.request("GET", "/health") }

  async analyzeEntropy(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/entropy", undefined, file, filename)
  }

  async analyzeStego(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/stego", undefined, file, filename)
  }

  async analyzeThreat(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/threat", undefined, file, filename)
  }

  async analyzePassword(password: string) {
    try {
      return await this.request("POST", "/analyze/password", { password })
    } catch {
      const common = new Set([
        "password", "123456", "123456789", "qwerty", "abc123", "password123",
        "admin", "letmein", "welcome", "monkey", "dragon", "master", "hello",
        "freedom", "whatever", "qazwsx", "trustno1", "jordan", "harley",
        "12345678", "1234567", "password1", "12345", "1234567890", "qwerty123",
        "1q2w3e4r", "1qaz2wsx", "superman", "batman", "shadow", "michael",
        "iloveyou", "hunter", "starwars", "passw0rd", "p@ssword", "p@ssw0rd",
        "changeme", "secret", "summer", "winter", "charlie", "daniel",
        "mustang", "corvette", "dallas", "houston", "chicago", "boston",
      ])
      const pw = password.toLowerCase().trim()
      if (common.has(pw)) {
        return { strength_score: 0, grade: "very_weak", feedback: "This password is commonly used — change immediately" }
      }

      let finalScore = 0
      const length = password.length

      const hasLower = /[a-z]/.test(password)
      const hasUpper = /[A-Z]/.test(password)
      const hasDigit = /[0-9]/.test(password)
      const hasSymbol = /[^a-zA-Z0-9]/.test(password)
      const types = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length

      if (length >= 16) finalScore += 30
      else if (length >= 12) finalScore += 20
      else if (length >= 10) finalScore += 10
      else if (length >= 8) finalScore += 5

      if (types >= 3) finalScore += 25
      else if (types >= 2) finalScore += 15
      else if (types >= 1) finalScore += 5

      if (length >= 8 && types >= 3) finalScore += 15
      if (length >= 12 && types >= 3) finalScore += 10

      if (/(.)\1{3,}/.test(password)) finalScore = Math.max(0, finalScore - 20)
      else if (/(.)\1{2,}/.test(password)) finalScore = Math.max(0, finalScore - 10)

      const seqMatch = password.toLowerCase().match(/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789|qwerty|asdfgh|zxcvbn|qaz|wsx|edc|rfv)/)
      if (seqMatch) finalScore = Math.max(0, finalScore - 10)

      if (/^[a-zA-Z]+$/.test(password) || /^\d+$/.test(password)) finalScore = Math.max(0, finalScore - 10)

      finalScore = Math.max(0, Math.min(100, finalScore))

      const grade = finalScore >= 80 ? "strong" : finalScore >= 60 ? "fair" : finalScore >= 40 ? "weak" : "very_weak"
      const feedback = finalScore >= 80 ? "Excellent password — highly resistant to attacks"
        : finalScore >= 60 ? "Good password — consider adding more length or character variety"
        : finalScore >= 40 ? "Moderate — increase length and use more character types"
        : "Weak — easily guessable, use at least 12 characters with mixed types"

      return { strength_score: finalScore, grade, feedback }
    }
  }

  async analyzeMetadataRisk(metadata: Record<string, any>) {
    return this.request("POST", "/analyze/metadata-risk", { metadata })
  }

  async analyzeAdvancedTamper(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/advanced-tamper", undefined, file, filename)
  }

  async detectTamper(file: Buffer, filename: string) {
    return this.request("POST", "/detect/tamper", undefined, file, filename)
  }

  async detectDeepfake(file: Buffer, filename: string) {
    return this.request("POST", "/detect/deepfake", undefined, file, filename)
  }

  async generateSecretLanguage(data: {
    theme?: string
    scriptType?: string
    complexity?: string
    includeDigits?: boolean
    includePunctuation?: boolean
    glyphCount?: number
  }) {
    try {
      return await this.request("POST", "/generate/secret-language", data)
    } catch {
      return {
        name: "ScriptError",
        glyphs: [],
        description: "AI service unavailable — generated fallback",
        version: "1.0",
      }
    }
  }

  async extractStrings(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/strings", undefined, file, filename)
  }

  async carveEmbedded(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/carve", undefined, file, filename)
  }

  async analyzeExif(file: Buffer, filename: string) {
    return this.request("POST", "/analyze/exif", undefined, file, filename)
  }

  async cleanMetadata(file: Buffer, filename: string): Promise<{ cleaned_file_base64?: string; [key: string]: any }> {
    return this.request("POST", "/clean/metadata", undefined, file, filename)
  }

  async securityAnalysis(data: { mfa_enabled: boolean; key_age_days: number; old_password: boolean; recent_actions: any[] }) {
    try {
      return await this.request("POST", "/analyze/security", data)
    } catch {
      const issues: { severity: string; title: string; description: string }[] = []
      if (!data.mfa_enabled) issues.push({ severity: "high", title: "MFA Not Enabled", description: "Enable multi-factor authentication" })
      if (data.old_password) issues.push({ severity: "medium", title: "Password Recently Changed", description: "Consider updating your password" })
      if (data.recent_actions.length === 0) issues.push({ severity: "low", title: "No Recent Activity", description: "Your account has been inactive" })
      return {
        security_score: data.mfa_enabled ? 70 : 40,
        issues,
        overall_score: data.mfa_enabled ? 70 : 40,
        grade: data.mfa_enabled ? "good" : "needs_attention",
      }
    }
  }
}
