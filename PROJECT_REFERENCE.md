# Professional Full-Stack Project Reference

> Use this as your checklist and architecture guide for every new project.

---

## 1. Stack Recommendations (2026)

### Tier 1: Enterprise / Production-Ready

| Layer | Primary Choice | Alternative | When to Use Alt |
|-------|---------------|-------------|-----------------|
| **Fullstack Framework** | Next.js (App Router) + TypeScript | SvelteKit | SvelteKit for smaller teams, simpler state |
| **Backend (separate)** | Go / Fiber | Hono.js (Node) | Go for extreme perf & concurrency |
| **Backend (monolith)** | Hono.js + tRPC | FastAPI (Python) | FastAPI if team knows Python / needs ML |
| **Database** | PostgreSQL | SQLite (lite projects) | SQLite for single-server / embedded |
| **Cache** | Redis (Upstash/Valkey) | — | Always use Redis |
| **ORM** | Prisma | Drizzle ORM | Drizzle for more control / SQL-like DX |
| **Validation** | Zod (shared types) | Pydantic (Python) | Pydantic if using FastAPI |
| **Auth** | Lucia / Supabase Auth | Clerk / Auth0 | Managed if you don't want to handle auth |
| **Hosting** | Docker + Fly.io / Railway | AWS ECS / K8s | K8s at enterprise scale |
| **CDN** | Cloudflare | Fastly | Cloudflare is standard |
| **Monitoring** | Sentry + Grafana + OpenTelemetry | Datadog | Datadog if budget allows |

### Core Principle: Pick ONE stack and standardize across all projects.

---

## 2. Project Structure

```
project/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # Backend (if separate)
├── packages/
│     ├── shared/             # Zod schemas, types, constants
│     ├── db/                 # Prisma schema, migrations
│     └── config/             # Environment configs
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .github/
│   └── workflows/           # CI/CD pipelines
├── .env.example
├── .prettierrc
├── .eslintrc.js
├── tsconfig.json
├── AGENTS.md
└── README.md
```

**Why monorepo (pnpm workspaces / Turborepo):**
- Shared types between frontend & backend
- Single lint/typecheck/test command
- Atomic commits across packages
- Reusable configs

---

## 3. Security Checklist

### Authentication & Authorization
- [ ] Passwords hashed with **argon2** (not bcrypt, not SHA)
- [ ] JWT access tokens: 15 min expiry, stored in memory only
- [ ] Refresh tokens: 7 day expiry, HTTP-only + Secure + SameSite=Strict cookies
- [ ] CSRF tokens on mutation endpoints (or use SameSite=Strict)
- [ ] Rate limiting: 10 req/s per IP, 100 req/min per user (use `upstash-rate-limit` or `express-rate-limit`)
- [ ] Account lockout after 5 failed attempts (exponential backoff)
- [ ] Session invalidation on password change
- [ ] Role-based access control (RBAC) — not boolean `isAdmin`
- [ ] API key rotation mechanism

### HTTP Security Headers (Helmet)
```typescript
// Next.js middleware.ts or backend
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=63072000
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=()
```

### Data Protection
- [ ] Input validation at the boundary (Zod) — reject before it reaches DB
- [ ] SQL injection protection: use Prisma/SQLAlchemy — never raw queries
- [ ] No secrets in code: all via environment variables
- [ ] Secrets rotated every 90 days
- [ ] DB encryption at rest (RDS/Aurora default)
- [ ] PII fields encrypted at application level (e.g., `pgcrypto`)
- [ ] Audit logging for all data mutations (who, what, when)
- [ ] Data export / delete endpoints (GDPR compliance)

### OWASP Top 10 Coverage
- [ ] **Broken Access Control** — test every endpoint with unauthorized roles
- [ ] **Cryptographic Failures** — no custom crypto, use standard libraries
- [ ] **Injection** — Zod validation + ORM parameterized queries
- [ ] **Insecure Design** — threat modeling during planning phase
- [ ] **Security Misconfiguration** — automated scanning (Trivy, Snyk)
- [ ] **Vulnerable Components** — Dependabot / Renovate auto-updates
- [ ] **Auth Failures** — rate limiting, lockout, MFA ready
- [ ] **Data Integrity** — signed webhooks, HMAC validation
- [ ] **Logging & Monitoring** — structured logs, alerts on 4xx/5xx spikes
- [ ] **SSRF** — block internal IP ranges, validate URLs

---

## 4. Error Handling Architecture

### Backend (structured JSON errors)

```typescript
// All errors return this shape
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [{ "field": "email", "issue": "Required" }],
    "requestId": "req_abc123"
  }
}
```

**Error types to implement:**
- `BAD_REQUEST` (400) — validation failures
- `UNAUTHORIZED` (401) — missing/invalid token
- `FORBIDDEN` (403) — valid token, insufficient permissions
- `NOT_FOUND` (404) — resource doesn't exist
- `CONFLICT` (409) — duplicate resource
- `RATE_LIMITED` (429) — too many requests
- `INTERNAL_ERROR` (500) — unexpected, no stack trace exposed

