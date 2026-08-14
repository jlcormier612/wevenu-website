# Vendor Lifecycle & Status Remediation

**Type:** Implementation of the two approved changes from `docs/vendor-lifecycle-status-truth-audit.md` (Final Decision B / Option 3 + P0 RLS).  
**Date:** 2026-08-13  
**Scope:** Exact approved remediations only. No commit / no push.

---

## 1. Exact files changed

| File | Change |
|---|---|
| `supabase/migrations/20261290000000_vendor_relationship_venue_staff_rls.sql` | **New** — drops/recreates the two approved venue-side RLS policies |
| `components/vendors/vendor-list.tsx` | Rename Status → Preference; add Relationship claim indicator; use shared helpers |
| `lib/vendors/list-presentation.ts` | **New** — pure Preference / claim / RLS-model helpers |
| `lib/vendors/list-presentation.test.ts` | **New** — focused unit tests |
| `docs/vendor-lifecycle-status-remediation.md` | **New** — this report |

Evidence (not product code): `docs/qa/vendor-lifecycle-status-remediation/` (Playwright screenshots + results JSON).

---

## 2. Exact RLS policies changed

Only these two policies, as approved:

### `venues_manage_relationships` on `public.venue_vendor_relationships`

**Before (live DB, pre-migration):**
```sql
EXISTS (
  SELECT 1 FROM venues v
  WHERE v.id = venue_vendor_relationships.venue_id
    AND v.owner_user_id = auth.uid()
)
```
(same for `WITH CHECK`)

**After:**
```sql
venue_id = public.current_user_venue_id()
```
(same for `WITH CHECK`)

Pattern copied from Sprint 107 / later remediations (e.g. `event_questionnaires_all` in `20261253000000_questionnaire_working_experience.sql`).

### `venues_see_vendor_team` on `public.vendor_users`

**Before (post-lifecycle alter):**
```sql
EXISTS (
  SELECT 1 FROM venue_vendor_relationships vvr
  JOIN venues v ON v.id = vvr.venue_id
  WHERE vvr.vendor_id = vendor_users.vendor_id
    AND vvr.status <> 'inactive'
    AND v.owner_user_id = auth.uid()
)
```

**After:**
```sql
EXISTS (
  SELECT 1 FROM venue_vendor_relationships vvr
  WHERE vvr.vendor_id = vendor_users.vendor_id
    AND vvr.status <> 'inactive'
    AND vvr.venue_id = public.current_user_venue_id()
)
```

Preserved the `status <> 'inactive'` filter from `20260723000000_vendor_relationship_lifecycle.sql`.

**Local apply note:** `npx supabase migration up --local` refused because of pre-existing legacy migration gaps on this DB. The migration SQL was applied directly to local Postgres and recorded in `supabase_migrations.schema_migrations` as version `20261290000000`. Live policy text after apply was re-queried and matches the above.

---

## 3. Exact UI change

On the venue Vendor list (`components/vendors/vendor-list.tsx`):

1. Column header **Status** → **Preference** (same Featured / Preferred badges; recommended still blank).
2. New compact **Relationship** column showing claim state only:
   - `Claimed` when `vendor.isClaimed === true`
   - `Not claimed` when `vendor.isClaimed === false`
3. Does **not** use the word **Invited**.
4. Does **not** infer invitation from claim state.
5. Preference sort (“Preferred First”) semantics unchanged (shared `vendorPreferenceSortRank`).

No filters, sorting controls, redesign, or extra columns beyond the claim indicator.

---

## 4. Data source for claim status

**Existing field only:** `vendors.is_claimed`, already selected via `getVendors` → `venue_vendor_relationships` + `vendors(*)` and mapped to `Vendor.isClaimed` in `lib/vendors/repository.ts` (`mapVendorProfile`).

No new DB column, no new RPC, no repository query expansion required.

---

## 5. Tests added

`lib/vendors/list-presentation.test.ts` (16 tests):

- Preference badge presentation (featured / preferred / recommended blank)
- Preferred First sort rank unchanged
- Claim labels Claimed / Not claimed; never Invited; no invitation inference
- Truth-matrix states A–D presentation expectations
- `venues_manage_relationships` model: Manager access + cross-venue isolation + null venue
- `venues_see_vendor_team` model: matching venue, cross-venue isolation, inactive-empty, null venue

