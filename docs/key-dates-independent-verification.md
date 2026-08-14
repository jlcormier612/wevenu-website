# Key Dates — Independent Verification

**Type:** Independent verification only. No code, database, migrations, UI, tests, or documentation were modified. No fixes applied. No scope expansion.
**Date:** 2026-08-13
**Source of truth:** `docs/key-dates-implementation-specification.md` (approved scope). Implementation report: `docs/key-dates-implementation.md`.

**Evidence key:** VERIFIED LIVE (observed in the running app) · VERIFIED FROM DATABASE (direct Postgres query/transaction, independently run) · VERIFIED FROM SOURCE (read the actual diff/file) · UNVERIFIED.

---

## 1. Source verification of the four approved changes

Read every diff directly, not taken from the report's own description.

**`app/(app)/clients/[id]/page.tsx`** — exactly one line added: `keyDates={client.keyDates}`. **VERIFIED FROM SOURCE.**

**`components/events/event-detail.tsx`** — `keyDates?: ClientKeyDate[]` prop added (default `[]`), `KeyDatesSection` imported, mounted as the second `<Card>` inside the pre-existing `grid gap-4 lg:grid-cols-2` div in the Overview tab, immediately after the "Event summary" card — exactly the mount point specified. **VERIFIED FROM SOURCE**, matches the approved specification precisely.

**`lib/clients/repository.ts`** — `deleteKeyDate` now chains `.select("id")` and returns `{ok:false, message:"Only an Owner or Manager can delete a key date."}` when zero rows are affected, `{ok:true}` otherwise. **VERIFIED FROM SOURCE.**

**`lib/clients/service.ts`** — `deleteKeyDate_` now propagates that failure to the caller instead of unconditionally returning `{ok:true}`. **VERIFIED FROM SOURCE.**

**`app/(app)/clients/[id]/actions.ts`** (the server actions `addKeyDateAction`/`deleteKeyDateAction`) — `git diff --stat` returns empty. **VERIFIED FROM SOURCE**: genuinely untouched, confirming the existing actions are reused, not replaced.

---

## 2. Coordinator experience — live verification

Used a real seeded venue/event (Sweet Daisy Barn & Farm, "Nicole & Colby" booking) with a real logged-in Owner session.

1–4. **Overview tab, card position, Event Summary intact** — **VERIFIED LIVE.** Screenshot confirms "Event summary" (left) and "Key Dates" (right) as the two cards in that grid row, exactly as specified. Event Summary's content (Date/Start/End/Setup/Teardown/Guests) is unchanged.

5–6. **Create + persistence** — **VERIFIED LIVE + VERIFIED FROM DATABASE.** Added "VERIFY TEST — Final Guest Count Due" (2027-09-01, with a note) via the existing form. It appeared immediately in the UI, survived a full page reload, and was independently confirmed via direct query to exist in `client_key_dates` with the exact label/date/note.

7–8. **Edit** — **N/A, not a gap.** The approved implementation explicitly does not add edit ("Existing stack has add + delete only — no update API / no edit UI. Not invented," per the implementation report), which matches the original approved specification I verified in the prior research pass — `KeyDatesSection` has never had an edit affordance. Confirmed live: hovering the key-date row surfaces only a delete (trash) icon, no edit/pencil control, and no update server action or repository function exists (`insertKeyDate`/`deleteKeyDate` are the only two). Steps 7–8 of the verification brief assume a capability that was never part of the approved scope; this is a mismatch between the brief's assumption and the approved work, not an implementation defect.

9–10. **Delete + removal confirmed** — **VERIFIED LIVE + VERIFIED FROM DATABASE.** Deleted the test key date via the UI; it disappeared immediately, stayed gone after reload, and was independently confirmed at `count = 0` in the database.

11. **Delete does not report success on zero rows** — **VERIFIED LIVE + VERIFIED FROM DATABASE**, tested three distinct ways:
    - Unit-level (independently re-run): `deleteKeyDate` returns `{ok:false}` when the mocked client reports zero affected rows — 4/4 tests pass.
    - Database-level, nonexistent id, as Owner (rolled-back transaction): `DELETE 0` — confirms the real RLS/query layer genuinely returns zero rows for a nonexistent id, matching what the code's `.select("id")` check depends on.
    - Database-level, real row, as a Coordinator (a role the `client_key_dates_delete_gate` RESTRICTIVE policy does **not** permit to delete — confirmed by reading the policy: `current_user_role() = ANY (ARRAY['owner','manager'])`, so Coordinator and Staff are blocked, **Manager is not**): `DELETE 0`, row independently confirmed still present.
    - Live UI, as the real Coordinator account (`d5b-coordinator@example.com`): clicked delete on a real key date. **The UI correctly showed an error toast, "Could not delete key date."** — confirming the delete-safety guard's own message-level behavior is exactly correct, live, for the one role it's meant to protect against. Database re-query confirmed the row was never actually removed.

---

## 3. Out-of-scope finding — reported, not fixed

**While testing item 11 above, a genuine, reproducible defect was found in the pre-existing `KeyDatesSection` component (unmodified by this implementation — confirmed by `git diff --stat` returning empty for that file).**

