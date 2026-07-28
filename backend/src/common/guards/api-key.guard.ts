import { Injectable, ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { ApiKeysService } from "../../api-keys/api-keys.service"

@Injectable()
export class ApiKeyGuard {
  constructor(private apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest()
    const auth = req.headers?.authorization
    if (!auth || !auth.startsWith("Bearer sk_")) {
      throw new UnauthorizedException("Valid API key required (Bearer sk_...)")
    }
    const rawKey = auth.slice(7)
    const result = await this.apiKeysService.validate(rawKey)
    if (!result) {
      throw new UnauthorizedException("Invalid or expired API key")
    }
    req.user = { id: result.userId, apiKeyId: result.keyId, permissions: result.permissions, authMethod: "api-key" }
    return true
  }
}
