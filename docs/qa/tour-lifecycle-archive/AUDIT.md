# Tours List Lifecycle — Forensic Audit (no implementation)

**Date:** 2026-09-27  
**Scope:** Read-only architecture audit for Archive / Delete on Tours  
**Status:** AUDIT ONLY — no code, migration, or deploy from this pass  
**Production:** untouched

---

## Verdict (product recommendation)

| Question | Answer |
| --- | --- |
| Is the Past clutter gap real? | **Yes.** Default Past is an unbounded operational graveyard (capped only by a silent 50-row fetch). |
| Existing tour archive? | **None.** No `is_archived` / `archived_at` on `tour_appointments`. |
| Existing product archive pattern? | **Yes — Library/config soft-archive** (`is_archived` + collapsible Archived section + Restore). |
| Recommended primary action | **Archive + Restore** (soft flag; exclude from default Upcoming/Past). |
| Recommended Delete | **Outcome C (guarded):** allow hard Delete only for disposable / non-historical rows; otherwise Archive-only. Do not cascade into leads/clients/events. |

---

## 1. What represents a tour?

**Canonical table:** `public.tour_appointments`

Created in `supabase/migrations/20260628160000_tour_scheduling.sql`.  
Program 2 Phase 1a (`20260718000000_program2_phase1a_canonical_tour_scheduling.sql`) made it the **single source of truth** for “does this lead have a tour” (legacy `leads.tour_*` fields superseded).

**App type:** `TourAppointment` in `lib/tours/types.ts`.

---

## 2. Status / lifecycle fields today

| Concern | Mechanism |
| --- | --- |
| Scheduled | `status = 'scheduled'` (default) |
| Confirmed | `status = 'confirmed'` + `confirmed_at`, `confirmation_source` (`manual` \| `prospect_link`), `confirmation_requested_at`, `confirm_token` |
| Completed | `status = 'completed'` + `completed_at` (trigger `set_tour_completed_at`) |
| Cancelled | `status = 'cancelled'` + `cancellation_reason` |
| No-show | `status = 'no_show'` |
| Outcome | `outcome` ∈ `interested` \| `considering` \| `not_a_fit` \| `booked` \| `unknown` |
| Follow-up sent | `follow_up_sent_at` |
| Past / Upcoming | **Not a DB field.** Derived in `lib/tours/list-order.ts` from `status` + `scheduled_at` vs `now` |
| Archive | **Does not exist** |

Status check constraint (create migration):

`scheduled | confirmed | completed | cancelled | no_show`

---

## 3. Existing archive patterns elsewhere (reuse, don’t invent)

Archive is an established **Library / configuration** pattern — not currently used on CRM operational entities (leads/clients have no archive):

- Columns: typically `is_archived boolean not null default false` (templates, inventory, offerings, questionnaires, etc.)
- Presentation: `partitionArchived` + `LibraryArchivedSection` (collapsible “Archived (N)” with Restore)
- Labels: `LIBRARY_LABELS.archive` / `.restore` / `.archivedSection`
- Overflow menu: Archive sits in row overflow, not as a permanent primary button

**Closest operational soft-hide analog for schedule config:** `venue_schedule_item_types.archived_at`.

**Tours should follow soft-archive (`is_archived` or `archived_at`), not invent a sixth `status` value.** Status already means operational outcome (completed/cancelled/etc.). Archive means “hide from working list.”

---

## 4–7. Downstream references / SoT / delete risk

### Foreign keys *to* `tour_appointments`

| Referrer | ON DELETE | Risk if hard-deleted |
| --- | --- | --- |
| `task_reminders.tour_appointment_id` | **CASCADE** | Tour reminders deleted with the tour |
| `tour_protection_requests.appointment_id` | **SET NULL** | Protection history kept; link cleared |
| Message merge context `merge_tour_appointment_id` (message templates path) | **SET NULL** | Merge pointer cleared |

### Tour → other records (outbound)

| Link | Direction | Delete tour effect |
| --- | --- | --- |
| `tour_appointments.lead_id` → `leads` | Tour references lead (`ON DELETE SET NULL` on lead delete) | **Lead is not deleted** when tour is deleted |
| Clients / events / conversations / payments | No FK from tour | Untouched by tour delete |
| Post-tour `lead_activities`, `lead_tasks`, `lead_signal_events` | Written on status transitions; keyed by `lead_id`, not tour FK | **Remain** after tour delete (orphan narrative risk: activity says “Tour completed” but appointment gone) |
| Reporting / metrics | `COUNT(tour_appointments)`, funnel joins via `tour_appointments.lead_id` | **Hard delete mutates historical funnel/tour counts** |
| Calendar | Reads non-cancelled `tour_appointments` as Tour SoR | Delete removes calendar presence; archive must decide calendar visibility separately |
| Notifications | Triggers on insert/update of `tour_appointments` | Past notifications unaffected |

### Is the tour itself SoT?

**Yes, for tour scheduling history and “lead had a tour” reporting.**  
It is **not** SoT for lead/client/event identity. Booking a tour may create a lead, but the lead then lives independently.

### Delete verdict (architecture-based)

- **Blind hard delete of completed/confirmed tours with lead linkage is unsafe for reporting integrity and narrative history.**
- **Hard delete can be appropriate** for junk/orphan/test rows (no lead, obvious fixture) — Sandbox already hard-deletes synthetic tours in `20261400800000_sandbox_remove_synthetic_tour_fixtures.sql`.
- Authenticated role already has SQL `DELETE` grant on `tour_appointments`, but **there is no product Delete UI/API today.**

