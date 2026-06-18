---
title: "Hangil Backend MVP Phase 1"
description: "Fastify+Drizzle+Neon backend: auth, lessons, SRS flashcards, progress, AI journal-check."
status: pending
priority: P1
effort: ~16h
branch: main
tags: [backend, fastify, drizzle, neon, srs, ai]
created: 2026-06-18
---

# Hangil Backend — MVP Phase 1

Korean-learning backend for Vietnamese users. Greenfield repo (only CLAUDE.md exists).
All code lives under `api/src/`. Conventions: TS strict, Drizzle-only ORM, Result pattern,
Zod-per-route, `/api/v1` prefix, response `{success,data}` / `{success:false,error,code}`,
snake_case DB cols / camelCase TS. Services hold business logic — routes only validate→call→respond.

## Build order (dependency graph)

```
P1 init ──► P2 schema ──► P3 services ──► P5 plugins ──► P6 routes ──► P7 errors ──► P8 verify
                              (srs/claude/streak)  (auth/ratelimit/requirePro)
P4 (errors+lib) feeds P5/P6/P7. P3 has no DB writes (pure/SDK) → testable before P6.
```

P4 (lib/errors) intentionally early — plugins + routes both import AppError. Folded into P3 chain.

## Phases

| # | Phase | File | Status | Effort | Blocked by |
|---|-------|------|--------|--------|-----------|
| 1 | Project init (deps, tsconfig, env, npm scripts) | [phase-01-project-init.md](phase-01-project-init.md) | pending | 1.5h | — |
| 2 | Drizzle schema + Neon connection | [phase-02-database-schema.md](phase-02-database-schema.md) | pending | 2h | P1 |
| 3 | Services: SRS / Claude / streak + lib/errors | [phase-03-services-and-errors.md](phase-03-services-and-errors.md) | pending | 3.5h | P1, P2 |
| 4 | Fastify plugins: auth / ratelimit / requirePro | [phase-04-plugins.md](phase-04-plugins.md) | pending | 2.5h | P1, P3 |
| 5 | Routes: auth, lessons, flashcard, progress, ai | [phase-05-routes.md](phase-05-routes.md) | pending | 4h | P2, P3, P4 |
| 6 | Global error handler + server bootstrap | [phase-06-error-handler-bootstrap.md](phase-06-error-handler-bootstrap.md) | pending | 1.5h | P3, P5 |
| 7 | Verification (db:push, dev, test, curl) | [phase-07-verification.md](phase-07-verification.md) | pending | 1h | all |

## Key dependencies (external)
- Neon project + `DATABASE_URL`; Upstash REST URL+token; Anthropic API key; Better Auth secret.
- All injected via `.env` (never committed). `.env.example` lists keys with no values.

## Cross-cutting decisions
- **Better Auth** owns user identity table + sessions. Our `users` table extends it with app fields
  (plan, track, streak). Decide in P2 whether Better Auth writes to our `users` or a separate auth table — see P2 Risk.
- **Result pattern** for service returns; routes map `Result` → HTTP. AppError thrown only at boundaries the error handler catches.
- **Rate limiting** keyed per-user-per-day for AI routes; per-IP-per-hour for register.

## Unresolved questions
See per-phase "Unresolved questions" sections; consolidated in phase-02 (auth/users table shape) and phase-04 (Better Auth token verification mechanism).
