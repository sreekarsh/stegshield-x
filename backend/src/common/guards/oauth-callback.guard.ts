import { Injectable, ExecutionContext } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"

const OAUTH_SUCCESS_URL = process.env.OAUTH_SUCCESS_URL || "http://localhost:3000/auth/callback"

export function createOAuthCallbackGuard(strategy: string) {
  @Injectable()
  class OAuthCallbackGuard extends AuthGuard(strategy) {
    async canActivate(context: ExecutionContext): Promise<boolean> {
      try {
        return (await super.canActivate(context)) as boolean
      } catch (err) {
        const res = context.switchToHttp().getResponse()
        const errorMsg = err?.message ? encodeURIComponent(err.message) : "oauth_failed"
        res.redirect(`${OAUTH_SUCCESS_URL}#error=${errorMsg}`)
        return false
      }
    }
  }
  return OAuthCallbackGuard
}
