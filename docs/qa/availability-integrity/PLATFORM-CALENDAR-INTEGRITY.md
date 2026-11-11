# Platform-wide calendar & availability integrity

**Priority:** P0 venue operating integrity  
**Status:** **GREEN** on Sandbox tip `c00749be` (migration + deploy verified)  
**Production:** untouched  
**Preserved:** blocked-date fix `8e4f911e` / `20261415000000`; existing-lead tour `45290d6a`

**Observed (UTC):** 2026-10-12 (live QA)  
**Migration apply:** https://github.com/jlcormier612/wevenu-website/actions/runs/38193003319  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38193005026  

---

## Canonical availability contract

| Concept | Authoritative source | Affects | Enforcement |
|---|---|---|---|
| Tour Blocked Dates (one-time + annual) | `tour_availability_exceptions` | Event-date selection + tour slots | `_is_event_date_available` / `_is_tour_slot_blocked` / staff precheck |
| Calendar blocks | `calendar_blocks` | Event + tour (typed) | `_is_event_date_available` / covering helpers / precheck |
| Holds | `date_holds` (+ spaces) | Event-date when `hold_blocks_availability` | SQL + precheck |
| Booked events | `events` with `booked_at` | Occupancy | `events_enforce_availability` / occupancy precheck |
| Preferred event date | `leads.event_date` | Informational preference | Not a booking; public choose_available gated |
| Tour appointment | `tour_appointments` | Tour calendar only | Slot windows + tour exceptions |
| Existing-lead tour link | HMAC `?o=` + lead row | Tour attach; date read-only | `resolveExistingLeadTourContext` + `book_public_tour_for_lead` |
| Venue operating / tour hours | `tour_availability_windows` | Tour slots | Slot generation |

**Modes:** `choose_available` → hard gate via `_is_event_date_available`. `request_preferred` → no public availability calendar gate (product rule). Staff preferred-date UI remains a **soft** warning with “Save anyway”.

---

## Path matrix

| Entry | Handler | Canonical validation | Mutation | Status |
|---|---|---|---|---|
| Public inquiry form | `/api/public/inquire` → `create_public_lead` | `_is_event_date_available` | `ingest_lead` | **GREEN** |
| Inquiry dates API | `/api/public/inquiry-available-dates` | `get_available_event_dates` | none | **GREEN** |
| Purpose public form | `/api/public/forms/submit` → `create_public_form_lead` | `_is_event_date_available` | `ingest_lead` | **GREEN** (fixed) |
| Existing-lead `/book/{key}?o=` | InquiryForm schedule_tour | Tour slots; lead date read-only | `book_public_tour_for_lead` | **GREEN** (preserved) |
| Generic `/book/{key}` | same, no lead context | Tour slots | ingest/attach | **GREEN** |
| Staff New Lead preferred date | `checkAvailability(preferred_date)` | blocks + holds + tour exceptions (annual) | soft override | **GREEN** (warning fixed) |
| Staff booking / events | assert + occupancy | SQL write authority | events | Existing |
| Calendar UI projection | `projectTourAvailabilityExceptions` | display | none | Existing annual |

---

## Defects closed

1. **`create_public_form_lead`** — migration `20261415100000_public_form_lead_honors_event_date_availability.sql`  
2. **Staff preferred_date precheck** — annual-aware `tour_availability_exceptions` in `repository.ts` + event-path conflict in `precheck.ts`  
3. Public form API `date_unavailable` copy — `lib/public-forms/constants.ts`

---

## Live Sandbox evidence (`c00749be`)

| Check | Result |
|---|---|
| Inquiry API excludes Christmas 2027-12-25 | PASS |
| `create_public_lead` → `date_unavailable` | PASS |
| `create_public_form_lead` → `date_unavailable` | PASS |
| No lead created on form reject | PASS |
| Open date still accepted on form path | PASS |
| Annual helper covers 2030-12-25 | PASS |
| Staff preferred_date surfaces `tour_exception` | PASS |
| SQL `tour_availability_exception_covers_date` | PASS |

Evidence: `platform-browser-results.json` (8/8 GREEN). Unit: 25/25 related suites.

---

## Remaining limitations (explicit, non-blocking for this contract)

- Staff preferred-date **soft** override remains by product design; public choose_available paths stay hard-gated.  
- Purpose public-form UI still uses `<input type="date">`; server rejects blocked dates (integrity OK). Optional calendar UX can follow.  
- Concurrent booking load tests not re-run this pass (existing assert/lock paths unchanged).
