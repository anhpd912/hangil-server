# Phase 02 — `requireAdmin` preHandler + expose role on request.user

## Context Links
- `src/plugins/requirePro.ts:4-12` — mirror pattern (403 shape)
- `src/plugins/auth.ts:8-14` (user shape), `:29-38` (population)
- `src/lib/require-auth.ts:4-12` — 401 pattern

## Overview
- Priority: P1
- Status: pending
- Blocked by: phase-01
- Add `role` to `request.user`, create `requireAdmin` preHandler returning 403 ADMIN_REQUIRED.

## Key Insights
- `request.user` is built manually in plugins/auth.ts:33-38 — add `role` there, defaulting
  to `"user"` (mirrors `plan ?? "free"` at :36). Session field arrives via Better Auth's
  additionalFields, so cast like the existing `plan?/track?` cast at :29-32.
- requireAdmin assumes requireAuth ran first (request.user present). Routes chain
  `[requireAuth, requireAdmin]` so a missing user yields 401 (from requireAuth) before
  requireAdmin's 403. Still, requireAdmin guards independently: no user OR role!=='admin' → 403.

## Requirements
- Functional: `request.user.role` is `'user' | 'admin'`. `requireAdmin` blocks non-admins.
- Error contract: `403 {success:false, error:"Yêu cầu quyền admin", code:"ADMIN_REQUIRED"}`.

## Architecture
preHandler order per route: `requireAuth` (401 if no session) → `requireAdmin` (403 if not admin)
→ handler. Both are plain async `(request, reply)` fns returning a reply on failure.

## Related Code Files
- Modify: `src/plugins/auth.ts` — add `role: string` to interface (`:8-14`) and populate (`:33-38`)
- Create: `src/plugins/require-admin.ts`

## Implementation Steps
1. In `src/plugins/auth.ts`, extend the `user` interface (after `track`):
   ```ts
   role: string;
   ```
2. Extend the session cast (`:29-32`) with `role?: string;` and set in `request.user`:
   ```ts
   role: sessionUser.role ?? "user",
   ```
3. Create `src/plugins/require-admin.ts` mirroring requirePro.ts:
   ```ts
   import type { FastifyRequest, FastifyReply } from "fastify";
   export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
     if (request.user?.role !== "admin") {
       return reply.status(403).send({
         success: false,
         error: "Yêu cầu quyền admin",
         code: "ADMIN_REQUIRED",
       });
     }
   }
   ```
4. `npm run build` — confirm no type errors from the widened user shape.

## Todo List
- [ ] Add `role` to request.user interface + population
- [ ] Create require-admin.ts
- [ ] tsc passes

## Success Criteria
- `request.user.role` typed and populated.
- requireAdmin returns the exact 403 contract for non-admin / missing user.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Widening user shape breaks existing routes reading request.user | Low | Low | role is additive, optional fallback `"user"` |
| Session not carrying role (stale token) | Low | Medium | `?? "user"` default = safe (denies admin) |

## Security Considerations
- Default-deny: unknown/absent role resolves to `"user"` → never accidentally admin.
- Server-trusted role only; comes from Better Auth session, not client header.

## Next Steps
- Unblocks phase-04/05/06 (all admin routes use requireAdmin).
