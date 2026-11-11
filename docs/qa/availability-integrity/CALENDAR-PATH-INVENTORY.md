# Calendar & availability — path inventory (Sandbox audit)

**Observation (UTC):** 2026-10-12T02:58Z  
**Deployed tip:** `0122911f32c20b33ea99321d1df4ad7306cea3ce`  
**Ancestors verified:** `8e4f911e`, `45290d6a`, `c00749be`, `553c8687` ⊂ tip  
**Production:** untouched

This inventory traces authoritative checks. It does **not** declare the whole calendar platform GREEN. Known held-date tour + staff link guidance are verified on tip; broader concurrency/contract edges remain noted below.

## Concepts (verified distinct in code/docs)

| Concept | Occupies date? | How created |
|---|---|---|
| Preferred event date | **No** (preference only) | Inquiry / lead edit |
| Date Hold | **Yes** (temporary) | Explicit venue hold action |
| Reserved / blocked (tour exceptions) | **Yes** (venue-wide) | Availability settings |
| Event | **Yes** | Booking / Direct Add / contract flows |
| Tour appointment | Separate time slot | Staff schedule or public `/book` |

## Public paths

| Path | UI | Server authority | Notes |
|---|---|---|---|
| `/form/{embedKey}` inquire | Preferred date calendar (`choose_available`) | `create_public_lead` → `_is_event_date_available` | Blocked/held unavailable; `8e4f911e` |
| `/book/{key}` generic tour | Mode toggle; preferred optional after this pass | `book_tour` / email attach / `book_public_tour_for_lead` | Held date not selectable; tour no longer requires preferred date |
| `/book/{key}?o=` existing-lead | Locked schedule_tour; read-only preferred | HMAC `o=` → attach only | `45290d6a` + `553c8687` |
| Public form variants | Config-driven fields | `create_public_form_lead` gates choose_available (`c00749be`) | |

## Staff / venue paths

| Path | Authority / notes |
|---|---|
| Calendar share tour link | Generic `publicTourSchedulingPath` — **guidance added** |
| Lead Copy scheduling link | `publicTourSchedulingPathForLead` + HMAC |
| Staff preferred-date edit | Precheck + annual tour exceptions (`c00749be`) |
| Hold create/release | Explicit hold APIs; not auto from preferred date |
| Blocked dates / annual | `tour_availability_exceptions` + SQL helpers |
| Event create / reschedule | Booking conflict checks; not re-audited byte-for-byte this pass |
| Contract/payment occupancy | Prior platform integrity notes; no new defect proven this pass |

## Known defect closed this pass

**Root cause:** Generic Calendar tour link + venue `preferred_event_date: required` + `choose_available` treated the prospect’s **own hold** as an unselectable preferred date, blocking Confirm Tour in the UI. Server attach-by-email already succeeded if the client could submit.

**Fix:** (1) Prefer lead **Copy scheduling link** (staff guidance). (2) Prefer `?o=` existing-lead UX. (3) Make preferred event date **optional** on `schedule_tour` so generic links can complete a tour without selecting a held date. Request Information still enforces required preferred dates. Other prospects still cannot claim the held date (`date_unavailable`).

## Gaps / not fully re-proven this pass

- Concurrent double-book race under load (constraints believed present; not load-tested here).
- Every contract/payment occupancy edge case (see prior `PLATFORM-CALENDAR-INTEGRITY.md`).
- DST/leap exhaustive matrix (existing helpers; not expanded).
- Current-cycle Supabase Usage GB (unrelated owner gap).

## Regression commands

```bash
npx tsx --test lib/tours/existing-lead-tour-context.test.ts lib/tours/public-link.test.ts \
  lib/availability/inquiry-tour-blocked-dates.test.ts lib/availability/platform-integrity.test.ts
npx tsx scripts/qa/existing-lead-tour-preferred-date-browser.mts
npx tsx scripts/qa/generic-tour-held-date-browser.mts
```
