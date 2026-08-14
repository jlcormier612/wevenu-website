# Vendor Manager RLS Gap — Implementation Specification

**Type:** Research and specification only. No code, database, migrations, or UI were modified to produce this document.
**Date:** 2026-08-13
**Starting point:** `docs/product-completion-master-inventory.md` §3 ("Vendor Manager access — `vendors` table still owner-scoped"), `docs/vendor-lifecycle-status-remediation.md` §10, `docs/vendor-lifecycle-status-remediation-verification.md`, `docs/vendor-and-help-content-independent-verification.md`.
**Objective (unchanged from the prior approved remediation):** make the Vendor domain work correctly for authorized venue staff (Owner, Manager, Staff, Coordinator — anyone `current_user_venue_id()` resolves) using the exact venue-scoping pattern already approved and shipped for `venue_vendor_relationships` and `vendor_users`. Nothing more.

---

## 1. Exact policies currently causing the block

Queried live, fresh, this pass (`\d vendors`) — not taken from a prior report:

```sql
POLICY "venues_insert_vendors" FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM venues WHERE venues.owner_user_id = auth.uid()))

POLICY "venues_select_related_vendors" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM venue_vendor_relationships vvr
      JOIN venues v ON v.id = vvr.venue_id
      WHERE vvr.vendor_id = vendors.id
        AND vvr.status <> 'inactive'
        AND v.owner_user_id = auth.uid()
    )
    OR id = current_user_vendor_id()
  )

POLICY "venues_update_unclaimed_vendors" FOR UPDATE
  USING (
    is_claimed = false AND EXISTS (
      SELECT 1 FROM venue_vendor_relationships vvr
      JOIN venues v ON v.id = vvr.venue_id
      WHERE vvr.vendor_id = vendors.id
        AND vvr.status <> 'inactive'
        AND v.owner_user_id = auth.uid()
    )
  )
  WITH CHECK ( -- identical condition )
```

All three gate on `venues.owner_user_id = auth.uid()` — literally the venue's single owner account — instead of `current_user_venue_id()`, which resolves to the same venue for Owner **and** any active, accepted Manager/Staff/Coordinator (`venue_staff.accepted_at is not null and is_active = true`). This is the exact same deviation already fixed once for `venue_vendor_relationships`/`vendor_users`; it was left out of that fix by explicit, disclosed scope decision (`docs/vendor-lifecycle-status-remediation.md` §10).

Two other `vendors` policies exist and are **not** part of this gap — confirmed correct as-is, not touched:
```sql
POLICY "vendor_users_update_profile" FOR UPDATE
  USING (id = current_user_vendor_id() AND current_user_vendor_role() = ANY (ARRAY['owner','manager']))
POLICY "vendors_hq_select" FOR SELECT TO authenticated USING (is_hq_admin())
```
These gate the vendor's *own* portal-side self-edit and Wevenu HQ's own admin visibility respectively — neither is a venue-staff-access path, neither is affected by or relevant to this fix.

There is no DELETE policy on `vendors` at all (confirmed: only these 5 policies exist). Vendor profiles are never hard-deleted — `deleteVendor` only soft-deletes the *relationship* (`venue_vendor_relationships.status = 'inactive'`), already covered by the already-fixed `venues_manage_relationships`. No DELETE-policy work is in scope.

Table-level GRANTs are not the problem here (unlike a prior, unrelated Event Order finding): `authenticated` already has SELECT/INSERT/UPDATE/DELETE on `vendors` at the table-privilege level — confirmed via `information_schema.role_table_grants`. This is purely three RLS policy predicates, nothing else.

---

## 2. The canonical existing pattern to copy

Already shipped, live, and independently verified twice this engagement — `supabase/migrations/20261290000000_vendor_relationship_venue_staff_rls.sql`:

