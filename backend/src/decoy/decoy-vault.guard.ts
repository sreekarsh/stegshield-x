import { Injectable, CanActivate, ExecutionContext } from "@nestjs/common"
import { DecoyService } from "./decoy.service"

@Injectable()
export class DecoyVaultGuard implements CanActivate {
  constructor(private decoyService: DecoyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const decoyPassword = req.headers["x-decoy-password"]
    req.decoyMode = false

    if (!decoyPassword || !req.user?.id) return true

    try {
      const result = await this.decoyService.verify(req.user.id, { password: decoyPassword })
      if (result.valid) {
        req.decoyMode = true
        const r = result as { fakeVaultId: string; realVaultId: string }
        req.fakeVaultId = r.fakeVaultId
        req.realVaultId = r.realVaultId
      }
    } catch {}

    return true
  }
}
