# Communication Readiness — status definitions & test-message repair

## Verdict: GREEN (Sandbox)

| Field | Value |
|--------|--------|
| Commit | `6abedcfb408d653b94ab1f4d3d65fc58ef3a3e3d` |
| Serving (`dpl`) | `6abedcfb408d653b94ab1f4d3d65fc58ef3a3e3d` |
| Deploy | [38448251809](https://github.com/jlcormier612/wevenu-website/actions/runs/38448251809) success (retry after marketing ECR rate-limit flake on [38447725280](https://github.com/jlcormier612/wevenu-website/actions/runs/38447725280)) |
| Focused tests | 18/18 (`message-status-definitions`, `test-send`, `delivery-result`) |
| Browser | `verify-browser.mts` — 13/13 PASS |

## Root cause (email test)

The server action could succeed (`ok: true` + Resend accept) while the UI only used a transient toast and claimed “delivered.” Operators often saw no durable feedback, and success copy overstated delivery. SMS test stayed clickable whenever a venue phone existed even when texting was `not_ready`, which could call Twilio resolution.

## Verified status mappings

| UI label | Persisted status / event |
|----------|---------------------------|
| Sent | `accepted` ← `email.sent` / `sms.sent` (provider accepted submit) |
| Delivered | `delivered` ← `email.delivered` / `sms.delivered` |
| Received | inbound `received` / inbound conversation message |
| Replied | outbound advanced to `replied` when inbound matched |
| Couldn't deliver / Not delivered | `failed` / `undelivered` → needs attention |

Opened/Clicked are email engagement only; not claimed as “read” for SMS.

## Dashboard counts

Fancy example on proof run: tiles can show Sent > Delivered with Needs attention = failures only. Pending `accepted`/`sending` rows count as Sent, not Delivered, not Needs attention — intentional. Explained via `DASHBOARD_COUNT_NOTE` under the tiles.

## SMS

Unconfigured Fancy: Send test text disabled; copy states provider will not be called. Configured SMS E2E not run (no authorized configured test venue in this pass).

## Evidence

- `browser-results.json`, `desktop-readiness.png`, `after-email-test.png`, `narrow-readiness.png`
- `verify-browser.mts`, `reproduce-email-test.mts` / `reproduce-results.json` (pre-fix)

Production untouched. Unrelated dirty/untracked work preserved.
