# HTC Phase 3 — Operational readiness (gates OFF)

Status: **documented only**. Population-wide automatic upgrades and the recurring evaluator are **not** enabled.

## Kill switch (stop future notices and Stripe mutations)

Leave all of the following unset or `false` (default-off):

| Gate | Effect when OFF |
| --- | --- |
| `TIER_UPGRADE_SEND_NOTICE` | No customer upgrade notices |
| `TIER_UPGRADE_APPLY_STRIPE` | No Stripe subscription schedule mutations from apply paths |
| `TIER_UPGRADE_REHEARSAL_ENABLED` | Fixture metadata alone cannot authorize notice/apply |
| Recurring evaluator / cron | Not scheduled — no population evaluation loop |

Emergency stop after a mistaken enable: set the three env gates above to `false` (or remove them) and redeploy / restart the serving task. Do **not** flip Production or Stripe Live.

## Population process (defined, disabled)

| Capability | Design |
| --- | --- |
| Recurring evaluation schedule | Intended daily/periodic internal evaluate job — **not wired** |
| Bounded batch size | Evaluate route accepts bounded venue batches; callers must page |
| Retry behavior | Idempotent upsert of pending upgrades; notice/apply retry-safe |
| Idempotent notice | Provider acceptance + stored `noticeProviderMessageId`; re-send refused when already accepted |
| Idempotent apply | Schedule create/update keyed by upgrade record; webhook reconcile idempotent on invoice/event ids |
| Founder holds | Active hold → `blocked_hold`; CRM place/release does not mutate Stripe |
| Legacy exclusion | Legacy subscriptions blocked (`blocked_legacy`) |
| Stripe subscription mapping | Catalog price IDs + reconciled `venues.saas_plan_key` |
| Seven-day notice | Civil-day notice gate before Stripe apply |
| Safe schedule cancellation | Release/cancel paths remove schedules without mid-cycle proration |
| Webhook reconciliation | `invoice.paid` → applied with invoice/amount/price checks |
| Founder failure visibility | CRM `/tier-upgrades` lists `failed` / blocked statuses + audit |

## Fixture testing (controlled, default-off)

Temporary Phase 3 rehearsal auth no longer treats Stripe metadata `htc_phase3_rehearsal=true` as sufficient. Fixture notice/apply requires:

1. `TIER_UPGRADE_REHEARSAL_ENABLED=true` (explicit, default-off)
2. Customer **and** subscription metadata `htc_phase3_rehearsal=true`
3. Optional `TIER_UPGRADE_REHEARSAL_VENUE_IDS` allowlist
4. Internal notice recipients restricted to the rehearsal allowlist

Rehearsal fixture metadata should be cleared after acceptance so orphaned tags cannot re-arm a future enablement.

## Activation boundary

Do **not** enable population-wide automatic upgrades or recurring evaluation without a separate written approval.
