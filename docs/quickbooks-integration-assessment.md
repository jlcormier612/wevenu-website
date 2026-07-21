# QuickBooks Integration Assessment

**Status: superseded.** This assessment (below, unedited) found zero QuickBooks code anywhere in the codebase and recommended treating it as a large post-launch initiative. The user then declared it a launch requirement with a bounded scope. It has since been designed and built — see [`docs/quickbooks-integration-completion.md`](./quickbooks-integration-completion.md) for current state. This document is kept as the historical record of where things stood before that decision.

**Research only — no implementation (at the time this was written).** This document answers exactly where the platform stands on QuickBooks integration today, verified by direct codebase inspection (grep across every `.ts`/`.tsx`/`.sql`/`.md` file, `package.json` dependencies, environment variable usage, and the live Settings page), not assumption.

**Date:** 2026-07-21

---

## Is a QuickBooks integration present in any form?

**No — not in any form, anywhere in the application.** Every specific sub-item:

| Item | Present? | Evidence |
|---|:---:|---|
| OAuth | ❌ No | No OAuth flow, route, or token-exchange code references QuickBooks/Intuit anywhere. (The app *does* have a real OAuth flow — Stripe Connect, `app/api/stripe/callback/route.ts` — which shows the team knows how to build one; it was simply never built for Intuit.) |
| Intuit App (Developer account / app registration) | ❌ No | No `client_id`/`client_secret`-shaped config, no Intuit App SDK, no reference anywhere |
| API client | ❌ No | No `node-quickbooks`, `intuit-oauth`, or any Intuit SDK in `package.json` (main app or marketing) |
| Sync jobs | ❌ No | `vercel.json`'s 4 declared cron jobs are notifications, digest, scheduled-communication processing, and automation processing — none touch accounting or QuickBooks |
| Manual export | 🟡 Exists, but not accounting-shaped | Settings → "Your Data" (`components/settings/data-export-section.tsx`) exports a raw JSON dump of clients/events/contracts/invoices/payments. It's a data-portability backup, not a QuickBooks-importable format (no CSV, no IIF, no chart-of-accounts mapping) — a venue would need to hand-rebuild it before QuickBooks could import anything |
| Placeholder UI | ❌ No | Settings page has real integration sections (Stripe Connect, Data Export, Team) — no QuickBooks card, button, or "coming soon" placeholder anywhere in the actual app |
| Environment variables | ❌ No | Zero `QUICKBOOKS_*`/`QBO_*`/`INTUIT_*` variables anywhere (cross-checked against the complete env var inventory already compiled for `docs/rc-launch-validation-runbook.md`) |
| Database schema | 🟡 One comment, no real schema | `supabase/migrations/20260627080000_packages_invoices.sql`: `invoice_line_items.type` (an enum including `package`/`addon`/`inventory`/`discount`/`fee`/`tax`/`deposit`/`item`) has a comment reading *"Types map to QBO account categories for future accounting sync (see memory: accounting-integration)."* No column, table, or constraint actually implements any mapping — it's a comment expressing intent, not a schema |
| Feature flags | ❌ No | No feature-flag file or mechanism references QuickBooks anywhere |

**One finding that matters more than the missing code:** the public marketing site (`marketing/lib/marketing/features-page.ts`, the "Financials" feature group) lists **"QuickBooks Integration"** as a feature, alongside real, shipped features like Payment Plans, Invoices, and Refund Tracking. A prospective venue reading that page has no way to know this is the one item in that list that doesn't exist at all — everything else in that same list is real and shipped. This is a live, customer-facing claim with nothing behind it, not a backlog item.

**The dangling memory reference is itself a small finding.** The migration comment says "see memory: accounting-integration" — no such memory file exists in this project's memory store (`accounting-integration.md` is not present, and nothing else in memory references QuickBooks or accounting sync). Either the memory was written once and lost, or the comment was aspirational and the memory was never actually created. Either way, whatever design thinking prompted that comment isn't recoverable from anything in this repository today.

---

## What works today / what's incomplete / what's abandoned

Not applicable in the usual sense — there's no partially-built feature to evaluate. But precisely because there's *nothing* built, it's worth being exact about what that means:

