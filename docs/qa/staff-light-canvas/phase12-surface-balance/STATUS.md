# Phase 12 — Application-Wide Hospitality Color Balance & Surface Hierarchy

**Verdict:** IMPLEMENTED LOCALLY — AWAITING PRODUCT VISUAL APPROVAL  
**Baseline:** Sandbox serving `dea957d2` (verified)  
**Commit / deploy:** Not authorized (Stage D gate)

## What changed

1. Extended `docs/design/HTC-COLOR-DISTRIBUTION-RULES.md` with Rule H (surface layering) and Rule I (Active indicators).
2. Shared utilities: `.htc-group-shell`, `.htc-badge-active`.
3. Automations: eucalyptus intro, calm-blue help, linen Sales/Client shells + white cards, eucalyptus Active badges, calm “What will happen?”.
4. Dashboard: Coming Up → white working shell (not linen slab); Focus/Luv/Snapshot preserved.
5. Broader framing: Requests, Task Center hospitality intros; vendor empty states white; EO template example calm guidance.
6. Existing dirty Phase 8/9 hospitality wiring left intact where already correct.

## Evidence

- Before (Sandbox `dea957d2`): `evidence-before/` + `~/Desktop/htc-phase12-before/`
- After (local): `evidence-after/` + `~/Desktop/htc-phase12-after/`
- Tests: `lib/theme/phase12-surface-balance.test.ts` — **15/15 pass**

## Explicitly not done

- Commit / push / Sandbox deploy
- Broader unrelated dirty-tree product work
- Production / migrations / portals / print-PDF
