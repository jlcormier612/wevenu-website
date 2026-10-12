# P0 — Ellie cannot book a tour from existing-lead link

**Status:** FIX IMPLEMENTED — awaiting Sandbox deploy + tip verification  
**Sandbox tip at investigation start:** `c00749be9f39026029256e43c408ab9789bea7c1`  
**Preserved ancestors:** `8e4f911e` (blocked-date), `45290d6a` (existing-lead preferred-date)  
**Production:** untouched  
**Ellie live lead:** inspected read-only only (`8d61d740-…`, Meadowbrook, `2027-09-04` holds active, stage `outreach_sent`)

---

## Exact customer failure

1. Staff send Ellie `/book/{tour_embed_key}?o={originToken}`.
2. Server resolves existing-lead context and shows preferred date **2027-09-04** (held).
3. That held date was **seeded into mutable `eventDate` state**.
4. ModeSelector still offered **Request Information**.
5. Switching to Request Information (or any automation that clicks a button matching `/Request/i`) submitted `/api/public/inquire` with `eventDate=2027-09-04`.
6. Server correctly rejected: **“That date is no longer available. Please choose another date.”**

Reproduced on tip `c00749be` with disposable ModeFlip fixture:

- `docs/qa/tour-scheduling/mode-flip-inquire.png`
- `docs/qa/tour-scheduling/mode-flip-browser.json`

Direct Confirm Tour (correct button) **already succeeded** on the same tip with held preferred date + attach (`attachedExistingLead=true`, hold/event date unchanged). See `ellie-confirm-browser.json`.

## Why prior GREEN missed it

| Prior check | Gap |
|---|---|
| Browser script booked via **API** with `eventDate: ""` | Never exercised UI Confirm Tour payload |
| UI never asserted ModeSelector lock | Request Information remained reachable with held date seeded |
| Playwright mis-click used `/Schedule\|Book\|Submit\|Request/i`.last() | Clicked **Request Information**, not Confirm Tour — false “UI failure” |

## Root cause (first divergence)

**UI:** `InquiryForm` seeded `existingLeadTour.preferredEventDate` into `eventDate` and left ModeSelector enabled on existing-lead tour links. Request Information then treated that held date as a new-inquiry preferred date.

Server attach path was already correct when Confirm Tour + valid `o=` ran.

## Fix

| Change | Behavior |
|---|---|
| Lock existing-lead `?o=` links to `schedule_tour` | Hide ModeSelector; no Request Information |
| Do not seed held preferred date into `eventDate` | Display-only via read-only block |
| Existing-lead tour submit sends `eventDate: ""` | Attach uses lead’s authoritative date server-side |
| Seed `guestCount` from lead | Meadowbrook-required field does not block Ellie |

## CRM `HTC_CRM_VERSION_CONFLICT`

- Tour book attach (`book_public_tour_for_lead`) and public inquire do **not** call `htc_crm_replace_store`.
- Conflict (`expected 6611, actual 6783`) is staff CRM optimistic concurrency, not the customer tour submit path.
- **Conclusion:** unrelated to Ellie’s tour failure; no CRM rewrite in this incident.

## Tests

- Unit: `lib/tours/existing-lead-tour-context.test.ts` + blocked-date suite → **14/14**
- Browser: `scripts/qa/existing-lead-tour-preferred-date-browser.mts` (UI Confirm Tour + mode lock + held-date create reject)

## Deploy / verification

Fill after Sandbox deploy:

| Item | Value |
|---|---|
| Commit SHA | _(pending)_ |
| Deployed tip | _(pending)_ |
| UI Confirm Tour E2E | _(pending)_ |
| Persisted hold/event date | _(pending)_ |
