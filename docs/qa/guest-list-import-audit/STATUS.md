# Guest List Import Audit — STATUS

**Original verdict (2026-10-20):** **NOT GREEN — PRODUCT DECISION REQUIRED**  
**HEAD at audit:** `487cb347`  
**Artifacts:** `FORENSIC.md`, `probe-sandbox.mts`, `probe-results.json`

## Follow-up (implemented)

Product decision accepted: remove venue-facing Migration Center guest-list import with server-side enforcement; preserve client-owned tables/features; audit client I/O and operational handoffs without building new features.

**Implementation + closure evidence:** `docs/qa/guest-list-venue-import-removal/`
