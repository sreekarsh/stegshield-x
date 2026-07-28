import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ConflictException } from "@nestjs/common"
import { ContactsService } from "./contacts.service"
import { PrismaService } from "../prisma/prisma.service"

describe("ContactsService", () => {
  let service: ContactsService
  let prisma: Record<string, any>

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ id: "contact-1", name: "Bob", email: "bob@test.com" }) },
      contact: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({
          id: "contact-rel-1",
          ...data,
          contact: { id: data.contactId, name: "Bob", email: "bob@test.com", avatar: null },
          createdAt: new Date(),
        })),
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
      },
    }

    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactsService, { provide: PrismaService, useValue: prisma }],
    }).compile()

    service = module.get<ContactsService>(ContactsService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("add", () => {
    it("should add a contact", async () => {
      prisma.contact.findUnique.mockResolvedValue(null)
      const result = await service.add("user-1", { contactId: "contact-1", alias: "My Friend" })
      expect(result.contact.name).toBe("Bob")
      expect(prisma.contact.create).toHaveBeenCalled()
    })

    it("should reject self-contact", async () => {
      await expect(service.add("user-1", { contactId: "user-1" })).rejects.toThrow(ConflictException)
    })

    it("should reject non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      await expect(service.add("user-1", { contactId: "ghost" })).rejects.toThrow(NotFoundException)
    })

    it("should reject duplicate contact", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: "existing", ownerId: "user-1", contactId: "contact-1" })
      await expect(service.add("user-1", { contactId: "contact-1" })).rejects.toThrow(ConflictException)
    })
  })

  describe("findAll", () => {
    it("should return all contacts", async () => {
      prisma.contact.findMany.mockResolvedValue([{
        id: "rel-1", ownerId: "user-1", contactId: "c1", alias: "Friend",
        contact: { id: "c1", name: "Alice", email: "alice@test.com", avatar: null, role: "VIEWER" },
      }])
      const result = await service.findAll("user-1")
      expect(result.contacts).toHaveLength(1)
    })
  })

  describe("update", () => {
    it("should update contact alias", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: "rel-1", ownerId: "user-1", contactId: "c1" })
      prisma.contact.update.mockResolvedValue({ id: "rel-1", alias: "New Alias", contact: { id: "c1", name: "Alice", email: "a@b.com", avatar: null } })
      const result = await service.update("user-1", "c1", { alias: "New Alias" })
      expect(result.alias).toBe("New Alias")
    })

    it("should throw for non-existent contact", async () => {
      prisma.contact.findUnique.mockResolvedValue(null)
      await expect(service.update("user-1", "c1", { alias: "New" })).rejects.toThrow(NotFoundException)
    })
  })

  describe("remove", () => {
    it("should remove a contact", async () => {
      prisma.contact.findUnique.mockResolvedValue({ id: "rel-1", ownerId: "user-1", contactId: "c1" })
      const result = await service.remove("user-1", "c1")
      expect(result.message).toContain("removed")
    })
  })
})
