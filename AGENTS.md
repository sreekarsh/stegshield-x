# StegShield X

## Stack
- Frontend: Next.js 16 (App Router) + React 18 + TypeScript + Tailwind CSS + shadcn/ui
- Backend: NestJS 10 + Prisma 5 + PostgreSQL 16
- AI Service: Python FastAPI + NumPy + Pillow
- Cache: Redis 7 (BullMQ for job queues)
- Auth: JWT + refresh tokens + Argon2 + Passport (Google/GitHub OAuth)
- Validation: class-validator + class-transformer
- Reverse Proxy: Nginx
- Hosting: Docker Compose (5 services)

## Architecture
- Multi-service: frontend (port 3000), backend (port 4000), AI service (port 8000), PostgreSQL, Redis
- Nginx reverse proxy on ports 80/443
- Prisma ORM with PostgreSQL — 25+ models, proper indexes, enums
- RBAC with 5 roles: ADMIN, OWNER, EDITOR, VIEWER, INVESTIGATOR
- JWT access tokens (15min) + refresh tokens (7d HTTP-only cookies)
- Rate limiting via @nestjs/throttler (60 req/min default)

## Project Structure
```
cybersecurity/
├── frontend/          # Next.js app
│   └── src/
│       ├── app/       # App router pages (auth, dashboard, share)
│       ├── components/# Reusable UI components
│       ├── hooks/     # Custom React hooks
│       ├── lib/       # API client, utilities
│       ├── modules/   # Feature modules
│       ├── store/     # Zustand stores
│       └── types/     # TypeScript types
├── backend/           # NestJS API
│   └── src/
│       ├── auth/      # Authentication (JWT, OAuth, MFA)
│       ├── stego/     # Steganography operations
│       ├── forensics/ # Digital forensics analysis
│       ├── tamper/    # Tamper detection
│       ├── evidence/  # Evidence management + chain of custody
│       ├── sharing/   # Secure file sharing
│       ├── encryption/# Key management
│       ├── watermark/ # File watermarking
│       ├── metadata/  # Metadata analysis
│       ├── ai/        # AI service proxy
│       ├── panic/     # Panic mode
│       ├── decoy/     # Decoy vaults
│       ├── times/     # Time capsules
│       ├── trust/     # Trust scoring
│       ├── team/      # Team/organization management
│       ├── vault/     # Secure vault
│       ├── pdf/       # PDF encryption/decryption
│       ├── url-checker/# URL safety analysis
│       ├── secret-language/ # Custom secret languages
│       ├── contacts/  # Contact management
│       ├── messages/  # Encrypted messaging
│       ├── reports/   # Report generation
│       ├── audit/     # Audit logging
│       ├── api-keys/  # API key management
│       ├── notifications/ # User notifications
│       ├── dashboard/ # Dashboard analytics
│       └── admin/     # Admin panel
├── ai-service/        # Python FastAPI microservice
│   └── main.py        # All AI endpoints (entropy, stego, threat, tamper, deepfake, EXIF, etc.)
├── docker/            # Dockerfiles + nginx config
└── docker-compose.yml # Full stack orchestration
```

## Conventions
- Backend: NestJS modules with controller/service pattern, Prisma for DB access
- Frontend: Next.js App Router, server components by default, client components for interactivity
- API calls: fetch-based client in `frontend/src/lib/api.ts`
- State management: Zustand stores + TanStack React Query
- Styling: Tailwind CSS + shadcn/ui (Radix primitives)
- Auth: JWT stored in memory, refresh token in HTTP-only cookie
- File uploads: multer on backend, stored in `backend/uploads/`

## Commands
### Backend
- `npm run start:dev` — Start NestJS in watch mode (port 4000)
- `npm run build` — Build for production
- `npm run prisma:generate` — Generate Prisma client
- `npm run prisma:migrate` — Run Prisma migrations
- `npm run lint` — ESLint
- `npm run test` — Jest

### Frontend
- `npm run dev` — Next.js dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check

### AI Service
- `uvicorn main:app --reload --port 8000` — Dev server
- `docker compose up ai-service` — Containerized

### Docker
- `docker compose up -d` — Start all services
- `docker compose down` — Stop all services

## Security
- Passwords hashed with Argon2
- JWT access tokens (15min) in memory, refresh tokens (7d) in HTTP-only Secure SameSite=Strict cookies
- Rate limiting: 60 req/min per IP (ThrottlerModule)
- Helmet security headers (CSP, HSTS, X-Frame-Options, etc.)
- RBAC with 5 roles — not boolean isAdmin
- MFA support via TOTP (speakeasy)
- Audit logging for all mutations
- API key management with permissions
- Session tracking (device, browser, IP, location)
- Account lockout after failed attempts
- Input validation via class-validator on all endpoints
- File upload size limits

## Key Features
- Steganography: LSB encoding/decoding in images
- Digital Forensics: entropy analysis, LSB steganalysis, file carving, string extraction
- Tamper Detection: gradient analysis, ELA (Error Level Analysis)
- Deepfake Detection: FFT frequency analysis, color correlation, noise consistency
- Evidence Management: chain of custody, hash verification, sharing with permissions
- Secure Sharing: password-protected links, download limits, geo/IP restrictions, expiry
- Watermarking: visible and invisible watermarks
- Metadata Privacy: EXIF analysis and cleaning
- Panic Mode: emergency account lockdown
- Decoy Vaults: fake vaults with fake passwords
- Time Capsules: encrypted data with unlock dates
- Secret Languages: custom glyph-based languages
- Trust Scoring: file security grading (A+ through F)
- PDF Tools: encryption, decryption, password protection
- URL Checker: safety analysis for URLs
- Encrypted Messaging: self-destruct, one-time view, expiry
- Shamir Secret Sharing: split secrets into shares
