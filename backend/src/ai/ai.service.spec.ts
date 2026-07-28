import { Test, TestingModule } from "@nestjs/testing"
import { HttpException } from "@nestjs/common"
import { AiService } from "./ai.service"
import * as http from "http"
import * as https from "https"
import { EventEmitter } from "events"

jest.mock("http")
jest.mock("https")

describe("AiService", () => {
  let service: AiService

  beforeEach(async () => {
    jest.resetAllMocks()
    process.env.AI_SERVICE_URL = "http://localhost:8000"
    process.env.AI_API_KEY = "test-api-key"

    // Default mock request implementation that responds immediately with valid JSON
    const mockRequest = (options: any, callback: any) => {
      const req = new EventEmitter() as any
      req.write = jest.fn()
      req.end = jest.fn()
      req.destroy = jest.fn()

      const res = new EventEmitter() as any
      res.statusCode = 200

      if (options.path === "/analyze/password") {
        setImmediate(() => {
          const err = new Error("ECONNREFUSED") as any
          err.code = "ECONNREFUSED"
          req.emit("error", err)
        })
      } else if (callback) {
        setImmediate(() => {
          callback(res)
          res.emit("data", Buffer.from(JSON.stringify({ status: "healthy", security_score: 85, issues: [] })))
          res.emit("end")
        })
      }
      return req
    }

    ;(http.request as jest.Mock).mockImplementation(mockRequest)
    ;(https.request as jest.Mock).mockImplementation(mockRequest)

    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile()

    service = module.get<AiService>(AiService)
  })

  afterEach(() => {
    delete process.env.AI_SERVICE_URL
    delete process.env.AI_API_KEY
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("analyzePassword", () => {
    it("should return weak for common passwords", async () => {
      const result = await service.analyzePassword("password")
      expect(result.strength_score).toBe(0)
      expect(result.grade).toBe("very_weak")
    })

    it("should return strong for complex passwords", async () => {
      const result = await service.analyzePassword("Str0ng!P@ssw0rd#2024")
      expect(result.strength_score).toBeGreaterThanOrEqual(60)
    })

    it("should detect repeated characters", async () => {
      const result = await service.analyzePassword("aaaaaa")
      expect(result.strength_score).toBeLessThan(40)
    })

    it("should detect sequential patterns", async () => {
      const result = await service.analyzePassword("abcdefgh123")
      expect(result.grade).not.toBe("strong")
    })
  })

  describe("generateSecretLanguage", () => {
    it("should handle response when AI available or mock response", async () => {
      const result = await service.generateSecretLanguage({ theme: "fantasy" })
      expect(result).toBeDefined()
    })
  })

  describe("health", () => {
    it("should reject when AI is unreachable", async () => {
      ;(http.request as jest.Mock).mockImplementation((options: any, callback: any) => {
        const req = new EventEmitter() as any
        req.write = jest.fn()
        req.end = jest.fn()
        req.destroy = jest.fn()
        setImmediate(() => {
          const err = new Error("ECONNREFUSED") as any
          err.code = "ECONNREFUSED"
          req.emit("error", err)
        })
        return req
      })

      await expect(service.health()).rejects.toThrow(HttpException)
    })
  })

  describe("securityAnalysis", () => {
    it("should return security analysis", async () => {
      const result = await service.securityAnalysis({
        mfa_enabled: false,
        key_age_days: 30,
        old_password: true,
        recent_actions: [],
      })
      expect(result.security_score).toBeDefined()
      expect(result.issues).toBeDefined()
    })
  })
})
