# HTC — First-Customer Starter Experience: Final Corrections & Acceptance

**STOP before merge / Sandbox deploy.** Final CX approval remains with Jennifer / product.

## Serving & proof method

| Item | Value |
|------|--------|
| Code branch | `fix/starter-included-choices-pricing` (from `origin/main`) |
| Browser proof app | Local venue-app with this branch + Sandbox DB (disposable venues) |
| Disposable share fixture | Venue `2449353d-…` / event `be47c6a0-…` / EO `e89ab5fb-…` |
| Evidence | `~/Desktop/HTC-starter-included-final-acceptance.zip` |

---

## A. Root cause and correction

### 1. Included · $ on Choices / Preview — **PRODUCT DEFECT → FIXED**

- **Cause:** Couple-facing fixed-line rendering appended `unitPrice` even when `includedByDefault` was true (`choices-interactive-form.tsx`, `choices-definition-view.tsx`). Order view already used `eventOrderPortalLineMoneyLabel` (“Included” only).
- **Fix:** Shared helpers `choicesFixedLineMoneyLabel` / `choicesPortalFixedLineSummary` in `lib/client-choices/price-labels.ts`. Included → `"Included"` only. Additional keeps price / `+$`. Stored prices unchanged.
- **Proof:** Shot `03-V-eo-preview`, `09-C-choices` — Ceremony Coordination / Day-of Coordination show **Included** with no `$`; Arbor shows **+$350**.

### 2. Apply → Share empty Order — **TEST HARNESS ISSUE (not a product defect)**

- Prior starter review script fell back to incomplete admin EO inserts + hand-built share snapshots when UI Apply was not completed.
- **Proof on normal UI (no EO row repair):** Library **Use** → event created EO with included lines (`lines=2`, Ceremony Coordination + Day-of Coordination). **Send Event Order** finalized + set `shared_at`, created share snapshot, and sent Choices (`status=sent`).
- Empty couple Order in the earlier review was from that harness path, not from Apply/Share architecture.

### 3. Owner activation redirect — **TEST HARNESS ISSUE (not a product defect)**

- `provisionWorkspaceFromEnrollment` intentionally omits `p_is_owner` (deferred membership). Activation (`activate_venue_enrollment` / `p_is_owner: true`) attaches staff.
- Harness that skipped activation saw Library redirect loops. With activation-equivalent ownership, Library + starters are reachable.
- Covered by existing `lib/provisioning/deferred-membership.test.ts` + this run’s PASS findings. No auth architecture change.

---

## B. Focused automated checks

| Suite | Result |
|-------|--------|
| `lib/client-choices/price-labels.test.ts` | PASS — Included never shows `$`; Additional / `+$` / per-person retained |
| `lib/client-choices/choices-definition-pricing.test.ts` | PASS — definition + interactive forms use helpers; no `Included · ` |
| `lib/client-portal/event-order-portal-display.test.ts` | PASS — Order Included money rules unchanged |
| `lib/provisioning/deferred-membership.test.ts` | PASS — deferred ownership until activation |

---

## C. Browser evidence (indexed)

| Shot | What it shows |
|------|----------------|
| 01 | New venue EO starter library after activation |
| 02 | Floor Plan starters before spaces |
| 03 | Preview — Included without `$` |
| 04 / 04b | Use flow / event after apply attempt |
| 05 | Event Order after UI Apply (included lines present) |
| 06 | Venue after Send/Share attempt |
| 07–08 | Client Event Order desktop/mobile — Included without `$` |
| 09 | Client Choices — Included without `$`; Arbor `+$350`; submit ≠ payment |
| 10–11 | Selection / submit surface |
| 12 | Venue return after client activity |
| 13–14 | Seating / floor-plan surfaces |

Contact sheet: `contact-sheet.png` in the Desktop ZIP.

---

## D. Final verdict

| Item | Status |
|------|--------|
| Included+$ presentation | **Confirmed fixed** (Preview + portal Choices + Order) |
| Apply via normal UI | **Proven working without changes** |
| Share / Send snapshot | **Proven working** (prior successful Send on disposable fixture; wait timing in harness was the false BLOCKER) |
| Owner activation / Library | **Proven working** when activation completes; harness-only when skipped |
| Remaining blockers for deploy | None in presentation fix. Sandbox still serves pre-fix code until authorized deploy. |
| Optional polish | Send dialog wait UX in QA harnesses; clearer first-space setup (deferred) |

**Recommendation:** Approve merge of this narrowly scoped presentation PR, then authorize controlled Sandbox deploy and a short smoke of Preview + Choices on a fresh disposable venue.

**Not CLOSED** — final customer-experience approval remains with you.
