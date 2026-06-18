# Phase 04 — Fastify Plugins (auth / ratelimit / requirePro)

## Context Links
- Spec: STEP 5. Rate limits: CLAUDE.md RATE LIMITING RULES. Auth: Better Auth.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** `plugins/auth.ts` (verify token → request.user), `plugins/ratelimit.ts` (Upstash), `plugins/requirePro.ts` (Pro gate preHandler).

## Key Insights
- Better Auth issues sessions; CLAUDE.md uses `Authorization: Bearer <token>`. Auth plugin must verify Better Auth session/token and load app user (plan, track) from `users`.
- `request.user` must be typed via Fastify module augmentation (`declare module 'fastify'`) — strict mode, no `any`.
- Rate-limit state is per-user-per-day in Upstash — keyed `ratelimit:{route}:{userId}:{yyyy-mm-dd}` via @upstash/ratelimit sliding/fixed window. Pro users bypass entirely.
- requirePro is a preHandler, runs AFTER auth plugin populated request.user.

## Requirements
**Functional**
- `plugins/auth.ts`: fastify-plugin. Decorator/preHandler reads `Authorization` header, verifies via Better Auth (validate session token), loads `users` row, sets `request.user = {id,email,plan,track}`. Missing/invalid → throw AppError unauthorized(401).
- `plugins/ratelimit.ts`: init `@upstash/ratelimit` with Upstash Redis client. Export `checkRateLimit(key, limit, window)` usable as preHandler factory. On exceed → throw AppError rateLimited(429). Free-tier limits per CLAUDE.md; Pro → skip.
- `plugins/requirePro.ts`: preHandler; if `request.user.plan !== 'pro'` → throw AppError forbidden(403) message `"Tính năng này yêu cầu gói Pro"`.

**Non-functional**
- Auth verification cheap (cache user lookup if needed post-MVP). No secrets in code.
- Register-route IP limit (5/hr/IP) configured here or in auth route (P5) using @fastify/rate-limit or Upstash by IP.

## Architecture
- Order: auth preHandler → (ratelimit preHandler) → (requirePro preHandler) → route handler.
- Data flow auth: header → Better Auth verify → users SELECT → request.user.
- Data flow ratelimit: build key from user+route+day → Upstash incr → allow/deny.
- request.user lifetime = **per-request** (Fastify request object). No shared mutable state across requests — confirmed safe (no module-level user state).

## Related Code Files
**Create**
- `api/src/plugins/auth.ts`
- `api/src/plugins/ratelimit.ts`
- `api/src/plugins/requirePro.ts`
- `api/src/types/fastify.d.ts` (augment FastifyRequest with `user`)

## Implementation Steps
1. Augment Fastify types: `request.user: { id; email; plan: 'free'|'pro'; track }`.
2. `auth.ts`: register as fastify-plugin; verify Better Auth token; load user; decorate. Export `requireAuth` preHandler.
3. `ratelimit.ts`: Upstash Redis + Ratelimit instances; `checkRateLimit(routeKey, limit, windowDays)` returns preHandler; Pro bypass; throw rateLimited on deny.
4. `requirePro.ts`: simple preHandler reading request.user.plan.
5. Wire register IP limit (5/hr) — configure @fastify/rate-limit keyed by IP on the register route.

## Todo List
- [ ] types/fastify.d.ts augmentation
- [ ] plugins/auth.ts (Better Auth verify + load user)
- [ ] plugins/ratelimit.ts (Upstash, Pro bypass)
- [ ] plugins/requirePro.ts (403 Pro gate)
- [ ] register IP rate limit wiring

## Success Criteria
- Unauthenticated request to protected route → 401 `{success:false,error,code}`.
- Free user hitting AI route past limit → 429; Pro user unlimited.
- Non-Pro hitting Pro route → 403 with Vietnamese message.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Better Auth token verification API unknown (Bearer vs cookie session) | **H×H** | Confirm Better Auth session/JWT verification method before coding; CLAUDE.md says Bearer — verify Better Auth supports bearer plugin. Spike in P4. |
| Upstash daily window reset semantics | M×M | Use fixed-window keyed by `yyyy-mm-dd` (VN day) so reset aligns with user expectation; document tz (match streak decision). |
| request.user typing leaks `any` under strict | M×M | Module augmentation file; no optional-chaining shortcuts. |
| preHandler order misordered (ratelimit before auth) | M×H | Document fixed order; auth always first per-route. |

## Security Considerations
- 401 vs 403 distinct. No token contents logged. IP rate limit mitigates register abuse. Rate-limit keys namespaced to avoid collision.

## Next Steps
- Unblocks P5 (routes attach these preHandlers).

## Unresolved questions
- **Better Auth bearer/session mechanism** — exact verify call + whether bearer plugin needed. Blocks auth.ts. Confirm with lead / Better Auth docs.
- Timezone for daily rate-limit window — must match P3 streak decision.
