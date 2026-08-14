# Vendor Manager RLS Gap — Implementation Report

**Type:** Implementation of the approved remediation in `docs/vendor-manager-rls-gap-implementation-specification.md`.  
**Date:** 2026-08-13  
**Scope:** Exact three `vendors` RLS policies only. No commit / no push.  
**Stopped at:** remediation complete — `vendor_reviews` / other domains not touched.

---

## 1. Migration path

| Step | Detail |
|---|---|
| File | `supabase/migrations/20261292000000_vendor_venue_staff_rls.sql` |
| Apply | `npx supabase migration up --local` not used (legacy gaps on this DB, same as prior vendor RLS pass). SQL applied directly via `docker exec … psql` against local Postgres (`127.0.0.1:54322`). |
| Recorded | Inserted `20261292000000` / `vendor_venue_staff_rls` into `supabase_migrations.schema_migrations`. |
| Verified | Re-queried `pg_policy` for the three policy names — predicates match §3 of the spec. |

---

## 2. Policies changed (ONLY these three)

Canonical pattern copied: `venues_see_vendor_team` (join through `venue_vendor_relationships`, compare `vvr.venue_id = current_user_venue_id()`). No `venues` join, no GRANTs, no new helpers.

### `venues_select_related_vendors` (SELECT)

**Before:** `EXISTS (… JOIN venues v … v.owner_user_id = auth.uid()) OR id = current_user_vendor_id()`  
**After:**
```sql
exists (
  select 1 from public.venue_vendor_relationships vvr
  where vvr.vendor_id = vendors.id
    and vvr.status <> 'inactive'
    and vvr.venue_id = public.current_user_venue_id()
)
or id = current_user_vendor_id()
```

### `venues_update_unclaimed_vendors` (UPDATE)

**Before:** `is_claimed = false AND EXISTS (… JOIN venues v … v.owner_user_id = auth.uid())` (USING + WITH CHECK)  
**After:** same `is_claimed = false` gate; EXISTS uses `vvr.venue_id = current_user_venue_id()` (USING + WITH CHECK identical).

### `venues_insert_vendors` (INSERT)

**Before:** `EXISTS (SELECT 1 FROM venues WHERE venues.owner_user_id = auth.uid())`  
**After:** `with check (public.current_user_venue_id() is not null)`

**Explicitly untouched:** `vendor_users_update_profile`, `vendors_hq_select`, all of `vendor_reviews` (including `venues_manage_reviews`, still `owner_user_id`-scoped — confirmed post-apply), relationship/lifecycle/UI code.

---

## 3. Files changed (this remediation)

| File | Change |
|---|---|
| `supabase/migrations/20261292000000_vendor_venue_staff_rls.sql` | **New** — three drop/create policy pairs |
| `lib/vendors/list-presentation.ts` | Extended predicate models for SELECT / UPDATE / INSERT |
| `lib/vendors/list-presentation.test.ts` | Regression coverage for Owner/Manager/cross-venue/claimed lock/null venue |
| `docs/vendor-manager-rls-gap-implementation.md` | **New** — this report |
| `docs/qa/vendor-manager-rls-gap-evidence/` | Browser evidence (smoke script, screenshots, `results.json`) |

No application Vendor UI, repository, service, lifecycle, invitations, preferences, or other-domain files were modified for this task.

---

## 4. Tests

### Predicate-model unit tests

Extended `lib/vendors/list-presentation.test.ts`:

1. Owner/Manager can read venue vendors (matching relationship)
2. Manager can read (same predicate)
3. Manager cannot access another venue’s vendors
4. Owner unchanged (matching still works)
5. Relationship behavior intact (inactive-only → no access; self-access via `current_user_vendor_id` preserved)
6. Manager can update unclaimed; claimed identity lock holds; cross-venue update denied; INSERT requires non-null venue context

### Live DB re-simulation (rolled-back) — **VERIFIED FROM DATABASE**

Manager session (`manager@example.com` / `341c0293-…`):

