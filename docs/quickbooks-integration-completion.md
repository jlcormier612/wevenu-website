# QuickBooks Online Launch Integration — Completion Report

**Date:** 2026-07-21
**Status:** Built and live-verified against real Intuit sandbox endpoints. Blocked only on real Intuit sandbox credentials for the final "does a legitimate sync actually create a real object" confirmation — same posture as TR-M1 (Stripe collection) before its credentials arrived.

Supersedes `docs/quickbooks-integration-assessment.md`'s "large post-launch initiative" recommendation — the user declared this a launch requirement with a bounded scope and it has since been designed and built end-to-end.

---

## Scope, as declared

**Required for launch:** OAuth connection, Customer sync, Invoice sync, Payment sync, Refund/credit sync, connection health, retry/error queue, disconnect/reconnect, sync status on records, idempotent operations.

**Explicitly not required for launch:** Chart-of-accounts mapping UI, tax engine, product catalog sync, vendor accounting, expense sync, bank reconciliation, journal entries, full bidirectional editing.

**Direction:** one-directional push only — Wevenu → QuickBooks. No inbound webhooks, no drift detection. Every invoice line item pushes under one generic "Wevenu Services" placeholder Item, since chart-of-accounts mapping is out of scope.

---

## What's built

| Piece | File(s) | State |
|---|---|---|
| Schema | `supabase/migrations/20261126000000_quickbooks_integration_phase_a.sql` + 2 follow-up grant migrations | `quickbooks_connections`, `quickbooks_sync_queue`, `quickbooks_sync_log`, sync-status columns on `clients`/`invoices`/`payment_line_items` |
| OAuth connect/disconnect | `lib/quickbooks/service.ts`, `app/api/quickbooks/callback/route.ts`, `components/settings/quickbooks-connect-section.tsx` | Mirrors Stripe Connect; calls Intuit's own revoke endpoint on disconnect (an improvement over Stripe Connect, which never does) |
| Token refresh | `lib/quickbooks/client.ts` | Proactive (2-min buffer) + lazy-on-401, no separate polling job |
| Retry queue + processor | `lib/quickbooks/queue.ts`, `lib/quickbooks/processor.ts`, `lib/quickbooks/backoff.ts`, `app/api/quickbooks/sync/process/route.ts`, cron every 5 min | Atomic claim, connection circuit breaker, dependency ordering (Invoice waits on Customer; Payment/Refund wait on Invoice), exponential backoff to dead-letter (~1 day, 8 attempts) |
| Customer sync | `lib/quickbooks/sync/customer.ts` | Idempotent on `DisplayName` query-before-create |
| Invoice sync | `lib/quickbooks/sync/invoice.ts`, `lib/quickbooks/items.ts` | Idempotent on `DocNumber` = Wevenu's `invoice_number`; placeholder Item auto-created and cached per venue |
| Payment sync | `lib/quickbooks/sync/payment.ts` | Idempotent on a Wevenu ID embedded in QBO's `PrivateNote` field |
| Refund sync | `lib/quickbooks/sync/refund.ts` | Pushed as a QBO RefundReceipt; same `PrivateNote` idempotency mechanism |
| Sync status UI | `components/quickbooks/sync-status-badge.tsx`, wired into invoice detail and payment-line-item rows | Never shown for venues with no QuickBooks connection |
| Recent sync activity | `components/settings/quickbooks-connect-section.tsx` | Last 20 `quickbooks_sync_log` rows, in Settings |

Enqueue hooks fire from: `createClient_`/`updateClientInfo` (Customer), `updateInvoiceStatus`'s sent transition **and** `addLineItem`/`removeLineItem` on any non-draft invoice (Invoice — this second path was a real gap found during planning, not in the original research: those two functions had no status guard at all, so an invoice edited after being sent would otherwise never re-sync), `markLineItemPaid` (Payment), `refundLineItem_` (Refund).

---

## Real bugs found and fixed during this build

Every one of these was found by live-testing against the running dev server and local Postgres, not by code review alone:

1. **Missing `service_role` GRANTs on `clients`/`invoices`/`payment_line_items`.** A dead-letter test showed a client's `quickbooks_sync_status` silently staying `not_synced` instead of advancing to `failed`. RLS bypass via `rolbypassrls` does not imply table privileges — fixed in `20261127000000_quickbooks_service_role_grants.sql`.
2. **Missing `service_role` SELECT grant on `invoice_line_items`.** Same hazard, found the same way: a real invoice with a real line item came back "Invoice has no line items to sync." Fixed in `20261128000000_quickbooks_invoice_line_items_grant.sql`. This is the third and fourth instance of this exact hazard class this engagement (after `vendor_inquiries`/`vendor_tasks` in Sprint 2) — every new service-role write/read path in this codebase needs its grants checked explicitly, never assumed.
3. **Cron route unreachable via middleware.** `curl /api/quickbooks/sync/process` redirected to `/login` because `integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` allowlist didn't include it. Vercel Cron never carries session cookies, so this would have silently never run in production. Fixed by adding the route to the allowlist.
4. **`addLineItem`/`removeLineItem` invoice-edit gap.** Found during plan verification, not the original research pass: these two functions have no status guard at the repository level, so a coordinator can edit an already-sent invoice's line items with nothing re-triggering a sync. Fixed by enqueueing a re-sync whenever the invoice's current status isn't `draft`. (The underlying question of whether invoices *should* be editable after sending is a separate product decision, out of scope here — same shape as TR-L1 for contracts.)

---

## Live verification performed

Using the same technique proven in Sprint 1/2 (real signed sessions, real Postgres fixtures, zero residue after cleanup) plus one addition specific to this integration: real HTTP calls against Intuit's actual sandbox endpoints (`sandbox-quickbooks.api.intuit.com`, `oauth.platform.intuit.com`) using fake-but-realistic credentials. This exercises every real code path — token refresh, 401 handling, error classification (retryable vs. not), dependency checks, backoff, dead-letter, status propagation — against Intuit's real rejection behavior, without needing real credentials to exist yet.

Confirmed live and correct:
- Invoice sync's dependency check blocks (retryable) when the Customer hasn't synced yet, without ever calling the QBO API.
- Payment/Refund sync's dependency check blocks (retryable) when the Invoice hasn't synced yet, same way.
- A real 401 from Intuit correctly triggers one forced-refresh retry; a real `invalid_client` rejection on refresh is correctly classified non-retryable and dead-letters immediately (not after burning all 8 attempts).
- Dead-lettering correctly flips the record's own `quickbooks_sync_status` to `failed`; a `failed_retrying` outcome correctly leaves it at `pending` so a coordinator never sees a false "failed" badge mid-backoff.
- The connection circuit breaker correctly skips (without burning an attempt) any queue item for a venue whose connection just flipped to `error`.
- `tsc --noEmit` and `next build` both clean (filtering the pre-existing, untracked `shared/relationships/` noise this engagement has flagged separately).

## What remains genuinely blocked on credentials

No live Intuit sandbox app/credentials exist yet. Every HTTP-call code path and error-classification branch above has been verified against Intuit's real endpoints using fake credentials that are correctly rejected — but a genuinely successful sync (a real Customer/Invoice/Payment/RefundReceipt actually created in a real QBO sandbox company) cannot be confirmed until real credentials are provided. The one piece flagged in the design as needing the most scrutiny once that happens: whether QBO's `query` API reliably filters on the `PrivateNote` field for Payment/RefundReceipt idempotency — if it doesn't, the queue's own `payload_hash` dedup is the documented fallback guard.
