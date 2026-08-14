# Key Dates — Bounded Implementation Specification

**Type:** Research and specification only. No code, database, migrations, UI, tests, or documentation were modified to produce this document.
**Date:** 2026-08-13
**Starting point:** `docs/key-dates-release-readiness-assessment.md` (2026-07-15, Phase 4), reconciled against the current working tree — which has changed substantially since that assessment (the Client detail page was rebuilt as "The Booking Workspace" under the Unified Relationship Workspace initiative, and the Dashboard was rebuilt under the Decision Engine architecture). The old diagnosis's *conclusion* still holds, but its *supporting file references* needed independent re-verification, not a straight carry-forward — done below.

---

## 1. Current Key Dates architecture

**Data model** — `public.client_key_dates` (`id`, `venue_id`, `client_id`, `label`, `date`, `note`, `created_at`). RLS: `client_key_dates_all` (`FOR ALL`, `venue_id = current_user_venue_id()` — venue-wide staff, correctly scoped, not owner-restricted) plus a `RESTRICTIVE` `client_key_dates_delete_gate` (`FOR DELETE`, owner/manager only) added since the prior assessment. Table-level GRANTs to `authenticated` (SELECT/INSERT/UPDATE/DELETE) are present and correct. **VERIFIED FROM DATABASE**, fresh query this pass, not assumed from the prior report.

**Repository / service** (`lib/clients/repository.ts`, `lib/clients/service.ts`) — `insertKeyDate`, `deleteKeyDate`, `getClient()`'s join (`client_key_dates` queried and mapped into `ClientWithDetails.keyDates`), `addKeyDate`/`deleteKeyDate_` service wrappers, `validateKeyDateInput`. All present, unchanged, internally consistent. **VERIFIED FROM SOURCE.**

**Server actions** (`app/(app)/clients/[id]/actions.ts`) — `addKeyDateAction`, `deleteKeyDateAction`. Present, call the service functions above directly, no missing wiring at this layer. **VERIFIED FROM SOURCE.**

**Coordinator-side component** — `components/clients/key-dates-section.tsx`, `export function KeyDatesSection({ clientId, initialKeyDates })`. A complete, self-contained `"use client"` component: renders the list (with "N days" / "past" styling), an inline add-form (label with a datalist of suggestions, date, optional note), and a delete affordance per row. It does not include its own `Card`/header chrome — it's designed to be dropped inside a parent's own card/section wrapper. **VERIFIED FROM SOURCE, read in full.**

**Coordinator/event workspace surface** — `app/(app)/clients/[id]/page.tsx` is now "The Booking Workspace," and is the single canonical page: `app/(app)/events/[id]/page.tsx` is not a second rendering path — it immediately `redirect()`s to `/clients/${event.clientId}` and renders nothing itself. The Booking Workspace page calls `getClient(id)` (which already includes `.keyDates` in its return shape) and renders `<EventDetail ... />` (`components/events/event-detail.tsx`), a large tabbed component (Overview / Playbook / Timeline / Floor Plan / Documents / Vendors / Event Order / Inventory / Invoice / Conversation / Activity / Notes / Team / Feedback). **`keyDates` is fetched by the page but never passed as a prop to `EventDetail`, and `EventDetail` has no `keyDates` prop at all today.** **VERIFIED FROM SOURCE**, confirmed by reading both files' full prop lists.

