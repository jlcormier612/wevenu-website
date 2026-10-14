# Gate A — Email delivery failure guidance (forensic)

**Environment:** Sandbox only (`wvpsldwwjqdannqasrdf`)  
**Date:** 2026-10-13  
**Decision:** No schema change, no provider/config change, no status-semantics change. Proceed with mapping + persistence-of-reason + UI guidance (Gate B).

## Failure paths traced

| Path | What happens | What venue sees today |
|------|----------------|------------------------|
| Send-time HTTP error (`sendEmail` → Resend) | `classifyResendHttpFailure` collapses most non-quota/non-429 cases to `"Email send failed due to a provider error."` and **drops the HTTP body** | Generic provider sentence (or, after `acceptOutboundEmail` → `translateEmailFailure`, even more generic `"Your message couldn't be delivered."`) |
| Conversation send reject | `acceptOutboundEmail` runs `translateEmailFailure` on the already-classified message; returns error to UI and **does not persist** a failed conversation row | Toast / inline error only |
| Bounce webhook (`email.bounced`) | Sets `failure_reason` from `translateEmailFailure("Bounced at <timestamp>")` — **ignores** `data.bounce.type/subType/message/diagnosticCode` | Almost always `"Your message couldn't be delivered."` |
| Event audit | Full webhook payload stored in `conversation_message_events.payload` | Not shown in Message History badge |

## Root cause (combination)

1. **Application discards specifics** at send classification (`lib/email/resend-failure.ts` default `provider` branch).
2. **Webhook mapping too broad** — bounce timestamp string has no classifiable signals (`app/api/messaging/webhook/route.ts` + `lib/communication/failure-messages.ts`).
3. **Double-normalization** — `acceptOutboundEmail` re-runs `translateEmailFailure` on already-safe classifier output, wiping quota/rate-limit copy when that path is used.
4. **UI shows only `failure_reason`** — richer bounce diagnostics already exist in events but are unused for the badge.

Not primarily “provider returned nothing useful”: bounce payloads in Sandbox include `type`, `subType`, `message`, and `diagnosticCode`.

## Observed Sandbox categories (conversation_messages, email failed/undelivered, n≈69)

| Bucket | Count | Evidence sample (redacted) |
|--------|------:|----------------------------|
| Generic couldn't deliver | 59 | `"Your message couldn't be delivered."` — mostly bounce webhooks |
| Quota (legacy raw JSON persisted) | 5 | `Email send failed: {"statusCode":429,"name":"daily_quota_exceeded",...}` |
| Invalid recipient (legacy raw JSON) | 3 | `422 validation_error Invalid \`to\` field … example.com` |
| Generic provider classifier | 1 | `"Email send failed due to a provider error."` |
| QA injected | 1 | `"QA injected provider failure"` |

### Bounce event stats (`email.bounced`, n=59 sampled)

| bounce.type / subType | Count |
|-----------------------|------:|
| Transient / General | 56 |
| Permanent / General | 3 |

Example Transient diagnostic (safe fragment): `smtp; 550 4.4.7 Message expired… Unable to connect to remote host` / `Unable to lookup DNS for example.test`.

## Fields available vs lost

| Field | Available? | Used for venue UI today? |
|-------|------------|--------------------------|
| HTTP status + Resend JSON body at send | Transiently in `sendEmail` | No — collapsed before persist |
| `conversation_messages.failure_reason` | Yes | Yes (badge reason) |
| `conversation_message_events.payload` bounce object | Yes | No (support/audit only) |
| Resend `bounce.type` / `message` / `diagnosticCode` | Yes in events | No |
| Secrets / auth headers | Never stored in failure_reason | N/A |

## Accuracy concerns in current copy

- Rate-limit translation claims *“this one will be retried shortly”* — **no automatic retry** exists for that path.
- Bounce failures are not labeled temporary vs permanent even when Resend provides `bounce.type`.

## Recommended minimal implementation (no schema)

1. Structured email-failure guidance helper (category + explanation + next action + retryAppropriate + safe diagnostic).
2. Expand send-time classifier (422 invalid `to`, 5xx temporary, preserve safe detail).
3. Stop destroying already-classified `SendResult` messages in `acceptOutboundEmail`.
4. Webhook: derive `failure_reason` from bounce type/message (not timestamp-only).
5. Display: resolve guidance from stored reason (including legacy `Email send failed: {json}`) and show next step on the badge.
6. Gate Retry suggestion when category is retry-unsafe.

## Privacy / support

- Do not surface raw Authorization headers or API keys (never persisted today).
- Sanitize emails out of any diagnostic snippets shown to venue owners.
- Keep full event payloads for authorized support troubleshooting.
- Contact support when category is unknown.

## Stop / proceed

- **Schema change:** not required → proceed Gate B.  
- **Provider behavior / auto-retry / status semantics:** unchanged.
