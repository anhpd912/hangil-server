---
title: "Admin API — user management, lessons/vocab CRUD, stats"
description: "Backend-only admin endpoints under /api/v1/admin/* gated by role-based access."
status: pending
priority: P2
effort: 6h
branch: main
tags: [backend, admin, better-auth, fastify, drizzle]
created: 2026-06-18
---

# Admin API

Backend-only admin surface for the Hangil app (frontend repo `hangil-app` consumes later).
Adds a `role` field to the Better Auth user table, a `requireAdmin` preHandler, and
`/api/v1/admin/*` routes for user management, lesson/vocabulary CRUD, and dashboard stats.

## Verified Codebase Facts (file:line)

- `auth-schema.ts` is the GENERATED file; `plan/track/streakCount/lastStudiedAt` were emitted as
  plain `text/integer/timestamp` with defaults — NOT pgEnum (`src/db/auth-schema.ts:22-25`).
  So `role` will be plain `text("role").default("user")`, not an enum.
- additionalFields source of truth = `src/lib/auth.ts:12-32`. Regen reads from here.
- `request.user` shape lacks `role` (`src/plugins/auth.ts:8-14`, populated 33-38).
- Routes register inside `/api/v1` prefix wrapper (`src/index.ts:22-31`).
- User-field mutation pattern = direct Drizzle `db.update(user).set(...)`, NOT Better Auth
  updateUser API (`src/services/streak.ts:50-53`). Admin PATCH MUST follow this.
- VN-timezone day-key helper exists: `toVnDateKey` (`src/services/streak.ts:9`) — but is NOT
  exported. Stats "active today" needs it exported or duplicated.
- preHandler convention: `{ preHandler: requireAuth }` per route (`src/routes/ai.ts:14`).
  Chain via array `[requireAuth, requireAdmin]`.
- Route validation = `safeParse` → inline 400 `{success:false,...}` (`src/routes/lessons.ts:10-17`).
- Drizzle ORM 0.45.2 (`package.json:27`) — `count`, `ilike`, `or`, `sql` available.

## Phases

| # | Phase | Status | File |
|---|-------|--------|------|
| 1 | Add `role` field + regenerate auth-schema (HIGH RISK) | pending | [phase-01](phase-01-role-field-and-schema-regen.md) |
| 2 | `requireAdmin` preHandler + request.user.role | pending | [phase-02](phase-02-require-admin-prehandler.md) |
| 3 | Admin Zod schemas | pending | [phase-03](phase-03-admin-validators.md) |
| 4 | Admin users routes | pending | [phase-04](phase-04-admin-users-routes.md) |
| 5 | Admin lessons + vocabulary CRUD routes | pending | [phase-05](phase-05-admin-lessons-vocab-routes.md) |
| 6 | Admin stats route + index wiring | pending | [phase-06](phase-06-admin-stats-and-wiring.md) |

## Dependency Graph

```
P1 (role field + regen) ──> P2 (requireAdmin) ──> P4, P5, P6 (routes)
P3 (validators) ─────────────────────────────────> P4, P5
P6 also depends on P3 (stats has no body, but wiring needs P4+P5 done)
```

- P1 blocks P2 (request.user.role needs the field to exist).
- P2 blocks P4/P5/P6 (all routes use requireAdmin).
- P3 blocks P4/P5 (route bodies need schemas).
- P6 wiring step blocks on P4+P5 (index registers the full admin plugin).

## Top Risk

Phase 1 schema regeneration OVERWRITES `src/db/auth-schema.ts`. The 4 existing
additionalFields (`plan/track/streakCount/lastStudiedAt`) plus the hand-added
`session_userId_idx`/`account_userId_idx` indexes and `*Relations` blocks could be
lost if regen output differs. Mitigation = git diff gate + manual field-presence
checklist before `db:push`. Full detail in phase-01.

## Success Criteria (whole plan)

- `tsc` (npm run build) passes, strict mode, no `any`.
- `db:push` applies `role` column with zero data loss; existing columns intact.
- All `/api/v1/admin/*` routes return 401 without auth, 403 for non-admin, 200/201 for admin.
- No business logic in route handlers beyond validate→query→respond (CLAUDE.md).
- Every new file < 200 lines.
