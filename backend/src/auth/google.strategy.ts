import { Injectable, Logger } from "@nestjs/common"
import { PassportStrategy } from "@nestjs/passport"
import { Strategy, VerifyCallback } from "passport-google-oauth20"
import { AuthService } from "./auth.service"

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
if (GOOGLE_CLIENT_ID) {
  Logger.log("Google OAuth configured", "GoogleStrategy")
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(private authService: AuthService) {
    super({
      clientID: GOOGLE_CLIENT_ID || "disabled",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "disabled",
      callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
      scope: ["email", "profile"],
    })
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
    try {
      const user = await this.authService.validateOAuthUser("google", profile)
      done(null, user)
    } catch (err) {
      done(err, false)
    }
  }
}
