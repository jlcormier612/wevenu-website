# Willow Grove Phase 2 — Closure Report

**Date:** 2026-11-07  
**Environment:** HTC Sandbox only (`app.sandbox.hellotocheers.com`)  
**Venue:** The Willow Grove (`31f38b79-eb99-4ebc-81bc-af85767b42aa`)  
**Authorization:** Focused closure pass — no commit / push / deploy / migrations  

**Final verdict: PARTIAL**

---

## A. Full UI-only commercial workflow results

Fresh Demo A lead (not Claire):

| Field | Value |
|---|---|
| Lead | `cdeb5727-1091-47b4-8504-b4633b2ce195` — DemoA Closure2026110772022 & Partner |
| Marker | `demo_a_commercial_rehearsal_ui` / `ui_only: true` / excluded from reporting |
| Package | Essential Wedding · $15,000 |
| Selection | `9f0be002-46d4-4d13-ae6a-c729dc1a5488` (accepted via couple offer UI) |
| Contract | `849f60de-78d8-455d-9cc2-f8296e3ac197` (signed) |
| Invoice | `7c4094e7-153b-4b7d-bdfd-cfa465d2aaba` |
| Schedule | `dfdfec1e-7205-4936-9746-2f2d1d6b238d` |
| Event | `55308248-52d6-4da3-86dd-88839c7d89fc` · `booked_at=2026-11-06` |
| Setup | Signature Wedding Setup inherited (`uses_profile=true`) |

### Step results (method = UI only)

| Step | Result | Notes |
|---|---|---|
| create_lead | OK | `/leads/new` → Save inquiry; unique DemoA name |
| schedule_tour | OK (soft) | Tour UI present; slot confirm soft |
| send_proposal | OK | Essential + Signature; status=sent |
| couple_approve | OK | Public `/offer/…` → Essential → Approve |
| create_contract | OK | `/contracts/new` → Save draft (native `confirm` accepted) |
| send_contract | OK | Review & send → Send Anyway (starter placeholders) |
| client_sign | OK | Public `/sign/…` |
| venue_countersign | OK | Authenticated staff “Sign as venue” → Fully executed |
| setup_payments | OK | Set up payments wizard → Review schedule → Create payment plan |
| share_payment_plan | OK | Invoice preview/share path |
| partial_offline_payment | OK | Recorded **$2,000 Check** on Initial Payment → `partially_paid` |
| reallocate | OK (soft) | Remaining $1,750 correctly stays on Initial Payment; no separate redistribute mutation required for a balanced plan |
| mark_booked | OK | Lead workspace **Mark as Booked** |
| signature_setup_inherit | OK | Signature Wedding Setup on event |
| canonical_preserved | OK | Claire `52173016-…` still `tour_scheduled` / `demo_a_commercial` |

Evidence JSON: `docs/qa/willow-grove-phase2-impl/closure/ui-rehearsal-results.json`  
Runner: `ui-only-rehearsal.mts` (create→approve) + `ui-resume-from-contract.mts` (contract→Booked)

---

## B. Staff and client browser screenshots

Under `docs/qa/willow-grove-phase2-impl/closure/screenshots/`:

**Staff:** `ui-01`…`ui-03` lead create; `ui-06`…`ui-09` proposal; `ui-13`…`ui-17` contract; `ui-20`…`ui-21` venue sign; `ui-22`…`ui-26` payments; `ui-27`…`ui-29` partial pay; `ui-33`…`ui-34` Booked; `ui-35` setup.

**Client:** `ui-10`…`ui-12` offer select/approve; `ui-18`…`ui-19` sign.

**Vendor:** `flora-01` dashboard; `flora-02` events; `flora-03` Hayes; `flora-04` internal notes tab.

---

## C. Exact blockers / defects encountered (during closure)

| Screen | Action | Error | Root cause | Resolution |
|---|---|---|---|---|
| `/leads` New Lead | Save | Wrong lead reused | Button is **Save inquiry**; Claire name collision | Go `/leads/new` + unique DemoA names |
| `/contracts/new` | Save draft | No persist | Native `window.confirm` dismissed by Playwright | `page.on('dialog', accept)` |
| `/contracts/:id/edit` | open | 404 | No edit route | Use `/contracts/:id` |
| Contract review | Send | No-op | `/Send to Client/i` matched **Review & send to client** | Exact name `Send to Client` + **Send Anyway** for `STARTER_POLICY_PLACEHOLDERS` |
| Set up payments | Continue only | Stuck on Build Schedule | Commit control is **Review schedule** then **Create payment plan** (below fold) | Scroll sheet + Review schedule |
| Payments record | Record | Disabled / no pay | Method required; Label not wired for getByLabel | Combobox → Check → `Record $2,000 payment` |
| Client workspace | Mark as Booked | Missing | CTA is on **lead** workspace | Navigate `/leads/:id` |

No product auth/RLS bypasses used. No RPC substitutes for workflow state.

---

## D. Flora vendor authentication — root cause + verification

**Root cause:** Session/cookie scope mismatch (demo harness), not an application defect.

- Vendor portal uses isolated jar `sb-wvpsldwwjqdannqasrdf-vendor-auth-token` via `createVendorClient()`.
- Prior Phase 2 probe set the **staff** cookie `sb-…-auth-token`, so `getVendorUser()` saw no vendor session → redirect `/vendor/login`.
- Legitimate membership exists: `lila@floraandbranch.example` → Flora & Branch owner (`vendor_users` active).

**Verification (correct vendor cookie):**

