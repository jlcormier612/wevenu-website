# Acceptance matrix — Event Order process completion

**Commit:** `20e9e3168c7e971533b6d95555d7d44d922319fa`  
**Serving image:** `htc-sandbox-venue-app:20e9e3168c7e971533b6d95555d7d44d922319fa`  
**Digest:** `sha256:6575c2855b577e0c07975a07c78c28b65415f0b346c1251d22c6227f6d97b7ba`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40239565138  

| Stage / scenario | Result | Evidence |
|------------------|--------|----------|
| Stage 1 — Booking Selected Package owns package context | **PASS** | `verify-process.mts` selection created with frozen inclusions |
| Stage 2 — EO template start + package inclusion seed | **PASS** | Seeded `EO-PROC-*` included custom lines with `package-selection:` notes; no Offering invention; no auto package fee; idempotent |
| Stage 3 — Client choices | **PASS** | Prior CLOSED choice-tree e2e on `1c7850ef`; unit regression conditional/validate **PASS** on this branch; engine untouched |
| Stage 4 — Venue review/edit | **PASS** | Browser landed client/event EO workspace; open EO editable; seed visible before cleanup |
| Stage 5 — Finalize / historical lock | **PASS** | Fancy EO `finalized` rev 26; seed guards `open && !sharedAt`; invoice freeze revision 26 |
| Stage 6 — Invoice / payment plan | **PASS** | `verify-financial-fixture.mts`: EO billable $2061 + tax $128.81 = invoice **$2189.81**; freeze aligned; no payment schedule on this invoice (N/A) |
| A Package-led → EO seed | **PASS** | `browser-results.json` |
| B Package + dedupe / no fee double | **PASS** | Dedup unit tests + runtime no package-fee auto-add |
| C Offering-backed option | **PASS** | Prior Inc2 / Phase 3; Fancy EO still has offering provenance lines |
| D Template-only option | **PASS** | Prior Phase 3; custom provenance seed path |
| E Included vs paid | **PASS** | Seeded included; payable unchanged 2243→2243 |
| F Parent change / repeated ops | **PASS** | Prior conditional GREEN; seed idempotent reload |
| G Financial closeout | **PASS** | Payable reconcile $2189.81; freeze rev 26 |
| H Catalog/template change vs finalized | **PASS** | Seed skips shared/finalized; sent invoice freeze retained; offering line snapshot vs catalog default |

Unit: `seed-package-inclusions` + conditional/validate — **PASS**.
