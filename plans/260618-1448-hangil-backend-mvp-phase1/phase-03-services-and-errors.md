# Phase 03 — Services + lib/errors

## Context Links
- Spec: STEP 4 (services) + STEP 6 (errors, foundational). SRS rules: CLAUDE.md SRS ALGORITHM.

## Overview
- **Priority:** P1
- **Status:** pending
- **Description:** Pure SM-2 (`srs.ts`), Anthropic wrapper (`claude.ts`), streak logic (`streak.ts`), and `lib/errors.ts` (AppError). Includes SM-2 vitest unit tests.

## Key Insights
- `srs.ts` is **pure** — no DB, no SDK. Fully unit-testable before any DB exists. Build/test first.
- `claude.ts` singleton client → avoid re-instantiating SDK per request.
- Services return Result pattern (`{ok:true,data} | {ok:false,error}`) where they can fail; pure SRS returns plain value.
- `lib/errors.ts` lives here because plugins (P4) + routes (P5) + error handler (P6) all import AppError. Earliest shared dep.

## Requirements
**Functional**
- `lib/errors.ts`: `class AppError extends Error { code: string; statusCode: number }`. Factory helpers: unauthorized(401), forbidden(403), notFound(404), rateLimited(429), validation(400). Vietnamese-friendly messages.
- `services/srs.ts`: `calculateNextReview(card: {easiness;repetitions;intervalDays}, grade: 0|3|4|5): NextReview`. Standard SM-2:
  - grade<3 (0=Lại): repetitions→0, intervalDays→1, easiness unchanged (or floored 1.3).
  - grade≥3: rep0→interval 1, rep1→interval 6, rep≥2→round(prevInterval×easiness). repetitions++.
  - easiness' = max(1.3, EF + (0.1 − (5−grade)×(0.08 + (5−grade)×0.02))).
  - Returns `{nextEasiness, nextRepetitions, nextIntervalDays}`. (Caller computes next_review_at = now + days.)
- `services/srs.ts` tests (`srs.test.ts`): 5 cases — new card (rep0) grade5; grade4; grade3; grade0 reset; existing card rep≥2 interval = round(interval×EF). Assert easiness floor 1.3.
- `services/claude.ts`: singleton `Anthropic` client from `ANTHROPIC_API_KEY`. `checkJournal(text): Promise<Result<JournalFeedback>>`. System prompt: Vietnamese, Korean-teacher persona grading Korean writing; instruct JSON-only output. Parse to `{corrections:[{original,corrected,explanation_vi}], suggestions:string[], score:number}`. model `claude-haiku-4-5`, max_tokens 1000. Handle malformed JSON → `{ok:false}`.
- `services/streak.ts`: `updateStreak(userId): Promise<Result<{streak:number,isNewRecord:boolean}>>`. Reads `users.last_studied_at`. Logic by date (UTC day compare): =today → unchanged; =yesterday → +1; >1 day or null → reset to 1. Writes streak_count + last_studied_at=today. isNewRecord = new streak > prior max (MVP: prior streak_count).

## Architecture
- Data flow `srs`: route passes card SRS fields + grade → returns next values → route persists (P5).
- Data flow `claude`: route passes Korean text → SDK call → JSON parse → Result → route saves journal_entries + returns.
- Data flow `streak`: userId → read users → date math → write users → Result.

## Related Code Files
**Create**
- `api/src/lib/errors.ts`
- `api/src/services/srs.ts`
- `api/src/services/srs.test.ts`
- `api/src/services/claude.ts`
- `api/src/services/streak.ts`

## Implementation Steps
1. `lib/errors.ts`: AppError + factory helpers with codes (`UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`, `VALIDATION`).
2. `srs.ts`: implement SM-2 pure fn + types. No imports beyond types.
3. `srs.test.ts`: 5 vitest cases; run `npm run test` (passes without DB).
4. `claude.ts`: singleton client, system prompt const, checkJournal with JSON parse + try/catch → Result.
5. `streak.ts`: updateStreak with date comparison helpers; DB read/write via `db`.

## Todo List
- [ ] lib/errors.ts AppError + factories
- [ ] services/srs.ts SM-2 pure fn
- [ ] services/srs.test.ts (5 cases) — passing
- [ ] services/claude.ts singleton + checkJournal
- [ ] services/streak.ts updateStreak

## Success Criteria
- `npm run test` passes all 5 SM-2 cases.
- easiness never drops below 1.3 in any case.
- claude.ts returns Result, never throws raw on bad JSON.

## Risk Assessment
| Risk | L×I | Mitigation |
|------|-----|-----------|
| Claude returns non-JSON / prose | **H×M** | Strict system prompt + parse in try/catch → Result error; consider response prefill `{`. |
| SM-2 off-by-one on interval rounding | M×M | Unit tests pin expected values; use Math.round per SM-2 reference. |
| streak timezone (UTC vs VN UTC+7) | M×M | Decide day boundary now — pick UTC+7 (VN users) or UTC consistently; document. See Unresolved. |
| claude.ts import crashes if key missing at module load | M×M | Lazy-init client inside checkJournal or guard; don't instantiate at import for tests. |

## Security Considerations
- API key from env only. Never log full journal text at info level (PII). Claude output is user-facing — no system prompt leak.

## Next Steps
- Unblocks P4 (plugins import AppError) and P5 (routes call services).

## Unresolved questions
- **Streak day boundary timezone:** UTC or Asia/Ho_Chi_Minh (UTC+7)? VN audience suggests UTC+7. Confirm with lead.
- Claude response reliability — may need retry/prefill; defer hardening to post-MVP unless tests show flakiness.
