# HTC Phase 3 — Operational readiness (Sandbox ACTIVATED)

Status: **Sandbox population automation ENABLED**. Recurring evaluator runs daily via the scheduler. Notices redirect exclusively to the approved internal inbox. Stripe apply uses the Test SaaS account only.

## Active Sandbox configuration

| Gate / setting | Sandbox value | Effect |
| --- | --- | --- |
| `PRICING_TIER_UPGRADE_STORE` | `postgres` | Durable pending upgrades + holds |
| `TIER_UPGRADE_SEND_NOTICE` | `true` | Sends upgrade notices (redirected to internal inbox) |
| `TIER_UPGRADE_APPLY_STRIPE` | `true` | Creates/updates Stripe Test subscription schedules |
| `TIER_UPGRADE_REHEARSAL_ENABLED` | unset / `false` | Fixture metadata alone cannot authorize |
| Recurring evaluator | `15 6 * * *` UTC | `GET /api/internal/pricing/tier-upgrades/process` via scheduler |
| Notice recipients | Redirect | `TIER_UPGRADE_NOTICE_REDIRECT_TO` or default `jennifer@hellotocheers.com` |
| Stripe | Test only | `HTC_SAAS_STRIPE_SECRET_KEY` must be `sk_test_*` |

## Kill switch (stop future notices and Stripe mutations)

Set all of the following to `false` (or remove them) in the Sandbox CloudFormation parameters / task env and redeploy:

| Gate | Effect when OFF |
| --- | --- |
| `TIER_UPGRADE_SEND_NOTICE` | No upgrade notices |
| `TIER_UPGRADE_APPLY_STRIPE` | No Stripe subscription schedule mutations from apply paths |
| `TIER_UPGRADE_REHEARSAL_ENABLED` | Fixture metadata alone cannot authorize notice/apply |

Emergency stop: flip the two global gates above to `false` and redeploy / restart the venue-app task. Optionally remove the `tier-upgrades-process` crontab line and redeploy the scheduler image. Do **not** flip Production or Stripe Live (HTC has neither in use for this product).

## Population process

| Capability | Behavior |
| --- | --- |
| Recurring evaluation schedule | Daily 06:15 UTC via supercronic → process route |
| Bounded batch size | Process/evaluate pages of ≤25 venues (`limit` / `offset`) |
| Retry behavior | Idempotent upsert of pending upgrades; notice/apply retry-safe |
| Idempotent notice | Provider acceptance + stored `noticeProviderMessageId`; re-send refused when already accepted |
| Idempotent apply | Schedule create/update keyed by upgrade record; webhook reconcile idempotent on invoice/event ids |
| Founder holds | Active hold → `blocked_hold`; CRM place/release does not mutate Stripe |
| Legacy exclusion | Legacy subscriptions blocked (`blocked_legacy`) |
| Stripe subscription mapping | Catalog price IDs + reconciled `venues.saas_plan_key` |
| Seven-day notice | Civil-day notice gate before Stripe apply; defer if renewal too soon |
| Safe schedule cancellation | Release/cancel paths remove schedules without mid-cycle proration |
| Webhook reconciliation | `invoice.paid` → applied with invoice/amount/price checks |
| Founder failure visibility | CRM `/tier-upgrades` lists `failed` / blocked statuses + audit |
| Notice safety | Population notices always redirect to approved internal inbox |

## Fixture testing (controlled, default-off)

Temporary Phase 3 rehearsal auth no longer treats Stripe metadata `htc_phase3_rehearsal=true` as sufficient. When global gates are OFF, fixture notice/apply requires:

1. `TIER_UPGRADE_REHEARSAL_ENABLED=true` (explicit, default-off)
2. Customer **and** subscription metadata `htc_phase3_rehearsal=true`
3. Optional `TIER_UPGRADE_REHEARSAL_VENUE_IDS` allowlist
4. Internal notice recipients restricted to the approved inbox allowlist

Keep rehearsal execution **disabled** while population gates are ON.

## Maintain

- Keep `PRICING_TIER_UPGRADE_STORE=postgres`.
- Keep SaaS Stripe secret on Test (`sk_test_`).
- Keep notice redirect pointed at an approved internal inbox.
- Do not enable Stripe Live or Production endpoints.