```sql
-- venue_vendor_relationships (has its own venue_id column — direct match)
create policy "venues_manage_relationships" on public.venue_vendor_relationships
  for all
  using      (venue_id = public.current_user_venue_id())
  with check (venue_id = public.current_user_venue_id());

-- vendor_users (no venue_id column — joins through the relationship)
create policy "venues_see_vendor_team" on public.vendor_users
  for select using (
    exists (
      select 1 from public.venue_vendor_relationships vvr
      where vvr.vendor_id = vendor_users.vendor_id
        and vvr.status <> 'inactive'
        and vvr.venue_id = public.current_user_venue_id()
    )
  );
```

`vendors` has no `venue_id` column of its own (it's a global profile shared across venues — confirmed by table schema), so the correct pattern to copy is the **second** shape (`vendor_users`'s), not the first: join through `venue_vendor_relationships` and compare `vvr.venue_id = current_user_venue_id()` directly, with no join back to `venues` at all (the join to `venues` in the current, broken policies exists only to reach `owner_user_id` — once the check moves to `current_user_venue_id()`, that join becomes unnecessary and should be dropped, exactly as it already was when `venues_see_vendor_team` was fixed).

---

## 3. Exact policies that need remediation, and their proposed after-state

**`venues_select_related_vendors`** (SELECT) — same shape as `venues_see_vendor_team`, preserving the existing `OR id = current_user_vendor_id()` self-access clause untouched:
```sql
using (
  exists (
    select 1 from public.venue_vendor_relationships vvr
    where vvr.vendor_id = vendors.id
      and vvr.status <> 'inactive'
      and vvr.venue_id = public.current_user_venue_id()
  )
  or id = current_user_vendor_id()
)
```

**`venues_update_unclaimed_vendors`** (UPDATE) — same transformation, preserving the existing `is_claimed = false` gate untouched, on both `USING` and `WITH CHECK`:
```sql
using (
  is_claimed = false and exists (
    select 1 from public.venue_vendor_relationships vvr
    where vvr.vendor_id = vendors.id
      and vvr.status <> 'inactive'
      and vvr.venue_id = public.current_user_venue_id()
  )
)
with check ( -- identical condition )
```

