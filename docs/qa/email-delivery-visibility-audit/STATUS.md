# Customer-facing email delivery visibility

**Status: IMPLEMENTED — Sandbox deploy in progress — NOT GREEN until browser verify**

| Field | Value |
|-------|--------|
| Commit | `3f30db10ab2e3343482e475cd5c46b0f8b2648e4` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38624571701 (`in_progress`) |
| Focused tests | **67 pass / 0 fail** |
| Browser verify | Pending serving SHA `3f30db10…` — `verify-browser.mts` |
| Open/click tracking | Separate — **NOT GREEN** |
| Production / Resend / DNS | Untouched |

## What changed

Compact message badges; failure detail in timeline popover; calm guidance (no reputation scare / no routine support invite); Communication Health shows **Readiness only** (aggregate tiles/widget/failure list deferred).

## What did not change

Status semantics, webhooks, counts helpers, recovery actions, provider config.

## Next

When deploy succeeds: `EXPECTED_SHA=3f30db10ab2e3343482e475cd5c46b0f8b2648e4 npx tsx docs/qa/email-delivery-visibility-audit/verify-browser.mts`
