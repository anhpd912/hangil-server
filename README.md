# hangil-server

Backend API for **Hangil** — a Korean-learning platform for Vietnamese speakers. This service owns the
database, authentication, and all business logic; the two frontends (`hangil-app`, `hangil-admin`) are
pure clients that talk to it over HTTP.

## Stack

| Concern | Choice |
|---|---|
| Runtime | Node.js ≥ 22, ESM (`"type": "module"`) |
| Framework | Fastify 5 + TypeScript (strict, `NodeNext` resolution) |
| Database | Neon serverless PostgreSQL via Drizzle ORM |
| Auth | Better Auth (bearer tokens, email/password + Google + Facebook) |
| Cache / quotas | Upstash Redis (`@upstash/ratelimit`) |
| AI | Pluggable provider — Anthropic Claude or Groq, selected by env var |
| TTS | ElevenLabs (proxied, never exposed to the client) |
| Email | Resend |
| Validation | Zod |
| Tests | Vitest |
| Deploy | Docker + Nginx on a VPS, via GitHub Actions |

## Getting started

Requires Node.js 22+ and accounts for Neon and Upstash (both have free tiers); AI, email, and TTS keys are
optional for local work but the routes that use them will fail without them.

```bash
npm install
cp .env.example .env      # fill in DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_*, …
npm run db:push           # push the Drizzle schema to your Neon branch
npm run dev               # http://localhost:3001
```

`BETTER_AUTH_SECRET` must be a random 32-character string. `FRONTEND_URL` and `ADMIN_FRONTEND_URL` drive
both the CORS allowlist and Better Auth's `trustedOrigins` — if a frontend runs on a port not listed
there, its requests are rejected. Defaults are `http://localhost:3000` (app) and `http://localhost:3100`
(admin). See `.env.example` for the full variable list.

## Scripts

```bash
npm run dev          # tsx watch, loads .env
npm run build        # tsc -> dist/
npm start            # node dist/index.js
npm test             # vitest run
npm run db:push      # drizzle-kit push   — dev only, no migration file
npm run db:migrate   # drizzle-kit migrate — production
npm run db:studio    # Drizzle Studio
```

Run a single test by name: `npx vitest run src/services/srs.test.ts -t "grade 4"`.

## Project layout

```
src/
├── index.ts              server bootstrap: CORS, helmet, rate limit, /metrics, route mounting, error handler
├── plugins/              auth (bearer -> request.user), requireAdmin, requirePro, Upstash rate limiter
├── routes/               one file per resource, mounted under /api/v1
│   └── admin/            admin-only routes, mounted under /api/v1/admin
├── services/             business logic — srs (SM-2), streak, email, lesson-cards
│   ├── ai/               provider-agnostic AI layer + one adapter per provider
│   └── games/            word selection and non-AI question generation
├── db/                   schema.ts (app tables) + auth-schema.ts (Better Auth tables) + Neon connection
└── lib/                  auth config, AppError, Result<T>, requireAuth, Zod validators
```

Routes validate input and delegate; business logic belongs in `services/`. Relative imports must include
the `.js` extension (`NodeNext` + ESM), even from `.ts` files.

## API conventions

Base URL `/api/v1`. Auth via `Authorization: Bearer <token>`.

```jsonc
// success
{ "success": true, "data": { } }
// failure
{ "success": false, "error": "Message in Vietnamese", "code": "ERROR_CODE" }
```

Status codes: `200` read · `201` create · `400` validation · `401` unauthenticated · `403` insufficient
plan/role · `404` missing · `429` rate limited · `500` server error. Stack traces are never returned —
`index.ts`'s error handler converts an `AppError` to its own code and status, a `ZodError` to a `400`, and
anything else to a generic `500`.

### Route groups

| Prefix | Purpose |
|---|---|
| `/auth/*` | Proxied to Better Auth (register, login, social, password reset) |
| `/lessons`, `/vocabulary` | Published learning content |
| `/cards/*` | Flashcard SRS — due cards, init, review |
| `/games/*` | Three review game modes: matching, context-fill, speed-quiz |
| `/progress`, `/me` | Learner progress, streak, profile updates |
| `/ai/*` | Journal correction and chat (quota-limited) |
| `/tts` | Korean text-to-speech proxy |
| `/waitlist`, `/feedback` | Landing-page capture and in-app feedback |
| `/admin/*` | Users, lessons, vocabulary, stats, waitlist, feedback — admin role required |
| `/metrics` | Prometheus metrics |

## Free vs Pro

Free users are never hard-blocked with a `403`. They receive a daily quota enforced through Upstash
(`429` once spent) or a silent non-AI fallback — the games routes, for example, drop back to
deterministically generated questions when the AI quota is exhausted or the model returns invalid JSON.
Pro users skip the quota check.

## Spaced repetition

`services/srs.ts` implements SM-2 in plain TypeScript with no external dependency. It takes the card's
easiness, repetitions and interval plus a grade (`0` again · `3` hard · `4` good · `5` easy) and returns
the next interval, easiness, repetitions, and `nextReviewAt`. It is the one module with unit tests —
change it only alongside `src/services/srs.test.ts`.

## Deployment

Pushing to `main` triggers `.github/workflows/deploy.yml`: install, build, test, then SSH to the VPS and
`docker compose up -d --build`. The container binds `127.0.0.1:3201` and Nginx
(`deploy/nginx-api-hangil.conf`) terminates TLS in front of it. Postgres (Neon) and Redis (Upstash) are
managed services — nothing stateful runs on the VPS. Step-by-step instructions, including SSL issuance,
are in [`docs/deployment-guide.md`](docs/deployment-guide.md).

## License

Proprietary — all rights reserved. See [LICENSE](LICENSE).
