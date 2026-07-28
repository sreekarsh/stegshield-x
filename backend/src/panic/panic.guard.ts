import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common"
import { JwtService } from "@nestjs/jwt"

@Injectable()
export class PanicGuard implements CanActivate {
  constructor(private jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest()
    const token = req.headers?.["x-panic-token"]
    if (!token) throw new UnauthorizedException("Panic verification required — re-enter your password")

    try {
      const payload = this.jwtService.verify(typeof token === "string" ? token : token[0])
      if (payload.type !== "panic_verify") throw new UnauthorizedException("Invalid panic token")
      if (payload.sub !== req.user?.id) throw new UnauthorizedException("Panic token does not match user")
      return true
    } catch {
      throw new UnauthorizedException("Invalid or expired panic verification — please re-enter your password")
    }
  }
}
