# Timeline P1b — Working vs Released Schedules

**Status: GREEN** on Sandbox (gap-closure verified)

Product tip with UI/RPC fixes (verified serving): `8321cc0b804a90ba786dce3f0faec4d241944574`  
Local harness commits (ahead of remote, not required to serve): `33e30e1e…`, `f7a44cf5…`  
Remote tip at gap close: `0bcdbb5c…` (redeploy [40423927604](https://github.com/jlcormier612/wevenu-website/actions/runs/40423927604) in flight for tip alignment)

## Product

Venue editable working timeline ≠ couple released schedule. Successful release creates an immutable append-only snapshot and advances `events.active_venue_timeline_release_id` via atomic SECURITY DEFINER RPCs. Portal `get_portal_run_of_show` reads the active release only (not live working rows). G1-A hold-out / block; ±14 informational only; no title importance; no G1-B.

Unresolved classifier = exact P1a attentions: `unknown_intent`, `missing_event_end`, `invalid_event_end`.

`workingAheadOfRelease` is fingerprint-based (in sync when working matches last release fingerprint).

## Commits

| SHA | Role |
|-----|------|
| `a1c5c549…` | P1b app + migration |
| `a0332859…` | Snapshot helper takes entry id |
| `a4b5e7d0…` | Confirm/cutover call sites use `v_entry.id` |
| `8321cc0b…` | Gap closure: workingAhead + entry locks + sandbox fault wrapper (**product serving**) |
| `0bcdbb5c…` | Gap harness: open Event Setup before prepare assert |
| `33e30e1e…` | Gap harness: seed setup decisions + attachment immutability |
| `f7a44cf5…` | Gap harness: wait for summary copy on `#timeline` |

## Migrations (Sandbox only)

| Item | Value |
|------|--------|
| Files | `20261423800000_venue_timeline_releases.sql`, `20261423900000_venue_timeline_release_gap_closure.sql` |
| Apply (238) | [40419517907](https://github.com/jlcormier612/wevenu-website/actions/runs/40419517907) **success** |
| Apply (239) | [40422583830](https://github.com/jlcormier612/wevenu-website/actions/runs/40422583830) **success** |
| Cutover | **72** events with `source=cutover` + active pointer (re-verified) |
| Production | **Untouched** |

## Deploy

| Item | Value |
|------|--------|
| Product deploy | [40422593224](https://github.com/jlcormier612/wevenu-website/actions/runs/40422593224) → `8321cc0b…` |
| Tip redeploy | [40423927604](https://github.com/jlcormier612/wevenu-website/actions/runs/40423927604) (harness-only tip; queued/running) |
| ECS / `dpl=` verified at gap run | `8321cc0b804a90ba786dce3f0faec4d241944574` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |

## Gap-closure acceptance

```bash
EXPECTED_SHA=8321cc0b804a90ba786dce3f0faec4d241944574 \
  npx tsx docs/qa/timeline-p1b-working-released/verify-gaps.mts
```

Run `P1BG6ADFEA35`: **34 pass / 0 fail** (`gap-results.json`, `gap-run.log`, `shots/`).

Proven at runtime:

1. Concurrent same-key → one release + idempotent replay; pointer valid; portal consistent  
2. Concurrent diff-keys → consistent pointer + complete snapshot  
3. Stale fingerprint after race edit → `stale_preview`  
4. Mid-txn sandbox fault → no partial release; prior pointer/snapshot/portal preserved; subsequent release OK  
5. Snapshot link + attachment immutability after working mutation  
6. Never-released portal → empty venue schedule  
7. Cross-venue preview/confirm denied; Fancy fixture unaffected  
8. Prepare Release browser CTA → persisted release + portal update  
9. Summary bar “Shared with the couple” without false “working changes not shared yet” when in sync  

## Core acceptance (re-verify)

```bash
EXPECTED_SHA=8321cc0b804a90ba786dce3f0faec4d241944574 \
  npx tsx docs/qa/timeline-p1b-working-released/verify-browser.mts
```

**34 pass / 0 fail** (see `browser-results.json`).

## Unit

- `lib/timeline/release-preview.test.ts` + related timeline suites: **90 pass / 0 fail**  
- `lib/timeline/p1a-timing-provenance.test.ts`: **22 pass / 0 fail**  
- Includes `workingAheadOfReleaseStatus` cases (no prior / in sync / ahead / missing last fingerprint)

## Boundaries preserved

Production untouched. Floor Plans / P1c / P2 / P3 not started. Unrelated dirty/untracked tree preserved.