After the Coordinator's blocked delete attempt, the error toast correctly appeared ("Could not delete key date"), but **the key date remained visually removed from the list** — `handleDelete`'s optimistic `setKeyDates((p) => p.filter(...))` runs before the server call, and on failure it calls `toast.error()` + `router.refresh()`, but the component's local `useState(initialKeyDates)` has no effect resyncing it when `initialKeyDates` changes on a Next.js soft refresh — the same "stale client state after refresh" pattern already identified and partially fixed elsewhere in this codebase. **VERIFIED LIVE**: a genuine full page reload (not `router.refresh()`) correctly restored the key date, and the database was confirmed to have held the row correctly the entire time — **this is a display-staleness bug, not a data-loss bug.**

This is reported here, per instruction, as **OUT OF SCOPE** — it predates and is untouched by the approved Key Dates implementation (which correctly reused this component without modification, exactly as directed), and no fix is proposed or applied. It was unreachable before this pass (the whole component was orphaned), so this is the first time it's been observed, not a regression introduced by this work.

---

## 4. Couple Portal

**"Next key date" card displays a coordinator-created date** — **VERIFIED LIVE.** After creating the test key date, both the raw portal API (`/api/portal/key-dates?token=...` → `{"keyDates":[{"label":"VERIFY TEST — Final Guest Count Due", ...}]}`) and the actual rendered portal page's DOM text (captured after `networkidle`, past the legal-acceptance gate) showed "NEXT KEY DATE / VERIFY TEST — Final Guest Count Due / September 1, 2027 / independent verification pass." (Note: a `fullPage` screenshot of this specific card had a scroll/capture timing artifact and doesn't visually show it, but the live DOM text extraction — real browser, real render — does; the screenshot gap is a tooling artifact, not a functional one.)

**Unshared/private Key Date exposure** — **N/A, not a gap to test.** Read `get_portal_key_dates` directly: it filters only on `client_id` (resolved securely from the portal session token) — there is no visibility/privacy/shared flag anywhere in `client_key_dates`'s schema or this RPC. Unlike Event Order, Key Dates has no "draft vs. shared" concept in its data model at all — every key date a coordinator creates is immediately, by design, couple-visible. This is pre-existing, unchanged architecture (the RPC and route were not touched by this implementation), not something this pass introduced or could meaningfully test a negative case against.

**Existing couple-facing design unchanged** — **VERIFIED FROM SOURCE.** `components/portal/portal-shell.tsx`, `app/api/portal/key-dates/route.ts`, and `lib/portal/service.ts` all show empty `git diff --stat` — genuinely untouched.

---

## 5. Architecture / regression

| Check | Result |
|---|---|
| No new route created | **VERIFIED FROM SOURCE** — no new files under `app/`; only the pre-existing `page.tsx` was modified |
| No new navigation item | **VERIFIED FROM SOURCE** — `lib/navigation.ts` shows a diff, but it is the same pre-existing, unrelated Left-Navigation-initiative diff already present before this work (confirmed via `git log` blame in an earlier pass this engagement); Key Dates work touched nothing in it |
| Data model intact | **VERIFIED FROM DATABASE** — `client_key_dates` schema (columns, constraints, indexes) is byte-identical to before; no new migration exists for this table |
| Existing actions/services reused | **VERIFIED FROM SOURCE** — `addKeyDateAction`/`deleteKeyDateAction` untouched; `insertKeyDate` untouched; only `deleteKeyDate`'s return contract was extended (additive, not replaced) |
| Existing permissions intact | **VERIFIED FROM DATABASE** — exactly the same 2 RLS policies (`client_key_dates_all`, `client_key_dates_delete_gate`) with unchanged predicates |
| `/events/[id]` behavior unchanged | **VERIFIED FROM SOURCE** — `git diff --stat` empty; still a pure redirect to `/clients/{clientId}`, forwarding query params and preserving hash |
| Booking Workspace remains the single coordinator destination | **VERIFIED FROM SOURCE** — confirmed by the above; no second rendering path exists |
| Delete-safety change doesn't alter normal delete behavior | **VERIFIED LIVE + DATABASE** — the Owner's successful delete (§2, items 9–10) behaved identically to before: immediate UI removal, persisted after reload, row genuinely gone |

---

## 6. Tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | Clean, exit 0 |
| `npm test` | **587 / 587** pass, 0 fail |
| `npx tsx --test lib/clients/key-dates.test.ts` (focused) | **8 / 8** pass, independently re-run |

All numbers independently reproduced this pass, not taken from the implementation report.

---

## Final Verdict: **A — VERIFIED COMPLETE**

All four approved changes are implemented exactly as specified and independently verified — live, from the database, and from source, with no discrepancies. The two brief items that could not be executed as literally written (Edit, and a private/unshared Key Date negative test) are not implementation gaps: Edit was never part of the approved scope (matching the original specification), and Key Dates has no shared/unshared dimension in its data model at all, unchanged by this work. One genuine, reproducible defect was found and is reported separately as **OUT OF SCOPE** (§3) — a pre-existing, unmodified component's optimistic UI state doesn't resync after a blocked delete, though the underlying data is never actually lost or corrupted. No regressions were found anywhere in the do-not-touch list.
