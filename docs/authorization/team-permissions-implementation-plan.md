# Team & Permissions — Implementation Plan (Locked Model)

**Status:** Source implementation complete on `feature/team-permissions-multi-owner` (`74dfbab9`). Sandbox migration + deploy dispatched; E2E GREEN gate pending runtime proof.  
**Date:** 2026-09-22  
**Scope:** Schema + multi-owner + Wave 1 persistence + billing delegation + purchaser/Owner onboarding + Team UI + cutover of sensitive consumers. Wave 2 untouched. Production untouched.

## Locked product decisions (summary)

- Access title ≠ ownership (`is_owner`)
- Six titles; Owner is not a title
- Multiple Owners; last-Owner protected
- Purchaser ≠ Owner (explicit question)
- Non-owner purchaser → Administrator + billing override; Owner invite pending (not approval gate)
- `account.billing` is **delegable** (not ownership-only); Owners always have billing
- Administrator may manage all six titles; cannot grant ownership
- Wave 1 engine is authoritative; do not rebuild

---

## Phase 1 — Schema + ownership foundation

### Migration `20261405200000_team_permissions_access_model.sql`

1. Add columns on `venue_staff`:
   - `access_title text` with check: administrator|manager|coordinator|staff|view_only|custom
   - `title_basis text` with check: administrator|manager|coordinator|staff|view_only (nullable except when custom)
   - `capability_overrides jsonb not null default '{}'`
   - `owner_invite_pending boolean not null default false` (Owner invite sent, not yet accepted)

2. Backfill from legacy `role`:
   - `owner` → access_title=administrator, title_basis=administrator, is_owner=true
   - `manager|coordinator|staff` → matching title/basis, preserve is_owner
   - capability_overrides = {}

3. Drop `venue_staff_one_owner` unique index

4. Last-Owner trigger: BEFORE UPDATE/DELETE that would clear the last active accepted Owner → raise exception unless another Owner remains or atomic transfer flag is set (session/GUC)

5. Constraints:
   - access_title NOT NULL after backfill
   - custom requires title_basis
   - ownership-only keys must not appear as true in capability_overrides (CHECK or trigger)

### RPCs

- `transfer_venue_ownership(from_staff_id, to_staff_id)` — transactional
- `designate_owner_on_accept` path via existing accept invite + owner_invite_pending

### Rollback

- Reverse migration restores unique index only if ≤1 owner per venue; otherwise fail closed with instruction

---

## Phase 2 — Authorization persistence + billing

### Wave 1 library updates (locked product change)

- `account.billing`: ownershipOnly=false, customizable=true, sensitive=true, grantableTo=[administrator]
- `isOverrideDenied`: remove special-case deny of billing
- `hasCapability`: Owners always have `account.billing`; others via resolve
- Administrator **preset does not** include billing by default
- Update resolve.test.ts accordingly

### Membership loader

- `lib/authorization/membership.ts` — load active venue membership → MembershipAccessInput
- `requireCapability(key)` server helper using active venue context (Wave 2)

### Dual-write

- Team invite/update writes access_title + title_basis + overrides + syncs legacy `role` for compatibility (`administrator`→`manager` until role consumers migrate; Owners keep `role='owner'` while is_owner)

Legacy role mapping for RLS during transition:

| access_title | dual-write role |
|---|---|
| administrator (is_owner) | owner |
| administrator (!is_owner) | manager |
| manager | manager |
| coordinator | coordinator |
| staff / view_only / custom | staff or mapped basis |

---

## Phase 3 — Consumer migration (minimum set)

Must use capability model:

| Surface | Capability |
|---|---|
| Billing portal | account.billing |
| Team invite/change/remove | team.* |
| Ownership add/remove/transfer/close | ownership.* |
| Integrations settings | settings.integrations |
| Texting settings | settings.texting |
| Sensitive payments.refund | payments.refund |

Others keep legacy role temporarily with compatibility mapping from access_title — tracked, not abandoned.

---

## Phase 4 — Purchaser / onboarding

### Enrollment / activate

- Add `purchaser_is_owner boolean` (or `setup_identity text`) on `venue_enrollments`
- Activate UI: “Are you an owner of this venue?”
- Path A: is_owner=true, access_title=administrator, billing via Owner
- Path B: is_owner=false, access_title=administrator, overrides `{account.billing: true}`, collect Owner name/email → pending Owner invite (`owner_invite_pending=true`, is_owner=false until accept)
- `venues.owner_user_id`: set to purchaser for contact/FK continuity when Path A; on Path B set to purchaser temporarily as account contact **without** treating as ownership auth — document; prefer first Owner on accept to update contact. **Do not authorize via owner_user_id.**

### Owner invite email

- Reuse team invite + distinct copy for Owner designation

---

## Phase 5 — Team UI

Files:

- `components/settings/team-roster.tsx` (replace)
- New: `components/settings/team-member-editor.tsx`, `team-access-summary.tsx`, `team-capability-customizer.tsx`
- `lib/team/types.ts`, `lib/team/service.ts`, `app/(app)/settings/team/actions.ts`
- `app/(app)/settings/team/page.tsx` copy update

---

## Phase 6 — RLS

- venue_staff insert/update: Owner or Administrator with team caps (via SQL helpers reading access_title + is_owner + overrides — or keep role dual-write for RLS interim)
- Prefer new `current_user_is_owner()` and `current_user_has_capability(text)` SECURITY DEFINER helpers scoped to active venue
- Billing portal: deny without account.billing

---

## Phase 7–8 — Sandbox E2E matrix

Scenarios A–L from product brief; disposable venues only; exact ECS SHA; Production untouched.

---

## Files to change (primary)

| Area | Paths |
|---|---|
| Migration | `supabase/migrations/20261405200000_*.sql` (+ helpers) |
| Auth model | `lib/authorization/*` |
| Team | `lib/team/*`, `components/settings/team-*`, `app/(app)/settings/team/*` |
| Billing | `app/api/billing/portal/route.ts` |
| Activate | `workspace/components/activate/*`, `app/api/internal/enrollment/activate/route.ts`, activate RPC |
| Provisioning | `lib/provisioning/workspace.ts`, `complete_venue_setup` / activate RPCs |

## Explicit non-touch

Wave 2 active context, Twilio, QR archive/redirect, contracts, booking, inbox, calendar, photos, notes — unless a hard dependency is discovered (then stop and report).