| Check | Result |
|---|---|
| `current_user_venue_id()` | Sweet Daisy `69cfd906-…` |
| `select count(*) from vendors` | **6** (was 0 before this fix) |
| Pretty Platypus vendors visible | **0** |
| Unclaimed own-venue rows | **5** |
| Claimed own-venue rows | **1** |
| UPDATE unclaimed (Cuppity Cakes) | **1 row** updated (rolled back) |
| UPDATE claimed (Golden Hour) | **0 rows** (identity lock held) |

Owner session: `current_user_venue_id()` still Sweet Daisy. Raw `select count(*) from vendors` is higher (**12**) because this seed Owner is also `is_hq_admin() = true` and therefore matches pre-existing `vendors_hq_select` — **not** introduced by this change. App list still scopes via relationships (see browser).

---

## 5. Validation commands

| Command | Result |
|---|---|
| `npx tsc --noEmit` | **Pass** (exit 0) |
| `npx tsx --test lib/vendors/list-presentation.test.ts` | **30/30 pass** |
| `npm test` | **579/579 pass** |

---

## 6. Browser validation — **VERIFIED LIVE**

Evidence: `docs/qa/vendor-manager-rls-gap-evidence/` (`results.json`, screenshots `01`–`17`). Smoke: `18/18` checks passed.

### Owner (`owner@example.com`) — **VERIFIED LIVE**

- `/vendors` list loads with seed vendors (Preference + Relationship columns).
- Detail for Cuppity Cakes loads.
- No Pretty Platypus venue leakage on the list.

### Manager (`manager@example.com`) — **VERIFIED LIVE**

- `/vendors` is **not** false-empty — same seed names as Owner (Baker’s Dozen, Cuppity Cakes, Golden Hour Photography, Harah’s Hair, Nail Studio).
- Unclaimed edit (Cuppity Cakes phone → `555-8733`) **succeeded**; phone restored to `NULL` after QA.
- Claimed edit form shows read-only identity lock (banner + `#vn` disabled) for Golden Hour Photography.
- `+ Add Vendor` created `RLS Mgr Vendor 38733`; relationship then marked **inactive** for cleanup.
- Cross-venue: Blue Ridge Catering (Platypus-only) absent from Manager list.

### Incidental surfaces — validate only

| Surface | Result | Label |
|---|---|---|
| Conversations | No seed vendor names on `/conversations` for Manager (likely empty data for this seed) | **UNVERIFIED** live name visibility (page loaded; no conflicting blank-name symptom proven either way) |
| Events / Event Vendor Assignments | Manager `/events` loaded (`15-manager-events.png`); this seed Manager session had no clickable event row to open Assignments | **UNVERIFIED** live name visibility on Assignments (no event available); SELECT policy fix is the shared root cause with the now-fixed list |

Root-cause fix for nested `vendors(*)` embeds is the SELECT policy change above; when those surfaces embed related vendors for this venue, names are now RLS-visible to Manager the same way as the Vendor list.

---

## 7. Cross-venue isolation

| Layer | Result | Label |
|---|---|---|
| DB Manager session | 0 Platypus vendors / relationships | **VERIFIED FROM DATABASE** |
| Browser Manager `/vendors` | No Platypus venue name; Blue Ridge absent | **VERIFIED LIVE** |
| Owner list | No Platypus venue name | **VERIFIED LIVE** |

---

## 8. Limitations / intentional non-scope

- **`vendor_reviews.venues_manage_reviews`** still uses `v.owner_user_id = auth.uid()` — same bug class, **explicitly out of scope** (confirmed still present after apply).
- No GRANT changes (confirmed not needed).
- No Vendor UI / lifecycle / invitations / claim / preference / assignments architecture changes.
- Owner’s HQ-wide `vendors_hq_select` remains as before; not part of this remediation.
- Local migration apply used direct `psql` because of pre-existing migration-history gaps on this developer DB.

---

## Verdict

Approved three-policy remediation shipped locally, covered by unit + rolled-back RLS simulation + Owner/Manager browser acceptance. Manager Vendor list no longer false-empty; permitted unclaimed edits and inserts work; claimed identity lock and cross-venue isolation hold. Stopped here — no further cleanup into `vendor_reviews` or other domains.
