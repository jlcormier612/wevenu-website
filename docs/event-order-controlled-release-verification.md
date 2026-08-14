# Event Order — Controlled Release Verification Protocol & Results

**Type:** Verification only. This document both defines the protocol and reports the results of actually executing it once, live, this session.
**Date:** 2026-08-13
**No code, database schema, migrations, or UI were modified.** One reversible data test was performed and fully cleaned up — see §Data Safety.

**Evidence key:** VERIFIED LIVE (observed in the running app / real HTTP) · VERIFIED FROM DATABASE (direct Postgres query/transaction) · VERIFIED FROM SOURCE (read the code) · UNVERIFIED.

---

## Data Safety — read this first

| | |
|---|---|
| **Venue used** | Sweet Daisy Barn & Farm (`69cfd906-0d15-4e5c-8bab-ed106b411c34`) |
| **Original `event_order_enabled`** | `false` |
| **Final `event_order_enabled`** | `false` (confirmed by direct query after the run) |
| **Other 7 venues** | Confirmed `false` before, during (spot-checked), and after — never touched |
| **Test event reused** | "Nicole & Colby" (`302cf30f-6081-4ab4-b320-f81be7a56a8b`), an existing disposable draft dev-seed event with no vendors/floor-plan/timeline data, already used read-only in an earlier verification pass this engagement |
| **Data created** | One `event_orders` row (from the "Standard Wedding Event Order" starter) + its 140 `event_order_lines`, including one manually-added custom line ("VERIFICATION TEST — Catering Service," $500) |
| **Cleanup** | The `event_orders` row was deleted directly (`ON DELETE CASCADE` confirmed on `event_order_lines.event_order_id`); independently re-queried afterward: **0** remaining test orders, **0** remaining test lines, **0** venues with the flag enabled |

---

## 1. Seven-point verification protocol

Exact steps, as executed this session (repeatable by anyone with HQ admin + venue owner access):

1. Query `venues.event_order_enabled` for all venues; confirm all `false`.
2. Log in as an HQ admin. Navigate to `/admin/venues/{testVenueId}`. Click **"Enable Event Orders"** in the Event Orders card.
3. Re-query all venues; confirm only the test venue is now `true`.
4. Log in as the test venue's owner (or reuse the same session, if the HQ admin is also that venue's owner). Open a draft event's Booking Workspace, click the **Event Order** tab.
5. Select **"Standard Wedding Event Order"** from the template dropdown, click **"Start Event Order."**
6. Click **"Finalize"** while the total is still $0. Confirm the warning dialog appears. Click **Cancel**.
7. Query the couple portal (`/api/portal/event-order?token=...` or the portal page) for this client; confirm no Event Order data is exposed.
8. Use **"+ Add Line" → Custom line** to add one line with a real price (e.g. $500).
9. Click **"Finalize"** again. Confirm no warning dialog appears this time (total > 0), and the order becomes `finalized`.
10. Attempt to mutate a line of the now-finalized order via a direct database write (bypassing the UI, which has already hidden the add/edit affordances) — confirm the database trigger blocks it.
11. Click **"Share with Client,"** send. Confirm `shared_at` is set.
12. Re-query the couple portal endpoint; confirm the finalized, priced Event Order is now visible with the correct total and lines.
13. Return to `/admin/venues/{testVenueId}`, click **"Disable Event Orders."**
14. Re-query all venues; confirm the test venue is `false` again and the other 7 are unchanged.
15. Confirm the test venue's Event Order data (order + lines) still exists in the database after disabling (not deleted).
16. Clean up: delete the test `event_orders` row; confirm cascade removed its lines; confirm 0 residue.
17. Run `npx tsc --noEmit` and `npm test`.

---

## 2. Required test data