**Global handler pattern:**
```typescript
// One middleware that catches everything
app.onError((err, c) => {
  log.error({ err, requestId: c.get('requestId') })
  if (err instanceof ZodError) {
    return c.json({ error: formatZodError(err) }, 400)
  }
  if (err instanceof AppError) {
    return c.json({ error: err.toJSON() }, err.status)
  }
  return c.json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } }, 500)
})
```

**Logging (always structured, never console.log):**
```typescript
// Use pino / winston / @opentelemetry/instrumentation
logger.info({ event: 'user.created', userId, durationMs })
logger.error({ event: 'payment.failed', userId, error: err.message, stack: err.stack })
```

### Frontend (global error handling)

```typescript
// React Query global onError
const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      onError: (error) => {
        if (error.code === 'UNAUTHORIZED') redirectToLogin()
        if (error.code === 'RATE_LIMITED') showToast('Too many requests. Please wait.')
        else showToast(error.message)
      }
    }
  }
})

// Global fetch interceptor
fetchClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.status === 500) captureException(err)
    return Promise.reject(err)
  }
)
```

- [ ] **Error boundaries** around every route segment
- [ ] **Sentry/Raygun** for uncaught exceptions
- [ ] **Graceful degradation** — show fallback UI, don't crash the whole page
- [ ] **Retry with exponential backoff** for network failures (TanStack Query does this)
- [ ] **User-friendly messages** — never show raw error codes to users

---

## 5. Performance Optimization

### Database
- [ ] Index all foreign keys and columns in WHERE/ORDER BY/JOIN
- [ ] Use `EXPLAIN ANALYZE` on every slow query before shipping
- [ ] Pagination: cursor-based (not offset) for large datasets
- [ ] Connection pooling: `pgBouncer` or built-in pooling
- [ ] Read replicas for read-heavy workloads
- [ ] Materialized views for expensive aggregations
- [ ] Query timeouts: 30s max, 5s for user-facing queries

### API
- [ ] Response compression (gzip/brotli)
- [ ] HTTP/2 or HTTP/3
- [ ] Conditional responses: ETag + If-None-Match
- [ ] Batch endpoints for N+1 queries (GraphQL or custom batching)
- [ ] Caching: `Cache-Control` headers, CDN cache, Redis (5-60s TTL)
- [ ] Rate limit: 100 req/s burst, sustained 10 req/s
- [ ] Payload size limits: 10MB upload, 1MB JSON request

### Frontend
- [ ] Bundle analysis (`@next/bundle-analyzer`) — keep initial JS under 150KB
- [ ] Code splitting: dynamic imports for routes, modals, heavy components
- [ ] Image optimization: WebP/AVIF, lazy loading, responsive sizes
- [ ] Font: self-host woff2, `font-display: swap`
- [ ] Prefetch: `<Link prefetch>` for likely navigations
- [ ] Virtual scrolling for long lists (TanStack Virtual)
- [ ] Debounce search inputs (300ms)
- [ ] Skeleton loaders (not spinners)
- [ ] Web Workers for CPU-heavy tasks
- [ ] Service Worker for offline support (if needed)
- [ ] Lighthouse target: 90+ on all metrics

---

## 6. Validation Strategy

### Every input, every boundary, every time.

```
User Input → Zod Schema → Backend Handler → Prisma → PostgreSQL
   ↑                    ↑                      ↑
 Client-side          Server-side           DB constraints
 validation           validation            (unique, FK, CHECK)
```

**Rule: Validate at EVERY layer. Never trust the layer above.**

```typescript
// Shared Zod schema (packages/shared)
export const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(100),
  age: z.number().int().min(13).max(150),
})

// Frontend: validate before sending
const result = createUserSchema.safeParse(formData)
if (!result.success) showErrors(result.error)

// Backend: validate again at the boundary
app.post('/users', async (c) => {
  const data = createUserSchema.parse(await c.req.json())
  // data is now fully typed and validated
})
```

**Additional backend validation:**
- [ ] Rate limit check
- [ ] Permission check (RBAC)
- [ ] Resource ownership check
- [ ] Business rule validation (e.g., "can't delete last admin")

---

## 7. Testing Strategy

| Layer | Tool | Coverage Target | What to Test |
|-------|------|----------------|--------------|
| **Unit** | Vitest / Jest | 80%+ | Pure functions, validation schemas, utilities |
| **Integration** | Playwright / Supertest | 60%+ | API endpoints, DB interactions, auth flows |
| **E2E** | Playwright | 20%+ | Critical user journeys (signup, purchase, etc.) |
| **Visual** | Percy / Chromatic | UI components | Visual regressions in component library |

