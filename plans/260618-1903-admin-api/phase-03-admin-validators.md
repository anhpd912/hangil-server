# Phase 03 — Admin Zod schemas

## Context Links
- `src/lib/validators.ts:1-23` — existing schemas (23 lines, will grow past comfort if merged)
- `src/db/schema.ts:18-19` — `trackEnum`/`levelEnum` source values
- CLAUDE.md → files < 200 lines; modularize by concern

## Overview
- Priority: P1 (blocks phase-04/05)
- Status: pending
- New file `src/lib/validators/admin.ts` holding all admin request schemas. Keeps the existing
  flat `validators.ts` untouched and admin concern isolated (DRY/KISS).

## Key Insights
- Decision: SEPARATE file `validators/admin.ts`, NOT appended to validators.ts. Admin adds
  ~7 schemas; merging would push validators.ts toward 100+ lines mixing public+admin concerns.
  Existing imports (`../lib/validators.js`) stay valid — no churn.
- Enum values MUST mirror DB: track `["k_culture","topik"]`, level
  `["beginner","intermediate","advanced"]` (schema.ts:18-19). DRY risk: duplicated literals.
  Acceptable — Drizzle pgEnum can't be reused directly in Zod without extra import; keep inline
  to match existing lessonsQuerySchema (validators.ts:4-7) which already duplicates them.
- PATCH bodies use `.partial()` semantics via all-optional + a `.refine` that at least one key present.

## Requirements
Schemas to define:
- `adminUsersQuerySchema`: `{ page?: number>=1 default 1, limit?: 1..100 default 20, search?: string }`
  (coerce query strings → numbers via `z.coerce.number()`).
- `adminUpdateUserBodySchema`: `{ plan?: enum["free","pro"], role?: enum["user","admin"] }`
  refined to require ≥1 field.
- `adminLessonCreateSchema`: `{ titleVi, titleKo, track, level, orderIndex? int>=0 default 0,
  content? (jsonb passthrough via z.unknown().optional()), isPublished? bool default false }`.
- `adminLessonUpdateSchema`: all fields from create as `.optional()`, refined ≥1 present.
- `adminVocabCreateSchema`: `{ korean, romanization, vietnamese, exampleSentenceKo?,
  exampleSentenceVi?, audioUrl? (url) }` — `lessonId` comes from the route param, not the body.
- `adminVocabUpdateSchema`: create fields all optional, refined ≥1 present.
- `adminPublishBodySchema`: `{ isPublished: boolean }`.

## Architecture
Routes (phase-04/05) `import { ... } from "../../lib/validators/admin.js"` and `safeParse`
the body/query, returning the inline 400 pattern (lessons.ts:10-17) on failure.

## Related Code Files
- Create: `src/lib/validators/admin.ts`
- No modification to existing validators.ts.

## Implementation Steps
1. Create `src/lib/validators/admin.ts`, `import { z } from "zod";`.
2. Define the 7 schemas above. For PATCH refines:
   `.refine((o) => Object.keys(o).length > 0, { message: "Cần ít nhất một trường" })`.
3. Use `z.coerce.number().int()` for query page/limit (query params arrive as strings).
4. Export each schema named.
5. `npm run build` — confirm file compiles, < 200 lines.

## Todo List
- [ ] Create validators/admin.ts with 7 schemas
- [ ] coerce numeric query params
- [ ] refine PATCH bodies (≥1 field)
- [ ] tsc passes

## Success Criteria
- All 7 schemas exported, typed, < 200 lines.
- Enum literals match DB enums (track/level) and additionalFields (plan/role).

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Enum literal drift vs DB | Low | Medium | Comment cross-refs schema.ts:18-19; covered by route tests |
| Query numbers parsed as string → NaN | Medium | Low | `z.coerce.number()` |
| Empty PATCH no-op | Low | Low | `.refine` ≥1 field → 400 |

## Security Considerations
- `adminUpdateUserBodySchema` only allows `plan`/`role` — cannot patch email/id/streak,
  preventing field-injection on the user table.

## Next Steps
- Unblocks phase-04 (users) and phase-05 (lessons/vocab).
