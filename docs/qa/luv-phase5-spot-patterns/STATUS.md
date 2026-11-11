# Luv Phase 5 — Spot Patterns

**Status:** GREEN — engineering proof complete on exact Sandbox image  
**Jennifer handoff:** READY FOR ACCEPTANCE PASS (not discovery)  
**Production:** untouched  

## Runtime proof

| Field | Value |
| --- | --- |
| Commits | `daeaf0d0` (core) → `f1825f13` (migration renumber) → **`da5cf544`** (L2 surfaces) |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/36661647230 |
| Migration | `20261410100000_luv_phase5_spot_patterns.sql` applied (run 36660744146) |
| Task definition | `htc-sandbox-venue-app:472` |
| Image tag | `htc-sandbox-venue-app:da5cf544e0fe188dd5357f0172509725c6790d80` |
| Digest | `sha256:bcac181c85f5865d4473d3c886998efa4632626ac72adc1971d4594336a0cbe1` |
| Health | `/api/health` → **200** |
| Sole RUNNING task | `f07676431b74428fbef430025cae3b42` (replaced by deploy `:472` task) |

## Locked product model (shipped)

- Phase 5 = Spot Patterns (multi-record), Celebrate → Inform → Help
- Initial set (all **L2**): **P-A1**, **P-A4**, **P-P1**
- **No new Dashboard L1 cards**; L1 gate unchanged
- Cluster: **3+** / **14 days** + venue history ≥5
- Booking clock: `leads.first_booked_at` (Lead → Booked, manual or automation)

## Implementation

| Piece | Location |
| --- | --- |
| Evaluators + sync | `lib/luv/spot-patterns.ts` |
| Sync RPC + booking repair | `supabase/migrations/20261410100000_luv_phase5_spot_patterns.sql` |
| Wire sync | `lib/luv/recommendation-service.ts` |
| L1 exclusion | `lib/dashboard-system/luv-entry.ts` |
| Global S2/S3 supersession | `lib/dashboard/service.ts` |
| L2 surfaces | Leads (`P-A1`,`P-P1`) + Payments (`P-A4`) via `SpotPatternRecommendationsPanel` |
| Tests | `lib/luv/spot-patterns.test.ts` |

## Browser proof (Fancy Venue, exact image `da5cf544`)

| Criterion | Result |
| --- | --- |
| **P-A1** | Leads L2: “4 recent inquiries still need a first response” + 48h/14d evidence + Review inquiries |
| **P-P1** | Leads L2: “Inquiry volume is picking up” / “28 … compared with 5 …” |
| **P-A4** | Payments L2: “3 upcoming events need payment attention” + Review payments |
| Lifecycle | Dismiss P-A4 → `dismissed_at` set → reload Payments → pattern gone (7-day cooldown) |
| Dashboard L1 | L1 card remains delivery-failure note — **no** Phase 5 titles |
| S3 record L3 | Lead `b37de545…` still shows unattended S3 insight |
| Venue isolation | Phase 5 `luv_recommendations` rows only on Fancy (`a415ac52…`); other venues empty for these types |
| Booking metric | Trends/insights SQL uses `first_booked_at`; not `status='won'` / `clients.created_at` |

## Automated verification

- `npx tsx --test lib/luv/spot-patterns.test.ts` (+ Luv regressions) — pass
- `npx tsc --noEmit` — pass

## GREEN checklist

- [x] Targeted automated tests
- [x] Luv regression tests
- [x] Typecheck
- [x] Sandbox migration applied
- [x] Sandbox deploy — exact task / image / digest / health
- [x] Browser: P-A1 / P-A4 / P-P1 L2 journeys (copy + evidence)
- [x] Lifecycle / dismiss
- [x] No Phase 5 on Dashboard L1
- [x] S1–S4 adjacent (S3 record intact)
- [x] Venue isolation
- [x] Production untouched

**Engineering GREEN.** Jennifer browser pass = final acceptance.
