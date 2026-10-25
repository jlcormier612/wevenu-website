# Event Order financial harness reconcile — STATUS

**Verdict: GREEN** on serving image that includes fix commit `e8f621bf`.

| Field | Value |
|-------|-------|
| Serving commit | `b2377f578c48be0c226d5323c8a635cdd10c59b1` (ancestor includes `e8f621bf`) |
| Digest | `sha256:8902cc9488ea50ca5d2c768698dffbe3cccba2c6962c9a07970d3d57a6289c0d` |
| Default-template harness | **21/21 GREEN** (`default-template-run-b2377f57.log`) |
| Focused financial closure | **16/16 PASS** (`verify-financial-closure.mts`, `closure-results.json`) |
| Full EO journey | **61/61 GREEN** (`full-eo-run-b2377f57-r4.log`, `full-eo-browser-results-r4.json`) |
| Production | Untouched |

## Root cause (proven)

Five failures compared live EO payable to a frozen invoice snapshot after a second Plated Dinner was applied atop legacy package dinners. Product fix clears conflicting single-select option lines on finalize; harness reopens drifted sent invoices via Update Draft Invoice then publish (Send), not silent rewrite.

## Correct payable

After conflict cleanup the coherent EO has **one** Plated Dinner and **no** Buffet:

- billable `$2061` + tax `$128.81` = **`$2189.81`**
- Invoice freeze rev **24**, total **`$2189.81`**, status `sent`
- Payment schedule **`$2189.81`**
- Portal TOTAL CONTRACTED **`$2,189.81`**

Note: `$2351.31` was the drifted duplicate-Plated total; it is not the expected post-cleanup payable.

## Persisted evidence (post full EO r4)

- `persisted-after-full-eo-r4.json` — one Plated line, zero Buffet, invoice/plan `$2189.81`, freeze rev 24
- `persisted-after-closure.json`, `closure-results.json`
- `full-eo-run-b2377f57-r4.log`, `full-eo-browser-results-r4.json`
- `default-template-run-b2377f57.log`
- Shots under `shots/closure-*`

## Four closure checks (complete)

1. Serving image verified: SHA `b2377f57…`, digest `sha256:8902cc94…`
2. Default-template 21/21 + full EO 61/61 (including prior five invoice/payment-plan/portal assertions)
3. Persisted EO: one Plated Dinner; invoice/plan/portal reconcile to `$2189.81`
4. Evidence saved under this directory

## Conditional choices (separate workstream)

Schema/UI still have **no** parent→child dependency fields. Financial closure does **not** implement conditional dinner/bar child groups. That remains **NOT GREEN** until schema + starter + client flow + Sandbox browser proof land.
