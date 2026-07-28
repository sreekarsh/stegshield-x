import { Test, TestingModule } from "@nestjs/testing"
import { InternalServerErrorException } from "@nestjs/common"
import { PdfService } from "./pdf.service"
import * as fs from "fs"
import * as path from "path"

jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  existsSync: jest.fn(),
}))

jest.mock("child_process", () => ({
  execFile: jest.fn(),
}))

jest.mock("util", () => ({
  promisify: jest.fn(() => jest.fn()),
}))

describe("PdfService", () => {
  let service: PdfService

  beforeEach(async () => {
    jest.resetModules()
    // Clear the require cache for getQpdfPath
    const module: TestingModule = await Test.createTestingModule({
      providers: [PdfService],
    }).compile()

    service = module.get<PdfService>(PdfService)
    jest.spyOn(service as any, "isEncrypted").mockResolvedValue(false)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("protect", () => {
    it("should throw when qpdf is not available", async () => {
      // We can't easily mock the static QPDF_PATH, but we can verify the error handling is correct
      // by checking that the function handles the missing binary case
      const buffer = Buffer.from("%PDF-1.4 test pdf content")
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      await expect(service.protect(buffer, "test123")).rejects.toThrow(InternalServerErrorException)
    })

    it("should reject already encrypted PDF", async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      jest.spyOn(service as any, "isEncrypted").mockResolvedValue(true)
      const buffer = Buffer.from("%PDF-1.4 encrypted content")
      await expect(service.protect(buffer, "test123")).rejects.toThrow("already password-protected")
    })
  })

  describe("unlock", () => {
    it("should throw when qpdf is not available", async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(false)
      const buffer = Buffer.from("%PDF-1.4 test")
      await expect(service.unlock(buffer, "test123")).rejects.toThrow(InternalServerErrorException)
    })

    it("should throw for non-encrypted PDF", async () => {
      ;(fs.existsSync as jest.Mock).mockReturnValue(true)
      jest.spyOn(service as any, "isEncrypted").mockResolvedValue(false)
      const buffer = Buffer.from("%PDF-1.4 plain")
      await expect(service.unlock(buffer, "test123")).rejects.toThrow("not password-protected")
    })
  })
})
