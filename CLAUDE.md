# ══════════════════════════════════════════════
# HANGIL BACKEND — CLAUDE.md
# ══════════════════════════════════════════════
## PROJECT OVERVIEW
Hangil là web học tiếng Hàn cho người Việt Nam.
Backend này phục vụ MVP Phase 1 — chạy song song
với frontend Next.js tại repo hangil-app/.
## TECH STACK
Runtime : Node.js 20+ (LTS)
Framework : Fastify 4 + TypeScript (strict mode)
ORM : Drizzle ORM
Database : Neon (serverless PostgreSQL)
Auth : Better Auth
Cache : Upstash Redis
AI : Anthropic Claude API (claude-haiku-4-5)
Storage : Cloudflare R2 (S3-compatible)
Payment : Stripe
Email : Resend
Deploy : Railway
## PROJECT STRUCTURE
api/
├── src/
│ ├── index.ts # entry point, server bootstrap
│ ├── plugins/ # fastify plugins (cors, auth, redis...)
│ ├── routes/ # route handlers
│ │ ├── auth.ts
│ │ ├── lessons.ts
│ │ ├── flashcard.ts
│ │ ├── progress.ts
│ │ └── ai.ts
│ ├── db/
│ │ ├── schema.ts # Drizzle schema (source of truth)
│ │ └── index.ts # Neon connection
│ ├── services/
│ │ ├── srs.ts # SM-2 algorithm
│ │ ├── claude.ts # AI wrapper
│ │ └── streak.ts # streak logic
│ └── lib/
│ ├── errors.ts # custom error classes
│ └── validators.ts # Zod schemas
├── drizzle/ # migration files
├── .env.example
└── CLAUDE.md
## CODING CONVENTIONS
- TypeScript strict: true — không dùng any, không ts-ignore
- Mọi route phải có Zod schema cho request body và response
- Dùng Result pattern thay vì throw/catch lan tràn:
type Result<T> = { ok: true; data: T } | { ok: false; error: string }
- Không business logic trong route handler —
route chỉ validate input → gọi service → trả response
- Tên hàm bằng tiếng Anh, comment giải thích bằng tiếng Việt
- Mọi hàm async phải handle error — không để unhandled rejection
- Dùng snake_case cho DB columns, camelCase cho TypeScript
## API CONVENTIONS
Base URL : /api/v1
Auth header: Authorization: Bearer <token>
Response thành công:
{ success: true, data: T }
Response lỗi:
{ success: false, error: string, code: string }
HTTP status codes:
200 GET thành công · 201 POST tạo mới
400 validation error · 401 chưa auth
403 không đủ quyền (cần Pro) · 404 not found
429 rate limit · 500 server error
## ENVIRONMENT VARIABLES (xem .env.example)
DATABASE_URL # Neon connection string
BETTER_AUTH_SECRET # random 32-char string
UPSTASH_REDIS_URL # Upstash REST URL
UPSTASH_REDIS_TOKEN # Upstash token
ANTHROPIC_API_KEY # Claude API key
STRIPE_SECRET_KEY # Stripe secret
STRIPE_WEBHOOK_SECRET
R2_ACCOUNT_ID # Cloudflare R2
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
RESEND_API_KEY
FRONTEND_URL # https://hangil.vn
## RATE LIMITING RULES (Upstash Redis)
POST /ai/journal-check : 5 req/ngày (Free), unlimited (Pro)
POST /ai/chat : 10 req/ngày (Free), unlimited (Pro)
POST /shadowing/session : 1 req/ngày (Free), unlimited (Pro)
POST /auth/register : 5 req/giờ/IP
## SRS ALGORITHM (services/srs.ts)
Dùng SM-2 algorithm thuần TypeScript — không thư viện ngoài.
Input : easiness, repetitions, interval, grade (0–5)
Output: nextInterval (days), nextEasiness, nextRepetitions
Grade mapping:
5=Dễ · 4=Tốt · 3=Khó · 0=Lại
Lưu next_review_at = now + nextInterval days vào DB
## COMMANDS
npm run dev # nodemon + tsx watch
npm run build # tsc
npm run db:push # drizzle-kit push (dev)
npm run db:migrate # drizzle-kit migrate (prod)
npm run db:studio # Drizzle Studio UI
npm run test # vitest
## WHAT NOT TO DO
✕ Không dùng any ORM ngoài Drizzle
✕ Không gọi Anthropic API trực tiếp trong route — dùng services/claude.ts
✕ Không lưu API keys trong code — dùng env vars
✕ Không tạo migration thủ công — dùng drizzle-kit
✕ Không return stack trace ra client ở production
✕ Không bỏ qua rate limiting cho AI routes
# ══════════════════════════════════════════════