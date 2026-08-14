# Event Order — Controlled Release Remaining Work

**Date:** 2026-08-14  
**Repo:** `wevenu-website`  
**Sources of truth:**
- `docs/event-order-production-readiness-audit.md`
- `docs/event-order-product-readiness-recommendation.md`
- `docs/event-order-minimum-safe-release-implementation.md`
- `docs/event-order-enable-control-recommendation.md`
- `docs/event-order-controlled-release-verification.md`

**Scope of this pass:** Close remaining minimum-safe / controlled-release gaps only. No commit/push. No redesign/schema/architecture/financials. No global enablement.

**Evidence labels:** VERIFIED LIVE · VERIFIED FROM DATABASE · VERIFIED FROM SOURCE · UNVERIFIED

---

## 1. Already complete before this prompt

From prior MSR + controlled-release verification (re-inspected this pass, not re-derived from memory):

| Item | Status before this prompt | Evidence |
|---|---|---|
| HQ per-venue `event_order_enabled` control | Complete | VERIFIED FROM SOURCE (`EventOrderEnableSection`, `setEventOrderEnabledAction`) · prior VERIFIED LIVE |
| `$0.00` **warning** (Cancel / Continue) on Finalize + Share | Complete (warn, not block — matches approved readiness docs) | VERIFIED FROM SOURCE · prior VERIFIED LIVE |
| `venues.event_order_enabled` flag preserved; no permanent enable | Complete | VERIFIED FROM DATABASE (all 8 venues `false` at start) |
| D7A duplicate “Test Wedding Template” rows on Sweet Daisy | Already deleted in prior MSR | VERIFIED FROM DATABASE (0 D7A/test matches at start of this pass) |
| Basic automated `$0` / gate tests | Present but thin | VERIFIED FROM SOURCE (`minimum-safe-release.test.ts`) |
| Controlled-release 7-point live protocol | Already executed; verdict READY FOR CONTROLLED ROLLOUT | `docs/event-order-controlled-release-verification.md` |

**Decision on warn vs block (this pass):**  
Approved readiness docs are explicit — **warning, not hard block**:

- Audit §12: *“add a plain warning before finalizing/sharing…”*
- Recommendation P0 #1: *“a plain warning… (‘share anyway?’)”* and acceptance: *“surfaces a real, visible warning rather than silently succeeding”*
- Recommendation Explicitly Deferred: *“adding required-price validation to every line”*

No Jennifer decision needed on warn vs block — docs resolve it as **warn**. Prior MSR already implemented warn; this pass kept warn and clarified copy.

---

## 2. What changed

1. **`$0.00` guardrail clarity (still warn)**  
   - Helper now optionally requires `lineCount > 0` when provided (empty orders do not warn).  
   - Copy now tells the coordinator what to do: Cancel → add Package/Inventory lines if pricing is incomplete; Continue only if `$0.00` is intentional.  
   - Panel passes `lines.length` into the helper for Finalize and Share.

2. **Automated regression (lifecycle gates)**  
   - Extracted pure gates into `lifecycle-gates.ts` and wired `service.ts` / `representation.ts` through them.  
   - Expanded `minimum-safe-release.test.ts` for finalize, reopen, share, finalized mutation immutability, totals, fingerprints, `$0` safety, template copy semantics, starter name hygiene.

3. **Template curation (local DB)**  
   - Renamed two leftover **“Our Wedding Event Order CERT”** rows (Cert Orchard venues) back to **“Standard Wedding Event Order”**.  
   - Confirmed zero templates matching test/D7A/CERT/dev/dummy/qa/sample.  
   - No new production templates invented. Starter masters (EO-01 / EO-02) unchanged.

4. **Flag**  
   - Temporarily enabled only for Sweet Daisy during UI smoke; always restored to `false`.  
   - No venue left enabled.

5. **Verification cleanup**  
   - Deleted temporary Event Orders / lines created by smoke + followup.

---

## 3. Exact files

### Product code
- `lib/event-orders/lifecycle-gates.ts` *(new)*
- `lib/event-orders/service.ts` — uses lifecycle gates for assertOpen / finalize / reopen
- `lib/event-orders/representation.ts` — uses share gate
- `lib/event-orders/zero-total-warning.ts` — clearer copy + optional lineCount
- `components/event-orders/event-order-panel.tsx` — passes lineCount into warning helper
- `lib/event-orders/minimum-safe-release.test.ts` — expanded regression suite

### QA (not product)
- `docs/qa/event-order-minimum-safe-release/smoke.mjs` *(re-run)*
- `docs/qa/event-order-minimum-safe-release/followup-reopen-templates.mjs` *(new)*
- `docs/qa/event-order-minimum-safe-release/results.json`
- `docs/qa/event-order-minimum-safe-release/results-followup.json`
- screenshots `01`–`06` under that folder

### Docs
- `docs/event-order-controlled-release-remaining.md` *(this file)*

### Local data only (no migration)
- Renamed 2 CERT-named `event_order_templates` rows → `Standard Wedding Event Order`

---

## 4. Tests added/updated

**Updated:** `lib/event-orders/minimum-safe-release.test.ts`

Coverage now includes:

