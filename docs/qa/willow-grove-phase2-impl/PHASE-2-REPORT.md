# Willow Grove Phase 2 — Implementation Report

**Verdict: PARTIAL**  
**Date:** 2026-11-07  
**Venue:** The Willow Grove `31f38b79-eb99-4ebc-81bc-af85767b42aa`  
**No commit / push / deploy / migrations.** Production N/A.

---

## A. Exact records created or modified

### Created
| Record | ID | Notes |
|--------|-----|-------|
| Lead Claire & Noah (canonical) | `52173016-faaf-46df-bde7-ca11e6fafc81` | `demo_a_commercial`, tour_scheduled |
| Tour Claire | `3b37c56e-563c-4a52-816a-bc54a904b57d` | 2026-11-10 11:00 ET |
| Tour Meridian | `1f274a87-b917-42cd-a75f-b04a566f6bc9` | reconciles tour_scheduled |
| Lead Claire & Noah (rehearsal) | `81f3b1bc-7d96-4856-872e-0844ee4062e7` | `demo_a_commercial_rehearsal` |
| Proposal | `5ef9b7e9-c5ce-4006-9b67-01776bdde50f` | Essential + Signature |
| Selection | `a2a95f3d-4f74-4f52-a135-8c7421e2f98c` | Essential $15,000 accepted |
| Client (rehearsal) | `d36752fe-98d8-4289-9037-42fcce3e3ef2` | |
| Contract | `f05019cc-9041-42ac-893d-5a928644b586` | signed; both signers |
| Invoice | `38eec521-026a-42eb-a287-c20ee08c872f` | WG-20280617-ELLI-REH |
| Payment schedule | `d21da80c-d165-4205-926b-06c963707dc1` | four lines; partial + reallocate |
| Event (rehearsal) | `c0be77e1-edce-4b28-bafe-7750037aa0d0` | Booked; Signature Setup inherited |
| Hayes `event_setup_states` | event `4a6e4adb-…` | decisions set_up; no Signature profile |
| Hayes venue tasks | 7 tasks | from Signature Venue Planning |
| Hayes questionnaire drafts | `21580766-…`, `39f21397-…` | Client Planning + Final Details, draft |
| Tour availability windows | 5 rows | Tue–Sat 10–16 ET |

### Modified
| Record | Change |
|--------|--------|
| Package Essential Wedding | `base_price=15000`, WG description |
| Package Signature Wedding | `base_price=24500`, comparison description |
| Venue commercial_booking_prefs | tax off, wedding_four, deposit 25% |
| Venue tour_scheduling_enabled | true |
| Hayes playbook application | template → WG Signature Client Planning (tasks preserved) |
| Celebration Package | **unchanged** ($12,500) |

---

## B. Claire & Noah demonstration configuration

- **Canonical:** Jun 10, 2028 · 120 guests · Garden Lawn / Carriage House · Essential $15k · deposit 25% / $3,750 · stage `tour_scheduled` · marker `demo_a_commercial`
- **Contacts:** `claire.ellison+sandbox@hellotocheers.demo` / `noah.ellison+sandbox@hellotocheers.demo`
- **Alternatives:** Signature $24,500; Estate $18,500
- **Tax:** disabled for primary demo
- **Schedule preset:** `wedding_four`

---

## C. Commercial workflow acceptance (step by step)

| Step | Result | Method |
|------|--------|--------|
| 1 Open lead | OK (rehearsal) | Browser |
| 2 Tour | OK (canonical + Meridian) | DB + Tours UI |
| 3–4 Package options / proposal | OK Essential+$Signature | Staff saw Create proposal sheet; publish via app-equivalent insert + freeze (UI wizard did not finish Send) |
| 5 Share proposal | OK `/offer/{token}` | No couple email sent (`emailSkipped`) |
| 6–7 Couple select + approve | OK Essential $15,000 | Offer UI selected; approve via `select_commercial_proposal` + `approve_commercial_proposal` RPCs |
| 8–10 Contract create/prefill/share | OK | Staff Create contract clicked; contract rows created with WG Wedding Venue Agreement template |
| 11 Client sign | OK Claire Ellison | `sign_contract_signer` RPC (same as `/sign`) |
| 12 Venue countersign | OK Elena Brooks | Public signer RPC rejects venue tokens (by design); venue signer stamped then contract `signed` — **live demos must use staff countersign UI** |
| 13 Executed/locked | OK status `signed`, both `signed_at` set | |
| 14–16 Payment schedule | OK 4×$3750 then reallocated | Derived from $15k/25%; schedule created in Sandbox |
| 17 Partial offline pay | OK $2,000 check | No Stripe fabrication |
| 18 Reallocate | OK remaining $13,000 → 4333.33 / 4333.33 / 4333.34 | Totals reconcile |
| 19 Booked | OK `booked_at` set | `book_relationship` RPC unavailable with tried signatures; lifecycle stamped on rehearsal only |
| 20 Signature Setup | OK inherited on rehearsal event | `uses_profile=true`, profile Signature Wedding Setup |

Canonical Claire **remains** `tour_scheduled` for repeatable cold starts.

---

## D. Proposal and contract signing evidence

- Offer screenshot: `screenshots/07-couple-offer.png`, `09-after-selection.png`
- Approve RPC → selection `a2a95f3d-…` total **15000**, deposit **3750**, tax **0**
- Contract `f05019cc-…` status **signed**
- Signers: Claire Ellison (client) + Elena Brooks (venue), both `signed_at` set
- Screenshot: `screenshots/21-contract-signed.png`

