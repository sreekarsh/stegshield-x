jest.mock("fs", () => {
  const actual = jest.requireActual("fs")
  return {
    ...actual,
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
  }
})

import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, NotFoundException } from "@nestjs/common"
import { StegoService } from "./stego.service"
import { PrismaService } from "../prisma/prisma.service"
import * as fsMock from "fs"

function createTestCarrier(width = 100, height = 100): Buffer {
  const pixels: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pixels.push(x % 256, y % 256, (x + y) % 256)
    }
  }
  return Buffer.from(new Uint8Array(pixels))
}

function embedInLSB(carrier: Buffer, payload: Buffer): Buffer {
  const pixels = new Uint8Array(carrier)
  const headerSize = 32
  const totalBits = headerSize + payload.length * 8
  if (totalBits > pixels.length * 8) throw new Error("Message too large")

  for (let b = 0; b < headerSize; b++) {
    const bit = (payload.length >> (headerSize - 1 - b)) & 1
    pixels[b] = (pixels[b] & 0xFE) | bit
  }

  for (let i = 0; i < payload.length; i++) {
    for (let b = 7; b >= 0; b--) {
      const idx = headerSize + i * 8 + (7 - b)
      pixels[idx] = (pixels[idx] & 0xFE) | ((payload[i] >> b) & 1)
    }
  }

  return Buffer.from(pixels)
}