- `$0` warning required at total `0` with lines; not above `0`; not for empty `lineCount === 0`
- Warning copy: intentional `$0`, Cancel guidance, Package/Inventory cue; does not forbid priced lines
- Totals via `sumLines`; fingerprint change on price change
- Finalize UI gate (`canAttemptFinalize`)
- Finalize blocked when already finalized
- Reopen blocked unless finalized
- Share blocked unless finalized
- Finalized mutation block for section/line mutators; open allows
- Template → instance custom provenance; blank-start empty structure
- Starter master names have no Test/D7A/CERT/dev labels

**Unchanged:** `lib/event-order-templates/starters.test.ts` (still validates EO-01/EO-02 content)

---

## 5. Test results

| Command | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | pass (exit 0) | VERIFIED LIVE |
| `npm test` | **597 pass / 0 fail** | VERIFIED LIVE |
| Focused EO domain tests (included in suite) | pass | VERIFIED LIVE |

---

## 6. UI verification

### Smoke (`smoke.mjs`) — 17 pass / 0 fail — VERIFIED LIVE
- HQ section visible while Disabled
- Enable via HQ persists (`event_order_enabled = t`)
- Event Order tab visible when enabled
- Running total `$0` with starter content
- Zero-total warning appears before Finalize (updated copy verified)
- Cancel leaves Finalize available
- Continue — Finalize commits
- Disable restores DB `false`; tab content hidden
- Final flag forced `false` in `finally`

### Followup (`followup-reopen-templates.mjs`) — 15 pass / 0 fail — VERIFIED LIVE
- DB + Library template lists have no CERT/Test/D7A/dev names
- Sweet Daisy templates: Standard Wedding Event Order + Reception Only only
- Apply starter → 139 lines → Finalize (via Continue on `$0`) → Add Line hidden
- Reopen → DB `status = open` → Finalize + Add Line visible again
- Temp order deleted; flag restored `false`

### Client share
- Not re-walked in this pass’s browser scripts. Prior controlled-release verification already proved portal API before/after `shared_at` (VERIFIED LIVE API-level). Label for in-portal click path remains UNVERIFIED (same open evidentiary note as before — not a functional blocker).

### Venue enablement after verification — VERIFIED FROM DATABASE
| Venue | `event_order_enabled` |
|---|---|
| All 8 local venues | **false** |
| Sweet Daisy leftover Event Orders | **0** |

---

## 7. Is `$0.00` fully closed?

**Yes, for the approved readiness definition (warn / disclose).**

- Finalize and Share both surface an explicit dialog when total is `$0.00` with lines.  
- Cancel is the safe default (autofocus + Escape/backdrop).  
- Continue still allowed — intentional complimentary / unpriced documents remain valid (per recommendation § Default Starter Assessment #9).  
- **Not** a hard block — that would contradict approved docs and deferred “required-price validation.”

If Jennifer later wants a hard block instead of warn, that is a product decision change; this pass did not invent one.

---

## 8. Is template list production-safe?

**Yes (local DB + shipped starters) — VERIFIED FROM DATABASE + VERIFIED FROM SOURCE.**

- Shipped starters: EO-01 / EO-02 only, customer-facing names.  
- Local DB: 0 templates matching test/D7A/CERT/dev/dummy/qa/sample after renaming the two CERT rows.  
- Library UI for Sweet Daisy showed only Standard Wedding templates.  
- Note: CERT-named rows were on ephemeral Cert Orchard venues (not Sweet Daisy / Pretty Platypus). Still cleaned so no local account exposes them.

---

## 9. READY FOR CONTROLLED RELEASE?

# **YES — conditional**

**Conditional on:** enable **one deliberate venue at a time** via HQ only — never a global flip — with informed monitoring for the `$0` Continue path in real use.

This matches:

- Prior controlled-release verification verdict (READY FOR CONTROLLED ROLLOUT)
- Product recommendation rollout option D (soft-launch cohort)
- This pass’s reconfirmation that P0 warning, tests, HQ control, and template hygiene are in place

**Not ready for:** global default-on, Help content, or Library IA changes (explicitly out of scope).

---

## 10. Remaining issues / Jennifer decisions

| Item | Status |
|---|---|
| Warn vs hard-block on `$0` | **Resolved by docs → warn.** No decision needed unless product wants to change posture. |
| Which first cohort venue(s) to enable | **Jennifer decision** — operational, not engineering |
| In-portal visual click-path screenshot for Event Order section | Open evidentiary nicety from prior verification; portal API gate already proven. Does not block controlled release. |
| Starter checklist vs priced-document UX labeling in picker | Deferred by readiness docs (starter content intentional; warning is the fix). Optional polish later. |
| Help & Guides Event Order topics | Deferred until a real cohort is enabled (audit §14). |

---

## DO-NOT-TOUCH confirmation

Unchanged:

- Event Order schema, immutability triggers, copy-at-application, financial couplings
- Starter line content / pricing defaults
- Packages, Inventory, Invoices, Payments, Contracts
- Left nav, Library IA, Help, Luv, Dashboard, Automations
- No permanent `event_order_enabled = true` for any venue
- No commit, no push

---

## STOP

Remaining controlled-release engineering items in scope are closed. Stopped — no commit, no push, no venue left enabled.