- **What works today:** Nothing. There is no code path a venue could exercise, not even a broken one.
- **What is incomplete:** Nothing is "incomplete" in the sense of unfinished-but-started work — the one artifact that exists (the `invoice_line_items.type` enum) is complete and correct *on its own terms* (it's a real, working, already-shipped part of the invoicing system); its only connection to QuickBooks is a comment noting the values happen to be chosen with future accounting-category mapping in mind.
- **What has never been wired:** Everything — OAuth, API client, sync engine, webhook receiver, error handling, reconciliation. There's no partial wiring to describe.
- **Has any part been abandoned?** Not "abandoned" in the sense of started-then-stopped — more accurately, **never started**. The one piece of evidence that anyone ever thought concretely about this (the migration comment + its now-missing memory reference) predates this engagement and was never picked up again in any of the initiatives this engagement has tracked (RC1, Lead Intake, RC2, Sprint 1, Sprint 2). It's a dropped thread, not a stalled build.

---

## Comparison against what a venue actually needs before launch

For each capability, "current state" reflects what exists in the codebase today (not what QuickBooks integration would need to build) — since there is no integration, every row starts from zero, but the *distance* to a working version differs by how much the underlying domain model already exists.

| Capability | Current state | Distance to close |
|---|---|---|
| **Customer sync** | `clients` table exists with real venue/relationship data; nothing syncs it anywhere | Needs the whole sync direction built: create/update QuickBooks Customer on client creation/edit, handle name changes, handle merges |
| **Invoice sync** | Real `invoices`/`invoice_line_items` tables, fully functional for in-app invoicing | Needs a full push-sync to QuickBooks Invoice objects, including matching `invoice_line_items.type` to actual QuickBooks Items/Categories (the one thing the schema comment gestures at, but doesn't implement) |
| **Payment sync** | Real `payment_schedules`/`payment_line_items`, `markItemPaid` guarded against double-marking (Sprint 2) | Needs push-sync of each payment as a QuickBooks Payment linked to the synced Invoice |
| **Refund synchronization** | Real refund flow exists (`refundLineItem`, TR-M3, adds `refunded_amount`/`refunded_at`/`refund_reason`) | Needs push-sync of refunds as QuickBooks Refund Receipts/Credit Memos, correctly reversing the matched payment |
| **Product/Service Items** | `packages`/`invoice_line_items.type` model exists, but no concept of a QuickBooks Item ID anywhere | Needs a mapping table (Wevenu package/line-item-type ↔ QuickBooks Item) and a UI for a venue to set that mapping once |
| **Taxes** | No tax-rate or jurisdiction model at all — `tax` is just one more free-text line-item `type`, manually entered by a coordinator | Needs real tax-rate modeling before sync even makes sense, since there's nothing structured to sync today (this is a bigger gap than "add a sync," it's "build tax modeling," which doesn't fully exist independent of QuickBooks) |
| **Deposits** | Real deposit handling exists (`payment_schedules`, deposit-shaped `invoice_line_items.type`, `TR-M3`'s refund logic already treats deposits correctly for the in-app ledger) | Needs deposits to sync as QuickBooks-recognized deposit transactions, correctly linked to the eventual invoice they apply against |
| **Chart of Accounts mapping** | Doesn't exist in any form | Needs to be built from scratch: a settings UI for a venue to map each Wevenu line-item type/category to their real QuickBooks chart of accounts |
| **Webhooks/import back from QuickBooks** | No inbound integration of any kind | Needs a full webhook receiver (mirroring the pattern already proven for Resend/Twilio inbound in this codebase) plus reconciliation logic for anything changed on the QuickBooks side (a payment recorded there first, an invoice voided there, etc.) |
| **Error handling** | N/A — nothing to fail yet | Needs the same "never silently claim success" discipline already enforced everywhere else in this codebase (see the Trust Risk Register's repeated pattern of catching exactly this class of bug) applied to a brand-new integration surface |
| **Reconciliation** | N/A | Needs a real reconciliation job/UI — QuickBooks and Wevenu will diverge (manual edits on either side, sync failures, timing gaps) and someone needs a way to see and resolve that |
| **OAuth refresh** | N/A — no OAuth exists yet | Standard Intuit OAuth2 refresh-token handling, needs building from scratch (though the Stripe Connect OAuth flow already in this codebase is a reasonable structural template) |
| **Disconnect/reconnect** | N/A | Needs a Settings UI affordance (would sit naturally next to the existing Stripe Connect section) plus the data-integrity question of what happens to already-synced records on disconnect |

**Net read:** this isn't a partially-built feature with a few gaps — it's twelve separate, real engineering problems, none of which have been started, sitting behind a public marketing claim that implies all twelve are done.

---

## Recommendation: **Large post-launch initiative**

Not "already launch-ready" — nothing exists. Not "small completion effort" — there's no existing implementation to complete. Not even "medium initiative" in the sense of extending working infrastructure — every one of the twelve capabilities above starts from zero, and at least one (Taxes) requires building real domain modeling that doesn't exist independent of QuickBooks at all.

This is comparable in shape to TR-M1 (real Stripe payment collection) — a fully separate, real integration effort, correctly sequenced as its own initiative rather than folded into launch scope. The difference: TR-M1 is blocked only on credentials (the design is done, `docs/stripe-payment-architecture.md`); QuickBooks integration has no design document, no architecture decision, and no credentials/Intuit App registration in place either.

**Two things worth doing now, neither of which is "building the integration":**

1. **Fix the marketing claim.** "QuickBooks Integration" is listed as a shipped feature to prospective customers today, and it doesn't exist. This is a launch-readiness item in the same category as everything else this engagement has been correcting — a real-world claim not backed by reality — except this one is customer-facing marketing copy, not an internal bug. Recommend either removing it from the features list before launch, or changing its framing to something honest ("Accounting export," "Data export," or simply not listing it) until it's real.
2. **If a real QuickBooks integration is wanted, scope it as its own initiative** with an actual design document (mirroring how Stripe collection was designed before any code was written) — starting with the two hardest, most foundational open questions: real tax-rate modeling (needed regardless of QuickBooks) and the Chart of Accounts mapping UI (the one piece every other capability in the table above depends on).
