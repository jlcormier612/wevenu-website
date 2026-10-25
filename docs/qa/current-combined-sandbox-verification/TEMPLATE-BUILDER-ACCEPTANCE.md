# Category-first template builder acceptance (combined serving)

**Serving:** `d9e25c77…` / `sha256:63e9cfdaf8f7f1…`  
**Harness:** `docs/qa/event-order-template-builder/verify-builder.mts`  
**Log:** `template-builder-run.log` → **GREEN**

| Check | Result |
|-------|--------|
| Section / category nav | PASS |
| Catering workspace (fixed + choices) | PASS |
| Nested plated/buffet branches | PASS (nestedCards=2) |
| Incomplete empty dependent callout | PASS |
| Offering picker preferred category filter | PASS (`preferred`) |
| Client preview from real template | PASS |
| Section switch isolates categories | PASS |
| Reload retains nav | PASS |

Ancestry: fix landed in `e7f7178e`; present on serving `d9e25c77`. Choice-tree / Offering-link units re-run PASS (54/54 combined with other suites).
