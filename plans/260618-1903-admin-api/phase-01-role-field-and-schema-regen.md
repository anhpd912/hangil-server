# Phase 01 — Add `role` field + regenerate Better Auth schema (HIGH RISK)

## Context Links
- `src/lib/auth.ts:12-32` — additionalFields (source of truth for regen)
- `src/db/auth-schema.ts:11-26` — generated user table (regen target, WILL be overwritten)
- `src/db/auth-schema.ts:44,68,84` — hand-relevant indexes; `87-104` relations blocks
- CLAUDE.md → "Không tạo migration thủ công — dùng drizzle-kit"

## Overview
- Priority: P1 (blocker for all admin work)
- Status: pending
- Add `role` (`'user' | 'admin'`, default `'user'`) to the user table via Better Auth
  additionalFields, regenerate the Drizzle auth-schema, then push to DB.

## Key Insights
- Better Auth emitted prior additionalFields as **plain `text`/`integer`/`timestamp`**, not
  pgEnum (auth-schema.ts:22-25). `role` follows suit → `text("role").default("user")`.
  Role enum validation is enforced at the Zod layer (phase-03), not the DB column.
- The CLI `generate` command OVERWRITES the output file wholesale. Anything the generator
  does not re-emit is lost. Must diff and verify.
- `input: false` on `plan/streakCount/lastStudiedAt` means clients cannot set them on
  signup. `role` MUST also use `input: false` so users cannot self-assign admin at register.

## Requirements
- Functional: user table has `role` column, default `'user'`; existing rows backfill to `'user'`.
- Non-functional: zero loss of `plan/track/streakCount/lastStudiedAt` columns, the two
  `index(...)` declarations, and the three `*Relations` exports.
- Security: `role` not client-settable (`input: false`).

## Architecture
Data flow: `auth.ts additionalFields` → `@better-auth/cli generate` reads config →
emits `auth-schema.ts` → `drizzle-kit push` diffs against Neon → adds `role` column.
`request.user.role` (phase-02) reads it back via `auth.api.getSession`.

## Related Code Files
- Modify: `src/lib/auth.ts` (add `role` block to additionalFields)
- Regenerate (overwrite): `src/db/auth-schema.ts`
- No new files.

## Implementation Steps
1. In `src/lib/auth.ts` additionalFields, add after `lastStudiedAt` (line 31):
   ```ts
   role: {
     type: "string",
     defaultValue: "user",
     input: false,
   },
   ```
2. **Safety gate BEFORE regen:** `git status` clean / commit current state so the regen
   diff is reviewable. (If not a git repo per env, copy auth-schema.ts to
   `auth-schema.ts.bak` first.)
3. Run: `npx @better-auth/cli generate --config src/lib/auth.ts --output src/db/auth-schema.ts -y`
4. **Verification checklist (MANDATORY — diff regenerated file against backup):**
   - [ ] `plan: text("plan").default("free")` present
   - [ ] `track: text("track")` present
   - [ ] `streakCount: integer("streak_count").default(0)` present
   - [ ] `lastStudiedAt: timestamp("last_studied_at")` present
   - [ ] `role: text("role").default("user")` NEW, present
   - [ ] `session`/`account`/`verification` tables present with their `index(...)` lines
   - [ ] `userRelations`/`sessionRelations`/`accountRelations` exports present
   - If any prior item is MISSING, manually re-add it to match auth-schema.ts:11-104, then
     delete the `.bak`. Do NOT push a schema that dropped columns.
5. Run `npm run build` (tsc) — confirm `schema.ts` re-export (`schema.ts:16`) still compiles.
6. Run `npm run db:push` (dev). Confirm output adds only the `role` column, no DROP.

## Todo List
- [ ] Add `role` to additionalFields (auth.ts)
- [ ] Backup auth-schema.ts
- [ ] Run CLI generate
- [ ] Complete verification checklist (all 7 boxes)
- [ ] tsc passes
- [ ] db:push applies role column only

## Success Criteria
- `auth-schema.ts` contains all 5 additionalFields + indexes + relations.
- `db:push` diff shows `ADD COLUMN role` and nothing dropped.
- tsc passes.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Regen drops existing additionalFields | Medium | HIGH (data/runtime break) | Backup + 7-point diff checklist before push |
| Regen drops hand-added indexes/relations | Medium | Medium (perf/typing) | Checklist items 6-7; manually re-add from :44-104 |
| db:push issues destructive DROP | Low | HIGH | Inspect push plan; abort if any DROP appears |
| `role` settable at register → privilege escalation | Low | HIGH | `input: false` |

## Security Considerations
- `input: false` prevents self-assigning admin via register/update payloads.
- Role check is server-side only (phase-02); never trust a client-supplied role.

## Next Steps
- Unblocks phase-02 (requireAdmin reads role from session).
