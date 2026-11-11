# Willow Grove Demo A — Operator Guide (Claire & Noah commercial journey)

## Purpose

Demonstrate HTC’s continuous proposal → selection → contract → payment plan → partial pay / reallocate → Booked workflow on **The Willow Grove** Sandbox venue.

## Identities

| Role | Record | Marker | Purpose |
|------|--------|--------|---------|
| **Canonical start** | Claire & Noah Ellison lead `52173016-faaf-46df-bde7-ca11e6fafc81` | `source_data.demo_marker = demo_a_commercial` | Live sales demo starting state (tour scheduled, no accepted proposal) |
| **Rehearsal / acceptance** | Claire & Noah Ellison lead `81f3b1bc-7d96-4856-872e-0844ee4062e7` (+ client/event) | `demo_a_commercial_rehearsal` | Completed journey for verification; not the starting-state demo |
| **Mature planning** | Olivia & James Hayes | (existing) | Demo B — do not use for commercial booking walkthrough |

Venue ID: `31f38b79-eb99-4ebc-81bc-af85767b42aa`  
App: `https://app.sandbox.hellotocheers.com`  
Staff: `jennifer@hellotocheers.com` (active venue = The Willow Grove)

## Safeguards (every run)

- Automations remain paused / disabled.
- Use `*.hellotocheers.demo` emails only; do not send SMS or live Stripe charges.
- Do not change Jen’s Fancy Venue or other venues.
- Do not delete executed contracts or payment history casually.
- Do not run a global Willow Grove reset.

## Configuration already in place

- Essential Wedding = **$15,000**; Signature Wedding = **$24,500** (comparison option); Celebration Package unchanged.
- Commercial prefs: **tax off**, deposit **25%**, schedule preset **`wedding_four`**.
- Tour scheduling enabled (Tue–Sat 10:00–16:00 ET).
- Canonical Claire tour confirmed; Meridian Partners tour reconciled.

## How to run a live sales demonstration (canonical Claire)

1. Open **Leads → Claire Ellison** (`/leads/52173016-faaf-46df-bde7-ca11e6fafc81`).
2. Show tour on **Tours** and lead tour panel.
3. **Create proposal** → select Essential + Signature (and/or Estate) → Preview → **Send** (prefer copy-link if avoiding email; demo addresses only).
4. Open `/offer/{token}` as the couple → select **Essential Wedding** → **Approve my selection**.
5. From the lead commercial workspace → **Create contract** → review prefills on `/contracts/new` → **Save draft** (confirm the native “Save a draft contract…” dialog) → open draft at `/contracts/{id}` (there is **no** `/edit` route) → **Review & send to client** → **Send to Client** (use **Send Anyway** only if starter placeholders remain) → client signs at `/sign/{token}` → venue **Sign as venue** in staff UI.
6. **Set up payments** → Continue → build schedule → **Review schedule** → **Create payment plan** (four payments from $15,000 / 25%).
7. Record **offline partial** payment (Cash is the default method; Check/ACH/Other also supported). Method is required.
8. Adjust remaining installments if the schedule needs reshaping after a partial (edit pending lines / regenerate when totals drift). A balanced plan may correctly leave remainder on the same installment.
9. **Mark as Booked** from the **lead** workspace top button **or** change stage to Booked → confirm Signature Wedding Setup inheritance on the new event.
10. Stop. Do **not** reuse this same lead for the next prospect demo once Booked.

### Automation / QA navigation notes (not product defects)

- New lead save control label: **Save inquiry**.
- Contract draft lives at `/contracts/{id}` after save — never invent `/contracts/{id}/edit`.
- Do not match “Send to Client” with a loose regex that also hits **Review & send to client**.
- Payment wizard includes an intentional **Review schedule** step before create.
- Details: `closure/UI-AUTOMATION-DIFFICULTIES.md`.

## How to repeat (replay strategy)

**Preferred:** create a fresh rehearsal lead for each practice run.

1. Duplicate the canonical Claire pattern:
   - Same couple names optional, or “Claire & Noah Ellison (Demo YYYY-MM-DD)”.
   - `source_data.demo_marker = demo_a_commercial_rehearsal` (or `demo_a_commercial_rehearsal_<date>`).
   - Distinct `event_date` if the prior rehearsal already booked that date.
   - `exclude_from_business_reporting = true`.
2. Run the live workflow on that lead only.
3. After the meeting, leave the rehearsal as historical evidence **or** archive the lead (do not mass-delete contracts/payments).
4. Keep **canonical** `demo_a_commercial` at **tour_scheduled** for the next cold start. If it was advanced by mistake, create a new canonical start lead with the same marker and retire the old one by archiving (not hard-deleting financials).

**Do not** execute destructive cleanup without explicit approval.

## Online Stripe checkout (outstanding)

Willow Grove `stripe_account_id` is null / `stripe_onboarding_status = not_started`.  
Online client checkout is **not** verified. Complete Connect in **test mode**, then use card `4242…` before claiming online payment works. Offline/partial payment is the supported Phase 2 path.

## Quick IDs (Phase 2 acceptance rehearsal)

- Lead: `81f3b1bc-7d96-4856-872e-0844ee4062e7`
- Selection: `a2a95f3d-4f74-4f52-a135-8c7421e2f98c`
- Contract: `f05019cc-9041-42ac-893d-5a928644b586`
- Invoice: `38eec521-026a-42eb-a287-c20ee08c872f`
- Schedule: `d21da80c-d165-4205-926b-06c963707dc1`
- Event: `c0be77e1-edce-4b28-bafe-7750037aa0d0` (Signature Wedding Setup inherited)