- One HQ admin account (used `owner@example.com`, who is both the seeded HQ admin and Sweet Daisy's Owner — convenient, not required; any HQ admin plus any venue owner works).
- One test venue currently at `event_order_enabled = false`.
- One event belonging to that venue with no other in-flight Event Order (a fresh or disposable draft event is ideal, to keep cleanup unambiguous).
- One existing couple-portal session token for that event's client, to test the portal-facing gate (`client_portal_sessions.access_token`) — reused an existing one rather than minting a new one.

---

## 3. Acceptance criteria

| # | Point | Pass criteria | Fail criteria |
|---|---|---|---|
| 1 | HQ enablement | Only the target venue's flag flips; all others remain `false`; the venue can now see the Event Order tab | Any other venue's flag changes, or the target venue's tab doesn't appear |
| 2 | Starter template | Structure populates from the real starter (correct section/line count); every line is unambiguously $0, not blank/omitted | Missing sections/lines, or pricing that could be mistaken for real pricing |
| 3 | $0 total protection | Attempting to finalize or share at $0 shows an explicit confirmation dialog naming the $0 total; Cancel truly aborts (order stays open/unshared) | No dialog appears, or Cancel does not prevent finalization/sharing |
| 4 | Real pricing | Adding a priced line updates the running total correctly; finalizing no longer triggers the $0 dialog | Total miscalculates, or the $0 dialog still appears with a nonzero total |
| 5 | Finalization / immutability | Once finalized, the UI hides all add/edit affordances, **and** a direct database mutation attempt (bypassing the UI/app layer entirely) is rejected by a real trigger | UI still allows edits, or a direct DB write to a finalized order's lines succeeds |
| 6 | Share / Couple Portal | The portal endpoint returns nothing for an unshared order (even one that exists); returns the correct, full, priced content only after sharing | Portal exposes any data before `shared_at` is set, or shows incorrect/incomplete data after sharing |
| 7 | Reversibility | Disabling reverts the flag for the target venue only; existing Event Order data (order + lines) is provably still present afterward | Flag doesn't revert, another venue is affected, or data is deleted/mutated by the disable action |

---

## 4. Current implementation readiness

**Confirmed this pass, VERIFIED LIVE (real browser + real HTTP), matching every acceptance criterion above:**

- Point 1 — HQ enable/disable, scoped to exactly one venue, confirmed by direct DB query before/after (not just trusting the UI).
- Point 2 — starter applies 139→140 lines (140 after my one added line), all $0 before that, exact template name confirmed.
- Point 3 — the exact dialog text was captured live: *"Event Order totals $0.00 ... Confirm that is intentional before continuing — complimentary or unpriced items are allowed, but clients will see this total if you share it."* Cancel correctly left the order open and unfinalized.
- Point 4 — adding a $500 custom line correctly brought the running total to $500 (confirmed both in the UI and by direct query), and Finalize proceeded with no dialog.
- Point 5 (UI half) — after finalizing, all "+ Add Line" controls (18 present before, 0 after) disappeared from the page.
- Point 5 (DB half) — three separate direct-SQL attempts (UPDATE, INSERT, DELETE) against the finalized order's lines were each rejected with `This Event Order is finalized — reopen it to make changes.`, raised by a real trigger (`event_order_lines_enforce_finalized_immutability`), independent of and in addition to the application-layer guard.
- Point 6 — the portal API returned `{"eventOrder":null}` both when no order existed at all, **and** when a real, fully-built order existed but was unshared — the second case is the stronger, more precise proof. After sharing, it returned the correct order: `status: "finalized"`, `sharedAt` set, all 140 lines including the $500 test line, total $500.
- Point 7 — the flag reverted correctly, the other 7 venues were never touched, and the finalized/shared Event Order (140 lines) was independently confirmed still present in the database immediately after disabling, before I deleted it myself as cleanup.

**One item not fully closed this pass — genuine gap, not a defect:**

- I did not find the couple portal's in-app navigation path to the rendered Event Order *section* (the top-level portal nav is Home/Tasks/Timeline/Docs/Floor Plan/Payments/Messages/Guide/Vendors — no visible "Event Order" entry), so I could not capture a pixel-level screenshot of the couple viewing the priced document inside the portal shell itself. What I did confirm, live, is the exact data contract that section's component (`EventOrderPortalSection`) fetches from (`/api/portal/event-order?token=...`) — real HTTP, correct data, before and after sharing. This is strong evidence but a half-step short of a full visual walkthrough; label it **VERIFIED LIVE (API-level), UNVERIFIED (in-portal click path)**, not silently rounded up to a full pass.

**Confirmed from source, not re-tested live this pass (already independently verified in this engagement's prior research on this exact feature, not re-derived from a report's claim):**

- Table-level GRANTs (`authenticated` has the needed privileges) — checked directly this pass.
- The reversibility claim ("disabling doesn't cascade-delete") — proven directly this pass by re-querying the data after disable, before cleanup, rather than trusting the enable-section's own copy.

**Tests:** `npx tsc --noEmit` — clean. `npm test` — **587/587 pass, 0 fail.** No test was added; the existing suite already covers the $0-warning logic and starter shape at the unit level (`lib/event-orders/minimum-safe-release.test.ts`), and this protocol's job was to verify the live, end-to-end behavior those unit tests can't reach on their own — not to add more unit coverage.

**No implementation defect was found.** Everything specified in the minimum-safe-release report matched live behavior exactly, with no discrepancies.

---

## 5. Release verdict

## READY FOR CONTROLLED ROLLOUT

The live checklist was actually executed, end to end, this session — not just specified. All 7 points passed against their stated acceptance criteria, using real HQ/venue/couple-portal sessions and a real, independently-confirmed database trigger test, not source inspection alone. The one incomplete item (§4, in-portal visual click-path) is a minor evidentiary gap in *how* the couple-facing view was confirmed, not a functional failure — the underlying data contract that view depends on was proven correct, live, both before and after sharing.

This verdict applies to **controlled rollout to a single, deliberately chosen venue with informed monitoring** — matching the scope this whole protocol was built to validate. It is not a recommendation to globally enable Event Order, which remains a separate decision requiring explicit approval per venue, exactly as the HQ-only enable control was designed to require.

---

## 6. Blockers

**None.** No implementation defect, no data-safety failure, no regression, and no incomplete core behavior was found. The one open item named in §4 is worth closing on a future pass (find and click-test the actual in-portal path to the Event Order section) but does not block a first controlled rollout, since the data-layer gate it depends on is independently proven correct.