- Dashboard: Flora & Branch · partnering with The Willow Grove — OK  
- Events list shows **Olivia & James Hayes Wedding** — OK  
- Hayes event `6a413912-…`: assignment, arrival, load-in, tasks — OK  
- Venue-private notes: Internal notes tab present; no staff-private leak — OK  
- Venue couple financials (Essential/Signature totals): not exposed — OK  
- Vendor-own “Venue cost for this event $4,800” visible (intentional vendor coordination amount) — OK  

Evidence: `flora-auth-verification.json`, `flora-hayes-verification.json`, `flora-*.png`

**No code fix required** for Flora auth.

---

## E. Financial labeling changes + reconciliation tests

### Investigation
Prior discrepancy = comparing before-tax package to tax-inclusive plan language. WG wedding prefs are tax-off for this demo path. Sandbox payment plan after $2,000 record correctly shows **$2,000 paid · $13,000 remaining** (not deposit allocation as paid).

### Code changes (local — not deployed)
1. `lib/booking-journey/commercial-facts.ts` — Package subtotal / Tax not applied|Tax % / Total amount due / Deposit allocation (scheduled — not marked paid) / Plan total / Amount paid / Remaining balance  
2. `lib/booking-journey/model.ts` — Ready-stage direction no longer labels `selection.depositAmount` as “paid”; uses **recorded** payment line amounts; unpaid → “Deposit $X scheduled — not paid until a payment is recorded”  
3. `components/booking-journey/booking-journey-panel.tsx` — matching labels  
4. Tests: tax-free + tax-inclusive package facts; ready-stage never invents paid from schedule alone  

**Tests:** `npx tsx --test lib/booking-journey/model.test.ts lib/booking-journey/commercial-facts.test.ts lib/payments/offline-recording.test.ts` → **67 pass / 0 fail**

No calculation/allocation logic changed.

---

## F. Stripe Connect — Sandbox test-mode status

**Classification:** `outstanding_demo_dependency_external_auth` (not a product failure)

| Check | Result |
|---|---|
| Willow Grove `stripe_account_id` | `null` |
| `stripe_onboarding_status` | `not_started` |
| `stripe_charges_enabled` | false |
| Local env `STRIPE_CLIENT_ID` / secret | absent |
| Supported path | Settings → Integrations → Connect with Stripe (OAuth test mode) |
| Boundary | Requires interactive Stripe Connect OAuth to an authorized **test** Stripe account |

**No fabricated connected status. No live keys/cards. No checkout attempted.**

Evidence: `stripe-status.json`

Deferral decision for demo: external authorization required before a single test checkout can be verified.

---

## G. Canonical demo preservation + replay readiness

| Asset | Status |
|---|---|
| Claire & Noah `52173016-…` | Preserved — `tour_scheduled`, `demo_marker=demo_a_commercial` |
| Hayes planning/portal/financials | Untouched except Flora read-only verify |
| Jen's Fancy Venue | Untouched |
| Willow Grove automations | Left paused (no unpause) |
| External email/SMS / real payments | None |
| Closure rehearsal lead | Marked `ui_only` / reporting-excluded; Booked with Signature inherit — suitable as completed rehearsal artifact |

Replay: start from Claire start-state; use `ui-only-rehearsal.mts` for a new DemoA lead (do not reuse Claire).

---

## H. Files changed + Git status

**Not committed** (per authorization).

### Product code (label clarity)
- `lib/booking-journey/model.ts`
- `lib/booking-journey/model.test.ts`
- `lib/booking-journey/commercial-facts.ts`
- `lib/booking-journey/commercial-facts.test.ts`
- `components/booking-journey/booking-journey-panel.tsx`

### Closure evidence / runners (untracked)
- `docs/qa/willow-grove-phase2-impl/closure/**` (scripts, screenshots, JSON, this report)

### Pre-existing dirty (preserved, not part of this closure commit scope)
- `app/(app)/leads/[id]/actions.ts`
- `components/leads/tour-panel.tsx`
- other unrelated docs/design noise

Branch: `feat/spaces-booking-e1-smart-fields` (ahead/dirty as before)

---

## I. Remaining issues

1. **Stripe Connect test onboarding** — external auth dependency; blocks online checkout demo only.  
2. **Financial direction label fix undeployed** — Sandbox still runs prior build until approved deploy; unit tests green locally.  
3. **Tour scheduling** — soft OK (UI present; calendar slot confirm not hard-proven).  
4. **Reallocate** — after partial pay, product correctly leaves remainder on the same installment; no separate redistribute control was required for a still-balanced $15k plan.  
5. **Starter policy placeholders** — Send Anyway required (blank event spaces); not a blocker once acknowledged in UI.  
6. **Prior RPC rehearsal lead** `81f3b1bc-…` — left in place; not used for GREEN path.

---

## J. Final verdict

### PARTIAL

| Area | Status |
|---|---|
| UI-only commercial rehearsal (create→Booked→Signature inherit) | **Complete** (UI only; evidence above) |
| Flora vendor access | **Verified** (cookie-scope root cause; Hayes + privacy OK) |
| Financial labeling | **Code + tests ready**; **not deployed** to Sandbox |
| Stripe test checkout | **Deferred** — outstanding demo dependency (external OAuth) |
| Canonical Claire start state | **Preserved** |

Stripe deferral is reported separately and does **not** by itself force BLOCKED. Verdict is PARTIAL because financial label fixes are local-only pending deploy approval, and tour/reallocate were soft. Vendor access is verified; required UI actions were not RPC-bypassed.
