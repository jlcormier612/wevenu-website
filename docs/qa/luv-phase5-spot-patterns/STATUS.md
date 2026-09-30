# Luv Phase 5 — Spot Patterns

**Status:** IMPLEMENTATION IN PROGRESS — awaiting Sandbox exact-image + browser proof  
**Production:** untouched  
**Jennifer handoff:** NOT YET (mandatory verification gate incomplete)

## Locked product model (do not reopen)

- Phase 5 = Spot Patterns (multi-record), Celebrate → Inform → Help
- Initial set (all L2): **P-A1**, **P-A4**, **P-P1**
- **No new Dashboard L1 cards**; existing L1 gate unchanged
- Cluster rule: **3+** qualifying records within **14 days** + venue history floor (≥5)
- Booking = venue Lead → Booked/Client transition (`first_booked_at`) — not won / client create / payment / contract

## Implementation

| Piece | Location |
| --- | --- |
| Evaluators + sync | `lib/luv/spot-patterns.ts` |
| Sync RPC + booking metric repair | `supabase/migrations/20261410100000_luv_phase5_spot_patterns.sql` |
| Wire sync | `lib/luv/recommendation-service.ts` |
| L1 exclusion | `lib/dashboard-system/luv-entry.ts` (`isPhase5SpotPatternRecommendation` → false) |
| Global S2/S3 supersession | `lib/dashboard/service.ts` via `filterGlobalObservationsForSpotPatterns` |
| Tests | `lib/luv/spot-patterns.test.ts` (+ regression suites) |

### Patterns

| ID | Type | Evidence |
| --- | --- | --- |
| P-A1 | `unattended_inquiry_pattern` | Reuses S3 unattended semantics; ≥3 in 14d; history ≥5 |
| P-A4 | `payment_attention_pattern` | Reuses S2 `computePaymentsReadiness` / needs_attention; ≥3 upcoming in 14d; history ≥5 |
| P-P1 | `inquiry_volume_increase` | Current 14d vs prior 14d; ≥5 current, ≥25%, ≥+2 absolute |

### Booking metric (targeted)

- `get_venue_trends()` booked counts → `leads.first_booked_at`
- `compute_venue_insights()` momentum → `first_booked_at` + `current_user_venue_id()`
- Booking momentum **not** in initial Phase 5 pattern set

## Verification (required before Jennifer)

- [ ] Targeted automated tests
- [ ] Luv regression tests
- [ ] Typecheck
- [ ] Sandbox migration applied
- [ ] Sandbox deploy — exact task / image / digest / health
- [ ] Browser: P-A1 / P-A4 / P-P1 L2 journeys (copy + evidence)
- [ ] Lifecycle / dismiss
- [ ] No Phase 5 on Dashboard L1
- [ ] S1–S4 intact; venue isolation
- [ ] Production untouched

## Runtime proof (fill after deploy)

| Field | Value |
| --- | --- |
| Commit | _pending_ |
| Task definition | _pending_ |
| Image tag | _pending_ |
| Digest | _pending_ |
| Health | _pending_ |
