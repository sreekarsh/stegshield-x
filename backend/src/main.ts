import "dotenv/config"
import { NestFactory } from "@nestjs/core"
import { ValidationPipe } from "@nestjs/common"
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import { AppModule } from "./app.module"
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter"
import { LoggerInterceptor } from "./common/interceptors/logger.interceptor"
import { CsrfMiddleware } from "./common/middleware/csrf.middleware"

function validateEnv(): void {
  const required = [
    "DATABASE_URL",
    "JWT_SECRET",
    "REFRESH_TOKEN_SECRET",
  ]
  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`Missing required environment variable: ${key}`)
    }
  }
  const placeholderPatterns = [
    { key: "JWT_SECRET", pattern: /change-me/i },
    { key: "REFRESH_TOKEN_SECRET", pattern: /change-me/i },
    { key: "ENCRYPTION_KEY", pattern: /change-me/i },
  ]
  for (const { key, pattern } of placeholderPatterns) {
    const val = process.env[key]
    if (val && pattern.test(val)) {
      console.warn(`WARNING: ${key} still contains a placeholder value. Generate a strong random secret before production.`)
    }
  }
}

async function bootstrap() {
  validateEnv()
  const app = await NestFactory.create(AppModule)

  app.enableShutdownHooks()

  app.setGlobalPrefix("api")
  app.use(cookieParser())
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }))
  try { (app.getHttpAdapter().getInstance() as any).set("trust proxy", true) } catch {}
  const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000").split(",").map(s => s.trim()).filter(Boolean)
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin)
      ) {
        callback(null, true)
      } else {
        callback(new Error("CORS policy violation: Origin not allowed"), false)
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })

  app.useGlobalFilters(new GlobalExceptionFilter())
  app.useGlobalInterceptors(new LoggerInterceptor())

  const csrfMiddleware = new CsrfMiddleware()
  app.use((req: any, res: any, next: any) => csrfMiddleware.use(req, res, next))

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  )

  const config = new DocumentBuilder()
    .setTitle("StegShield X API")
    .setDescription("AI-Powered Zero-Trust Secure Communication & Digital Evidence Platform")
    .setVersion("1.0")
    .addBearerAuth()
    .addApiKey({ type: "apiKey", name: "Authorization", in: "header", description: "API Key (Bearer sk_...)" }, "api-key")
    .build()

  const isDev = process.env.NODE_ENV !== "production"
  if (isDev) {
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup("api/docs", app, document)
  }

  const port = process.env.PORT || 4000
  await app.listen(port)
  console.log(`StegShield X API running on port ${port}`)
}

bootstrap()
