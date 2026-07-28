import { Injectable, BadRequestException } from "@nestjs/common"
import * as crypto from "crypto"

const MODULUS = 257

function mod(n: number): number {
  return ((n % MODULUS) + MODULUS) % MODULUS
}

function evalPoly(coefficients: number[], x: number): number {
  let result = 0
  for (let i = coefficients.length - 1; i >= 0; i--) {
    result = mod(result * x + coefficients[i])
  }
  return result
}

function lagrangeInterpolate(shares: { x: number; y: number }[], x: number): number {
  let result = 0
  for (let i = 0; i < shares.length; i++) {
    let term = shares[i].y
    for (let j = 0; j < shares.length; j++) {
      if (i !== j) {
        const diff = shares[i].x - shares[j].x
        if (diff === 0) throw new BadRequestException("Duplicate share index detected")
        term = mod(term * mod((x - shares[j].x) * modInverse(diff)))
      }
    }
    result = mod(result + term)
  }
  return result
}

function modInverse(a: number): number {
  a = mod(a)
  for (let x = 1; x < MODULUS; x++) {
    if (mod(a * x) === 1) return x
  }
  throw new BadRequestException("Modular inverse not found for given shares")
}

@Injectable()
export class ShamirService {
  split(dto: { secret: string; parts: number; threshold: number }) {
    const { secret, parts, threshold } = dto
    if (threshold < 2) throw new BadRequestException("Threshold must be at least 2")
    if (parts < threshold) throw new BadRequestException("Parts must be >= threshold")
    if (parts > 255) throw new BadRequestException("Parts cannot exceed 255")
    if (!secret) throw new BadRequestException("Secret is required")

    const bytes = Buffer.from(secret, "utf-8")
    const polys = Array.from(bytes, (byte) => {
      const coeffs = Array.from({ length: threshold - 1 }, () =>
        crypto.randomInt(0, MODULUS)
      )
      return [byte, ...coeffs]
    })

    const shares: string[] = []
    for (let i = 1; i <= parts; i++) {
      const buf = Buffer.alloc(1 + polys.length * 2)
      buf[0] = i
      for (let p = 0; p < polys.length; p++) {
        buf.writeUInt16LE(evalPoly(polys[p], i), 1 + p * 2)
      }
      shares.push(buf.toString("base64"))
    }

    return { shares, threshold, parts }
  }

  recover(dto: { shares: string[]; threshold: number }) {
    const { shares: encoded, threshold } = dto
    if (!encoded || !Array.isArray(encoded) || encoded.length < threshold) {
      throw new BadRequestException(`Need at least ${threshold} valid shares to recover`)
    }

    const decoded = encoded.map((s) => Buffer.from(String(s).trim(), "base64"))
    const valueCount = Math.min(...decoded.map((d) => (d.length - 1) / 2))
    if (valueCount < 1) throw new BadRequestException("Invalid share data")

    const result: number[] = []
    for (let b = 0; b < valueCount; b++) {
      const points = decoded.slice(0, threshold).map((d) => ({
        x: d[0],
        y: d.readUInt16LE(1 + b * 2),
      }))
      result.push(lagrangeInterpolate(points, 0))
    }

    const secret = Buffer.from(result).toString("utf-8")
    return { recovered: true, secret }
  }
}
