# Email delivery failure guidance

**Status: GREEN** (Sandbox runtime verified)

## Gate A — Root cause

Combination (see `FORENSIC.md`):

1. Send-time classifier collapsed most Resend HTTP failures to `"Email send failed due to a provider error."` and dropped the body.
2. Bounce webhook stored a non-classifiable timestamp string / generic couldn't-deliver line instead of `bounce.type` / `message` / `diagnosticCode`.
3. `acceptOutboundEmail` re-ran `translateEmailFailure` and wiped already-classified quota/rate copy.
4. UI showed only `failure_reason` with no next-step guidance.

Not primarily “provider returned nothing” — Sandbox bounce events include structured fields; legacy rows still hold `Email send failed: {json}`.

## Observed categories (Sandbox evidence)

| Category | Signals | Evidence |
|----------|---------|----------|
| `quota` | HTTP 429/402 + quota/usage wording; `daily_quota_exceeded` | Fancy JSON `failure_reason` |
| `rate_limit` | HTTP 429 + `rate_limit_exceeded` / too many requests | Classifier + unit tests |
| `invalid_recipient` | HTTP 422 `validation_error` + invalid `to` | Fancy/other JSON fixtures |
| `temporary_provider` | HTTP ≥500 | Unit tests |
| `temporary_bounce` | Webhook `bounce.type=Transient` / general bounce prose | Fancy Message History |
| `permanent_bounce` | Webhook `bounce.type=Permanent` / hard bounce prose | Fancy fixtures |
| `unknown` | Missing/unclassified body; generic provider sentence | Unit tests (+ support path) |

## Classification rules (exact)

Implemented in `lib/communication/email-failure-guidance.ts`:

- Prefer structured `statusCode` / `name` / bounce `type` over loose substrings.
- Persist venue-safe **explanation** only; keep full event payloads for support.
- Retry suggested only when `retryAppropriate` (rate_limit, temporary_provider, temporary_bounce).
- Never invent bounce/invalid/temporary without matching evidence.

## Files changed

- `lib/communication/email-failure-guidance.ts` (+ test)
- `lib/communication/failure-messages.ts`
- `lib/email/resend-failure.ts` (+ test)
- `lib/conversations/delivery-display.ts`, `delivery-result.ts`, `delivery-recovery.ts`
- `components/messaging/message-status-badge.tsx`
- `components/conversations/conversation-thread.tsx` (pass `failureReason` into recovery)
- `app/api/messaging/webhook/route.ts` (structured bounce → `failure_reason`)
- Tests: `delivery-result.test.ts`, `messaging-trust.test.ts`
- QA: `docs/qa/email-delivery-failure-guidance/*`

## Focused tests

```bash
npx tsx --test \
  lib/communication/email-failure-guidance.test.ts \
  lib/email/resend-failure.test.ts \
  lib/conversations/messaging-trust.test.ts \
  lib/conversations/delivery-result.test.ts
```

**53 pass / 0 fail** (plus related suite runs during development).

## Deploy / serving

| Item | Value |
|------|--------|
| Commit | `9762445ca73df5db3965ef2c2b321cdd589c80c5` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38492956114 |
| Serving image | `htc-sandbox-venue-app:9762445ca73df5db3965ef2c2b321cdd589c80c5` |

Production untouched. No emails/texts sent; viewing failures invoked no send/retry APIs.

## Browser evidence

Fancy → `/messaging/health?attention=1` (1280 + 390):

- `Couldn't deliver` preserved
- Next-action nodes present (`message-failure-next-action`)
- Quota / bounce guidance and support paths visible without raw JSON / secrets
- Artifacts: `attention-desktop.png`, `guidance-desktop.png`, `guidance-390.png`, `browser-results.json`

## Remaining unclassified

- Truly empty/malformed diagnostics → honest unknown + support next step.
- Historical rows that never stored bounce/HTTP detail remain unknown unless event payloads exist for repair (support can still read `conversation_message_events.payload`).
