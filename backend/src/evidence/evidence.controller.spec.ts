import { Test, TestingModule } from "@nestjs/testing";
import { EvidenceController } from "./evidence.controller";
import { EvidenceService, EvidenceWithCustody, PaginatedResult, UpdateEvidenceDto, BulkOperationDto } from "./evidence.service";
import { DecoyService } from "../decoy/decoy.service";

describe("EvidenceController", () => {
  let controller: EvidenceController;
  let service: Partial<Record<keyof EvidenceService, any>>;

  const mockEvidence: EvidenceWithCustody = {
    id: "evidence-1",
    caseId: "default",
    userId: "user-1",
    name: "test.pdf",
    type: "application/pdf",
    hash: "sha256:abc123",
    hashAlgorithm: "sha256",
    size: 1024,
    filePath: "/uploads/evidence/evidence-1.enc",
    status: "COLLECTED",
    createdAt: new Date(),
    lastAccessedAt: new Date(),
    lastModifiedAt: new Date(),
    custody: [],
    user: { id: "user-1", name: "Test User", email: "test@example.com" },
  };

  beforeEach(async () => {
    service = {
      create: jest.fn().mockResolvedValue(mockEvidence),
      findAll: jest.fn().mockResolvedValue({ items: [mockEvidence], total: 1, page: 1, limit: 20, totalPages: 1 }),
      getStats: jest.fn().mockResolvedValue({ total: 10, byStatus: [], totalSize: 1024, caseCount: 2 }),
      getCases: jest.fn().mockResolvedValue([{ caseId: "default", _count: { caseId: 5 } }]),
      createCase: jest.fn().mockResolvedValue({ id: "new-case", name: "New Case" }),
      findById: jest.fn().mockResolvedValue(mockEvidence),
      update: jest.fn().mockResolvedValue(mockEvidence),
      updateStatus: jest.fn().mockResolvedValue(mockEvidence),
      download: jest.fn().mockResolvedValue({ buffer: Buffer.from("test"), name: "test.pdf", type: "application/pdf" }),
      verifyIntegrity: jest.fn().mockResolvedValue({ valid: true, expected: "sha256:abc", actual: "sha256:abc" }),
      bulkOperation: jest.fn().mockResolvedValue({ success: ["id1"], failed: [] }),
      exportManifest: jest.fn().mockResolvedValue(Buffer.from('{"test": true}')),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvidenceController],
      providers: [
        { provide: EvidenceService, useValue: service },
        { provide: DecoyService, useValue: { verify: jest.fn().mockResolvedValue({ valid: false }) } },
      ],
    }).compile();

    controller = module.get<EvidenceController>(EvidenceController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("create", () => {
    it("should create evidence from uploaded file", async () => {
      const mockFile = { originalname: "test.pdf", size: 1024, mimetype: "application/pdf", path: "/tmp/test.pdf" } as any;
      const mockReq = { user: { id: "user-1" }, body: { caseId: "case-1" } };

      const result = await controller.create(mockReq, mockFile, mockReq.body);
      expect(service.create).toHaveBeenCalledWith("user-1", mockFile, "case-1");
      expect(result).toEqual(mockEvidence);
    });

    it("should throw when file missing", async () => {
      const mockReq = { user: { id: "user-1" }, body: {} };
      await expect(controller.create(mockReq, null as any, mockReq.body)).rejects.toThrow("File is required");
    });
  });

  describe("findAll", () => {
    it("should return paginated evidence list", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.getAll(mockReq, 1, 20, undefined, undefined, undefined);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return evidence statistics", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.getStats(mockReq);
      expect(result.total).toBe(10);
      expect(result.totalSize).toBe(1024);
    });
  });

  describe("getCases", () => {
    it("should return cases with evidence counts", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.getCases(mockReq);
      expect(result).toHaveLength(1);
    });
  });

  describe("createCase", () => {
    it("should create new case", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.createCase(mockReq, { name: "New Case" });
      expect(result.id).toBe("new-case");
      expect(result.name).toBe("New Case");
    });

    it("should throw when name missing", async () => {
      const mockReq = { user: { id: "user-1" } };
      await expect(controller.createCase(mockReq, { name: "" })).rejects.toThrow("Case name required");
    });
  });

  describe("download", () => {
    it("should set correct headers and send file", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.download(mockReq, "evidence-1", mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Disposition", 'attachment; filename="test.pdf"');
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from("test"));
    });
  });

  describe("verifyIntegrity", () => {
    it("should return integrity check result", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.verifyIntegrity(mockReq, "evidence-1");
      expect(result.valid).toBe(true);
    });
  });

  describe("bulkOperation", () => {
    it("should execute bulk action", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.bulkOperation(mockReq, { ids: ["id1", "id2"], action: "archive" });
      expect(result.success).toContain("id1");
    });
  });

  describe("exportManifest", () => {
    it("should return manifest file", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportManifest(mockReq, { ids: ["id1"] }, mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "application/json");
      expect(mockRes.send).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("should archive evidence", async () => {
      const mockReq = { user: { id: "user-1" } };
      await controller.delete(mockReq, "evidence-1");
      expect(service.bulkOperation).toHaveBeenCalledWith("user-1", { ids: ["evidence-1"], action: "delete" });
    });
  });
});