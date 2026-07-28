import { Test, TestingModule } from "@nestjs/testing";
import { WatermarkController } from "./watermark.controller";
import { WatermarkService, WatermarkResult, PaginatedResult } from "./watermark.service";

describe("WatermarkController", () => {
  let controller: WatermarkController;
  let service: Partial<Record<keyof WatermarkService, any>>;

  const mockWatermark: WatermarkResult = {
    id: "wm-1",
    fileId: "test.png",
    type: "INVISIBLE",
    text: "secret",
    originalPath: "/uploads/wm-1.enc",
    watermarkedPath: "/uploads/wm-1_watermarked.png",
    originalMime: "image/png",
    createdAt: new Date(),
  };

  beforeEach(async () => {
    service = {
      createInvisible: jest.fn().mockResolvedValue(mockWatermark),
      createVisible: jest.fn().mockResolvedValue({ ...mockWatermark, type: "VISIBLE" }),
      findAll: jest.fn().mockResolvedValue({ items: [mockWatermark], total: 1, page: 1, limit: 20, totalPages: 1 }),
      getStats: jest.fn().mockResolvedValue({ total: 10, invisible: 6, visible: 4 }),
      findById: jest.fn().mockResolvedValue(mockWatermark),
      extractInvisible: jest.fn().mockResolvedValue({ text: "secret", verified: true }),
      downloadWatermarked: jest.fn().mockResolvedValue({ buffer: Buffer.from("test"), name: "test.png", mime: "image/png" }),
      downloadOriginal: jest.fn().mockResolvedValue({ buffer: Buffer.from("test"), name: "test.png", mime: "image/png" }),
      delete: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WatermarkController],
      providers: [{ provide: WatermarkService, useValue: service }],
    }).compile();

    controller = module.get<WatermarkController>(WatermarkController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("createInvisible", () => {
    it("should create invisible watermark", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockFile = { originalname: "test.png", size: 1024, mimetype: "image/png", path: "/tmp/test.png" } as any;

      const result = await controller.createInvisible(mockReq, mockFile, { text: "secret text" });
      expect(result.id).toBe("wm-1");
      expect(service.createInvisible).toHaveBeenCalledWith("user-1", mockFile, "secret text");
    });

    it("should throw when file missing", async () => {
      const mockReq = { user: { id: "user-1" } };
      await expect(controller.createInvisible(mockReq, null as any, { text: "text" })).rejects.toThrow("File is required");
    });

    it("should throw when text missing", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockFile = { originalname: "test.png", size: 1024, mimetype: "image/png", path: "/tmp/test.png" } as any;
      await expect(controller.createInvisible(mockReq, mockFile, { text: "" })).rejects.toThrow("Watermark text is required");
    });
  });

  describe("createVisible", () => {
    it("should create visible watermark", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockFile = { originalname: "test.png", size: 1024, mimetype: "image/png", path: "/tmp/test.png" } as any;

      const result = await controller.createVisible(mockReq, mockFile, { text: "CONFIDENTIAL" });
      expect(result.type).toBe("VISIBLE");
      expect(service.createVisible).toHaveBeenCalled();
    });
  });

  describe("findAll", () => {
    it("should return paginated list", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.findAll(mockReq, 1, 20);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getStats", () => {
    it("should return stats", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.getStats(mockReq);
      expect(result.total).toBe(10);
      expect(result.invisible).toBe(6);
      expect(result.visible).toBe(4);
    });
  });

  describe("findById", () => {
    it("should return watermark by id", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.findById(mockReq, "wm-1");
      expect(result.id).toBe("wm-1");
    });
  });

  describe("extractInvisible", () => {
    it("should extract invisible watermark", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.extractInvisible(mockReq, "wm-1");
      expect(result.text).toBe("secret");
      expect(result.verified).toBe(true);
    });
  });

  describe("downloadWatermarked", () => {
    it("should send watermarked file", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.downloadWatermarked(mockReq, "wm-1", mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from("test"));
    });
  });

  describe("downloadOriginal", () => {
    it("should send original file", async () => {
      const mockReq = { user: { id: "user-1" } };
      const mockRes = {
        setHeader: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.downloadOriginal(mockReq, "wm-1", mockRes);
      expect(mockRes.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
      expect(mockRes.send).toHaveBeenCalledWith(Buffer.from("test"));
    });
  });

  describe("delete", () => {
    it("should delete watermark", async () => {
      const mockReq = { user: { id: "user-1" } };
      const result = await controller.delete(mockReq, "wm-1");
      expect(result.success).toBe(true);
      expect(service.delete).toHaveBeenCalledWith("user-1", "wm-1");
    });
  });
});