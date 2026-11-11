# Category-first template builder + client choices (combined serving)

**Serving:** `d9e25c77…` / `sha256:63e9cfdaf8f7f1…`  
**Builder harness:** `docs/qa/event-order-template-builder/verify-builder.mts` → **GREEN** (`template-builder-run.log`)  
**Client-choice harness:** `docs/qa/event-order-conditional-choices/verify-browser.mts` → **GREEN 26/26** (`conditional-choices-run.log`)  
**Prior workstreams:** `docs/qa/event-order-template-builder/`, `docs/qa/commercial-choice-tree/`

## Builder

| Check | Result |
|-------|--------|
| Section / category nav | PASS |
| Catering workspace (fixed + choices) | PASS |
| Nested plated/buffet branches | PASS (`nestedCards=2`) |
| Incomplete empty dependent callout | PASS |
| Offering picker preferred category + escape | PASS (`preferred`) |
| Client preview from real template | PASS |
| Section switch isolates categories; reload retains nav | PASS |

## Client conditional choices (on same serving image)

| Check | Result |
|-------|--------|
| Plated reveals only plated branch | PASS |
| Switch to Buffet clears/invalidates plated child | PASS |
| Buffet-specific choices without unrelated branches | PASS |
| Submit persists option identities; reopen restores active branch | PASS |
| Empty dependent scaffolds (no invented menu items) | PASS |
| Existing finalized EO untouched | PASS |

Ancestry: builder fix `e7f7178e`; choice-tree engine preserved (not redesigned). Units: `unit-regression.log` **76/76**.
