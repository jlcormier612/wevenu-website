# RCJ Human-Facing Cleanup Workstream — Forensic + Product Model

**Status:** IMPLEMENTATION_COMPLETE_PENDING_SANDBOX — NOT GREEN  
**Production:** untouched  
**Produced:** 2026-09-23

## Locked principles (from brief)

1. Venue setup choices determine which concepts appear in the human-facing product.
2. Payment access ≠ portal access.
3. Invoice number (system) ≠ invoice name (human).
4. Phone ≠ SMS consent; texting configured ≠ consent.
5. Physical space ≠ space use.
6. Venue decides Booked — payment is not universally Booked.
7. GREEN only after code + DB + exact Sandbox runtime + browser + RCJ outcomes.

---

## PART 1 — Date/time

**Root cause:** human surfaces rendered machine 24h `tourTime` (`16:30`).

**Fix:** `formatVenueLocalClock` / `formatVenueLocalShortDate` in `lib/venue/timezone.ts`; call sites updated (relationship card, upcoming tours, decision-engine, tour reminders, merge-context). Regression tests assert no raw `16:30` in ordinary UI.

---

## PART 2–6 — Payment vs portal

**Fix:** deposit email creates/reuses `financial` portal sessions when no `couple` invite exists. `/p/{token}` routes financial → `PaymentAccessShell` (pay-only, no workspace nav). Confirmation explains booking setup / invitation forthcoming. Same invoice/line SoT. Payment ≠ Booked.

---

## PART 7–11 — Invoice name

**Schema:** `invoices.display_name` (migration `20261405900000_…`). `invoice_number` immutable. Venue can edit name. Email/payment page/list/detail use human label; system number shown as reference.

---

## PART 12–15 — SMS consent

**Decision:** refuse unsolicited SMS consent solicitation (`requestSmsConsentForLead` fails closed). UI shows accurate not-opted-in states. Email solicitation **OPEN** — no legal basis affirmed; do not invent.

---

## PART 16–26 — Spaces

**Schema:** `venue_spaces.permitted_uses`, `venues.space_operating_mode`, `event_space_assignments`. Contract merge prefers assignments. Calendar space filter only when `multi`. Setup UI: single vs multi + permitted uses when multi.

**OPEN (post-Sandbox if needed):** dedicated event-form use→space assignment editor beyond schema + contract backfill; package eligibility already uses `eligible_space_ids` → `venue_spaces`.

---

## OPEN (do not invent)

- Legal basis for venue-initiated **email** SMS-consent solicitation.
- Full event-assignment UI for multi-use (schema + contract path shipped; editor polish may remain).

## Verification gate

Do not mark GREEN until Sandbox migration + deploy + browser/DB/provider E2E prove the journeys.
