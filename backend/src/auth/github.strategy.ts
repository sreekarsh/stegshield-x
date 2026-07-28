import { Injectable } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy } from "passport-github2"
import { AuthService } from "./auth.service"

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
  constructor(private authService: AuthService) {
    super({
      clientID: GITHUB_CLIENT_ID || "disabled",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "disabled",
      callbackURL: process.env.GITHUB_CALLBACK_URL || "http://localhost:4000/api/auth/github/callback",
      scope: ["user:email"],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: (err: any, user?: any) => void): Promise<any> {
    try {
      const user = await this.authService.validateOAuthUser("github", profile)
      done(null, user)
    } catch (err) {
      done(err, false)
    }
  }
}