---

## 6. Test results

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npx tsx --test lib/vendors/list-presentation.test.ts` | **16/16 pass** |
| `npm test` | **565/565 pass** (includes new vendor tests) |

---

## 7. Browser validation

### Owner (`owner@example.com`) — VERIFIED LIVE

Screenshot: `docs/qa/vendor-lifecycle-status-remediation/owner-vendors.png`

Observed on `/vendors`:

| State | Seed example | Preference | Relationship |
|---|---|---|---|
| A | Baker's Dozen | blank (recommended) | Not claimed |
| B | Cuppity Cakes / Harah's Hair / Nail Studio / WG Step2 | ✓ Preferred | Not claimed |
| C | Golden Hour Photography | blank (recommended in this seed) | Claimed |
| D | inactive | not on list | — |

B vs C are visually distinct via Relationship (Not claimed vs Claimed). No **Invited** label in the table.

### Manager (`manager@example.com`) — PARTIAL LIVE

- Login succeeded; after seeding outstanding legal acceptances, Manager reached Vendor Library shell (sidebar + header + empty state). Screenshot: `manager-vendors.png`.
- List rendered **empty** (“No vendors yet”) even though relationship RLS now allows Manager SELECT/UPDATE on `venue_vendor_relationships`.
- **Root cause (remaining, out of approved scope):** `vendors` policies `venues_select_related_vendors` and `venues_update_unclaimed_vendors` still use `v.owner_user_id = auth.uid()`. Nested `vendors(*)` returns null under Manager; `mapVVR` drops those rows → empty UI. Manager edit UI therefore could not be completed live.
- Manager path for **relationship** read/write was verified at DB (section 8), not via the edit form click-through.

---

## 8. Cross-venue isolation validation

**VERIFIED LIVE (DB)** as Manager JWT (`341c0293-15da-457d-966b-e66f32cfffd5`, distinct from venue `owner_user_id`):

| Check | Result |
|---|---|
| `current_user_venue_id()` | Sweet Daisy `69cfd906-…` |
| SELECT relationships on own venue | **6** |
| SELECT relationships on Pretty Platypus (other venue) | **0** |
| UPDATE relationship on own venue | **1 row** updated |
| UPDATE relationship on other venue | **0 rows** |
| SELECT `vendor_users` via `venues_see_vendor_team` for own-venue vendors | **1** |

Also covered by unit tests for the policy predicate models.

---

## 9. Explicitly unchanged areas

- Vendor domain model / relationship status enum (`invited`/`active`/`inactive`)
- Creation / invitation / claim lifecycles and RPCs
- Vendor Portal, detail workflow (except shared `isClaimed` already used elsewhere)
- Preference semantics / ranking meaning
- Reviews, event assignments, dedup
- Client / Event / Pipeline / Automations / Library / Nav / Help / Event Orders / Branding / Contracts / Payments / Luv
- `current_user_venue_id()` definition
- Any Vendor RLS **other than** the two approved policies (notably `venues_select_related_vendors` / `venues_update_unclaimed_vendors` on `vendors`)

---

## 10. Remaining issue

**Manager still cannot see vendor profile rows (or update unclaimed vendor profiles) because `vendors` RLS remains owner-scoped.**  

Approved Change 1 fixed relationship manage + vendor-team visibility. Full Manager list/detail/edit UX additionally needs the same `current_user_venue_id()` treatment on:

- `venues_select_related_vendors`
- `venues_update_unclaimed_vendors` (for editing unclaimed profile fields)

That was **not** in the approved two-policy change set and was deliberately left unchanged. Until those policies are remediated in a follow-up, Manager relationship writes work at the DB layer, but the venue Vendor list/detail UI will continue to appear empty for Manager/Staff.

---

## Acceptance mapping

| Criterion | Status |
|---|---|
| List Preference label agrees with preference display | **Met** (Owner live) |
| Claim indicator from `is_claimed`; no Invited inference | **Met** (Owner live + unit tests) |
| Preference sorting/semantics unchanged | **Met** (unit tests + shared helper) |
| Manager can manage relationships (RLS) | **Met** (DB live UPDATE/SELECT) |
| Cross-venue isolation | **Met** (DB live + unit tests) |
| Manager view/edit via UI | **Not fully met live** — blocked by out-of-scope `vendors` RLS (section 10) |
