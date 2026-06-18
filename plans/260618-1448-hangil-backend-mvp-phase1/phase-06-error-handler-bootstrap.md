# Phase 06 — Global Error Handler + Server Bootstrap

## Context Links
- Spec: STEP 6 (error handler) + STEP 7 partial (server starts on 3001). Errors: P3 lib/errors.ts.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** `index.ts` bootstrap (Fastify instance, plugins, route registration, listen 3001) + global `setErrorHandler`.

## Key Insights
- Single error handler centralizes mapping → routes throw AppError, never format errors themselves.
- ZodError → 400 with field errors; AppError → its statusCode + code; unknown → 500 logged, generic message (CLAUDE.md: no stack trace to client in prod).
- Plugin registration order: helmet, cors, rate-limit (global), auth plugin, then route groups with `/api/v1` prefix.

## Requirements
**Functional**
- `index.ts`: create Fastify (logger on), register @fastify/helmet, @fastify/cors (origin = FRONTEND_URL), @fastify/rate-limit (global baseline), auth plugin, ratelimit plugin. Register route modules under `/api/v1`. Listen on `process.env.PORT ?? 3001`, host 0.0.0.0.
- Global `setErrorHandler`:
  - `AppError` → `reply.status(err.statusCode).send({success:false,error:err.message,code:err.code})`.
  - `ZodError` → 400 `{success:false,error:"Validation failed",code:"VALIDATION",fields:[...]}`.
  - unknown → log full error; send 500 `{success:false,error:"Lỗi hệ thống",code:"INTERNAL"}` (no stack in prod).
- `setNotFoundHandler` → 404 `{success:false,error:"Không tìm thấy",code:"NOT_FOUND"}`.

**Non-functional**
- Graceful shutdown (SIGTERM/SIGINT close server) — Railway friendly.
- Env validation at boot: fail fast if required keys missing (Zod over process.env).

## Architecture
- Data flow: request → plugins → route → (throw) → setErrorHandler → uniform error response.
- Env validation lifetime: once at process start (not per-request).

## Related Code Files
**Create**
- `api/src/index.ts`
- `api/src/lib/env.ts` (Zod-validated env loader)

## Implementation Steps
1. `lib/env.ts`: Zod schema over process.env; parse at import; export typed `env`.
2. `index.ts`: build Fastify, register plugins in order, register routes with prefix.
3. Implement setErrorHandler with AppError/ZodError/unknown branches.
4. setNotFoundHandler.
5. Graceful shutdown handlers.
6. Listen on PORT 3001.

## Todo List
- [ ] lib/env.ts (fail-fast env validation)
- [ ] index.ts Fastify bootstrap + plugin order
- [ ] route registration under /api/v1
- [ ] setErrorHandler (AppError / ZodError / unknown)
- [ ] setNotFoundHandler
- [ ] graceful shutdown

## Success Criteria
- `npm run dev` starts on 3001, logs ready.
- Throwing AppError yields correct status + code; ZodError → 400 fields; unknown → 500 no stack leak.
- Missing required env → process exits with clear message.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Stack trace leak in prod | L×H | Branch on NODE_ENV; only log server-side, generic client message. |
| Plugin order causing auth bypass | M×H | Fixed documented order; per-route preHandlers enforce auth regardless. |
| Env validation too strict for local/test | M×M | Mark Stripe/R2/Resend optional for MVP boot; required: DATABASE_URL, BETTER_AUTH_SECRET, ANTHROPIC, UPSTASH. |
| CORS misconfig blocks frontend | M×M | origin from FRONTEND_URL; allow credentials if Better Auth cookies used. |

## Security Considerations
- No detail leak on 500. helmet headers. CORS locked to FRONTEND_URL. Env fail-fast prevents running with missing secrets.

## Next Steps
- Unblocks P7 verification.

## Unresolved questions
- Which env keys are hard-required at boot vs optional for MVP (Stripe/R2/Resend unused in Phase 1 routes). Recommend optional. Confirm with lead.
