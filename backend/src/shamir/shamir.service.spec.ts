import { Test, TestingModule } from "@nestjs/testing"
import { BadRequestException, InternalServerErrorException } from "@nestjs/common"
import { ShamirService } from "./shamir.service"

describe("ShamirService", () => {
  let service: ShamirService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ShamirService],
    }).compile()

    service = module.get<ShamirService>(ShamirService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("split", () => {
    it("should split a secret into shares", () => {
      const result = service.split({ secret: "Hello World", parts: 5, threshold: 3 })
      expect(result.shares).toHaveLength(5)
      expect(result.threshold).toBe(3)
      expect(result.parts).toBe(5)
    })

    it("should produce unique shares", () => {
      const result = service.split({ secret: "Test Secret", parts: 3, threshold: 2 })
      const unique = new Set(result.shares)
      expect(unique.size).toBe(3)
    })

    it("should reject threshold less than 2", () => {
      expect(() => service.split({ secret: "Test", parts: 3, threshold: 1 })).toThrow(BadRequestException)
    })

    it("should reject parts less than threshold", () => {
      expect(() => service.split({ secret: "Test", parts: 2, threshold: 3 })).toThrow(BadRequestException)
    })

    it("should reject empty secret", () => {
      expect(() => service.split({ secret: "", parts: 3, threshold: 2 })).toThrow(BadRequestException)
    })
  })

  describe("recover", () => {
    it("should recover the original secret", () => {
      const split = service.split({ secret: "Hello World", parts: 5, threshold: 3 })
      const recover = service.recover({ shares: [split.shares[0], split.shares[2], split.shares[4]], threshold: 3 })
      expect(recover.recovered).toBe(true)
      expect(recover.secret).toBe("Hello World")
    })

    it("should recover with minimum threshold shares", () => {
      const split = service.split({ secret: "Test123", parts: 3, threshold: 2 })
      const recover = service.recover({ shares: [split.shares[0], split.shares[1]], threshold: 2 })
      expect(recover.recovered).toBe(true)
      expect(recover.secret).toBe("Test123")
    })

    it("should work with unicode secrets", () => {
      const split = service.split({ secret: "\u00A9 StegShield \u2665", parts: 3, threshold: 2 })
      const recover = service.recover({ shares: [split.shares[0], split.shares[1]], threshold: 2 })
      expect(recover.secret).toBe("\u00A9 StegShield \u2665")
    })

    it("should reject insufficient shares", () => {
      const split = service.split({ secret: "Test", parts: 5, threshold: 3 })
      expect(() => service.recover({ shares: [split.shares[0], split.shares[1]], threshold: 3 })).toThrow(BadRequestException)
    })

    it("should reject empty shares array", () => {
      expect(() => service.recover({ shares: [], threshold: 2 })).toThrow(BadRequestException)
    })

    it("should reject when shares count < threshold", () => {
      expect(() => service.recover({ shares: ["share1"], threshold: 3 })).toThrow(BadRequestException)
    })
  })
})
