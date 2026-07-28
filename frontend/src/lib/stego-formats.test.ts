import { describe, it, expect } from "vitest"
import {
  detectFormat,
  canUseSpatialLsb,
  parseWavDataChunk,
  embedAppendSteno,
  extractAppendSteno,
} from "./stego-formats"

describe("stego-formats utilities", () => {
  describe("detectFormat", () => {
    it("should identify PNG format by magic bytes", () => {
      const pngMagic = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
      expect(detectFormat("image.png", pngMagic)).toBe("PNG")
    })

    it("should identify JPEG format by magic bytes", () => {
      const jpegMagic = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
      expect(detectFormat("photo.jpg", jpegMagic)).toBe("JPEG")
    })

    it("should identify WAV format by RIFF header", () => {
      const wavMagic = new Uint8Array([0x52, 0x49, 0x46, 0x46])
      expect(detectFormat("audio.wav", wavMagic)).toBe("WAV")
    })

    it("should fallback to file extension when magic bytes are unknown", () => {
      const unknownMagic = new Uint8Array([0x00, 0x00, 0x00, 0x00])
      expect(detectFormat("track.mp3", unknownMagic)).toBe("MP3")
      expect(detectFormat("doc.pdf", unknownMagic)).toBe("PDF")
      expect(detectFormat("file.unknown", unknownMagic)).toBe("UNKNOWN")
    })
  })

  describe("canUseSpatialLsb", () => {
    it("should return true for PNG, BMP, GIF, WAV", () => {
      expect(canUseSpatialLsb("PNG")).toBe(true)
      expect(canUseSpatialLsb("BMP")).toBe(true)
      expect(canUseSpatialLsb("WAV")).toBe(true)
    })

    it("should return false for lossy or unstructured formats", () => {
      expect(canUseSpatialLsb("JPEG")).toBe(false)
      expect(canUseSpatialLsb("MP3")).toBe(false)
      expect(canUseSpatialLsb("PDF")).toBe(false)
    })
  })

  describe("Append Steganography (embed & extract)", () => {
    it("should embed and extract secret payload accurately", () => {
      const carrier = new Uint8Array([10, 20, 30, 40, 50])
      const secret = new TextEncoder().encode("TopSecretPayload123")

      const stegoContainer = embedAppendSteno(carrier, secret)
      expect(stegoContainer.length).toBeGreaterThan(carrier.length)

      const extracted = extractAppendSteno(stegoContainer)
      expect(extracted).not.toBeNull()
      const decodedSecret = new TextDecoder().decode(extracted!)
      expect(decodedSecret).toBe("TopSecretPayload123")
    })

    it("should return null when extracting from data without stego marker", () => {
      const cleanData = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(extractAppendSteno(cleanData)).toBeNull()
    })
  })

  describe("parseWavDataChunk", () => {
    it("should return null for non-WAV bytes", () => {
      const invalid = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(parseWavDataChunk(invalid)).toBeNull()
    })
  })
})
