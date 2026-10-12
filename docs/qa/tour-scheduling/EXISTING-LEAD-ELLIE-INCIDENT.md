# P0 — Ellie cannot book a tour from existing-lead link

**Status:** GREEN on Sandbox  
**Commit:** `553c8687dd19e1d5196c94fe07b9957cecabec70`  
**Deployed tip:** `553c8687dd19e1d5196c94fe07b9957cecabec70` (matches commit)  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38194762576  
**Preserved ancestors:** `8e4f911e` (blocked-date), `45290d6a` (existing-lead preferred-date)  
**Production:** untouched  
**Observed:** 2026-10-12T02:18:27Z  
**Ellie live lead:** read-only; unchanged (`outreach_sent`, `2027-09-04`, holds active, 0 appointments)

---

## Exact customer failure

1. Staff send Ellie `/book/{tour_embed_key}?o={originToken}`.
2. Server resolves existing-lead context and shows preferred date **2027-09-04** (held).
3. That held date was **seeded into mutable `eventDate` state**.
4. ModeSelector still offered **Request Information**.
5. Switching to Request Information submitted `/api/public/inquire` with `eventDate=2027-09-04`.
6. Server correctly rejected: **“That date is no longer available. Please choose another date.”**

Pre-fix repro on tip `c00749be`:

- Mode flip → inquire failure: `mode-flip-inquire.png`, `mode-flip-browser.json`
- Correct Confirm Tour already attached successfully: `ellie-confirm-browser.json` (proved server attach was fine)

## Why prior GREEN missed it

| Prior check | Gap |
|---|---|
| Browser script booked via **API** with `eventDate: ""` | Never exercised UI Confirm Tour payload |
| UI never asserted ModeSelector lock | Request Information remained reachable with held date seeded |
| Mis-click `/Schedule\|Book\|Submit\|Request/i`.last() | Clicked **Request Information**, not Confirm Tour |

## Root cause (first divergence)

**UI:** `InquiryForm` seeded `existingLeadTour.preferredEventDate` into `eventDate` and left ModeSelector enabled on existing-lead tour links. Request Information then treated that held date as a new-inquiry preferred date.

Server attach (`book_public_tour_for_lead` + valid `o=`) was already correct.

## Fix (`553c8687`)

| Change | Behavior |
|---|---|
| Lock existing-lead `?o=` links to `schedule_tour` | Hide ModeSelector; no Request Information |
| Do not seed held preferred date into `eventDate` | Display-only via read-only block |
| Existing-lead tour submit sends `eventDate: ""` | Attach uses lead’s authoritative date server-side |
| Seed `guestCount` from lead | Meadowbrook-required field does not block |

## CRM `HTC_CRM_VERSION_CONFLICT`

- Tour book attach and public inquire do **not** call `htc_crm_replace_store`.
- Conflict (`expected 6611, actual 6783`) is staff CRM optimistic concurrency.
- **Conclusion:** unrelated to Ellie’s tour failure; no CRM rewrite.

## Verification on tip `553c8687`

| Check | Result |
|---|---|
| Unit (existing-lead + blocked-date) | **14/14** |
| Browser regression | **27/27 GREEN** (`browser-results.json`) |
| Mode toggle hidden | PASS |
| Guest count seeded | PASS |
| UI Confirm Tour success | PASS (`eventDate=""`) |
| Attached existing lead | PASS |
| Held date rejected for new create | PASS |
| Event date / hold unchanged | PASS |
| No duplicate lead/event | PASS |
| Invalid token / unavailable slot / cross-venue | PASS |
| New inquiry blocked Christmas | PASS |
| Ellie live record mutated | **No** |

Commands:

```bash
npx tsx --test lib/tours/existing-lead-tour-context.test.ts lib/availability/inquiry-tour-blocked-dates.test.ts
npx tsx scripts/qa/existing-lead-tour-preferred-date-browser.mts
```

## Remaining limitations

- Generic `/book/{key}` (no `o=`) still shows ModeSelector; held dates cannot be selected via availability calendar (`8e4f911e`).
- Staff CRM version conflicts remain a separate reliability topic (see `docs/qa/supabase-egress-quota-audit/`).