describe("StegoService", () => {
  let service: StegoService
  let prisma: Record<string, any>
  const carrierBuffer = createTestCarrier(100, 100)

  beforeEach(async () => {
    prisma = {
      evidence: {
        findUnique: jest.fn(),
      },
      stegoFile: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
    }

    jest.clearAllMocks()
    ;(fsMock.existsSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes("carrier-1") || path.includes("carrier-rt")) return true
      if (path.includes("stego")) return true
      return false
    })
    let carrierForRead = carrierBuffer
    ;(fsMock.readFileSync as jest.Mock).mockImplementation((path: string) => {
      if (typeof path === "string" && path.includes("carrier-rt")) return carrierForRead
      return carrierBuffer
    })
    ;(fsMock.writeFileSync as jest.Mock).mockImplementation((path: string, data: Buffer) => {
      if (typeof path === "string" && path.includes("carrier-rt")) { carrierForRead = data }
    })

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StegoService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile()

    service = module.get<StegoService>(StegoService)
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("embed", () => {
    const carrierEvidence = {
      id: "carrier-1",
      userId: "user-1",
      filePath: "/uploads/evidence/carrier-1.enc",
      type: "image/png",
      name: "test.png",
    }

    beforeEach(() => {
      prisma.evidence.findUnique.mockResolvedValue(carrierEvidence)
    })

    it("should reject missing carrierId", async () => {
      await expect(service.embed("user-1", { carrierId: "", message: "hello" }))
        .rejects.toThrow(BadRequestException)
    })

    it("should reject missing message", async () => {
      await expect(service.embed("user-1", { carrierId: "cid-1", message: "" }))
        .rejects.toThrow(BadRequestException)
    })

    it("should reject non-existent carrier", async () => {
      prisma.evidence.findUnique.mockResolvedValue(null)

      await expect(service.embed("user-1", { carrierId: "missing", message: "hello" }))
        .rejects.toThrow(NotFoundException)
    })

    it("should reject carrier not found on disk", async () => {
      ;(fsMock.existsSync as jest.Mock).mockReturnValue(false)

      await expect(service.embed("user-1", { carrierId: "carrier-1", message: "hello" }))
        .rejects.toThrow("not found on disk")
    })

    it("should reject unsupported carrier type", async () => {
      prisma.evidence.findUnique.mockResolvedValue({
        ...carrierEvidence,
        type: "application/svg",
      })

      await expect(service.embed("user-1", { carrierId: "carrier-1", message: "hello" }))
        .rejects.toThrow("Unsupported carrier type")
    })

    it("should reject message too large for carrier", async () => {
      const bigMessage = "x".repeat(100000)
      ;(fsMock.readFileSync as jest.Mock).mockReturnValue(createTestCarrier(10, 10))

      await expect(service.embed("user-1", { carrierId: "carrier-1", message: bigMessage }))
        .rejects.toThrow("Message too large")
    })

    it("should embed message successfully", async () => {
      prisma.stegoFile.create.mockResolvedValue({
        id: "stego-1",
        name: "stego_test.png",
        algorithm: "LSB-spatial",
        encryption: "none",
        hiddenDataSize: 5,
      })

      const result = await service.embed("user-1", { carrierId: "carrier-1", message: "hello" })

      expect(result.id).toBe("stego-1")
      expect(result.algorithm).toBe("LSB-spatial")
      expect(result.encryption).toBe("none")
      expect(fsMock.writeFileSync).toHaveBeenCalled()
    })

    it("should embed with AES-256-GCM encryption", async () => {
      prisma.stegoFile.create.mockResolvedValue({
        id: "stego-2",
        name: "stego_test.png",
        algorithm: "LSB-spatial",
        encryption: "AES-256-GCM",
        hiddenDataSize: 6,
      })

      const result = await service.embed("user-1", { carrierId: "carrier-1", message: "secret", encrypt: true })

      expect(result.encryption).toBe("AES-256-GCM")
    })

    it("should use append-stego algorithm for MP4 files", async () => {
      prisma.evidence.findUnique.mockResolvedValue({
        ...carrierEvidence,
        type: "video/mp4",
      })
      prisma.stegoFile.create.mockResolvedValue({
        id: "stego-3",
        name: "stego_test.mp4",
        algorithm: "append-stego",
        encryption: "none",
        hiddenDataSize: 4,
      })

      const result = await service.embed("user-1", { carrierId: "carrier-1", message: "test" })
      expect(result.algorithm).toBe("append-stego")
    })
  })

  describe("extract", () => {
    const stegoRecord = {
      id: "stego-1",
      carrierFile: "carrier-1",
      algorithm: "LSB-spatial",
      encryption: "none",
      hiddenDataSize: 5,
    }

    beforeEach(() => {
      prisma.stegoFile.findUnique.mockResolvedValue(stegoRecord)
      prisma.evidence.findUnique.mockResolvedValue({
        id: "carrier-1",
        filePath: "/uploads/evidence/carrier-1.enc",
      })
      ;(fsMock.existsSync as jest.Mock).mockReturnValue(true)
    })

    it("should reject missing fileId", async () => {
      await expect(service.extract({ fileId: "" }))
        .rejects.toThrow(BadRequestException)
    })

    it("should reject non-existent stego record", async () => {
      prisma.stegoFile.findUnique.mockResolvedValue(null)

      await expect(service.extract({ fileId: "missing" }))
        .rejects.toThrow(NotFoundException)
    })

    it("should extract plain message from carrier", async () => {
      const stegoBuf = embedInLSB(carrierBuffer, Buffer.from("hello", "utf-8"))
      ;(fsMock.readFileSync as jest.Mock).mockReturnValue(stegoBuf)

      const result = await service.extract({ fileId: "stego-1" })
      expect(result.message).toBe("hello")
    })

    it("should extract with XOR key decryption", async () => {
      const msg = "decoded"
      const key = "mykey"
      const messageBuf = Buffer.from(msg, "utf-8")
      const keyBuf = Buffer.from(key, "utf-8")
      const xorBuf = Buffer.alloc(messageBuf.length)
      for (let i = 0; i < messageBuf.length; i++) {
        xorBuf[i] = messageBuf[i] ^ keyBuf[i % keyBuf.length]
      }
      const stegoBuf = embedInLSB(carrierBuffer, xorBuf)
      ;(fsMock.readFileSync as jest.Mock).mockReturnValue(stegoBuf)

      const result = await service.extract({ fileId: "stego-1", key })
      expect(result.message).toBe("decoded")
    })

    it("should reject non-existent carrier on disk", async () => {
      prisma.evidence.findUnique.mockResolvedValue(null)

      await expect(service.extract({ fileId: "stego-1" }))
        .rejects.toThrow("not found")
    })
  })

  describe("getFiles", () => {
    it("should return user's stego files", async () => {
      prisma.stegoFile.findMany.mockResolvedValue([{ id: "stego-1" }])

      const files = await service.getFiles("user-1")
      expect(files).toHaveLength(1)
    })

    it("should apply decoy mode filter", async () => {
      prisma.stegoFile.findMany.mockResolvedValue([])

      const files = await service.getFiles("user-1", true, "fake-vault")
      expect(prisma.stegoFile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "user-1", id: "fake-vault" } }),
      )
    })
  })

  describe("LSB roundtrip", () => {
    it("should correctly embed and extract a message through the public API", async () => {
      prisma.evidence.findUnique.mockResolvedValue({
        id: "carrier-rt",
        userId: "user-1",
        filePath: "/uploads/evidence/carrier-rt.enc",
        type: "image/png",
        name: "carrier.png",
      })
      prisma.stegoFile.create.mockResolvedValue({
        id: "stego-rt",
        name: "stego_carrier.png",
        algorithm: "LSB-spatial",
        encryption: "none",
        hiddenDataSize: 11,
      })
      const msg = "roundtrip-ok"

      const embedResult = await service.embed("user-1", { carrierId: "carrier-rt", message: msg })
      expect(embedResult.id).toBe("stego-rt")

      prisma.stegoFile.findUnique.mockResolvedValue({
        id: "stego-rt",
        carrierFile: "carrier-rt",
        algorithm: "LSB-spatial",
        encryption: "none",
        hiddenDataSize: 11,
      })

      const extractResult = await service.extract({ fileId: "stego-rt" })
      expect(extractResult.message).toBe(msg)
    })
  })
})
