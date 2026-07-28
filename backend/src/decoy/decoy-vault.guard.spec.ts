import { DecoyVaultGuard } from "./decoy-vault.guard"
import { DecoyService } from "./decoy.service"

describe("DecoyVaultGuard", () => {
  let guard: DecoyVaultGuard
  let decoyService: Record<string, any>

  beforeEach(() => {
    decoyService = { verify: jest.fn() }
    guard = new DecoyVaultGuard(decoyService as any)
  })

  it("should be defined", () => expect(guard).toBeDefined())

  it("should allow request without decoy header", async () => {
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: {}, user: { id: "user-1" } }) }) } as any
    expect(await guard.canActivate(ctx)).toBe(true)
  })

  it("should allow request without user", async () => {
    const ctx = { switchToHttp: () => ({ getRequest: () => ({ headers: { "x-decoy-password": "test" }, user: null }) }) } as any
    expect(await guard.canActivate(ctx)).toBe(true)
  })

  it("should set decoyMode when password valid", async () => {
    const req: any = { headers: { "x-decoy-password": "correct" }, user: { id: "user-1" } }
    decoyService.verify.mockResolvedValue({ valid: true, fakeVaultId: "f1", realVaultId: "r1" })
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.decoyMode).toBe(true)
    expect(req.fakeVaultId).toBe("f1")
  })

  it("should not set decoyMode when password invalid", async () => {
    const req: any = { headers: { "x-decoy-password": "wrong" }, user: { id: "user-1" } }
    decoyService.verify.mockResolvedValue({ valid: false })
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.decoyMode).toBe(false)
  })

  it("should handle errors gracefully", async () => {
    const req: any = { headers: { "x-decoy-password": "test" }, user: { id: "user-1" } }
    decoyService.verify.mockRejectedValue(new Error("error"))
    const ctx = { switchToHttp: () => ({ getRequest: () => req }) } as any
    expect(await guard.canActivate(ctx)).toBe(true)
    expect(req.decoyMode).toBe(false)
  })
})
