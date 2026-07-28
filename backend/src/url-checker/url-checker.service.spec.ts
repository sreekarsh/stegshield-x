jest.mock("dns", () => ({
  resolve4: jest.fn((_: string, cb: Function) => cb(null, ["93.184.216.34"])),
  resolve6: jest.fn((_: string, cb: Function) => cb(null, [])),
  resolveMx: jest.fn((_: string, cb: Function) => cb(new Error("No MX records"))),
  resolveNs: jest.fn((_: string, cb: Function) => cb(null, ["ns1.example.com"])),
  resolveTxt: jest.fn((_: string, cb: Function) => cb(new Error("No TXT records"))),
}))

import { Test, TestingModule } from "@nestjs/testing"
import { UrlCheckerService, UrlCheckResult } from "./url-checker.service"

describe("UrlCheckerService", () => {
  let service: UrlCheckerService

  beforeEach(async () => {
    jest.spyOn(globalThis as any, "fetch").mockRejectedValue(new Error("Network unavailable in test"))
    const module: TestingModule = await Test.createTestingModule({
      providers: [UrlCheckerService],
    }).compile()

    service = module.get<UrlCheckerService>(UrlCheckerService)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("should be defined", () => {
    expect(service).toBeDefined()
  })

  describe("checkUrl", () => {
    it("should return valid result structure for a URL", async () => {
      const result = await service.checkUrl("https://example.com")
      expect(result).toHaveProperty("url", "https://example.com")
      expect(result).toHaveProperty("riskScore")
      expect(result).toHaveProperty("riskLevel")
      expect(result).toHaveProperty("sections")
      expect(result.sections).toHaveProperty("structure")
      expect(result.sections).toHaveProperty("hostname")
      expect(result.sections).toHaveProperty("network")
      expect(result.sections).toHaveProperty("ssl")
      expect(result.sections).toHaveProperty("content")
      expect(result.sections).toHaveProperty("headers")
      expect(result.sections).toHaveProperty("reputation")
    }, 30000)

    it("should add https protocol if missing", async () => {
      const result = await service.checkUrl("example.com")
      expect(result.url).toContain("https://")
    }, 30000)

    it("should return critical for invalid URL", async () => {
      const result = await service.checkUrl("")
      expect(result.riskLevel).toBe("critical")
      expect(result.riskScore).toBe(100)
    })

    it("should detect credentials in URL", async () => {
      const result = await service.checkUrl("https://user:pass@evil.com")
      const credFinding = result.sections.structure.findings.find(f => f.category === "Credentials in URL")
      expect(credFinding).toBeDefined()
      expect(credFinding?.type).toBe("failed")
    }, 30000)

    it("should detect suspicious TLDs", async () => {
      const result = await service.checkUrl("https://malware.tk")
      const tldFinding = result.sections.hostname.findings.find(f => f.category === "Suspicious TLD")
      expect(tldFinding).toBeDefined()
      expect(tldFinding?.type).toBe("failed")
    }, 30000)

    it("should detect private IP addresses", async () => {
      const result = await service.checkUrl("https://192.168.1.1")
      const ipFinding = result.sections.hostname.findings.find(f => f.category === "Private IP Address" || f.category === "IP Address Instead of Domain")
      expect(ipFinding).toBeDefined()
    }, 30000)

    it("should detect phishing keywords", async () => {
      const result = await service.checkUrl("https://paypal-login.xyz")
      const phishingFinding = result.sections.hostname.findings.find(f => f.category === "Phishing Keyword in Domain")
      expect(phishingFinding).toBeDefined()
      expect(phishingFinding?.type).toBe("failed")
    }, 30000)

    it("should handle javascript protocol as critical", async () => {
      const result = await service.checkUrl("javascript:alert(1)")
      expect(result.riskLevel).toBe("critical")
    })
  })

  describe("risk level mapping", () => {
    it("should return safe for score <= 5", () => {
      const result = (service as any).getRiskLevel(5)
      expect(result).toBe("safe")
    })

    it("should return critical for score > 70", () => {
      const result = (service as any).getRiskLevel(71)
      expect(result).toBe("critical")
    })
  })
})