**`venues_insert_vendors`** (INSERT) — structurally different: at INSERT time no `venue_vendor_relationships` row exists yet to join through (the vendor doesn't exist until this statement completes), so there's nothing to compare a `venue_id` against. The current policy already reflects this by checking existence only ("does the caller own *some* venue"), not a specific venue match. The narrow, correct upgrade is the INSERT-time analog of the same idea — "does the caller resolve to *some* venue at all" — which is exactly what `current_user_venue_id()` already computes for Owner and staff alike:
```sql
with check (public.current_user_venue_id() is not null)
```
This does not grant any new capability to Owners (they already always pass) and extends exactly the same authorization `venues_manage_relationships` already grants Manager/Staff/Coordinator for the relationship half of the same create flow — see §4.

No other columns, tables, functions, roles, or grants are touched.

---

## 4. Every relevant Vendor create/read/update code path, traced

All paths go through `lib/vendors/repository.ts`, called from `lib/vendors/service.ts`, using the **authenticated** server client (`integrations/supabase/server.ts`) — confirmed by direct read, no admin/service-role client is used anywhere in this trace, so RLS is the only enforcement layer (there is no app-layer role pre-check in `lib/vendors/service.ts` the way Contracts/Payments/Team have — by design, since Vendor management is already meant to be venue-wide for all staff, matching `venues_manage_relationships`'s own `FOR ALL`, no role restriction).

| Function (`lib/vendors/repository.ts`) | What it does | Which of the 3 broken policies it depends on |
|---|---|---|
| `getVendors` | `venue_vendor_relationships` select with nested `vendors(*)` embed | `venues_select_related_vendors` — nested embed enforces SELECT on `vendors` independently; this is the exact, already-confirmed mechanism behind the live "No vendors yet" bug |
| `getVendor` | Same shape, single row | `venues_select_related_vendors` |
| `findActiveDuplicateVendor` | `venue_vendor_relationships` select with `vendors!inner(...)` — used during Add Vendor to warn on duplicates | `venues_select_related_vendors` (inner join drops any row RLS blocks) |
| `insertVendor` → `create_vendor_atomic` RPC | RPC is **not** `SECURITY DEFINER` (confirmed by reading its definition) — runs as the calling user, so its own `insert into vendors (...)` is subject to `venues_insert_vendors`, and its `insert into venue_vendor_relationships (...)` is subject to the already-fixed `venues_manage_relationships` | `venues_insert_vendors` |
| `updateVendor` | First does `client.from("vendors").select("is_claimed")...` (a plain SELECT, gated by `venues_select_related_vendors`); if that SELECT is blocked, `isClaimed` falls back to `true` ("fail closed") — meaning under the current bug, **Manager can never edit even an unclaimed vendor's identity fields today, because the preliminary claimed-check itself silently fails closed first.** If unclaimed, then updates `vendors` — gated by `venues_update_unclaimed_vendors` | `venues_select_related_vendors` **and** `venues_update_unclaimed_vendors` |
| `deleteVendor` / `reactivateVendor` | Only touch `venue_vendor_relationships.status` | Already fixed (`venues_manage_relationships`) — **not** affected by this gap, no change needed |

**Confirmed out of the blast radius, correctly untouched by this fix:** `vendor_reviews`, `vendor_invitations`, `vendor_users` self-service paths, the Vendor Portal (`lib/vendor-profile/service.ts`), Vendor preference-level semantics, and the Vendor lifecycle status enum — none of their code paths touch the three policies above.

**One adjacent finding, explicitly out of scope, not part of this fix:** `vendor_reviews`'s own `venues_manage_reviews` policy has the *identical* bug shape (`v.owner_user_id = auth.uid()` instead of `current_user_venue_id()`), confirmed by direct read this pass. Per the explicit instruction not to touch Vendor Reviews in this task, this is named here for the record and left alone — a future, separately-scoped fix of the same shape, not bundled in.

**One incidental, expected side effect, not new scope:** the `vendors(...)` embed pattern this fix corrects is used by several *other* domains unrelated to the Vendor UI itself — Event Vendor Assignments, Timeline, Conversations, Vendor Recommendations — each of which currently silently shows a blank/missing vendor name to a Manager for the same root-cause reason. Fixing `venues_select_related_vendors` will incidentally start showing correct vendor names in those surfaces too. This is a correct, expected consequence of the same one-line fix, not a redesign of those domains, and is called out only so it isn't mistaken for an unexplained regression during testing.

---

## 5. Exact files / migrations required

**One new migration file**, same shape and location as the prior fix, next available timestamp (confirmed by listing `supabase/migrations/`, latest is `20261291000000`):

`supabase/migrations/20261292000000_vendor_venue_staff_rls.sql`

Containing exactly three `drop policy if exists` / `create policy` pairs for `venues_insert_vendors`, `venues_select_related_vendors`, `venues_update_unclaimed_vendors` on `public.vendors`, per §3 above. No other file needs a schema change. No application code changes are required — `lib/vendors/repository.ts` and `lib/vendors/service.ts` already contain the correct queries; they were only ever blocked by RLS, not by missing code.

---

## 6. Required regression tests

1. **`tsc --noEmit` and `npm test`** — must stay clean/green, same as every prior pass in this engagement.
2. **Predicate-model unit tests**, extending `lib/vendors/list-presentation.ts`/`.test.ts` (the established pattern already used for `venues_manage_relationships`/`venues_see_vendor_team`) with an equivalent model for the vendors-table SELECT/UPDATE/INSERT predicates — including a cross-venue-isolation case and a null-venue-context case, matching the existing test groups' shape exactly.
3. **Live, rolled-back DB re-simulation** of the exact query this engagement already used to prove the bug: as a simulated Manager session, `select count(*) from vendors` must go from **0** (confirmed broken, this engagement) to **6** (the real count of Sweet Daisy's own vendors) — and must remain **0** for a cross-venue vendor (Pretty Platypus).
4. **Full-tree `git status`/diff scope check** — confirm only the one new migration file changed; no `lib/vendors/*`, `components/vendors/*`, or any other domain's files were touched, matching this task's explicit no-redesign boundary.
5. **Owner regression** — confirm the Owner's live `/vendors` view is byte-identical before and after (same rows, same columns, same badges) — Owner authorization is already a strict superset of the new check (`current_user_venue_id()` already resolves the Owner's own venue), so no behavior change is expected, but this should be proven, not assumed.
6. **Claimed-vendor identity lock still holds for Manager** — attempt to edit a *claimed* vendor's identity fields (e.g. Golden Hour Photography) as Manager; must still be rejected/no-op, proving `is_claimed = false` in `venues_update_unclaimed_vendors` was preserved verbatim, not accidentally loosened.

---

## 7. Browser acceptance tests

**Owner (`owner@example.com`)**
1. `/vendors` renders the same 6-row list, same columns (Preference/Relationship), as every prior pass this engagement — no visual or data change.
2. Open a vendor detail page — unchanged.

**Manager (`manager@example.com`)**
1. Log in, navigate to `/vendors` — must now render the venue's real vendor list (not "No vendors yet"), matching the same 6 vendors Owner sees for the same venue (Sweet Daisy Barn & Farm).
2. Open a vendor detail page — must load without error.
3. Edit an **unclaimed** vendor's identity fields (e.g. business name or phone) and save — must succeed, and the change must be visible on reload.
4. Attempt the same edit on the one **claimed** vendor (Golden Hour Photography) — identity fields must remain non-editable / the edit must have no effect, per existing business rule.
5. Use "+ Add Vendor" to create a new vendor — must succeed and the new vendor must appear in the list.
6. Confirm cross-venue isolation still holds: Manager must not see, and must not be able to create/edit, anything belonging to The Pretty Platypus.

All fixtures created for this testing (the new vendor from step 5, any edited fields) should be reversibly cleaned up afterward, per this engagement's established QA methodology — not left as residue in dev data.

---

## 8. Explicit do-not-touch boundaries

- **Vendor lifecycle** (`invited`/`active`/`inactive` status enum, `claim_vendor_profile`, `vendor_invitations`) — untouched, no code path in this fix reaches any of it.
- **Vendor invitations** — untouched.
- **Vendor claims** — untouched; the claim mechanism (`vendors.is_claimed`, the claim RPC) is not modified, only *read* by the existing, unchanged `is_claimed = false` gate.
- **Vendor preferences** (`preference_level` semantics/ranking) — untouched.
- **Vendor reviews** — untouched, despite the identical bug shape found on `venues_manage_reviews` (§4) — explicitly out of scope for this task.
- **Vendor UI** (`components/vendors/*`) — no changes; the existing queries already do the right thing once RLS permits them.
- **`venue_vendor_relationships` / `vendor_users` policies** — already correct, not touched; no dependency requires touching them (confirmed by the full code-path trace in §4 — every affected function's `venue_vendor_relationships` writes already go through the already-fixed `venues_manage_relationships`).
- **Owner behavior** — unaffected; `current_user_venue_id()` already resolves the Owner's own venue as a strict superset of the old `owner_user_id = auth.uid()` check.
- **Cross-venue isolation** — unaffected; `current_user_venue_id()` is the same, already-proven-isolated function used everywhere else in this domain.
- **No generalized permission framework** — this is three narrow predicate edits on one table, copying an already-approved, already-shipped pattern verbatim; nothing new is being designed.

---

## Verdict

## READY FOR CURSOR

The exact policies, their current and proposed SQL, the canonical pattern being copied, every dependent code path, the one migration file needed, the required regression and browser acceptance tests, and the do-not-touch boundaries are all fully specified above with no open questions or product decisions remaining. This is a mechanical, same-shape repeat of a fix already designed, approved, shipped, and independently verified twice this engagement — nothing here requires new judgment calls before implementation.
