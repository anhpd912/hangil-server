# Phase 07 — Verification

## Context Links
- Spec: STEP 7. Commands: CLAUDE.md COMMANDS.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** End-to-end smoke verification that the MVP boots, migrates, tests pass, and lessons endpoint responds.

## Key Insights
- This phase confirms the integration of all prior phases. No new feature code — only fixes if a check fails.
- Requires a real Neon `DATABASE_URL` + Upstash + Anthropic keys in `.env` for full path; lessons/test checks work with DB + no AI key.

## Requirements
**Functional — all must pass:**
1. `npm run db:push` → all 6 tables + Better Auth tables created in Neon, no error.
2. `npm run dev` → server listens on 3001, logs ready, no unhandled rejection.
3. `npm run test` → 5 SM-2 unit cases pass.
4. `curl localhost:3001/api/v1/lessons` → `{"success":true,"data":[]}` (empty DB).

**Non-functional**
- `npx tsc --noEmit` → zero type errors (strict).

## Architecture
- Validation only — exercises full data path: HTTP → plugins → route → db → response.

## Related Code Files
- None created. May edit any prior file to fix a failing check.

## Implementation Steps
1. Ensure `.env` populated (local) with at least DATABASE_URL, BETTER_AUTH_SECRET, UPSTASH_*, ANTHROPIC_API_KEY.
2. Run `npm run db:push`; resolve schema/adapter errors (esp. Better Auth tables — P2 unresolved).
3. Run `npm run test`; fix SM-2 until green.
4. Run `npm run dev`; verify port 3001 + ready log.
5. `curl localhost:3001/api/v1/lessons` → assert `{success:true,data:[]}`.
6. `npx tsc --noEmit` → assert zero errors.
7. Spot-check: unauth protected route → 401; bad body → 400.

## Todo List
- [ ] db:push succeeds (all tables)
- [ ] dev starts on 3001
- [ ] test passes (5 SM-2 cases)
- [ ] curl /api/v1/lessons → {success:true,data:[]}
- [ ] tsc --noEmit clean
- [ ] 401/400 spot checks

## Success Criteria
- All 4 spec checks + tsc clean pass.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| db:push fails on Better Auth table conflict | **H×H** | Pre-resolved in P2; if surfaces here, reconcile adapter table names before proceeding. |
| Neon serverless cold-start / connection in dev | M×M | Verify @neondatabase/serverless driver + pooled connection string. |
| Missing keys block dev boot | M×M | env.ts marks Phase-1-unused keys optional (P6). |
| tsc errors from NodeNext `.js` imports | M×M | Ensure relative imports use `.js` extension throughout. |

## Security Considerations
- Confirm no stack trace in 500 responses (NODE_ENV=production check). Confirm `.env` not committed.

## Next Steps
- MVP Phase 1 backend complete. Follow-ups (Phase 2): /ai/chat implementation, /shadowing/session, Stripe payment, R2 audio upload, Resend emails.

## Unresolved questions
- None new — depends on P2/P4 Better Auth resolutions landing before this phase runs.
