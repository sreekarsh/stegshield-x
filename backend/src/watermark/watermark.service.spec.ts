import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { WatermarkService } from "./watermark.service";

describe("WatermarkService", () => {
  let service: WatermarkService;
  let prisma: Partial<Record<string, any>>;
  let config: Partial<Record<string, any>>;

  const mockAuditService = {
    log: jest.fn(),
    logSimple: jest.fn(),
  }

  beforeEach(async () => {
    prisma = {
      watermark: {
        create: jest.fn().mockResolvedValue({
          id: "wm-1",
          userId: "user-1",
          fileId: "test.png-123",
          type: "INVISIBLE",
          text: "secret",
          originalPath: "/uploads/wm-1.enc",
          watermarkedPath: "/uploads/wm-1_watermarked.png",
          originalMime: "image/png",
          originalSize: 1024,
          createdAt: new Date(),
        }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue({
          id: "wm-1",
          userId: "user-1",
          fileId: "test.png-123",
          type: "INVISIBLE",
          text: "secret",
          originalPath: "/uploads/wm-1.enc",
          watermarkedPath: "/uploads/wm-1_watermarked.png",
          originalMime: "image/png",
          originalSize: 1024,
          createdAt: new Date(),
        }),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === "SECRET_KEY") return "test-secret-key-32-chars-long!!";
        if (key === "WATERMARK_ENCRYPTION_KEY") return undefined;
        if (key === "UPLOAD_DIR") return "/tmp/uploads/watermarks";
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WatermarkService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<WatermarkService>(WatermarkService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("getStats", () => {
    it("should return watermark statistics", async () => {
      (prisma.watermark.count as jest.Mock)
        .mockResolvedValueOnce(10)   // total
        .mockResolvedValueOnce(6)    // invisible
        .mockResolvedValueOnce(4);   // visible

      const stats = await service.getStats("user-1");
      expect(stats.total).toBe(10);
      expect(stats.invisible).toBe(6);
      expect(stats.visible).toBe(4);
    });
  });

  describe("findAll", () => {
    it("should return paginated watermark list", async () => {
      (prisma.watermark.findMany as jest.Mock).mockResolvedValue([
        { id: "wm-1", userId: "user-1", fileId: "test.png", type: "INVISIBLE", text: "secret", originalPath: "/tmp", watermarkedPath: "/tmp", originalMime: "image/png", originalSize: 1024, createdAt: new Date() },
      ]);
      (prisma.watermark.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll("user-1", 1, 20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });
  });

  describe("extractInvisible", () => {
    it("should throw when watermark not found", async () => {
      (prisma.watermark.findUnique as jest.Mock).mockResolvedValue(null);
      await expect(service.extractInvisible("user-1", "missing")).rejects.toThrow("Watermark not found");
    });

    it("should throw when not invisible type", async () => {
      (prisma.watermark.findUnique as jest.Mock).mockResolvedValue({
        id: "wm-1",
        userId: "user-1",
        type: "VISIBLE",
        watermarkedPath: "/tmp/file.png",
      });
      await expect(service.extractInvisible("user-1", "wm-1")).rejects.toThrow("Not an invisible watermark");
    });
  });
});