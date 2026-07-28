import { Module, InternalServerErrorException } from "@nestjs/common"
import { JwtModule } from "@nestjs/jwt"
import { PassportModule } from "@nestjs/passport"
import { AuthController } from "./auth.controller"
import { AuthService } from "./auth.service"
import { JwtStrategy } from "./jwt.strategy"
import { GoogleStrategy } from "./google.strategy"
import { GitHubStrategy } from "./github.strategy"

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret || jwtSecret.length < 16) {
  throw new InternalServerErrorException("JWT_SECRET not configured or too short")
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: jwtSecret,
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, GoogleStrategy, GitHubStrategy],
  exports: [AuthService],
})
export class AuthModule {}
