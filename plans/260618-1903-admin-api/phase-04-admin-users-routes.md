# Phase 04 — Admin users routes

## Context Links
- `src/routes/progress.ts:11` — preHandler + db.select pattern
- `src/routes/lessons.ts:32-50` — `:id` param + 404 pattern
- `src/services/streak.ts:50-53` — direct `db.update(user).set(...)` (the mutation pattern to reuse)
- phase-03 schemas: `adminUsersQuerySchema`, `adminUpdateUserBodySchema`

## Overview
- Priority: P2
- Status: pending
- Blocked by: phase-02 (requireAdmin), phase-03 (schemas)
- File: `src/routes/admin/users.ts` — list, detail, patch.

## Key Insights
- PATCH MUST use direct Drizzle update `db.update(user).set({plan?, role?}).where(eq(user.id,id))`,
  NOT Better Auth updateUser API — consistent with streak.ts:50-53. `input:false` on the columns
  only blocks Better Auth's own input path, NOT direct Drizzle writes, so admin update works.
- `user.id` is `text` (auth-schema.ts:12), not uuid — param is a plain string, no `.uuid()` validation.
- Search: `or(ilike(user.email, %q%), ilike(user.name, %q%))`. Pagination: `.limit(limit).offset((page-1)*limit)`.
- Detail aggregates progress + streak: `user` row + count of completed `userProgress` + `streakCount`.
  Keep aggregation in handler minimal (validate→query→shape); if it grows, extract to a service.

## Requirements
- `GET /admin/users` — paginated list `{ users, total, page, limit }`. Search by email/name.
  Return safe fields only (id, name, email, plan, role, streakCount, lastStudiedAt, createdAt).
- `GET /admin/users/:id` — detail incl. `completedLessons` count + streak; 404 USER_NOT_FOUND.
- `PATCH /admin/users/:id` — partial update plan/role; 404 if user missing; return updated row.

## Architecture
Data flow: query/body → safeParse → (400 on fail) → Drizzle select/update → `{success:true,data}`.
All three routes: `{ preHandler: [requireAuth, requireAdmin] }`.

## Related Code Files
- Create: `src/routes/admin/users.ts`
- Read for context: schema.ts (user, userProgress), require-auth.ts, require-admin.ts, validators/admin.ts

## Implementation Steps
1. Create `src/routes/admin/users.ts` as `FastifyPluginAsync`.
2. `GET /admin/users`: safeParse `adminUsersQuerySchema`. Build where (ilike OR if search).
   Run two queries: page rows (selected columns, limit/offset, `orderBy createdAt desc`) and
   `db.select({c: count()}).from(user).where(...)` for total. Send `{users,total,page,limit}`.
3. `GET /admin/users/:id`: select user by id → 404 if none. Count completed userProgress
   (`where(and(eq(userId,id), isNotNull(completedAt)))`). Send `{...user, completedLessons}`.
4. `PATCH /admin/users/:id`: safeParse body → build set obj from defined keys → confirm user
   exists (404 else) → `db.update(user).set(set).where(eq(user.id,id)).returning(...)` → send row.
5. Use `{ preHandler: [requireAuth, requireAdmin] }` on each.
6. `npm run build`; keep file < 200 lines (split if needed).

## Todo List
- [ ] GET /admin/users (paginate + search + total)
- [ ] GET /admin/users/:id (detail + completedLessons)
- [ ] PATCH /admin/users/:id (partial plan/role, 404 guard)
- [ ] preHandler chain on all
- [ ] tsc passes, < 200 lines

## Success Criteria
- List paginates and searches; total accurate.
- PATCH updates only plan/role; rejects empty/invalid body with 400.
- Non-admin → 403, unauth → 401.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Admin demotes/locks self out (own role→user) | Medium | Medium | OPEN Q: block self-role-change? See plan unresolved Qs |
| Returning password/token fields | Low | HIGH | Explicit column select, never `select()` * on user |
| Large offset pagination slow | Low | Low | MVP scale fine; index later |
| PATCH plan/role to invalid value | Low | Low | Zod enum guards both |

## Security Considerations
- Whitelist selected columns — never leak Better Auth account/session secrets.
- Body whitelist (plan/role only) prevents arbitrary user-field injection.

## Next Steps
- Parallel-safe with phase-05 (different file). Both feed phase-06 wiring.
