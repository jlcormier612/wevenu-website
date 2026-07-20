# Commitment Alignment Sprint — Documents (Private Until Shared) Report

Closes item 5 of 5 — the final item — in the Commitment Alignment Sprint, per `docs/commitment-lifecycle-architecture.md` §9's Domain Mapping Matrix. All five items are now compliant; see `docs/commitment-alignment-sprint-final-report.md` for the sprint-wide closing summary.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261028000000_..._documents_private_until_shared.sql` | `contracts.is_couple_visible` and `invoices.is_couple_visible` default changed to `false`; backfill recomputes every existing row from its own `status` (`<> 'draft'`), so nothing already legitimately shared gets silently un-shared |
| 2 | `lib/contracts/repository.ts` (`updateContractStatus`) | Sets `is_couple_visible = true` at the exact moment a contract is sent — the only place that ever sets it |
| 3 | `lib/invoices/repository.ts` (`updateInvoiceStatus`) | Same, for invoices, at the exact moment one is sent |
| 4 | `lib/invoices/repository.ts` (`revertToDraft`) | Sets `is_couple_visible = false` when a sent invoice is pulled back to Draft — symmetric with the fix, so a Draft's live edits (per the Commitment Lifecycle's own versioning rule) never leak to the couple mid-edit |

## The Finding, As Governed By Your Instructions

`is_couple_visible` on both `contracts` and `invoices` has defaulted `true` since it was added, and — grep-confirmed across the entire codebase — nothing outside its own column definition and `get_couple_documents`'s read filter ever referenced it. Every contract and every invoice, including one still sitting in Draft that a venue hasn't sent, has been visible to the couple from the moment it was created, because of a default value, not because of anything the venue did.

Per your instruction, the fix is exactly the platform principle already governing every other domain in this sprint — **Private until intentionally shared** — applied without inventing anything new: both tables already have a real, existing Draft → Sent lifecycle transition (contracts also have Signed/Cancelled beyond that; invoices have Paid/Void). That transition is the one place a venue takes an explicit action meaning "the couple should see this now." `is_couple_visible` now just tracks that transition faithfully instead of sitting inert at its default.

## Design Decisions

1. **Backfill recomputes from status, not from the stale default.** Since nothing ever wrote a meaningful value to this column, every existing row's `is_couple_visible` was already just the default (`true`), regardless of whether it was ever actually sent. Recomputing `is_couple_visible = (status <> 'draft')` for all existing rows is therefore not a judgment call or a data-loss risk — it's deriving the column's first-ever real value from the one field that's always accurately tracked the truth.
2. **Revert-to-draft also un-shares, symmetrically.** This wasn't explicitly named in your instruction but follows directly from the same principle: the Commitment Lifecycle's own versioning rule says live-sync is only ever allowed while Draft. If a sent invoice gets pulled back to Draft for editing, and stays visible to the couple the whole time, that's the Draft-stage live edits leaking straight to the Published Audience — the same violation this item exists to close, just triggered the other direction. Re-sending is the same explicit action that shares it again; nothing new introduced.
3. **Contracts have no revert-to-draft path, so only the send transition needed the flag.** Once sent, a contract can only become Signed, Cancelled, or Expired — never back to Draft (confirmed in `updateContractStatus`'s existing transition guards) — so there's no symmetric case to handle there.
4. **No new column, no new status value, no new UI.** The fix is two `alter column ... set default` statements, a one-time backfill, and one line added to each of two already-existing status-transition writes.

## Live Validation

Real venue, real client, real authenticated session (signed in as a real test user, not a service-role bypass), real HTTP route.

- **Contract**: created a draft contract via `insertContract` — curled the live `/api/portal/documents` route: not present. Called the real `updateContractStatus(..., "sent", { sentAt: true })` — curled again: present, `status: "sent"`.
- **Invoice**: created a draft invoice via `insertInvoice` — not present in the portal response. Called the real `updateInvoiceStatus(..., "sent")` — present, `status: "sent"`. Called the real `revertToDraft(...)` — disappeared from the portal response again, confirming the symmetric un-share.
- All five assertions passed in one continuous run against the actual running dev server, not a simulated or mocked path.
- `tsc --noEmit` clean (only the two pre-existing, unrelated stale `.next` entries noted in every report this session). Migration applied via `migration up --local`.

All test data (venue, auth user, client, contract, invoice, portal session) created and fully removed; final verification confirmed zero leftover rows.

## Recommendation: Commitment Alignment Sprint Complete

This closes the last open item in `docs/commitment-lifecycle-architecture.md` §9's Domain Mapping Matrix. Every domain row is now Compliant except Timeline, which remains intentionally paused pending its own already-designed target model (§12 of the Client Workspace doc) — an explicit, named exception, not an oversight. See `docs/commitment-alignment-sprint-final-report.md` for the full sprint-wide summary.
