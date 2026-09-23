# Suggested deposit — multi-option builder audit

**Status:** AUDIT COMPLETE (behavior change follows this finding)  
**Date:** 2026-09-23  
**Runtime inspected:** Sandbox Fancy + source on `create-proposal-sheet` / `createCommercialProposal` / `approve_commercial_proposal`

## Observed UI

Builder label: **Suggested deposit (optional)**  
Reporter saw **$15,000** with multiple packages selected.

## Exact source (code)

| Layer | Behavior |
|---|---|
| UI placeholder | `suggestDepositAmount(maxPrimary, null)` where `maxPrimary = Math.max(...selected primary package basePrice)` |
| UI value | Empty unless the venue types a number — **not** auto-filled |
| Create (`createCommercialProposal`) | If field empty → `suggestDepositAmount(maxPrimary, null)` → written to `commercial_proposals.deposit_amount` |
| `suggestDepositAmount(total, null)` | **25% of `total`** (hardcoded; ignores `venues.commercial_booking_prefs.defaultDepositPercent`) |
| Approve (`approve_commercial_proposal`) | L2 `deposit_amount = least(proposal.deposit_amount, chosen_total)` — **does not** recompute % of the chosen package |

## What $15,000 is / is not

| Hypothesis | Verdict |
|---|---|
| Legacy selected-package L2 total leaking into the field | **No** — field is local React state; only reads `drafts` + catalog packages |
| First selected option price | **No** — uses **max** of selected **primary** prices, not first |
| Venue default deposit % applied correctly | **No** — percent ignored; absolute `null` → fixed 25% of max primary |
| Actual proposal-level payment amount | **Yes (current model)** — stored on `commercial_proposals.deposit_amount` and later clamped onto L2 |
| Unformatted package total mistaken for deposit | **Plausible for the $15,000 report** — placeholder renders raw `"3750"` (no `$`), while package rows show `formatCurrency` e.g. **$15,000**. If only Essential ($15k) is the highest primary (or only primary), 25% placeholder is `3750`; a typed/confused `$15,000` would be the **full package price**, not the 25% suggestion |

## Product conflict

Multi-option intent: no single meaningful deposit until the client chooses.  
Current code: silently attaches **25% of the highest primary alternative** to the whole proposal, then clamps that number onto whatever the client picks. That can:

- Over-deposit a cheaper choice (proposal deposit based on Signature, client picks Essential → deposit capped at Essential total → up to 100% of Essential)
- Under-deposit a dearer choice if the venue typed a low override
- Treat one alternative’s economics as if it were already purchased

## Intended fix (applied after this audit)

1. Builder: do **not** present a single dollar “Suggested deposit” derived from max primary.
2. Create: store `deposit_amount = 0` on the proposal (no phantom purchase deposit).
3. Approve / L2: set deposit from **chosen total** × venue `defaultDepositPercent` (via post-approve correction using existing selection + prefs helpers).
4. Contract / payments / invoice continue to read L2 only.
