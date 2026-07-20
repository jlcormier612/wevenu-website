# Key Dates Release Readiness — Assessment

Phase 4 of the platform's release-readiness review. Booking Financial Architecture and Seating are closed (Ready-with-follow-ups and Almost Ready, respectively). This assessment covers Key Dates, judged the way a coordinator would use it in a real booking.

## Methodology

Key Dates is `public.client_key_dates` — a small, freeform table (`label`, `date`, `note`) scoped to a client, storing coordinator-authored planning milestones. Because there's no browser-automation tool available in this environment, verification combined two methods, and each finding below is labeled with which one produced it: (1) real writes against the actual RLS-scoped table and the exact query shapes the live dashboard/calendar code runs, executed as the authenticated venue owner — proving what the data layer actually does, not what it's assumed to do; and (2) direct grep/read verification of every UI entry point, repeated independently rather than taken on faith from the initial code survey, specifically to confirm or refute the single most consequential claim this audit surfaces (below). All test data — one client, four key dates, one relationship record — was created through real paths and fully deleted; final checks confirm zero rows remain.

---

## What Currently Exists

A real, individually well-built stack: a correctly-scoped and correctly-secured table (`client_key_dates`, RLS via `venue_id = current_user_venue_id()` — confirmed not self-referencing, unlike the known `venues`-table hazard elsewhere in this codebase), a validated insert path (`lib/clients/service.ts:332-342`, non-empty label enforced at both the app layer and the DB check constraint — confirmed live: an empty/whitespace label was rejected with a real `23514` constraint violation), a delete path, and a full component (`components/clients/key-dates-section.tsx`) with a labeled form, a suggestion datalist, and a delete affordance. Two read surfaces consume the table today: the Dashboard's "next 14 days" widget and the Calendar's month view.

## The Central Finding: The Feature Has No Reachable Entry Point

