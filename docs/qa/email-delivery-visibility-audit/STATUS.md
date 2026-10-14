# Customer-facing email delivery visibility

**Status: GREEN — Sandbox verified**

| Field | Value |
|-------|--------|
| Serving SHA | `3f30db10ab2e3343482e475cd5c46b0f8b2648e4` |
| ECS image | `htc-sandbox-venue-app:3f30db10ab2e3343482e475cd5c46b0f8b2648e4` |
| Task definition | `htc-sandbox-venue-app:745` (rollout COMPLETED) |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38624571701 (**success**) |
| Focused tests | **67 pass / 0 fail** |
| Browser verify | **ALL PASS** — `browser-results.json` |
| Open/click tracking | Separate — **NOT GREEN** |
| Production / Resend / DNS | Untouched · **0** emails sent |

## Verified surfaces

| Check | Result |
|-------|--------|
| Communication Readiness on `/messaging/health` | Present |
| Aggregate Sent/Delivered/Attention tiles | Absent |
| Excellent/Issues widget + failure list | Absent |
| Compact `Couldn't deliver` on conversation | Present (no inline prose) |
| Failure detail in status popover | Explanation + next action; no reputation scare |
| Desktop + mobile screenshots | `health-1280/390`, `thread-compact-*`, `thread-detail-open-1280` |

## What changed / did not

Changed: compact badges, on-demand failure detail, calm guidance, deferred aggregate health UI.  
Unchanged: status semantics, webhooks, counts helpers, recovery actions, provider config.
