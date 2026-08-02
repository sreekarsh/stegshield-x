import { Injectable, ExecutionContext, Logger } from "@nestjs/common"
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
        const errMsg = err instanceof Error ? err.message : String(err)
        const errStack = err instanceof Error ? err.stack : undefined
        Logger.error(`OAuth callback failed for ${strategy}: ${errMsg}`, errStack, "OAuthCallbackGuard")
        const errorMsg = encodeURIComponent(errMsg || "oauth_failed")
        res.redirect(`${OAUTH_SUCCESS_URL}?error=${errorMsg}`)
        return false
      }
    }
  }
  return OAuthCallbackGuard
}