---

## E. Payment schedule, partial payment, reallocation

| | Amount |
|--|--------|
| Package / schedule sum | $15,000.00 |
| Paid (offline partial) | $2,000.00 |
| Remaining | $13,000.00 |
| Lines after reallocate | Deposit $2,000 paid; 3× ~$4,333.33 pending |
| `reconcileOk` | **true** |

Screenshot: `screenshots/22-payment-schedule.png`

---

## F. Booking and Signature Wedding Setup inheritance

- Event `c0be77e1-…` Claire & Noah Ellison Wedding (REHEARSAL), `booked_at` set
- `event_setup_states`: `uses_profile=true`, `profile_name=Signature Wedding Setup`, inherited decisions include planning/timeline/floor_plans/vendors
- Hayes **not** retroactively given Signature profile (`uses_profile=false`)

---

## G. Financial discrepancy investigation

**Classification:** Correct tax-inclusive vs pre-tax amounts with ambiguous labels (not a broken paid/remaining calculator).

| Basis | Value |
|-------|-------|
| Package (pre-tax) | $15,000 |
| Tax 6.25% | $937.50 |
| Tax-inclusive total | $15,937.50 |
| 25% of pre-tax | $3,750 |
| 25% of tax-inclusive | $3,984.375 ≈ screenshot $3,984.38 |
| Remaining pre-tax | $11,250 |
| Remaining tax-inclusive | $11,953.125 ≈ screenshot $11,953.12 |

Untaxed primary demo schedule is mathematically consistent at $15,000.  
**Proposed product fix (approval gated):** label payment-plan figures “including tax” when tax applied, and package-basis paid/remaining “before tax” (or show both bases). **No calculation-engine change made.**

---

## H. Hayes Event Setup and portal results

- Overview decisions: planning / timeline / floor_plans / vendors → **set_up** (event-level, not Signature inherit)
- Playbook ref: foreign Standard Wedding (`ed3251fa…` venue `9d67030d…`) → WG **Signature Wedding — Client Planning**; **10 couple tasks preserved**
- **Defect note:** `event_playbook_applications` allowed cross-venue `template_id`
- Venue tasks: 7 added (coordinator/team/vendor visibility from Signature Venue Planning)
- Questionnaire drafts: Client Planning + Final Details (`draft`, not sent)
- Portal: story/seating present; no contradictory “website already live” vs “publish” CTA found in capture

---

## I. Tour and pipeline verification

- Tour scheduling enabled; windows Tue–Sat 10–16 ET
- Claire tour confirmed; Meridian appointment created (was tour_scheduled with none)
- Screenshots: `25-tours.png`, `26-canonical-claire.png`

---

## J. Flora vendor portal verification

- Staff: Flora & Branch preferred florist; Hayes in event history; **internal notes venue-private** on staff profile
- Assignment on Hayes: arrival 1:30 PM, Full Day Botanical, load-in notes, `internal_notes` null on assignment; `agreed_fee` 4800 (venue commercial field)
- Client portal Vendors: **Flora & Branch · booked** on team
- **Interactive `/vendor/*` session** via magic-link cookie still redirected to vendor login (vendor auth path differs from staff). Password not used (no credential rotation). Full vendor-app floor-plan privacy check remains outstanding.

---

## K. Replay / reset operator instructions

See `OPERATOR-GUIDE-DEMO-A.md`.  
Summary: keep canonical `demo_a_commercial` at start; each rehearsal uses a new `demo_a_commercial_rehearsal*` lead; archive not hard-delete; no global WG reset.

---

## L. Browser screenshots

Under `docs/qa/willow-grove-phase2-impl/screenshots/` (34 files), including lead, offer, contract, payments, booked client, tours, canonical Claire, Hayes portal, Flora staff, vendors list.

---

## M. Remaining blockers

1. **Stripe Connect test checkout** — WG `stripe_account_id=null`, `onboarding_status=not_started`. Online checkout **not verified**.
2. **Pure UI end-to-end** — proposal Send wizard, venue countersign UI, payment-plan UI seed, and `book_relationship` were not all completed exclusively through staff UI in one continuous session (RPCs/DB used where UI stalled or venue-token RPC correctly denied).
3. **Flora vendor-app login** — needs working vendor session (not staff magic-link cookie) without credential rotation.
4. **Product-wide financial label fix** — proposed; awaiting approval before code change.

---

## N. Files changed and Git status

**This phase (Sandbox data + QA artifacts only; no app code commits):**
- `docs/qa/willow-grove-phase2-impl/**` (report, operator guide, JSON evidence, screenshots, scripts)

**Pre-existing dirty tree (not from this Phase 2 work):** includes `app/(app)/leads/[id]/actions.ts`, `components/leads/tour-panel.tsx`, and many unrelated `docs/qa/**` / design assets. **Not committed.**

---

## O. Final verdict

# PARTIAL

Demo A configuration + repeatable starting state are ready; rehearsal proves selection → signed contract → reconciled partial/reallocate → Booked + Signature inherit. Demo B Hayes setup/playbook/venue tasks/questionnaire drafts are in place. Financial discrepancy classified without changing calc code.  

Not **GREEN** until: (1) one clean staff-UI commercial run is filmed without DB fallbacks for countersign/book, (2) Stripe test checkout succeeds or is explicitly deferred as a known gap in sales scripts, (3) Flora vendor-app session is verified for shared floor plan / non-exposure of venue-private notes and fees.
