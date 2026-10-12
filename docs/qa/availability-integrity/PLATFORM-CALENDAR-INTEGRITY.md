# Platform-wide calendar & availability integrity

**Priority:** P0 venue operating integrity  
**Status:** engineering closure in progress → verify on Sandbox after migration + deploy  
**Production:** untouched  
**Preserved:** blocked-date fix `8e4f911e` / `20261415000000`; existing-lead tour `45290d6a`

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

**Modes:** `inquiry_event_date_mode = choose_available` → hard gate via `_is_event_date_available`. `request_preferred` → no public availability calendar gate (unchanged product rule). Staff preferred-date UI remains a **soft** warning with “Save anyway” (does not reserve the date).

### Core invariants (this pass)

1. Blocked event dates cannot be newly submitted on public inquiry **or** purpose-specific public forms when `choose_available`.  
2. Client cannot bypass via crafted RPC — server revalidates.  
3. Existing-lead tour does not reselect / overwrite preferred date or hold (`45290d6a`).  
4. Staff preferred-date precheck surfaces tour Blocked Dates (including annual).  
5. Venue isolation via venue_id on all rows / RPCs.

---

## Path matrix

| Entry | Handler | Canonical validation | Mutation | Status |
|---|---|---|---|---|
| Public inquiry form | `/api/public/inquire` → `create_public_lead` | `_is_event_date_available` | `ingest_lead` | **GREEN** (`8e4f911e`) |
| Inquiry dates API | `/api/public/inquiry-available-dates` | `get_available_event_dates` | none | **GREEN** |
| Purpose public form | `/api/public/forms/submit` → `create_public_form_lead` | `_is_event_date_available` (new) | `ingest_lead` | **FIXED** this pass |
| Existing-lead `/book/{key}?o=` | InquiryForm schedule_tour | Tour slots; lead date read-only | `book_public_tour_for_lead` | **GREEN** (`45290d6a`) |
| Generic `/book/{key}` | same, no lead context | Tour slots | ingest or attach | **GREEN** (no PII leak) |
| Staff New Lead preferred date | `checkAvailability(preferred_date)` | calendar_blocks + holds + **tour exceptions** | `createLead` soft override | **FIXED** warning path |
| Staff booking / events | assert + occupancy | SQL write authority | events | Existing; not weakened |
| Calendar UI projection | `projectTourAvailabilityExceptions` | display only | none | Existing annual |

---

## Defects closed this pass

1. **`create_public_form_lead`** lacked `_is_event_date_available` — migration `20261415100000_public_form_lead_honors_event_date_availability.sql`.  
2. **Staff preferred_date precheck** ignored tour Blocked Dates / annual recurrence — `lib/availability/repository.ts` + `precheck.ts`.  
3. Public form API error map lacked `date_unavailable` — `lib/public-forms/constants.ts`.

---

## Tests

- `lib/availability/platform-integrity.test.ts`  
- Prior: inquiry blocked-dates, lead-date-availability, existing-lead tour (25/25 combined)  
- Live: `scripts/qa/platform-availability-integrity.mts` → `platform-browser-results.json`

---

## Evidence (fill after migrate + deploy)

| Item | Value |
|---|---|
| Migration apply | _pending_ |
| Deployed tip | _pending_ |
| Live QA verdict | _pending_ |
| `8e4f911e` / `45290d6a` ancestry | must remain |

---

## Remaining (explicit)

- Staff preferred-date remains **soft** override by product design (“Save lead anyway”) — warning now includes tour Blocked Dates; SQL still gates public choose_available paths.  
- Public-form UI still uses a raw `<input type="date">` (server rejects blocked dates); optional UX to mirror inquiry calendar is not required for integrity if RPC rejects.  
- Do not declare platform GREEN until live Sandbox migration + tip verification complete.
