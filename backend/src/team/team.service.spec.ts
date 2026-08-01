import { Test, TestingModule } from "@nestjs/testing"
import { NotFoundException, ForbiddenException, BadRequestException } from "@nestjs/common"
import { TeamService } from "./team.service"
import { PrismaService } from "../prisma/prisma.service"
import { MailService } from "../mail/mail.service"
import { NotificationsService } from "../notifications/notifications.service"

describe("TeamService", () => {
  let service: TeamService
  let prisma: Record<string, any>
  let mail: Record<string, any>

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findFirst: jest.fn() },
      organization: { create: jest.fn() },
      organizationUser: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), count: jest.fn(), delete: jest.fn(), update: jest.fn() },
      invitation: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn().mockResolvedValue({}), updateMany: jest.fn() },
      auditLog: { create: jest.fn() },
    }
    mail = { sendInvitation: jest.fn().mockResolvedValue(true) }
    const notifications = { create: jest.fn().mockResolvedValue({}) }

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mail },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile()

    service = module.get<TeamService>(TeamService)
  })

  it("should be defined", () => expect(service).toBeDefined())

  describe("getOrganization", () => {
    it("should return user organization details", async () => {
      prisma.organizationUser.findFirst.mockResolvedValue({
        organizationId: "org-1",
        role: "ADMIN",
        organization: { id: "org-1", name: "Test Team", slug: "team-test", plan: "FREE", createdAt: new Date() },
      })

      const result = await service.getOrganization("user-1")
      expect(result.id).toBe("org-1")
      expect(result.myRole).toBe("ADMIN")
    })

    it("should create default team if user has no team", async () => {
      prisma.organizationUser.findFirst.mockResolvedValue(null)
      prisma.user.findUnique.mockResolvedValue({ name: "Alice" })
      prisma.organization.create.mockResolvedValue({ id: "org-2", name: "Alice's Team", slug: "team-user-1", plan: "FREE", createdAt: new Date() })
      prisma.organizationUser.create.mockResolvedValue({
        userId: "user-1",
        organizationId: "org-2",
        role: "ADMIN",
        organization: { id: "org-2", name: "Alice's Team", slug: "team-user-1", plan: "FREE", createdAt: new Date() },
      })

      const result = await service.getOrganization("user-1")
      expect(result.id).toBe("org-2")
    })
  })

  describe("invite", () => {
    it("should add existing user directly", async () => {
      prisma.organizationUser.findFirst.mockResolvedValue({ organizationId: "org-1", organization: { name: "Test Org" }, role: "ADMIN" })
      prisma.user.findUnique.mockResolvedValueOnce({ name: "Inviter" }).mockResolvedValueOnce({ id: "target-id", email: "existing@test.com" })
      prisma.organizationUser.findUnique.mockResolvedValue(null)
      prisma.organizationUser.create.mockResolvedValue({})
      const result = await service.invite("user-1", { email: "existing@test.com", role: "EDITOR" })
      expect(result.status).toBe("added")
    })
  })

  describe("acceptInvite", () => {
    it("should accept a valid invitation", async () => {
      prisma.invitation.findUnique.mockResolvedValue({ id: "inv-1", organizationId: "org-1", email: "user@test.com", role: "VIEWER", status: "PENDING", createdAt: new Date() })
      prisma.user.findUnique.mockResolvedValue({ id: "user-1", email: "user@test.com" })
      prisma.organizationUser.findUnique.mockResolvedValue(null)
      prisma.organizationUser.create.mockResolvedValue({})
      const result = await service.acceptInvite("user-1", "token-123")
      expect(result.accepted).toBe(true)
    })

    it("should reject expired invitation", async () => {
      const past = new Date(Date.now() - 8 * 86400 * 1000)
      prisma.invitation.findUnique.mockResolvedValue({ id: "inv-1", organizationId: "org-1", email: "user@test.com", role: "VIEWER", status: "PENDING", createdAt: past })
      await expect(service.acceptInvite("user-1", "token-123")).rejects.toThrow(BadRequestException)
    })
  })

  describe("removeMember", () => {
    it("should remove a member", async () => {
      prisma.organizationUser.findFirst
        .mockResolvedValueOnce({ organizationId: "org-1", role: "ADMIN" })
        .mockResolvedValueOnce({ id: "member-1", organizationId: "org-1", role: "VIEWER" })
      prisma.organizationUser.count.mockResolvedValue(2)
      prisma.organizationUser.delete.mockResolvedValue({})
      const result = await service.removeMember("user-1", "member-1")
      expect(result.removed).toBe(true)
    })
  })

  describe("leaveOrganization", () => {
    it("should let a member leave", async () => {
      prisma.organizationUser.findFirst.mockResolvedValue({ id: "member-1", organizationId: "org-1", role: "VIEWER" })
      prisma.organizationUser.delete.mockResolvedValue({})
      const result = await service.leaveOrganization("user-1")
      expect(result.left).toBe(true)
    })
  })
})
