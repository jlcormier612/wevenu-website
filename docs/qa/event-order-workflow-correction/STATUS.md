# Event Order selection request vs Event Order share

## Status

**GREEN for selection-email isolation** (proven on live Sandbox).  
Composer deploy `3ad50017` is a separate in-progress image; isolation does not depend on that SHA.

## Forensic verdict

Sending **Send selection request** emails a secure Choices link via the same `sendEmail` + conversation outbound path as proposals. It does **not** share, finalize, or accept the Event Order.

The portal **Shared** / **Accept this Event Order** UI on fixture `ebf74f77-…` is a **pre-existing** shared Event Order (`shared_at` `2026-10-24T02:24:06Z` from an earlier explicit Share). Ten+ later selection sends left `shared_at` unchanged. `client_agreed_at` remains null.

Details: `SELECTION-VS-SHARE.md`, `selection-vs-share-probe.json`, `selection-email-isolation-results.json`.

## Live isolation proof (this turn)

| Item | Value |
| --- | --- |
| Serving image | `htc-sandbox-venue-app:3377a8614cb9e66637142f36495b36bc4dba774a` |
| Digest | `sha256:95ad0e6068b06255884e75f86e3386294f0eca4af2fd0c35f8704b23d6e4d8fe` |
| Harness | `verify-selection-email-isolation.mts` → **GREEN 10/10** |
| Email | `status=accepted`, `sourceType=client_choices_request`, Resend `01a16c0e-…` |
| URL (redacted) | `https://app.sandbox.hellotocheers.com/p/[redacted]?view=choices#choices` |
| Link opens | **Your Choices** (not Accept this Event Order) |
| `shared_at` | unchanged `2026-10-24T02:24:06.106Z` |
| `client_agreed_at` | null |
| Invoices | 1 → 1 |
| Booking | `confirmed` / `booked_at` 2026-10-22 unchanged |

Shots: `shots/isolation-send-dialog-1280.png`, `shots/isolation-selection-link-1280.png`.

## Code / tests

- Path: ShareDialog → `sendClientChoicesRequest` → `sendClientChoices` + `submitClientChoicesCoupleEmail` (mirrors proposal couple email).
- No call to `shareEventOrderWithClient` / `setSharedAt`.
- Regression: `lib/client-choices/selection-request-lifecycle.test.ts` (pass).
- Full journey harness now asserts isolation before any intentional Share.

## Follow-up deploy (composer typefix)

| Item | Value |
| --- | --- |
| Commit | `3ad50017c386282f2f0f0437aa3f7af119f88e32` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40060379987 (in progress at report time) |

Fixes `ChoicesDefinitionView` `pricingModel` typing that blocked the prior `2bdb49e4` build. Production untouched.
