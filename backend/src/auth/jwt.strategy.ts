import { Injectable, UnauthorizedException, InternalServerErrorException } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { ExtractJwt, Strategy } from "passport-jwt"
import { PrismaService } from "../prisma/prisma.service"

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const jwtSecret = process.env.JWT_SECRET
    if (!jwtSecret || jwtSecret.length < 16) {
      throw new InternalServerErrorException("JWT_SECRET not configured or too short")
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    })
  }

  async validate(payload: { sub: string; email: string; tokenVersion?: number; decoyMode?: boolean; fakeVaultId?: string; realVaultId?: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, isVerified: true, isMFAEnabled: true, tokenVersion: true },
    })

    if (!user) {
      throw new UnauthorizedException("User account no longer exists")
    }

    if (payload.tokenVersion !== undefined && user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException("Session has been revoked — please log in again")
    }

    return {
      ...user,
      ...(payload.decoyMode ? {
        decoyMode: true,
        fakeVaultId: payload.fakeVaultId,
        realVaultId: payload.realVaultId,
      } : {}),
    }
  }
}
