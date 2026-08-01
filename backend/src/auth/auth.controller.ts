import { Controller, Get, Post, Delete, Param, Body, HttpCode, HttpStatus, UseGuards, Req, Res } from "@nestjs/common"
import { AuthGuard } from "@nestjs/passport"
import { Throttle } from "@nestjs/throttler"
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger"
import { AuthService } from "./auth.service"
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard"
import { createOAuthCallbackGuard } from "../common/guards/oauth-callback.guard"
import { RegisterDto } from "./dto/register.dto"
import { LoginDto } from "./dto/login.dto"
import { extractClientIp } from "../common/utils"

const GoogleOAuthCallbackGuard = createOAuthCallbackGuard("google")
const GitHubOAuthCallbackGuard = createOAuthCallbackGuard("github")

const OAUTH_SUCCESS_URL = process.env.OAUTH_SUCCESS_URL || "http://localhost:3000/auth/callback"
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined
const IS_PROD = process.env.NODE_ENV === "production"

function setRefreshCookie(res: any, token: string) {
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: COOKIE_DOMAIN,
  })
}

function setAccessCookie(res: any, token: string) {
  res.cookie("access_token", token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 15 * 60 * 1000,
    domain: COOKIE_DOMAIN,
  })
}

function clearRefreshCookie(res: any) {
  res.cookie("refresh_token", "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
    domain: COOKIE_DOMAIN,
  })
}

function clearAccessCookie(res: any) {
  res.cookie("access_token", "", {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    domain: COOKIE_DOMAIN,
  })
}

function setUserRoleCookie(res: any, role: string) {
  res.cookie("user_role", role || "USER", {
    httpOnly: false,
    secure: IS_PROD,
    sameSite: "lax",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    domain: COOKIE_DOMAIN,
  })
}

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  async register(@Body() dto: RegisterDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.register(dto, extractClientIp(req))
    setRefreshCookie(res, result.refreshToken)
    setAccessCookie(res, result.accessToken)
    setUserRoleCookie(res, result.user.role)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post("login")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const result = await this.authService.login(dto, extractClientIp(req))
    setRefreshCookie(res, result.refreshToken)
    setAccessCookie(res, result.accessToken)
    setUserRoleCookie(res, result.user.role)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post("refresh")
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: { refreshToken?: string }, @Req() req: any, @Res({ passthrough: true }) res: any) {
    const token = dto.refreshToken || req.cookies?.refresh_token
    if (!token) {
      return { accessToken: null }
    }
    const result = await this.authService.refresh(token, extractClientIp(req))
    setRefreshCookie(res, result.refreshToken)
    setAccessCookie(res, result.accessToken)
    setUserRoleCookie(res, result.user.role)
    return { user: result.user, accessToken: result.accessToken }
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) res: any) {
    clearRefreshCookie(res)
    clearAccessCookie(res)
    return this.authService.logout(req.user.id, extractClientIp(req))
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(@Req() req: any, @Body() dto: { currentPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword)
  }

  @Post("mfa/setup")
  @UseGuards(JwtAuthGuard)
  async setupMFA(@Req() req: any) {
    return this.authService.setupMFA(req.user.id)
  }

  @Post("mfa/verify")
  @UseGuards(JwtAuthGuard)
  async verifyMFA(@Req() req: any, @Body() dto: { token: string }) {
    return this.authService.verifyMFA(req.user.id, dto.token)
  }

  @Post("forgot-password")
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: { email: string }) {
    return this.authService.forgotPassword(dto.email)
  }

  @Post("reset-password")
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: { email: string; token: string; password: string }) {
    return this.authService.resetPassword(dto.email, dto.token, dto.password)
  }

  @Get("sessions")
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req: any) {
    return this.authService.getSessions(req.user.id)
  }

  @Delete("sessions/:id")
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Req() req: any, @Param("id") id: string) {
    if (id === "all") {
      return this.authService.revokeAllOtherSessions(req.user.id)
    }
    return this.authService.revokeSession(req.user.id, id)
  }

  @Get("google")
  @UseGuards(AuthGuard("google"))
  async googleAuth() {}

  @Get("google/callback")
  @UseGuards(GoogleOAuthCallbackGuard)
  async googleAuthCallback(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const tokens = await this.authService.generateTokens(req.user.id, req.user.email)
    await this.authService.createSession(req.user.id, "Google OAuth", { ip: extractClientIp(req) })
    setRefreshCookie(res, tokens.refreshToken)
    setAccessCookie(res, tokens.accessToken)
    return res.redirect(OAUTH_SUCCESS_URL)
  }

  @Get("github")
  @UseGuards(AuthGuard("github"))
  async githubAuth() {}

  @Get("github/callback")
  @UseGuards(GitHubOAuthCallbackGuard)
  async githubAuthCallback(@Req() req: any, @Res({ passthrough: true }) res: any) {
    const tokens = await this.authService.generateTokens(req.user.id, req.user.email)
    await this.authService.createSession(req.user.id, "GitHub OAuth", { ip: extractClientIp(req) })
    setRefreshCookie(res, tokens.refreshToken)
    setAccessCookie(res, tokens.accessToken)
    return res.redirect(OAUTH_SUCCESS_URL)
  }

  @Post("connect/:provider")
  @UseGuards(JwtAuthGuard)
  async connectAccount(@Param("provider") provider: string) {
    const providerLower = provider.toLowerCase()
    if (!["google", "github"].includes(providerLower)) {
      return { error: "Unsupported provider" }
    }
    return { url: `/api/auth/${providerLower}` }
  }

  @Post("disconnect/:provider")
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async disconnectAccount(@Req() req: any, @Param("provider") provider: string) {
    return this.authService.disconnectProvider(req.user.id, provider)
  }
}
