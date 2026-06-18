# Phase 06 — Admin stats route + index wiring

## Context Links
- `src/services/streak.ts:9-11` — `toVnDateKey` (VN tz day-key) — NOT exported yet
- `src/index.ts:22-31` — `/api/v1` prefix wrapper (register admin plugin here)
- `src/db/schema.ts:62-72` (userProgress), `:74-82` (journalEntries), auth-schema.ts:11 (user)

## Overview
- Priority: P2
- Status: pending
- Blocked by: phase-02 (requireAdmin); wiring blocks on phase-04 + phase-05.
- `GET /admin/stats` + `src/routes/admin/index.ts` aggregator + register in src/index.ts.

## Key Insights
- "Active today" = users whose `lastStudiedAt` falls on today's VN-timezone date. The correct
  helper `toVnDateKey` lives in streak.ts:9 but is NOT exported. Plan: EXPORT `toVnDateKey`
  from streak.ts (add `export`) and reuse — DRY, avoids re-implementing tz logic.
  Then compute today's VN window and filter. Simplest correct approach: compute the VN-day
  start/end as UTC instants in JS, then `count where lastStudiedAt between [start,end)`.
- DO NOT use raw SQL `CURRENT_DATE` for active-today — that's UTC/server tz, wrong for VN users.
- "lessons completed count" = rows in userProgress with completedAt not null (total completions,
  matches phase-04 detail semantics).
- "total AI journal-check calls" = `count(journalEntries)` (CLAUDE.md states journal entries are
  the journal-check artifact; each check inserts one row).
- Use `count()` from drizzle-orm; run the 4 counts (optionally `Promise.all`).

## Requirements
- `GET /admin/stats` → `{ totalUsers, activeToday, lessonsCompleted, journalCheckCalls }`.
- Route gated `[requireAuth, requireAdmin]`.
- `src/routes/admin/index.ts` registers users + lessons (+ vocabulary if split) + stats plugins.
- `src/index.ts` registers the admin index plugin inside the `/api/v1` wrapper.

## Architecture
```
src/index.ts (/api/v1 wrapper :22-31)
  └─ register adminRoutes (src/routes/admin/index.ts)
       ├─ register usersRoutes      (phase-04)
       ├─ register lessonsRoutes    (phase-05)
       ├─ register vocabularyRoutes (phase-05, if split)
       └─ register statsRoutes      (this phase)
```
Final paths resolve to `/api/v1/admin/...`.

## Related Code Files
- Modify: `src/services/streak.ts` (export `toVnDateKey`)
- Modify: `src/index.ts` (import + register adminRoutes)
- Create: `src/routes/admin/stats.ts`, `src/routes/admin/index.ts`

## Implementation Steps
1. In `streak.ts`, change `function toVnDateKey` → `export function toVnDateKey` (line 9).
2. Create `src/routes/admin/stats.ts`: `GET /admin/stats`, preHandler `[requireAuth, requireAdmin]`.
   - totalUsers: `count()` on user.
   - activeToday: compute today's VN date key (`toVnDateKey(new Date())`), derive UTC window
     `[`${key}T00:00:00+07:00`, +1 day)`, count user where lastStudiedAt in window.
   - lessonsCompleted: count userProgress where `isNotNull(completedAt)`.
   - journalCheckCalls: count journalEntries.
   - Send `{success:true,data:{totalUsers,activeToday,lessonsCompleted,journalCheckCalls}}`.
3. Create `src/routes/admin/index.ts`: `FastifyPluginAsync` registering the sub-route plugins
   (users, lessons, [vocabulary], stats). No prefix here (paths already include `/admin`).
4. In `src/index.ts`: `import adminRoutes from "./routes/admin/index.js";` and add
   `await instance.register(adminRoutes);` inside the `/api/v1` wrapper (after aiRoutes, :28).
5. `npm run build`. Smoke-test: curl `/api/v1/admin/stats` → 401 (no auth), then with admin token → 200.

## Todo List
- [ ] Export toVnDateKey from streak.ts
- [ ] stats.ts with 4 counts + VN-tz activeToday
- [ ] admin/index.ts aggregator
- [ ] register adminRoutes in index.ts /api/v1 wrapper
- [ ] tsc passes
- [ ] smoke test 401 / 403 / 200

## Success Criteria
- `/api/v1/admin/stats` returns the 4 metrics; activeToday respects VN midnight, not UTC.
- All admin routes reachable under `/api/v1/admin/*` with correct auth gating.
- tsc passes.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| activeToday uses UTC date → off by up to 7h | Medium | Medium | Reuse toVnDateKey; build VN-offset window |
| journalEntries ≠ journal-check count if reused elsewhere | Low | Low | Verified: journal_entries is the journal-check artifact (schema.ts:74) |
| Route registration order/prefix mistake → 404 | Low | Medium | Register inside existing /api/v1 wrapper; no nested prefix |
| 4 sequential counts slow | Low | Low | Promise.all; MVP scale fine |

## Security Considerations
- Stats are aggregate counts only — no PII leakage.
- Admin-gated like all other admin routes.

## Next Steps
- Final phase. After this, delegate to `tester` for route-level auth-gating tests, then `code-reviewer`.
