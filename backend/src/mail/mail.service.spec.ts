import { MailService } from "./mail.service"

describe("MailService", () => {
  let service: MailService

  beforeEach(() => {
    // Clear SMTP env vars to avoid actual transport creation
    const oldHost = process.env.SMTP_HOST
    delete process.env.SMTP_HOST
    service = new MailService()
    if (oldHost) process.env.SMTP_HOST = oldHost
  })

  it("should be defined", () => expect(service).toBeDefined())

  it("should not send when transporter is null", async () => {
    const result = await service.sendInvitation({
      to: "test@test.com",
      invitedByName: "Alice",
      organizationName: "Test Org",
      role: "VIEWER",
      acceptUrl: "http://localhost:3000/accept",
      declineUrl: "http://localhost:3000/decline",
    })
    expect(result).toBeUndefined()
  })

  it("should not send password changed when no transporter", async () => {
    const result = await service.sendPasswordChanged("test@test.com", "Alice")
    expect(result).toBeUndefined()
  })

  it("should not send panic alert when no transporter", async () => {
    const result = await service.sendPanicAlert({
      to: "test@test.com",
      userName: "Alice",
      action: "destroy_keys",
      ip: "127.0.0.1",
    })
    expect(result).toBeUndefined()
  })

  it("should not send email changed notification when no transporter", async () => {
    const result = await service.sendEmailChangedNotification("test@test.com", "Alice", "new@test.com")
    expect(result).toBeUndefined()
  })

  describe("with SMTP configured", () => {
    beforeEach(() => {
      process.env.SMTP_HOST = "smtp.test.com"
      process.env.SMTP_PORT = "587"
      process.env.SMTP_USER = "user@test.com"
      process.env.SMTP_PASS = "password"
      process.env.SMTP_FROM = "noreply@test.com"
      service = new MailService()
    })

    afterEach(() => {
      delete process.env.SMTP_HOST
      delete process.env.SMTP_PORT
      delete process.env.SMTP_USER
      delete process.env.SMTP_PASS
      delete process.env.SMTP_FROM
    })

    it("should create transporter when SMTP configured", () => {
      expect((service as any).transporter).toBeDefined()
    })
  })
})