**A coordinator cannot add, view, or delete a key date anywhere in the product today.** `KeyDatesSection` — the only component that renders the add/delete UI — is never imported by any page. This was verified independently, twice: a repo-wide grep for the identifier `KeyDatesSection` returns only its own definition, and a direct read of the client detail page (`app/(app)/clients/[id]/page.tsx`) and the component it delegates to (`components/events/event-detail.tsx`) confirms neither references `keyDates` at all. The server actions and service functions behind it (`addKeyDateAction`, `deleteKeyDateAction`, `lib/clients/service.ts`'s `addKeyDate`/`deleteKeyDate_`) are consequently unreachable from any UI — not broken, just unused.

Meanwhile, the two read surfaces are real and live — this was confirmed by writing a key date directly into the table and re-running the Dashboard widget's exact query (`venue_id` + `date` between today and +14 days): the new row appeared correctly, with the client's name joined in, exactly as the widget would render it. Both the Dashboard widget and the Calendar link each key date back to `/clients/{id}` — a page where, today, that key date cannot be seen, edited, or removed.

The net effect: the product currently *advertises* a live "Key Dates" feature on two prominent surfaces (Dashboard, Calendar) that a coordinator can only ever populate by asking an engineer to insert a row directly into the database. This is not a partially-finished workflow with some rough edges — the core action (add a key date) does not exist anywhere a coordinator can reach it.

---

## Other Findings

**Ownership drift, live-demonstrated: `clients.rehearsal_date` vs. a "Rehearsal Dinner" key date.** The Key Date suggestion list offers "Rehearsal Dinner" as a freeform label, but a real, structured `clients.rehearsal_date` column already exists for exactly this concept — captured on the client form, validated against the event date, and set atomically at client creation. Nothing cross-checks the two. Live test: a client was created with `rehearsal_date = 2026-11-13`, then a "Rehearsal Dinner" key date was added with `date = 2026-11-12` — a full day of disagreement, accepted without any warning, because no validation rule or UI ever compares them. Compounding this: `clients.rehearsal_date` is itself effectively write-only — grepped across the whole app, it's captured on the client form and never displayed anywhere else, not even as its own Calendar item type (`key_date`/`timeline_entry`/`contract_expiration` all exist as distinct Calendar item types; `rehearsal_date` does not). So today, neither of the two "rehearsal date" values is reliably visible to a coordinator, and the one that is visible (via a manual Key Date, once the entry point above is fixed) can silently disagree with the one that's structured.

**No notification or automation ties exist, and none are even planned as such.** Grepped across the real, cron-backed notification/automation/Luv systems (`lib/notifications/digest-engine.ts` — the actual data source for the hourly `/api/digest` job — sources only `event_tasks` and `message_threads`; `lib/automation/`, `lib/platform-events/`, `lib/luv/observations.ts` all return zero references to `client_key_dates` or its activity-log entries). This is a pure display feature with no time-based behavior behind it. Distinct from other "documented but not yet built" gaps found in earlier phases of this review (which at least had a named future roadmap phase): the one existing internal doc that mentions extending Key Dates only proposes it as a future *calendar visibility* mechanism for guest-driven deadlines, not as a notification trigger — so there isn't even a stated intent for Key Dates to drive reminders.

**Zero couple-portal visibility, confirmed at the permission layer, not just by absence of a route.** An anonymous request for `client_key_dates` returns an explicit `permission denied for table client_key_dates` (no `anon` grant exists), and there is no SECURITY DEFINER RPC comparable to the ones that expose other coordinator-owned data (e.g. seating) to a token-based portal session. This may be entirely correct — Key Dates reads as an internal coordinator planning/reminder concept, not a couple-facing one — but several of the suggested labels ("Final Guest Count Due," "Menu Selection Deadline") describe deadlines that directly affect the couple, and there's no current mechanism for the couple to ever see them. Worth a deliberate product decision either way, not left as an accidental gap.

**Zero vendor visibility.** Confirmed by grep — no vendor-facing code references Key Dates at all. Given the domain's stated purpose (internal client-planning milestones), this reads as intentional, not a gap.

**Clean separation from Timeline, no overlap.** `client_key_dates` (multi-week/month planning milestones, date-only, scoped to a client) and `timeline_entries` (day-of run-of-show, time-of-day, scoped to an event) don't share code, schema, or Calendar item-type identity. This is architecturally sound and was not further tested live, since there's no evidence of confusion to test against.

**A minor, contingent hygiene item**: `getClient()` still runs the `client_key_dates` query on every client-detail-page load, and its result is discarded by every current caller (confirmed via grep — the only non-definition usages of `.keyDates` are inside the orphaned `key-dates-section.tsx` itself). This is a wasted query today; whether it's worth removing depends on the product decision below (if the entry point is restored, the query becomes load-bearing again).

---

## Architecture Issues

**None found.** The table's RLS is correctly scoped and not self-referencing, grants are correctly restricted to `authenticated` only, cascade-delete behavior is correct, and the CRUD stack (component → action → service → repository → table) is internally consistent and correctly layered. Nothing here requires a data-model change or a redesign. The central finding above is a wiring gap, not a design flaw — the fix is connecting an already-correct component to an already-correct page, not building anything new or reworking anything that exists.

## Product Completion Items

1. **Wire `KeyDatesSection` into the client detail page** — the component, actions, and service layer are already correct; this is a connection, not new construction. This single item resolves the central finding.
2. **Resolve the `rehearsal_date` vs. "Rehearsal Dinner"-key-date duplication** — either drop "Rehearsal Dinner" from the suggestion list in favor of the structured column (and surface that column somewhere it's actually visible), or keep both but add a cross-check/warning when they disagree.
3. **Decide, deliberately, whether any Key Dates should be couple-visible** — the deadline-shaped suggestions ("Final Guest Count Due," "Menu Selection Deadline") imply the couple has a stake in knowing them; today they structurally cannot.
4. **Decide whether Key Dates should drive any reminder/notification behavior** — currently a pure display feature; if that's intentional, it's worth stating so explicitly rather than leaving it implicit.

## Engineering Cleanup Items

1. **Remove the now-wasted `client_key_dates` query in `getClient()`** — only if the decision in Product Completion Item 1 is *not* to wire the feature back in. If it is wired in, this becomes load-bearing again and there's nothing to clean up.

---

## Recommendation: **Not Ready**

This is a smaller, more contained gap than the ones found in the two prior phases, and nothing here points to an architecture problem — the backend is correct, and the fix is short. But judged the way the user asked — as a coordinator actually trying to use the feature — the verdict has to be Not Ready: the core action the feature exists to perform, adding a key date, cannot be done anywhere in the product today, while two other surfaces (Dashboard, Calendar) actively present Key Dates as a live, working feature and link to a page where it cannot be managed. A feature whose only entry point is a direct database write is not release-ready, regardless of how sound the code behind that entry point is.

The path back to Ready is short and doesn't require redesigning anything: restore the one missing connection (Product Completion Item 1), then make the two deliberate product decisions about couple visibility and rehearsal-date duplication before calling it done.

### Prioritized Findings

1. **[Blocker] No reachable UI to create/view/manage a key date** — `KeyDatesSection` is dead code; the feature is unusable end-to-end despite a fully correct backend. *(Product Completion)*
2. **[High] `clients.rehearsal_date` and a "Rehearsal Dinner" key date can silently disagree**, live-demonstrated with a one-day drift and zero warning; the structured column is also effectively invisible everywhere outside the entry form. *(Product Completion)*
3. **[Medium] No couple-facing visibility for deadlines that concern the couple** — an open product decision, not a defect, but currently unresolved. *(Product Completion)*
4. **[Low] No notification/reminder behavior tied to Key Dates**, and none is even planned as one — a pure display feature today. *(Product Completion)*
5. **[Low] A wasted per-page-load query** in `getClient()`, contingent on the Item 1 decision. *(Engineering Cleanup)*
