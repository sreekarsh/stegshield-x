import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { PrismaService } from "../prisma/prisma.service";
import { EvidenceService } from "./evidence.service";
import { AuditService } from "../audit/audit.service";
import { of } from "rxjs";

describe("EvidenceService", () => {
  let service: EvidenceService;
  let prisma: Partial<Record<string, any>>;
  let config: Partial<Record<string, any>>;
  let http: Partial<Record<string, any>>;
  let audit: Partial<Record<string, any>>;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: "user-1", name: "Test User", email: "test@example.com", organizations: [] }),
      },
      evidence: {
        create: jest.fn().mockResolvedValue({ id: "evidence-1", userId: "user-1", caseId: "default", name: "test.pdf", type: "application/pdf", hash: "sha256:abc123", hashAlgorithm: "sha256", size: 1024, filePath: "/uploads/evidence/evidence-1.enc", status: "COLLECTED", createdAt: new Date(), lastAccessedAt: new Date(), lastModifiedAt: new Date(), deletedAt: null }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({ id: "evidence-1", userId: "user-1", caseId: "default", name: "test.pdf", type: "application/pdf", hash: "sha256:abc123", hashAlgorithm: "sha256", size: 1024, filePath: "/uploads/evidence/evidence-1.enc", status: "COLLECTED", createdAt: new Date(), lastAccessedAt: new Date(), lastModifiedAt: new Date(), deletedAt: null, custody: [] }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest.fn().mockResolvedValue({ _sum: { size: 1024 } }),
      },
      custodyEntry: {
        create: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === "SECRET_KEY") return "test-secret-key-32-chars-long!!";
        if (key === "EVIDENCE_ENCRYPTION_KEY") return undefined;
        if (key === "UPLOAD_DIR") return "/tmp/uploads/evidence";
        if (key === "AI_SERVICE_URL") return "http://localhost:8000";
        return undefined;
      }),
    };

    http = {
      post: jest.fn().mockReturnValue(of({ data: { threat_score: 10, threat_level: "low", indicators: [] } })),
    };

    audit = {
      log: jest.fn().mockResolvedValue(undefined),
      logSimple: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvidenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: HttpService, useValue: http },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();

    service = module.get<EvidenceService>(EvidenceService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getStats", () => {
    it("should return aggregated stats", async () => {
      (prisma.evidence.count as jest.Mock).mockResolvedValue(10);
      (prisma.evidence.groupBy as jest.Mock).mockResolvedValue([{ status: "COLLECTED", _count: { status: 5 } }, { status: "VERIFIED", _count: { status: 5 } }]);
      (prisma.evidence.aggregate as jest.Mock).mockResolvedValue({ _sum: { size: 1024000 } });

      const stats = await service.getStats("user-1");
      expect(stats.total).toBe(10);
      expect(stats.byStatus).toHaveLength(2);
      expect(stats.totalSize).toBe(1024000);
    });
  });

  describe("getCases", () => {
    it("should return grouped cases with counts", async () => {
      (prisma.evidence.groupBy as jest.Mock).mockResolvedValue([{ caseId: "case-1", _count: { caseId: 3 } }, { caseId: "default", _count: { caseId: 2 } }]);
      const cases = await service.getCases("user-1");
      expect(cases).toHaveLength(2);
      expect(cases[0].caseId).toBe("case-1");
    });
  });

  describe("verifyIntegrity", () => {
    it("should return integrity check result", async () => {
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue({
        id: "evidence-1",
        userId: "user-1",
        filePath: "/tmp/evidence-1.enc",
        hash: "sha256:abc123",
      });
      jest.spyOn(require("fs"), "existsSync").mockReturnValue(true);
      jest.spyOn(require("fs"), "readFileSync").mockReturnValue(Buffer.from("encrypted-data"));

      const result = await service.verifyIntegrity("user-1", "evidence-1");
      expect(result.valid).toBeDefined();
    });

    it("should throw when evidence not found", async () => {
      (prisma.evidence.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.verifyIntegrity("user-1", "missing")).rejects.toThrow("Evidence not found");
    });
  });
});