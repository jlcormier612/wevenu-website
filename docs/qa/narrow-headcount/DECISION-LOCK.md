# Narrow B — Headcounts decision lock

**Status:** Locked for slice delivery  
**Date:** 2026-10-30  
**Program:** Estimated + Guaranteed headcounts with careful, gated commercial use

## Goal

Support living headcounts the way banquet tools do — without silent money movement after couple approval or invoice send, and without regressing today’s snapshot Event Order quantities.

## In scope (Narrow B)

1. **Estimated** guest count (today’s `events.guest_count`, labeled Estimated in venue UI).
2. **Guaranteed** guest count (`events.guaranteed_guest_count`, optional).
3. Per-person **fixed/template** Event Order lines bind to: Guaranteed if set, else Estimated — **starting in slice B1** (apply/seed only).
4. Recalc of open, unapproved EO lines when a bound headcount changes — **slice B2**, behind recalc flag.
5. After couple Approve **or** EO invoice send → quantities frozen until venue **Send updated copy** — **slices B3/B4**.
6. Draft EO-linked invoice while recalc would apply: **block recalc** (v1) — **B4**.

## Explicit non-goals (do not pull into Narrow B)

- Couple choice options × guests (separate product decision)
- 72-hour guarantee deadline policy
- Bill max(guarantee, actual)
- F&B minimum shortfalls / overset %
- Staffing ratios from headcount
- Automatic balance invoices from headcount edits
- Rewriting historical Event Order line quantities on migration

## Money invariants (must remain true every slice)

1. Sent/paid invoices never reprice from a headcount edit.
2. Couple-approved EO quantities do not change from a headcount edit alone.
3. Changing Guaranteed after Approve requires Send updated copy (existing re-approval path).
4. Draft EO-linked invoice: block recalc (do not silently refresh) until B4 proves a safer rule.

## Slice order (each GREEN on Sandbox before the next)

| Slice | Behavior change |
|---|---|
| **B0** | Schema + UI for Estimated/Guaranteed. **No EO recalc. Apply still uses Estimated (`guest_count`) only.** |
| **B1** | New apply/seed uses Guaranteed ?? Estimated |
| **B2** | Recalc open unapproved bound lines only (`headcountRecalcEnabled`) |
| **B3** | Shared-but-unapproved → stale / Send updated copy |
| **B4** | Invoice boundary + draft block |

## Feature flag

- `headcountRecalcEnabled()` — env-gated (`HEADCOUNT_RECALC_ENABLED`). Default **on** in sandbox/test, **off** in production unless explicitly enabled.
- B2 recalc only runs when the flag is on **and** the Event Order is open, unshared, unapproved, with no non-void EO-linked invoice.

## Legacy mapping

- `events.guest_count` = Estimated (no column rename in B0).
- Existing rows: Estimated = current `guest_count`; Guaranteed = null.
- Read helper: `guaranteed ?? estimated ?? null` (`boundHeadcountForApply`).
- B1+: new EO apply/seed uses the bound helper. Existing line quantities stay frozen until B2 recalc.

## Production

Sandbox only until B2–B4 proofs are GREEN and flag-off characterization still passes. Production untouched unless explicitly authorized.
