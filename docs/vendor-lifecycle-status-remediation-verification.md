# Vendor Lifecycle & Status Remediation — Independent Verification

**Type:** Independent verification of `docs/vendor-lifecycle-status-remediation.md` against `docs/vendor-lifecycle-status-truth-audit.md`.
**Date:** 2026-08-13
**Scope:** Verification only. No code, database, migration, UI, or documentation modified. No fixes applied. No scope expansion.

**Evidence key:** VERIFIED LIVE (observed in running app) · VERIFIED FROM DATABASE (queried live Postgres, independently, not taken from the report) · VERIFIED FROM SOURCE (read the actual file/diff, independently) · UNVERIFIED (could not be established either way).

---

## 1. RLS Permission Verification

**A — `venues_manage_relationships` on `venue_vendor_relationships`**
Queried live via `\d venue_vendor_relationships`:
```sql
using (venue_id = current_user_venue_id())
with check (venue_id = current_user_venue_id())
```
Matches the report exactly. **VERIFIED FROM DATABASE.**

**B — `venues_see_vendor_team` on `vendor_users`**
Queried live via `\d vendor_users`:
```sql
using (exists (select 1 from venue_vendor_relationships vvr
  where vvr.vendor_id = vendor_users.vendor_id
    and vvr.status <> 'inactive'
    and vvr.venue_id = current_user_venue_id()))
```
Matches the report exactly, including the preserved `status <> 'inactive'` filter. **VERIFIED FROM DATABASE.**