**Recommended outcome: C (guarded deletion) with Archive as the default cleanup path.**

---

## 8–9. How Past is built / pagination / filters

### Fetch (`getTourAppointments` in `lib/tours/service.ts`)

Three parallel queries (each **`.limit(50)`**):

1. Upcoming: `status ∈ {scheduled, confirmed}` AND `scheduled_at >= now` — asc  
2. Completed/no-show history: `status ∈ {completed, no_show}` — desc  
3. Overdue still open: `status ∈ {scheduled, confirmed}` AND `scheduled_at < now` — desc  

**Cancelled is never fetched** for the Tours page.

### Partition (`partitionTourAppointmentsForVenueList`)

- **Upcoming:** not cancelled/completed/no_show AND `scheduled_at >= now`
- **Past:** completed OR no_show OR (not cancelled AND `scheduled_at < now`)

### UI (`app/(app)/tours/page.tsx` + `components/tours/tour-list.tsx`)

- Sections: Upcoming card + Past card only  
- **No archive filter, no search, no “load more”**  
- Row actions: status Select, Send Confirmation Request / Mark as Confirmed, Record outcome, Mark follow-up sent, link to Lead  
- **No overflow menu, no Archive, no Delete**

### Practical implication of the 50-limit

Without Archive, older completed tours **silently fall off** Past once >50 completed/no_show rows exist — not archived, not filterable, just invisible. That is worse than Archive: history becomes unrecoverable from this screen.

---

## 10. Fixture / preserve data

Sandbox cleanup migration **hard-deletes** known synthetic E2E tour IDs and `@example.com` / e2e-named contacts, while **preserving** legitimate tours (e.g. Lydia Cormier) via contact backfill. Real venue tour history must remain recoverable → favors Archive over mass Delete.

---

## Cancelled tours (related list gap)

Cancelled appointments are:

1. Excluded from `getTourAppointments` queries  
2. Excluded from both Upcoming and Past partitions  

So cancelled tours **already vanish from the Tours workspace** without Archive. They remain in DB (capacity/availability treats cancelled as free). Product decision for implementation phase: whether Cancelled should appear in Archived / a Cancelled filter, or stay out of default lists (current behavior).

---

## Recommended product behavior (for the next implementation pass)

### Archive (PRIMARY) — implement

- Add soft-archive column on `tour_appointments` (`is_archived boolean not null default false` **or** `archived_at timestamptz`, matching Library vs schedule-catalog precedents — prefer `is_archived` for label/parity with Library).
- Default Tours queries exclude `is_archived = true`.
- Archived collapsible section or filter (reuse `LibraryArchivedSection` / `partitionArchived` presentation pattern + Archive/Restore labels).
- Archive allowed for: completed, no_show, cancelled, and optionally overdue confirmed/scheduled the venue no longer needs in the working list.
- Restore clears archive flag; row returns to Upcoming vs Past by existing partition rules.
- **Do not** archive-delete leads/clients/events/conversations.
- Reporting should **continue counting archived tours** unless product later defines “exclude archived from metrics” (default: keep in metrics — archive is list hygiene, not un-happening the tour).

### Delete (SECONDARY) — guarded only

Allow Delete with confirmation **only when** e.g.:

- no `lead_id`, or  
- clearly disposable (and never when it would rewrite meaningful funnel history without an explicit “purge test data” admin path)

Otherwise: offer Archive and explain why Delete is blocked.

Never cascade-delete leads/clients/events/conversations/payments.

### UX placement

- Prefer row **overflow menu**: Archive (and Delete when allowed) — Tour row currently uses many primary buttons; don’t add another permanent Archive button.
- Match HTC Library overflow + confirmation dialog patterns for Delete.

### Default list goal

Default = **operational Upcoming + recent Past (non-archived)**.  
Archived = recoverable history.  
Do not invent a separate “CRM archive module”; extend the existing archive presentation language.

---

## Implementation checklist (next phase — not done here)

1. Migration: archive column + index `(venue_id, is_archived)`  
2. Service: exclude archived from default fetch; fetch archived for Archived section  
3. UI: overflow Archive/Restore; optional Delete with guards  
4. Tests: list-order + archive/restore + delete guards + regression on status/outcome/confirm  
5. Sandbox deploy + exact-image browser proof  

---

## Evidence pointers

| Area | Location |
| --- | --- |
| Schema | `supabase/migrations/20260628160000_tour_scheduling.sql` |
| Lifecycle fields | `supabase/migrations/20260628220000_tour_lifecycle.sql` |
| Confirmation | `supabase/migrations/20261313000000_tour_confirmation.sql` |
| List fetch | `lib/tours/service.ts` → `getTourAppointments` |
| Past/Upcoming | `lib/tours/list-order.ts` |
| Tours UI | `app/(app)/tours/page.tsx`, `components/tours/tour-list.tsx` |
| Post-tour side effects | `lib/tours/post-tour.ts` |
| Library archive pattern | `components/library/*`, `lib/message-templates/repository.ts` |
| Reporting SoT | `lib/metrics/registry.ts` (tour_appointments clocks) |
| Calendar SoT | `lib/calendar/service.ts` |
