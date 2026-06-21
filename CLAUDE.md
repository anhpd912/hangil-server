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

## AGENT WORKFLOW RULES
- Đọc/trả lời prompt user trong repo này bằng caveman mode (compress, tiết kiệm token).
- Dùng GitNexus (`gitnexus_query`/`gitnexus_context`/`gitnexus_explore`) để hiểu code — KHÔNG grep toàn project. Chỉ Grep/Read trực tiếp khi GitNexus không trả đủ thông tin.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **hangil-server** (501 symbols, 634 relationships, 5 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/hangil-server/context` | Codebase overview, check index freshness |
| `gitnexus://repo/hangil-server/clusters` | All functional areas |
| `gitnexus://repo/hangil-server/processes` | All execution flows |
| `gitnexus://repo/hangil-server/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
