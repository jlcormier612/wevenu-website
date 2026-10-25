# Package-led Event Order acceptance (combined serving)

**Serving:** `d9e25c77…` / `sha256:63e9cfdaf8f7f1…`  
**Harness:** `docs/qa/event-order-process-completion/verify-process.mts`  
**Log:** `package-led-run.log` → **GREEN** (this run)  
**Prior workstream:** `docs/qa/event-order-process-completion/`

| Check | Result |
|-------|--------|
| Selected Package + frozen inclusion text | PASS |
| Browser open EO seeds inclusion markers | PASS |
| Included custom, `package-selection:` notes, `offering_id=null` | PASS |
| No auto package fee (`provenance=package` absent) | PASS |
| Idempotent re-ensure (no duplicate marker) | PASS |
| Payable unchanged by included seed (2243 → 2243) | PASS |
| Venue can land on Event Order UI | PASS |

Ancestry: fix landed in `20e9e316`; present on serving `d9e25c77`.
