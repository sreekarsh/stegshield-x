import { Injectable, InternalServerErrorException, BadRequestException } from "@nestjs/common"
import * as crypto from "crypto"
import * as os from "os"
import * as path from "path"
import * as fs from "fs"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

const BUNDLED_QPDF = path.join(process.cwd(), "bin", "qpdf")

function getQpdfPath(): string {
  if (process.env.QPDF_PATH && fs.existsSync(process.env.QPDF_PATH)) return process.env.QPDF_PATH
  if (fs.existsSync(BUNDLED_QPDF)) return BUNDLED_QPDF
  if (process.platform === "win32") {
    try {
      const result = require("child_process").execSync("where qpdf", { stdio: "pipe", encoding: "utf8" })
      const p = (result as string).trim().split(/\r?\n/)[0]?.trim()
      if (p && fs.existsSync(p)) return p
    } catch {}
    try {
      const dirs = fs.readdirSync("C:\\Program Files").filter(d => d.toLowerCase().startsWith("qpdf"))
      for (const dir of dirs) {
        const candidate = path.join("C:\\Program Files", dir, "bin", "qpdf.exe")
        if (fs.existsSync(candidate)) return candidate
      }
    } catch {}
    return "C:\\Program Files\\qpdf\\bin\\qpdf.exe"
  }
  return "qpdf"
}

function qpdfExists(bin: string): boolean {
  if (fs.existsSync(bin)) return true
  try {
    const result = require("child_process").execSync(`which ${bin}`, { stdio: "pipe", encoding: "utf8" })
    const p = (result as string).trim()
    return !!p && fs.existsSync(p)
  } catch {
    return false
  }
}

const QPDF_PATH = getQpdfPath()

function qpdfEnv(): Record<string, string> {
  const libDir = path.join(process.cwd(), "lib")
  const ldPath = process.env.LD_LIBRARY_PATH
  const newLdPath = ldPath ? `${libDir}:${ldPath}` : libDir
  return process.platform === "linux" || process.platform === "darwin"
    ? { LD_LIBRARY_PATH: newLdPath }
    : {}
}

function tmpPdf(suffix: string): string {
  return path.join(os.tmpdir(), `pdf_${suffix}_${crypto.randomBytes(8).toString("hex")}.pdf`)
}

@Injectable()
export class PdfService {
  private async isEncrypted(filePath: string): Promise<boolean> {
    try {
      await execFileAsync(QPDF_PATH, ["--is-encrypted", "--", filePath], { env: { ...process.env, ...qpdfEnv() } })
      return true
    } catch (e: any) {
      if (e.code === 2) return false
      throw new InternalServerErrorException(`Failed to check PDF encryption: ${e.message || e.stderr || "unknown error"}`)
    }
  }

  async protect(data: Buffer, password: string): Promise<Buffer> {
    if (!qpdfExists(QPDF_PATH)) {
      throw new InternalServerErrorException(
        `qpdf not found at ${QPDF_PATH}. Install qpdf or set QPDF_PATH env var.`
      )
    }
    const inputPath = tmpPdf("in")
    const outputPath = tmpPdf("out")
    try {
      await fs.promises.writeFile(inputPath, data)

      if (await this.isEncrypted(inputPath)) {
        throw new BadRequestException(
          "This PDF is already password-protected. Use 'Unlock PDF' first."
        )
      }

      const ownerPw = crypto.randomBytes(16).toString("hex")
      await execFileAsync(QPDF_PATH, [
        "--warning-exit-0",
        "--encrypt", password, ownerPw, "256",
        "--print=none", "--modify=none", "--extract=n", "--annotate=n",
        "--", inputPath, outputPath,
      ], { env: { ...process.env, ...qpdfEnv() } })
      return fs.promises.readFile(outputPath)
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e
      throw new InternalServerErrorException(`PDF protection failed: ${e.message}`)
    } finally {
      try { await fs.promises.unlink(inputPath) } catch {}
      try { await fs.promises.unlink(outputPath) } catch {}
    }
  }

  async unlock(data: Buffer, password: string): Promise<Buffer> {
    if (!qpdfExists(QPDF_PATH)) {
      throw new InternalServerErrorException(
        `qpdf not found at ${QPDF_PATH}. Install qpdf or set QPDF_PATH env var.`
      )
    }
    const inputPath = tmpPdf("in")
    const outputPath = tmpPdf("out")
    try {
      await fs.promises.writeFile(inputPath, data)

      if (!(await this.isEncrypted(inputPath))) {
        throw new BadRequestException("PDF is not password-protected")
      }

      await execFileAsync(QPDF_PATH, [
        "--warning-exit-0",
        "--decrypt", `--password=${password}`,
        "--", inputPath, outputPath,
      ], { env: { ...process.env, ...qpdfEnv() } })
      return fs.promises.readFile(outputPath)
    } catch (e: any) {
      if (e instanceof BadRequestException) throw e
      const errText = ((e.stderr || "") + (e.message || "")).toLowerCase()
      if (
        errText.includes("invalid password") ||
        errText.includes("bad password") ||
        errText.includes("password incorrect") ||
        errText.includes("wrong password") ||
        (e.code === 2 && errText.includes("password"))
      ) {
        throw new BadRequestException("Incorrect password")
      }
      throw new InternalServerErrorException(`PDF unlock failed: ${e.message || e.stderr || "unknown error"}`)
    } finally {
      try { await fs.promises.unlink(inputPath) } catch {}
      try { await fs.promises.unlink(outputPath) } catch {}
    }
  }
}
