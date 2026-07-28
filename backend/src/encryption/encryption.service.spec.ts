import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService", () => {
  let service: EncryptionService;
  let prisma: Partial<Record<string, any>>;
  let config: Partial<Record<string, any>>;

  beforeEach(async () => {
    prisma = {
      encryptionKey: {
        create: jest.fn().mockResolvedValue({ id: "key-1", userId: "user-1", algorithm: "AES-256-GCM", keySize: 256, isActive: true, createdAt: new Date() }),
        findMany: jest.fn().mockResolvedValue([{ id: "key-1", algorithm: "AES-256-GCM", isActive: true }]),
        findUnique: jest.fn().mockResolvedValue({ id: "key-1", userId: "user-1", algorithm: "AES-256-GCM", keySize: 256, isActive: true, encryptedKey: "dGVzdA==" }),
        update: jest.fn().mockResolvedValue({}),
      },
    };

    config = {
      get: jest.fn((key: string) => {
        if (key === "SECRET_KEY") return "test-secret-key-32-chars-long!!";
        if (key === "ENCRYPTION_MASTER_KEY") return undefined;
        if (key === "UPLOAD_DIR") return "/tmp/uploads/encryption";
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("generateAESKey", () => {
    it("should generate a new AES key", async () => {
      const result = await service.generateAESKey("AES-256-GCM", "user-1");
      expect(result).toHaveProperty("algorithm", "AES-256-GCM");
      expect(result).toHaveProperty("keyId");
      expect(result).not.toHaveProperty("key");
      expect(result).not.toHaveProperty("iv");
    });
  });

  describe("getUserKeys", () => {
    it("should return user keys", async () => {
      const keys = await service.getUserKeys("user-1");
      expect(Array.isArray(keys)).toBe(true);
    });
  });
});