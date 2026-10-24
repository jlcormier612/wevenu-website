# Floor plan client submit → venue review

## Verdict: GREEN

Complete client-to-venue collaboration review loop proven on serving Sandbox.

| Item | Value |
| --- | --- |
| Product | `a58a319fe0f4fb4584a76bf136e5708a8b79225c` |
| Migration | `20261423000000_floor_plan_client_submit_review.sql` — [40103515047](https://github.com/jlcormier612/wevenu-website/actions/runs/40103515047) |
| Deploy | [40104539126](https://github.com/jlcormier612/wevenu-website/actions/runs/40104539126) |
| Serving image | `htc-sandbox-venue-app:a58a319fe0f4fb4584a76bf136e5708a8b79225c` |
| Digest | `sha256:11a4a86edc51d8647cc728542157f02bd11275ebc63f954923ab0014f09674dd` |
| Harness | `verify-browser.mts` → **GREEN 20/20** |
| Production | untouched |

## What already existed

- Venue offers → client select → shared working layout
- Couple move unlocked objects; add permitted tables (inventory qty + locks)
- Seating via `client_access=view`
- Venue **Mark as Ready** (`finalized_at`) locks couple placement
- No explicit “I’m done” / venue review status

## What was missing (root cause)

Clients could edit indefinitely with no submit/review status. Venue had no place to see a returned submission or approve / request changes. Copy did not explain limits or completion.

## What we added (smallest coherent loop)

Status on the same working plan (no parallel layout store):

`working` → `submitted` → `approved` | `changes_requested` → (edit) → `submitted` …

- Portal: guidance, **Submit floor plan to venue**, status + venue notes
- Server: submit RPC; move/add/remove blocked while `submitted`/`approved`
- Venue Floor Plans: review panel (Approve / Request changes), couple-may-add toggle
- Operational plan id unchanged until venue Marks Ready separately

## Browser proof (Fancy fixture)

Client: guidance → submit → reload awaiting review → move rejected (`awaiting_review`) → foreign token denied → 390px status  
Venue: review panel → request changes with note  
Client: sees note → resubmit  
Venue: approve  
Persisted: `approved` + same `operational_floor_plan_id`

Evidence: `browser-results.json`, `persisted-state.json`, `shots/`.
