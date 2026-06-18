# Phase 05 — Admin lessons + vocabulary CRUD routes

## Context Links
- `src/db/schema.ts:21-45` — lessons + vocabulary tables (column names, FK cascade)
- `src/routes/lessons.ts:32-50` — `:id` lookup + 404 pattern
- phase-03 schemas: `adminLessonCreateSchema`/`Update`, `adminVocabCreateSchema`/`Update`, `adminPublishBodySchema`

## Overview
- Priority: P2
- Status: pending
- Blocked by: phase-02, phase-03
- Files: `src/routes/admin/lessons.ts` (lessons CRUD + publish + nested vocab CRUD).
  If lessons.ts approaches 200 lines, split vocab into `src/routes/admin/vocabulary.ts`.

## Key Insights
- Public `GET /lessons` filters `isPublished=true` (lessons.ts:20). Admin `GET /admin/lessons`
  must return ALL lessons (published + drafts) — do NOT copy the isPublished filter.
- `vocabulary.lessonId` FK is `onDelete:"cascade"` (schema.ts:43) — deleting a lesson auto-removes
  its vocab. No manual cascade needed. Document this so DELETE behavior is intentional.
- IDs are `uuid` for lessons/vocabulary (schema.ts:22,34) — validate `:id` with `z.string().uuid()`
  (unlike user.id which is text). Reject non-uuid early with 400.
- Decision on vocab routing: nest under lesson — `POST/GET /admin/lessons/:id/vocabulary` and
  `PATCH/DELETE /admin/vocabulary/:vocabId` (update/delete by vocab id, no lesson needed).
  Mirrors the task spec's "or" — picks the clearer REST shape.

## Requirements
Lessons:
- `POST /admin/lessons` (201) — create from `adminLessonCreateSchema`, return row.
- `GET /admin/lessons` — list ALL (drafts incl.), optional track/level filter, order by orderIndex.
- `GET /admin/lessons/:id` — single, 404 LESSON_NOT_FOUND.
- `PATCH /admin/lessons/:id` — partial update, 404 guard, return row.
- `DELETE /admin/lessons/:id` — delete (cascades vocab), 404 guard, return `{deleted:true}`.
- `PATCH /admin/lessons/:id/publish` — set isPublished from `adminPublishBodySchema`.
Vocabulary:
- `POST /admin/lessons/:id/vocabulary` (201) — lessonId from param; verify lesson exists (404 else).
- `GET /admin/lessons/:id/vocabulary` — list vocab for lesson.
- `PATCH /admin/vocabulary/:vocabId` — partial update, 404 VOCAB_NOT_FOUND.
- `DELETE /admin/vocabulary/:vocabId` — delete, 404 guard, `{deleted:true}`.

## Architecture
Data flow: param/body → uuid + Zod safeParse (400 on fail) → existence check (404) →
Drizzle insert/select/update/delete `.returning()` → `{success:true,data}`.
All routes `{ preHandler: [requireAuth, requireAdmin] }`.

## Related Code Files
- Create: `src/routes/admin/lessons.ts` (+ optional `vocabulary.ts` if over 200 lines)
- Read: schema.ts, validators/admin.ts, require-admin.ts

## Implementation Steps
1. Create `src/routes/admin/lessons.ts` as `FastifyPluginAsync`.
2. Implement lessons CRUD + publish toggle (6 routes) using create/update schemas.
3. Implement nested vocab routes (4 routes); on create, validate `:id` lesson exists first.
4. Wrap every route with `[requireAuth, requireAdmin]`.
5. Map `content` jsonb directly (schema.ts:28 accepts arbitrary jsonb).
6. `npm run build`. If file > 200 lines, extract vocab routes into `vocabulary.ts` and register
   both from admin/index.ts (phase-06).

## Todo List
- [ ] Lessons POST/GET/GET:id/PATCH/DELETE
- [ ] PATCH /lessons/:id/publish
- [ ] Vocab POST/GET (nested), PATCH/DELETE (by vocabId)
- [ ] uuid validation on params
- [ ] preHandler chain all
- [ ] tsc passes, file(s) < 200 lines

## Success Criteria
- Admin sees drafts (no isPublished filter).
- DELETE lesson removes its vocab (cascade).
- Invalid uuid → 400; missing entity → 404.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Copying public isPublished filter (admin can't see drafts) | Medium | Medium | Explicit note; no filter on admin list |
| Vocab create with bad lessonId → FK error 500 | Medium | Low | Pre-check lesson exists → 404 before insert |
| File exceeds 200 lines | Medium | Low | Split vocab into separate file |
| Non-uuid :id → DB cast error 500 | Medium | Low | z.string().uuid() guard → 400 |

## Security Considerations
- Body whitelist via Zod — no mass-assignment of id/createdAt.
- All routes admin-gated; no public write path to lessons/vocab.

## Next Steps
- Parallel-safe with phase-04. Feeds phase-06 wiring.
