# Package-led Event Order acceptance (combined serving)

**Serving:** `d9e25c77…` / `sha256:63e9cfdaf8f7f1…`  
**Harness:** `docs/qa/event-order-process-completion/verify-process.mts`  
**Log:** `package-led-run.log` → **GREEN**

| Check | Result |
|-------|--------|
| Selected Package created with frozen inclusions | PASS |
| Browser open EO seeds inclusion markers | PASS |
| Included custom, `package-selection:` notes, no `offering_id` | PASS |
| No auto package fee (`provenance=package`) | PASS |
| Idempotent re-ensure (no duplicate marker) | PASS |
| Payable unchanged (2243 → 2243) | PASS |

Ancestry: fix landed in `20e9e316`; present on serving `d9e25c77`.
