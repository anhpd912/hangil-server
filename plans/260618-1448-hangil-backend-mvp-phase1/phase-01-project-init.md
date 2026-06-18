# Phase 01 — Project Init

## Context Links
- Spec: STEP 1. Conventions: `CLAUDE.md` COMMANDS + WHAT NOT TO DO.

## Overview
- **Priority:** P1 (blocks everything)
- **Status:** pending
- **Description:** Scaffold `api/` package: ESM package.json, deps, tsconfig, env template, npm scripts, drizzle config.

## Key Insights
- Repo currently empty except root CLAUDE.md. All code under `api/` per CLAUDE.md PROJECT STRUCTURE.
- `type: "module"` + `module: NodeNext` means relative imports need `.js` extensions in TS source (NodeNext resolution).
- `tsx`/`nodemon` run TS directly in dev; `tsc` only for `build` typecheck/emit.

## Requirements
**Functional**
- `package.json` `"type": "module"`, scripts: `dev` (nodemon+tsx watch src/index.ts), `build` (tsc), `db:push`, `db:migrate`, `db:studio`, `test` (vitest).
- Deps: fastify @fastify/cors @fastify/helmet @fastify/rate-limit drizzle-orm @neondatabase/serverless better-auth @upstash/redis @upstash/ratelimit @anthropic-ai/sdk stripe resend zod.
- DevDeps: typescript tsx nodemon drizzle-kit vitest @types/node.
- `tsconfig.json`: target ES2022, module NodeNext, moduleResolution NodeNext, strict true, outDir dist, rootDir src, esModuleInterop, skipLibCheck.
- `.env.example` — every key from CLAUDE.md ENV VARS section, no values. Add `PORT=3001`.
- `drizzle.config.ts` pointing schema → `src/db/schema.ts`, out → `drizzle/`, dialect postgresql, dbCredentials from `DATABASE_URL`.

**Non-functional**
- No secrets committed. `.gitignore`: node_modules, dist, .env, .env.local.

## Architecture
Data flow: none yet (scaffold). Sets the module system + tooling all later phases assume.

## Related Code Files
**Create**
- `api/package.json`
- `api/tsconfig.json`
- `api/drizzle.config.ts`
- `api/.env.example`
- `api/.gitignore`
- `api/vitest.config.ts` (node environment)

## Implementation Steps
1. `cd api`, `npm init -y`, set `"type":"module"`, set name/version.
2. Install deps + devDeps (pin to current majors: fastify@4).
3. Write `tsconfig.json` per Requirements.
4. Write `drizzle.config.ts` reading `process.env.DATABASE_URL` (load via `--env-file` or dotenv in config).
5. Write `.env.example` listing all keys + `PORT=3001`.
6. Write `.gitignore` + `vitest.config.ts`.
7. Add npm scripts exactly matching CLAUDE.md COMMANDS.

## Todo List
- [ ] package.json (ESM, scripts, deps)
- [ ] tsconfig.json (ES2022/NodeNext/strict)
- [ ] drizzle.config.ts
- [ ] .env.example (all keys, PORT=3001)
- [ ] .gitignore
- [ ] vitest.config.ts

## Success Criteria
- `npm install` completes clean.
- `npx tsc --noEmit` runs (no source yet → passes).
- `.env.example` contains every key in CLAUDE.md ENV section.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| fastify v4 vs v5 plugin API drift | M×M | Pin `fastify@^4`; verify @fastify/* peer ranges support v4. |
| NodeNext `.js` import friction | M×L | Document convention in code-standards; consistent from P2 on. |
| drizzle-kit needs env at config-eval time | M×M | Use `node --env-file=.env` in db scripts or `dotenv/config`. |

## Security Considerations
- `.env` gitignored; only `.env.example` committed. No values in template.

## Next Steps
- Unblocks P2 (schema needs drizzle-kit + connection config).

## Unresolved questions
- Exact dep versions left to install-time `latest` within pinned majors — acceptable for greenfield.
