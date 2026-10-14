# Email delivery visibility simplification — implementation

**Status:** Sandbox verification in progress (see STATUS.md)  
**Mode:** Presentation-layer only · Sandbox deploy authorized · Production untouched

---

## What changed

1. **Compact message status badge** — label + emoji only (`MessageStatusBadge`). No inline failure paragraphs.
2. **Detail on demand** — failure explanation, next action, and optional “More details” move into `MessageTimelinePopover`.
3. **Calm failure guidance** — strip reputation / mailing-list scare clauses; unknown failures no longer invite support by default; invalid-address copy is quieter.
4. **Deferred aggregate delivery monitoring on Communication Health** — Sent/Delivered/Attention tiles, Excellent/Issues widget, and recent/attention message list are not rendered. **Communication Readiness remains.**
5. **Health widget issue rows** (component preserved, not shown on health page) — concise label instead of full bounce prose.

## What deliberately did not change

- Status enums, ranking, webhooks, persistence, retries, recovery actions
- Count formulas / Attention eligibility helpers (`attentionHistoryHref`, dashboard filters)
- Open/click tracking / Resend / DNS (still NOT GREEN separately)
- Production

## Files

| File | Why |
|------|-----|
| `components/messaging/message-status-badge.tsx` | Compact default |
| `components/messaging/message-timeline-popover.tsx` | Detail surface |
| `lib/communication/email-failure-guidance.ts` | Calm copy |
| `app/(app)/messaging/health/page.tsx` | Defer aggregates; keep Readiness |
| `components/communication/communication-health-widget.tsx` | Concise issue rows (preserved) |
| Focused tests under `lib/communication/*` | Regression |

## Tests (focused)

```bash
npx tsx --test \
  lib/communication/email-failure-guidance.test.ts \
  lib/communication/attention-history.test.ts \
  lib/communication/empty-attention-back-link.test.ts \
  lib/communication/message-history-copy.test.ts \
  lib/communication/health-back-nav.test.ts \
  lib/communication/message-status-definitions.test.ts \
  lib/conversations/messaging-trust.test.ts \
  lib/communication/message-destination.test.ts
```

Result: **67 pass / 0 fail** (pre-commit).
