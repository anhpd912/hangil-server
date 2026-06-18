---
name: hangil-backend-open-decisions
description: Unresolved architecture decisions for Hangil backend MVP Phase 1 that block clean implementation
metadata:
  type: project
---

Hangil backend (Fastify+Drizzle+Neon, Korean-learning app for VN users). Plan at `plans/260618-1448-hangil-backend-mvp-phase1/`. Three decisions deferred to user during planning:

1. **Better Auth ↔ `users` table ownership.** Spec puts app fields (plan, track, streak) ON `users`, but Better Auth's drizzle adapter wants its own user/session/account tables. Must reconcile before `db:push` or it conflicts.
   **Why:** affects schema (P2) + auth plugin (P4) + register row creation (P5).
   **How to apply:** confirm Better Auth adapter table strategy before writing schema; don't push until resolved.

2. **AI journal-check gating.** Spec STEP3 labels AI routes "pro-gated" but CLAUDE.md rate table + STEP3 body say 5/day Free + unlimited Pro (rate-limited, NOT Pro-only). Recommended rate-limited (matches CLAUDE.md).
   **Why:** changes whether requirePro or checkRateLimit guards the route.
   **How to apply:** default to rate-limited per CLAUDE.md unless user says Pro-only.

3. **Day-boundary timezone** for streak (P3) and daily rate-limit windows (P4). VN audience → likely Asia/Ho_Chi_Minh (UTC+7), but unspecified. Must be consistent across streak + ratelimit.
   **Why:** wrong tz = streaks reset at midnight UTC (7am VN), confusing users.
   **How to apply:** pick one tz, use everywhere day math happens.
