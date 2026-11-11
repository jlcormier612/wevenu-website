# Inbox usability — Needs your attention + Couldn't deliver display

**Status: GREEN** (Sandbox runtime verified)

## Root causes

| Gate | Defect | Root cause |
|------|--------|------------|
| A | Attention count not actionable / incomplete set | Tile was non-interactive; Message History was a recent mixed feed (cap ~50), not the failed/undelivered set counted by the tile |
| B | “Couldn't deliver” clipped | Status column used tight single-line layout (`shrink` / no wrap); badge/popover lacked `break-words` / multi-line stack |

## Semantics (count ≡ filter)

- Eligible: `failed`, `undelivered` only (`isDeliveryFailureStatus` / `NEEDS_ATTENTION_STATUSES`)
- Pending confirmation (`accepted` / `sending`) stays in Sent — not attention
- Destination: `/messaging/health?attention=1` (null href when count is 0)
- Filtered history queries the same statuses in the same 30-day window; client “Load more” pages the full fetched set (20 at a time)

## Files changed

- `lib/communication/attention-history.ts` (+ test)
- `lib/communication/dashboard.ts`, `dashboard-counts.ts`
- `app/(app)/messaging/health/page.tsx`
- `components/messaging/message-history-list.tsx`
- `components/messaging/message-status-badge.tsx`
- `components/messaging/message-timeline-popover.tsx`
- `components/dashboard-system/stat-tile.tsx` (`ariaLabel` / focus ring)
- QA: `docs/qa/inbox-attention-delivery-display/*`

## Focused tests

```bash
npx tsx --test \
  lib/communication/attention-history.test.ts \
  lib/communication/message-status-definitions.test.ts \
  lib/communication/health-back-nav.test.ts \
  lib/conversations/messaging-trust.test.ts
```

Result: **34 pass / 0 fail**

## Deploy / serving

| Item | Value |
|------|--------|
| App commit (serving) | `8d9eb28bdef67382657666edae04e26b3f3b86ab` |
| Deploy (success) | https://github.com/jlcormier612/wevenu-website/actions/runs/38487307205 |
| Prior deploy (intermediate) | https://github.com/jlcormier612/wevenu-website/actions/runs/38486212676 (`af0f8555`) |
| ECS image | `htc-sandbox-venue-app:8d9eb28bdef67382657666edae04e26b3f3b86ab` |
| Docs tip (verify EXPECTED_SHA) | `75f8df0d` — docs only; not required for serving |

Production untouched.

## Browser evidence (Fancy venue)

Command: `EXPECTED_SHA=8d9eb28b… npx tsx docs/qa/inbox-attention-delivery-display/verify-browser.mts`

| Check | Result |
|-------|--------|
| Serving SHA | PASS |
| Attention count 50 → link `?attention=1` + aria-label | PASS |
| Keyboard focus ring on card | PASS |
| Filtered list failure-only; Load more 20→40 | PASS |
| Couldn't deliver not horizontally clipped (1280 + 390) | PASS |
| Long provider explanation wraps (`long-failure-probe.json`) | PASS |

Artifacts: `health-desktop.png`, `attention-filtered-desktop.png`, `health-narrow-390.png`, `long-failure-desktop.png`, `long-failure-390.png`, `browser-results.json`, `browser-run.log`.

## Limitations / separate product decisions

- Attention filter safety-caps at 500 history rows (Fancy had 50 in-window).
- Communication Health “Action Required” widget sample lines remain a separate summary surface; this fix targets the attention tile + Message History status column.
- No emails/texts sent; no status semantics invented.