### Minimum Viable Tests for Every Project
```typescript
// 1. Validation schema tests (fast, cheap)
describe('createUserSchema', () => {
  it('rejects invalid email', () => {
    expect(createUserSchema.safeParse({ email: 'bad' }).success).toBe(false)
  })
  it('rejects age under 13', () => {
    expect(createUserSchema.safeParse({ email: 'a@b.com', age: 12 }).success).toBe(false)
  })
})

// 2. API integration tests (hit the real DB)
describe('POST /users', () => {
  it('returns 201 for valid data')
  it('returns 400 for missing name')
  it('returns 409 for duplicate email')
  it('returns 401 without auth token')
})

// 3. E2E critical paths
describe('signup flow', () => {
  it('completes full registration and redirects to dashboard')
  it('shows error for existing email')
})
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
steps:
  - lint (ESLint + Prettier)
  - typecheck (tsc --noEmit)
  - unit tests (vitest)
  - integration tests (with test DB)
  - build (next build)
  - security scan (Snyk / Trivy)
  - deploy (only on main merge)
```

---

## 8. DevOps & Infrastructure

### Docker Compose (Dev)
```yaml
services:
  app:
    build: .
    depends_on: [postgres, redis]
    environment:
      - DATABASE_URL=postgres://user:pass@postgres:5432/db
      - REDIS_URL=redis://redis:6379
  postgres:
    image: postgres:16
    volumes: [pgdata:/var/lib/postgresql/data]
  redis:
    image: redis:7-alpine
```

### Production Checklist
- [ ] Healthcheck endpoint: `GET /health` returns DB + Redis + API status
- [ ] Graceful shutdown (SIGTERM handler)
- [ ] Readiness + liveness probes (K8s) or health checks (Fly.io)
- [ ] Auto-scaling based on CPU/memory
- [ ] Blue-green or rolling deployments
- [ ] Database migrations run before app starts
- [ ] Secrets management (HashiCorp Vault / AWS Secrets Manager / Doppler)
- [ ] Logs shipped to centralized sink (Grafana Loki / Datadog)
- [ ] Metrics: request rate, error rate, p50/p95/p99 latency
- [ ] Alerts: p95 > 500ms, error rate > 1%, 5xx > 0.1%
- [ ] Backup: automated daily DB snapshots, 30-day retention
- [ ] Disaster recovery: documented restore procedure, tested quarterly

---

## 9. AGENTS.md — Required for Every Project

Create `AGENTS.md` at the root. This is how AI tools and new team members onboard instantly.

```markdown
# Project: [Name]

## Stack
- Frontend: Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Backend: Hono.js + tRPC
- Database: PostgreSQL 16 + Prisma ORM
- Cache: Redis (Upstash)
- Auth: Lucia
- Validation: Zod
- Testing: Vitest + Playwright
- Hosting: Fly.io + Cloudflare

## Architecture
- Monorepo with pnpm workspaces
- tRPC for type-safe API calls (no REST)
- Server components by default, client components only for interactivity
- DB migrations via Prisma migrate

## Conventions
- Shared types/schemas in packages/shared
- API routes in apps/api/src/routes/
- Components in apps/web/src/components/
- Tests colocated with source files (*.test.ts)
- Commits: conventional commits (feat:, fix:, chore:)

## Commands
- pnpm dev — start all apps
- pnpm lint — run ESLint + Prettier
- pnpm typecheck — tsc --noEmit
- pnpm test — vitest
- pnpm db:migrate — run Prisma migrations
- pnpm build — build all packages

## Security
- All inputs validated with Zod at both client and server
- Auth via Lucia (session cookies, JWT access + refresh)
- Rate limiting via Upstash
- CSP enforced via Next.js middleware

## Current Todos
- [ ] ...
```

---

## 10. Development Workflow (How to Work With Me)

### For Best Results, Give Me This Prompt:

```
"I want to build a [project name] with:
- Stack: Next.js + Hono + Prisma + PostgreSQL
- Features: [list all features]
- Key requirements: [auth, payments, real-time, etc.]
- Timeline: [urgent / standard]

Make a detailed plan first, then implement everything fully with no placeholders.
Include security, error handling, validation, and tests.
```

### Session Protocol
1. **Plan phase** — I propose architecture, you approve or adjust
2. **Scaffold phase** — I create all files with full implementations
3. **Verify phase** — I run lint, typecheck, tests, build
4. **Review phase** — You review and request changes

---

## Quick Reference: Every Important npm Package

| Purpose | Package |
|---------|---------|
| Validation | `zod` |
| Auth | `lucia` |
| ORM | `@prisma/client` + `prisma` |
| HTTP client | `@tanstack/react-query` + `ky` |
| State | `@tanstack/react-query` |
| Forms | `react-hook-form` + `@hookform/resolvers` (zod) |
| UI | `tailwindcss` + `shadcn/ui` |
| Date | `date-fns` |
| Logging | `pino` |
| Rate limit | `@upstash/rate-limit` |
| Testing | `vitest` + `playwright` |
| Lint | `eslint` + `prettier` + `@ianvs/prettier-plugin-sort-imports` |
| Monorepo | `pnpm` + `turborepo` |
| TypeScript | `tsx` (runner) + `tsc` |
| Backend (Node) | `hono` |
| Backend (Python) | `fastapi` + `pydantic` |
| Backend (Go) | `fiber` + `sqlx` |

---

> **One stack. One structure. Same patterns every time.**
> Consistency eliminates cognitive overhead so you can focus on what makes your project unique.
