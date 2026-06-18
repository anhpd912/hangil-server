# Phase 05 — Routes (auth, lessons, flashcard, progress, ai)

## Context Links
- Spec: STEP 3. Validators: `lib/validators.ts` (Zod). Services: P3. Plugins: P4. Schema: P2.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** All `/api/v1` route handlers. Routes validate (Zod) → call service/db → return `{success,data}`. No business logic in handlers.

## Key Insights
- Every route: Zod schema for body (+ query where applicable). Response shape uniform `{success:true,data}`.
- Flashcard review is the integration hot-spot: route → srs.calculateNextReview → compute next_review_at → update user_cards → updateStreak.
- AI journal-check chains: requireAuth → requirePro OR rate-limit(5/day free) → claude.checkJournal → save journal_entries → return feedback. Per CLAUDE.md the limit is 5/day Free + unlimited Pro (so it is NOT hard Pro-gated; it is rate-limited). Confirm gating intent (see Unresolved).
- `/ai/chat` = empty scaffold only (Phase 2). Define route + 501/placeholder response, no logic.

## Requirements
**Functional — all prefixed `/api/v1`:**
- **auth** (`routes/auth.ts`): mount Better Auth handlers — POST /auth/register (IP limit 5/hr), /auth/login, /auth/logout, GET /auth/me (returns request.user). Register also creates `users` app row (plan=free).
- **lessons** (`routes/lessons.ts`): GET /lessons (query `track?`,`level?` → filter, only is_published=true) → list. GET /lessons/:id → lesson + its vocabulary[]. 404 if not found/unpublished.
- **flashcard** (`routes/flashcard.ts`):
  - GET /cards/due → user_cards where next_review_at<=now, joined vocab; Free max 20, Pro unlimited. requireAuth.
  - POST /cards/:id/review → body `{grade: 0|3|4|5}`; load card (ownership check), srs.calculateNextReview, set next_review_at=now+days, last_reviewed_at=now, persist; call updateStreak; return updated card + streak.
  - POST /cards/init → body `{lessonId}`; create user_cards for each vocab in lesson not already present (idempotent via unique constraint). requireAuth.
- **progress** (`routes/progress.ts`): GET /progress → {streak, totalCards, lessonsDone}. POST /progress/lesson/:id/complete → body `{score?}`; upsert user_progress completed_at=now. requireAuth.
- **ai** (`routes/ai.ts`):
  - POST /ai/journal-check → requireAuth + rate-limit(journal-check,5/day,Free; Pro unlimited); body `{content:string}` (Korean); claude.checkJournal; save journal_entries(content_ko, ai_feedback); return {corrections,suggestions,score}.
  - POST /ai/chat → scaffold: requireAuth, return 501/`{success:false,error:"Chưa khả dụng",code:"NOT_IMPLEMENTED"}`.

**Non-functional**
- All Zod schemas centralized in `lib/validators.ts`.
- Ownership checks on /cards/:id/review (card.user_id === request.user.id) else 404 (avoid leaking existence).

## Architecture
- Data flow review: body grade → ownership → SM-2 → next_review_at → UPDATE user_cards → updateStreak → response.
- Data flow journal: content → ratelimit → checkJournal (Result) → if ok INSERT journal_entries → response; if claude fails → 500 AppError (no save).
- Routes registered in index.ts (P6) with `/api/v1` prefix.

## Related Code Files
**Create**
- `api/src/lib/validators.ts`
- `api/src/routes/auth.ts`
- `api/src/routes/lessons.ts`
- `api/src/routes/flashcard.ts`
- `api/src/routes/progress.ts`
- `api/src/routes/ai.ts`

## Implementation Steps
1. `validators.ts`: Zod schemas — reviewBody (grade enum 0/3/4/5), cardsInit (lessonId uuid), lessonsQuery (track?/level? enums), lessonComplete (score? int), journalCheck (content nonempty string).
2. `auth.ts`: integrate Better Auth route handlers; /auth/me from request.user; register hook creates users app row.
3. `lessons.ts`: GET list (filter published + query), GET :id (+vocab join).
4. `flashcard.ts`: due (limit by plan), review (full chain), init (idempotent insert).
5. `progress.ts`: GET aggregate, POST complete upsert.
6. `ai.ts`: journal-check chain + chat scaffold.

## Todo List
- [ ] lib/validators.ts (all Zod schemas)
- [ ] routes/auth.ts (Better Auth + /me + users row on register)
- [ ] routes/lessons.ts (list + detail)
- [ ] routes/flashcard.ts (due + review + init)
- [ ] routes/progress.ts (get + complete)
- [ ] routes/ai.ts (journal-check + chat scaffold)

## Success Criteria
- GET /api/v1/lessons → `{success:true,data:[]}` on empty DB (P7 curl).
- POST /cards/:id/review updates next_review_at correctly and advances streak.
- Free user blocked at 21st due card / 6th journal-check; Pro unlimited.
- /ai/chat returns scaffold response, no crash.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| journal-check gating: Pro-only vs rate-limited-Free | M×M | CLAUDE.md says 5/day Free + unlimited Pro → rate-limit, NOT requirePro. Confirm spec intent (spec STEP3 says "pro-gated"). See Unresolved — do not silently pick. |
| Better Auth register not creating app `users` row | **H×H** | Hook into Better Auth post-register (afterCreate) to insert app fields, or use shared users table (P2 decision). |
| /cards/:id/review missing ownership check → IDOR | M×H | Enforce card.user_id === request.user.id; 404 on mismatch. |
| /cards/init duplicate cards | M×L | Rely on unique(user_id,vocab_id) + onConflictDoNothing. |
| Concurrent review double-streak | L×M | updateStreak idempotent per-day (=today → unchanged). |

## Security Considerations
- Ownership checks prevent IDOR on cards/progress. Zod rejects bad input → 400. AI content not echoed into logs. Rate limits enforced (CLAUDE.md: never skip AI rate limiting).

## Next Steps
- Unblocks P6 (register routes in bootstrap + error handler).

## Unresolved questions
- **journal-check gating conflict:** spec STEP3 labels AI routes "pro-gated" but CLAUDE.md + STEP3 body say 5/day Free + unlimited Pro (rate-limited, not Pro-only). Which wins? Recommend rate-limited (matches CLAUDE.md rate table). Confirm with lead.
- Better Auth ↔ app `users` row creation timing (depends on P2 table decision).