**Client portal surface** — real and already working, unrelated to the orphaned coordinator UI: `app/api/portal/key-dates/route.ts` → `resolvePortalKeyDates()` → `get_portal_key_dates` RPC (shipped 2026-07-23, "Program 4, Initiative C, Phase 3" per its own code comment) → rendered by `KeyDatesCard` in `components/portal/portal-shell.tsx` as a "Next key date" card on the couple's home view, self-fetching, rendering nothing if there are zero key dates. **This is a genuine, correct, already-shipped couple-facing read surface that the prior assessment's "Zero couple-portal visibility" finding did not know about** (it predates the 2026-07-15 assessment's own cutoff — Phase 3 shipped 2026-07-23, eight days later). It currently shows nothing to every couple only because no coordinator can ever create a key date for it to display — not because of any defect in the portal code itself. **VERIFIED FROM SOURCE**, read in full; this is the one place this pass's findings diverge from the prior assessment's, and it's a correction in the *positive* direction (less missing than previously known), not a new problem.

**Dashboard** — rebuilt since the prior assessment (`lib/dashboard-system/decision-engine.ts`, the "Attention List" Decision Engine), but the underlying data path is unchanged: `lib/dashboard/service.ts` still queries `client_key_dates` directly (joining client name), and the Decision Engine still links each upcoming key date to `/clients/${kd.clientId}` — same destination as before. **VERIFIED FROM SOURCE.**

**Calendar** — unchanged: `lib/calendar/service.ts` queries `client_key_dates` for the visible date range and links each item to `/clients/${k.client_id}`. **VERIFIED FROM SOURCE.**

**Navigation / deep links** — both surfaces above link to `/clients/{id}`, which resolves and loads successfully (it's a real, working page) — the link itself is not broken; the page it lands on simply has nothing that renders the key date once there.

---

## 2. Exact broken journey

```
Dashboard "Attention List" or Calendar month view
  → shows a real, live key date (e.g. "Final Guest Count Due — Jan 12")
  → click → navigates to /clients/{id}                          ✅ works
      → /clients/{id} loads "The Booking Workspace"              ✅ works
      → renders <EventDetail ... /> across its 14 tabs           ✅ works
      → NONE of the 14 tabs render KeyDatesSection anywhere,
        and EventDetail is never given the key-dates data at all ❌ breaks here
```

A coordinator arriving from either advertised entry point sees a fully working booking workspace with no visible trace of the key date that brought them there, and no way to add, edit, or remove any key date for this client anywhere on the page.

---

## 3. Root cause

**A single missing connection, in exactly one direction, confirmed unchanged in shape from the prior assessment despite the surrounding page having been substantially rebuilt since:**

1. `app/(app)/clients/[id]/page.tsx` fetches `client.keyDates` (via `getClient()`) but never passes it to `<EventDetail>`.
2. `components/events/event-detail.tsx` has no `keyDates` prop, and never imports or renders `KeyDatesSection`.

Both the data (already fetched, zero new queries needed) and the component (already built, complete, correct) exist; they are simply never connected to each other. This is not a regression introduced by the Booking Workspace rebuild — the orphaning predates it and survived it unchanged, confirmed by `git status` showing zero in-progress work on any of these files.

---

## 4. Recommended minimal fix

**Files to change (2):**

1. **`app/(app)/clients/[id]/page.tsx`** — pass the already-fetched `client.keyDates` through as a new prop on the existing `<EventDetail ... />` call. No new query, no new fetch — `getClient(id)` already returns it.
2. **`components/events/event-detail.tsx`** —
   - Add `keyDates?: ClientKeyDate[]` (default `[]`) to the props destructure and type, importing `ClientKeyDate` from `@/lib/clients/types` (already the type `KeyDatesSection` itself uses).
   - Import `KeyDatesSection` from `@/components/clients/key-dates-section`.
   - Mount it inside the **existing, currently under-filled** Overview-tab grid: `<TabsContent value="overview">` already contains a `<div className="grid gap-4 lg:grid-cols-2">` with exactly one `<Card>` child ("Event summary") — a two-column grid with only one column occupied. Add a second `<Card>` as the grid's second child: `<CardHeader><CardTitle className="text-base">Key Dates</CardTitle></CardHeader><CardContent><KeyDatesSection clientId={event.clientId} initialKeyDates={keyDates} /></CardContent></Card>`. `event.clientId` is already available in this scope (already used a few lines above for `BookingSetupCard`).

This adds **zero new tabs, zero new routes, zero new navigation, zero new components** — it fills an already-reserved, already-empty second column in an already-existing tab with an already-built component, exactly matching the "existing domain logic + existing coordinator component + correct existing mount point" shape requested.

**No migration is required.** The table, RLS, grants, and CRUD stack are already correct (§1).

**One decision to flag, not make:** the RESTRICTIVE `client_key_dates_delete_gate` (owner/manager-only) was added to the schema since the prior assessment. `deleteKeyDate` (`lib/clients/repository.ts`) only checks `error`, never rows-affected — the same "silent false success" shape already catalogued as non-blocking debt elsewhere in this engagement (`docs/release-readiness-reconciliation.md` §C/§F2). Today this is unreachable dead code, so the gap has zero live consequence. The moment this fix ships, it becomes reachable: a Staff/Coordinator clicking delete on a key date would see a false "deleted" state while the row silently remains. This is the same already-known class of bug, not a new one, and fixing it is a one-line, same-shape change identical to ones already applied elsewhere — but it is a scope decision (bundle it with this wiring fix, or leave it for the already-planned dedicated delete-safety sweep), not something to decide unilaterally here.

**Required tests:**
- `tsc --noEmit` / `npm test` stay green (existing baseline).
- No existing unit test covers `validateKeyDateInput`, `addKeyDate`, or `deleteKeyDate_` today — confirmed by search, none exist. Given this feature becomes live-reachable for the first time, worth adding focused unit tests for the validation function at minimum (empty/whitespace label rejection, matching the DB check constraint), mirroring the pattern already used for other recently-wired features.
- No test currently exercises `EventDetail`'s new prop; a render-level test isn't required by this engagement's own established pattern (`EventDetail` itself has no existing test suite to extend) — live browser verification is the correct evidence tier here, matching how this exact component tree is normally verified.

---

## 5. Acceptance tests

Only what's applicable to the current, confirmed architecture:

1. **Coordinator can reach Key Dates** — from the Dashboard's Attention List, click an upcoming key date; confirm the Overview tab of the resulting Booking Workspace now shows a "Key Dates" card. Repeat starting from the Calendar month view.
2. **Coordinator can see the event's/client's key dates** — the card lists every existing `client_key_dates` row for that client, matching what a direct DB query for that `client_id` returns.
3. **Coordinator can add a key date** — use the existing add-form; confirm the new row appears in the UI, and independently confirm it now exists in `client_key_dates` via a direct query (not just trusting the UI).
4. **Coordinator can delete a key date, as Owner or Manager** — confirm the row disappears from the UI and is independently confirmed gone from the table.
5. **Staff/Coordinator role and the delete gate** — attempt a delete as Staff/Coordinator; confirm the actual, current behavior (per the RESTRICTIVE gate, RLS should block it) and document whether the UI still falsely reports success (the known, pre-existing gap named in §4) or whether that's addressed as part of this change — this is exactly the open decision flagged above, and the acceptance test should record which was chosen.
6. **Save persists** — reload the page after adding/deleting; confirm the change survived (not just optimistic client state).
7. **Dashboard link resolves correctly** — the "Attention List" key-date item's link still lands on the correct client's Booking Workspace, Overview tab, with the new Key Dates card visible.
8. **Calendar link resolves correctly** — same check, starting from the Calendar month view.
9. **Client-facing (couple portal) behavior remains intact and — as an expected, correct consequence, not a redesign — finally shows real data**: confirm the existing, unmodified `KeyDatesCard` in the couple portal now displays the "Next key date" for a couple whose coordinator has added one, and confirm it still correctly renders nothing for a couple with zero key dates (unchanged empty-state behavior).
10. **Permissions remain correct** — confirm a Manager/Staff/Coordinator from a *different* venue cannot see or add key dates for this client (cross-venue isolation via `current_user_venue_id()`, already correctly scoped, not modified by this fix).

---

## 6. Explicit non-goals

Everything below must remain exactly as it is today:

- **Key Dates terminology, suggestion list, data model, or table schema** — unchanged (no migration needed per §4).
- **`client_key_dates` RLS** — unchanged; it is already correctly venue-scoped. The RESTRICTIVE delete gate is a *pre-existing*, separately-introduced constraint, not something this fix touches — see the flagged decision in §4, which is about the *application-layer* rows-affected check, not RLS itself.
- **Client-facing (couple portal) Key Dates behavior** — `KeyDatesCard`, `resolvePortalKeyDates`, `get_portal_key_dates`, `app/api/portal/key-dates/route.ts` are all already correct and are not modified; they simply start receiving real data as a consequence of coordinator-side data finally existing.
- **Dashboard architecture** — the Decision Engine, Attention List, and `lib/dashboard/service.ts`'s query are unchanged; they already work correctly and already link to the right place.
- **Calendar** — unchanged; already correct.
- **Event workspace architecture / `EventDetail`'s existing 14 tabs and their content** — unchanged, other than adding one new `Card` inside the Overview tab's already-existing, already-under-filled two-column grid. No tab is added, removed, reordered, or restructured.
- **Permissions generally** — unchanged; only the one already-flagged, optional, one-line rows-affected check is even under discussion, and it is explicitly not decided here.
- **`rehearsal_date` vs. "Rehearsal Dinner" duplication, couple-visibility-by-design decision, notification/reminder behavior** — all three were separate, already-named Product Completion Items in the prior assessment (items 2–4), explicitly distinct from the orphaned-UI item (item 1) this specification addresses. None are touched, redesigned, or decided here.
- **Help, Library, Navigation** — untouched.
- **Vendor, Pipeline, Automations, Event Order, Seating, Luv, Branding, Contracts, Payments, Wedding Website** — untouched; nothing in this trace crosses into any of these domains.
- **No new notifications, no new automation triggers** — confirmed none exist today tied to Key Dates (unchanged from the prior assessment's own finding), and none are added.

---

## 7. Verdict

## READY FOR CURSOR

The fix is fully specified with no open architectural questions: two files, one new prop, one new `Card` in an already-existing, already-empty grid slot, zero migrations, zero new routes. The one genuine open item — whether to bundle the pre-existing, now-newly-reachable delete-safety rows-affected check together with this wiring fix, or leave it for the already-planned dedicated sweep — is a small, bounded scope decision, not a blocking product question, and is named precisely in §4 for whoever approves the Cursor prompt to decide in one sentence before implementation starts.