**C — Cross-venue isolation**
Independently re-ran (not reusing the report's numbers) inside a rolled-back transaction, simulating the Manager's session (`set local role authenticated; set local request.jwt.claims = '{"sub":"341c0293-...-cffe5", ...}'`):

| Check | Result |
|---|---|
| `current_user_venue_id()` | `69cfd906-…` (Sweet Daisy) — correct |
| Relationship rows visible, own venue | **6** |
| Relationship rows visible, other venue (Pretty Platypus) | **0** |
| `vendor_users` rows visible via `venues_see_vendor_team` | **1** |

Matches the report's Section 8 numbers exactly. **VERIFIED FROM DATABASE, independently reproduced.**

**D — No other Vendor RLS was touched**
Re-queried `vendors` table policies directly. Confirmed still present, unchanged, and still owner-scoped:
- `venues_select_related_vendors` — `v.owner_user_id = auth.uid()`
- `venues_update_unclaimed_vendors` — `v.owner_user_id = auth.uid()`
- `venues_insert_vendors` — `venues.owner_user_id = auth.uid()`

The first two are named in the report's own Section 10 ("Remaining issue"). **`venues_insert_vendors` is the same class of gap (owner-only, blocks Manager from creating a vendor) but is not named in the report's disclosure.** This is not a regression and not caused by this remediation — it predates it and was never in scope — but it is a small gap in the report's own accounting worth naming precisely. **VERIFIED FROM DATABASE.**

**E — `current_user_venue_id()` itself unchanged**
Not touched by the new migration (confirmed by reading the migration file in full — it only drops/recreates the two named policies). No other migration in the working tree defines or alters this function. **VERIFIED FROM SOURCE.**

**F — Migration file scope**
Read `supabase/migrations/20261290000000_vendor_relationship_venue_staff_rls.sql` in full: contains exactly the two policy drop/recreate statements described in the report, nothing else (no other table, no other policy, no data changes). **VERIFIED FROM SOURCE.**

---

## 2. Live Manager Verification

Logged in live as `manager@example.com` (retry-loop login helper, succeeded on first attempt) and navigated to `/vendors`.

**Result: login succeeds; Vendor Library renders "No vendors yet" (empty state), with an "+ Add Vendor" button and no error message.** Screenshot captured.

This **exactly matches** the report's self-reported "PARTIAL LIVE" claim in Section 7 (login succeeds, list empty). It is also independently corroborated at the database layer: under a simulated Manager session, `select count(*) from vendors` returns **0** (RLS-blocked), which is the direct mechanical cause of the empty list — consistent with the report's stated root cause (`vendors(*)` nested join returns null → rows dropped by `mapVVR`).

No incorrect "Invited" label, no crash, no unhandled error was observed. **VERIFIED LIVE.**

---

## 3. Vendor List Verification

Read `components/vendors/vendor-list.tsx` diff in full and observed live as Owner.

- "Status" column header is gone; replaced by **"Preference"** and **"Relationship"**. **VERIFIED LIVE + FROM SOURCE.**
- Relationship column source is `vendor.isClaimed` via `vendorClaimStateLabel()`, which is typed to return only `"Claimed" | "Not claimed"` — "Invited" is structurally impossible to emit from this function. **VERIFIED FROM SOURCE.**
- Grepped `components/vendors/`, `lib/vendors/`, `app/(app)/vendors/` for the literal string `Invited`: the only matches are a code comment and a test description, not rendered UI text. **VERIFIED FROM SOURCE.**
- Preference sort ("Preferred First") reuses `vendorPreferenceSortRank`, same 2/1/0 ranking as the pre-existing inline logic. **VERIFIED FROM SOURCE (diff comparison).**

---

## 4. Four-State Verification

| State | Definition | Result |
|---|---|---|
| A | Unclaimed, no preference tier | Baker's Dozen: blank Preference, "Not claimed". **VERIFIED LIVE.** |
| B | Unclaimed, Preferred/Featured | Cuppity Cakes, Harah's Hair, Nail Studio, WG Step2: "✓ Preferred", "Not claimed". **VERIFIED LIVE.** |
| C | Claimed, Preferred/Featured | **No vendor in current seed data is both claimed and Preferred/Featured.** Golden Hour Photography is the only Claimed vendor and its `preference_level` is `recommended` (blank badge), confirmed by direct read-only SQL. The report's own Section 7 table discloses this identical caveat. **Not demonstrable live from existing data.** The underlying logic is separately covered by unit tests (`list-presentation.test.ts`, "C: preferred + claimed → Preferred badge, Claimed (visually distinct from B)"), so the code path is **VERIFIED FROM SOURCE / unit test**, but a true live side-by-side B-vs-C example does not currently exist. Per this task's explicit "do not modify the database" instruction, I did not create one. |
| D | Inactive | `venue_vendor_relationships.status = 'inactive'` rows are excluded by `.neq("status", "inactive")` in `lib/vendors/repository.ts` (confirmed by reading the file). Sweet Daisy currently has 0 inactive relationships in seed data, so this also has no live example (the report doesn't show one either). **VERIFIED FROM SOURCE only, not live.** |

The critical B-vs-C claim ("an unclaimed Preferred vendor and a claimed Preferred vendor must no longer look identical") is proven correct **at the code level** (the Relationship column is independent of the Preference column and both render), but is an **unverified-live item** for lack of matching seed data — this is a live-evidence gap, not a defect.

---

## 5. Invitation Boundary

No path in the touched code renders "Invited" as a claim-state or relationship label. `vendorClaimStateLabel`'s return type makes it impossible by construction, not just by convention. **VERIFIED FROM SOURCE.**

---

## 6. Regression Checks

Ran `git status --porcelain` and filtered for anything vendor-related across the entire working tree (not just the files the report named), to independently confirm nothing outside the approved scope changed:

- Only **one** modified (`M`) vendor file exists in the whole tree: `components/vendors/vendor-list.tsx`.
- Only **two** new vendor files exist: `lib/vendors/list-presentation.ts`, `lib/vendors/list-presentation.test.ts`.
- Only **one** new vendor migration exists: `20261290000000_vendor_relationship_venue_staff_rls.sql`.
- Three unrelated migrations incidentally contain the word "vendor" (activity-timeline automation reading `event_vendor_assignments`/`vendors` in a `select`, and Help & Guides content copy) — read in full, confirmed neither touches vendor schema, RLS, or business logic.

This means, independently of the report's own Section 9 claims, the following are **provably byte-for-byte untouched**: vendor creation RPC, Send/Resend Invite, `claim_vendor_profile`, claimed-vendor behavior, Mark Inactive/Reactivate, preference semantics, Vendor Portal, vendor reviews, and event vendor assignments. **VERIFIED FROM SOURCE (git diff), stronger evidence than re-reading each file individually.**

Cross-venue isolation: covered above (Section 1C), independently re-verified, not just re-read from the report.

---

## 7. Tests

Ran independently (not reusing the report's reported numbers):

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0. **Matches report.** |
| `npm test` | `565 / 565` pass, `0` fail. **Matches report exactly.** |
| `npx tsx --test lib/vendors/list-presentation.test.ts` | `16 / 16` pass, including the named B-vs-C truth-matrix group and both RLS-predicate-model groups (with cross-venue-isolation and null-context cases). **Matches report.** |

Gap, not filled with new tests per instruction: these are pure-function unit tests of extracted presentation/predicate logic. They prove the *logic* is correct but are not a substitute for the live RLS enforcement tests done in Sections 1–2 above.

---

## 8. Scope Check

Confirmed via full-tree `git status` scan (Section 6) that none of the following were touched: Client/Event/Pipeline/Automations/Library/Nav/Help/Event Orders/Branding/Contracts/Payments/Luv, `current_user_venue_id()` definition, or any Vendor RLS beyond the two approved policies. **VERIFIED FROM SOURCE.**

---

## Findings summary

1. Both approved RLS policy changes are implemented exactly as specified and independently confirmed live/DB — no discrepancy.
2. The UI rename (Status→Preference, +Relationship) is implemented exactly as specified, independently confirmed live for Owner — no discrepancy.
3. Manager's end-to-end Vendor list UI remains broken, exactly as the report itself discloses, for exactly the reason the report gives (`vendors` table RLS still owner-scoped) — independently reproduced live and at the DB layer. This is a pre-existing, out-of-approved-scope condition, honestly disclosed, not a new regression.
4. **Minor correction to the report's own disclosure:** a third owner-scoped `vendors` policy, `venues_insert_vendors`, exists alongside the two the report names in Section 10. Same class of gap, same root cause, not new, but not named — worth adding to the follow-up scope when that work is picked up.
5. Live Case C (claimed + Preferred) and Case D (inactive) have no matching example in current seed data, so the most safety-critical visual claim (B vs C look different) is proven at the code/unit-test level but not demonstrated with a live matching pair. Not a defect; a live-evidence gap only, left open per this task's no-database-modification instruction.
6. No regressions found in any of the explicitly checked areas.

---

## Final Verdict: **B — COMPLETE WITH UNVERIFIED ITEMS**

The two approved remediations were implemented correctly, exactly as specified, and are independently verified across database, source, and live evidence, with zero regressions found anywhere in scope or adjacent to it. This verdict is not A because the original audit's underlying symptom — Manager cannot use the Vendor list/detail UI — is still not resolved end-to-end, for a reason that was always outside the approved two-policy scope and is honestly disclosed rather than concealed. It is not C, because the approved scope itself is fully and correctly done, not partially done. It is not D, because nothing that previously worked now works differently or worse, and the report's self-disclosed limitation matches what I independently observed exactly. The "unverified" items are: (a) full Manager UI functionality (blocked by a known, disclosed, out-of-scope RLS gap, now confirmed to include a third policy not previously named), and (b) a live same-tier B-vs-C example, unavailable from current seed data.

**No modifications were made to code, database, migrations, UI, or documentation during this verification.**
