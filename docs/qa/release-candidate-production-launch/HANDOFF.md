# HTC — Release Candidate / Production Launch Handoff

**Document purpose:** Convert completed Sandbox release-readiness work into a concise, factual production-launch handoff.

**Document status:** Authoritative RC / Production Launch Handoff as of 2026-10-06.

**This document is not** a product audit, a new checklist, or permission to reopen closed work.

---

## HTC PRODUCT RELEASE READINESS — GREEN / COMPLETE

The finite master checklist contains **11** existing items.

**11/11 finite checklist rows reconciled.**

Do **not** describe this as “9 + 3”; that would total 12.

### 8 — Product GREEN / CLOSED

| # | Existing master item | Status |
|---|---|---|
| 1 | Help / Guides | 🟢 GREEN/CLOSED |
| 2 | `ones → one` copy correction | 🟢 GREEN/CLOSED |
| 3 | Post-Event / Feedback | 🟢 GREEN/CLOSED |
| 4 | Branding / Terminology final polish | 🟢 GREEN/CLOSED |
| 5 | Permissions / Security integrated acceptance | 🟢 GREEN/CLOSED |
| 6 | Engineering Cleanup | 🟢 GREEN/CLOSED |
| 9 | Real Customer Journey / Integration Sweep | 🟢 GREEN/CLOSED |
| 10 | Mobile / Human Acceptance | 🟢 GREEN/CLOSED |

### 3 — Product GREEN / External Verification Pending

| # | Existing master item | Product status | External dependency |
|---|---|---|---|
| 7 | Facebook Lead Ads | 🟢 PRODUCT GREEN | Fancy OAuth connection pending (Daisy Sandbox already demonstrated connected integration) |
| 8 | QuickBooks | 🟢 PRODUCT GREEN | Fancy OAuth connection pending (Daisy Sandbox already demonstrated connected company) |
| 11 | Twilio / A2P | 🟢 PRODUCT GREEN | Carrier verification pending; Fancy phase `details_needed` |

These three are **not** engineering reopen items. They are third-party account / carrier actions outside the product checklist.

---

## Help / Guides — GREEN/CLOSED

### Final serving application

| Field | Value |
|---|---|
| Task definition | `htc-sandbox-venue-app:593` |
| Sole running task | `f4fb863167574c5aac24b4c5447e88bc` |
| Image SHA | `5c6ec487d64d49c462bda2567825e1e81582ce79` |
| Image digest | `sha256:c9512fdbe70d9e50a951771901f50d110006426bcc8839042bd4e67e4c3732a3` |
| `data-dpl-id` | `5c6ec487d64d49c462bda2567825e1e81582ce79` (matches image SHA) |
| Health | `https://app.sandbox.hellotocheers.com/api/health` → HTTP 200 `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Prior runtime retired | `:592` / `48e4244b` no longer serving |
| Cluster | `htc-sandbox` only (`htc-production` absent) |
| Production | Untouched |

Deploy that placed this image:

`https://github.com/jlcormier612/wevenu-website/actions/runs/37506971110` (success)

### Forensic finding (Help content is database-backed)

Help content is database-backed.

`getPublishedArticleBySlug` reads `success_library_articles` first and falls back to editorial TypeScript only when no published row exists.

Therefore the original `5c6ec487` editorial correction alone could not change the live published article because a published DB row already existed.

### Minimum corrective migration

| Field | Value |
|---|---|
| Migration | `supabase/migrations/20261412800000_help_task_center_lenses_copy.sql` |
| Commit | `6099ceb5` |
| Apply workflow | `https://github.com/jlcormier612/wevenu-website/actions/runs/37510425573` |
| Result | `UPDATE 1` · applied and recorded · read-only DB verification passed |

### Live Article 7 proof (required for Help close)

Route: `/help/how-does-task-center-work`

Proven present on the live Sandbox article:

- **My Work**
- **By Person**
- **All Team Work**

Proven absent:

- **My Tasks**

Regression checks after close:

- Article 4 (`/help/how-do-i-create-a-timeline-from-a-template`) still correct (`Use Template`, `Apply [template name]`)
- Help hub intact
- Live Task Center tabs match the article lenses exactly
- Focused Help/navigation/setup tests: 95/95 pass

### Serving SHA vs repo HEAD

| | Value |
|---|---|
| Serving application image | `5c6ec487` |
| Repo HEAD at handoff | `6099ceb5` |

`6099ceb5` is a SQL migration + test assertion. No new application image was deployed for bookkeeping. The Help route reads the corrected copy from the database at request time; the live article proof already stands on `5c6ec487` + the applied migration.

Do **not** start another Sandbox deployment merely to make SHA and HEAD match.

---

## Locked product decisions (do not reinterpret)

These are already verified and closed. This handoff records them; it does not reopen them.

### Purchaser / Owner model

Purchaser ≠ necessarily owner.

First-time question:

> **“Are you an owner of this venue?”**

- YES → purchaser is owner
- NO → purchaser remains Administrator + billing; actual owner is separately recorded/invited

Fail-closed: missing/non-boolean ownership choice is rejected. It does not default to owner.

Fancy Sandbox mock data predates enrollment-based ownership and has no `venue_enrollments` row. Fancy `is_owner=true` is **not** evidence of a current purchaser YES answer. Mock data does not create product requirements.

### Other locked decisions retained for launch

- `ready_to_invite_couples` is guidance/readiness, not a global application gate
- Calendar is not a dumping ground for tasks/reminders
- Payment plans: no booking-date picker; allowed anchors unchanged
- Luv: authoritative evidence only; venue/internal notes never customer-facing; Discard = DELETE
- Tours: attached Tours follow authoritative Lead identity; no manual Tour-name editor
- Customer-facing email uses venue branding; staff/platform email retains Hello to Cheers branding

---

## Major product work already GREEN/CLOSED — do not reopen

Unless a concrete regression appears after launch cutover, do not reopen:

Core architecture · Leads/Pipeline · Clients/Relationships · Contracts · Payments/Financials · Payment Plan Builder · Event Workspace · Planning · Vendor Network · Calendar · Availability · Inbox/Messaging · Documents/Assets · Dashboard/Reporting · Portal activation · Event → Client date sync · Setup Graduation / Hub / Profile · Social Event · Rehearsal Dinner · Automatic Reminders · Dashboard Focus dismissal · Tour → Lead identity · K2 multi-venue purchase · C1–C4 / D1–D3 / E1–E2 / H onboarding closeout · Luv · Customer-facing email branding · Help / Guides

---

## Production launch posture

| Rule | Status |
|---|---|
| Production untouched during release-readiness | Confirmed — only `htc-sandbox` cluster exists in the HTC account |
| Sandbox-only verification | Complete for the finite checklist |
| One deployment workstream at a time | Retained for any future production cutover |
| No new backlog from this handoff | Confirmed |
| No speculative fixes from this handoff | Confirmed |

### What production cutover still requires (process, not product backlog)

This handoff does **not** authorize production deploy by itself.

Any later production launch step must be an **explicit, separate instruction** and must:

1. Deploy only when instructed
2. Leave Sandbox proof intact
3. Verify exact serving runtime on production with the same evidence standard used for Sandbox (task definition, sole running task, image SHA, digest, `data-dpl-id`, health, prior image retired, appropriate browser/API/DB proof)
4. Apply any required production migrations through the approved production migration path — including `20261412800000_help_task_center_lenses_copy.sql` so Help Article 7 is not stale in production for the same DB-vs-editorial reason found in Sandbox
5. Not reopen GREEN/CLOSED product items without a concrete regression

### External items that can proceed in parallel with launch process

These do not block product readiness GREEN/COMPLETE:

1. Facebook Lead Ads — complete Fancy (or target venue) OAuth connection when ready
2. QuickBooks — complete Fancy (or target venue) OAuth connection when ready
3. Twilio / A2P — continue carrier verification until Fancy (or target venue) leaves `details_needed`

---

## Final disposition

**HTC product release readiness is GREEN / COMPLETE.**

- **11/11** finite checklist rows reconciled
- **8** product GREEN/CLOSED
- **3** product GREEN with external verification pending
- Help / Guides closed on serving image `5c6ec487` + Sandbox migration `6099ceb5` / workflow `37510425573`
- Production remains completely untouched by this handoff
- No additional product work is implied by this document

**Next action is a human production-launch decision**, not another product audit.

---

# CORRECTION — 2026-10-08 (appended; nothing above was altered)

**The "GREEN / COMPLETE" declaration above predates subsequent product changes and must not be treated as evidence of current readiness.** It was written on 2026-10-06 against serving image `5c6ec487`. Nineteen further commits of real product fixes landed after it, and two QuickBooks queue defects were later confirmed in the live Sandbox database. The section above is retained as history, not as a current status claim.

## Deployed build

| | |
|---|---|
| Commit | `6093cd31344b9c677ab2e02bd188dff42d9ff2ba` |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Deployment | GitHub Actions run `37871481610` — application stack deployed successfully |
| Live runtime `data-dpl-id` | `6093cd31344b9c677ab2e02bd188dff42d9ff2ba` — exact match |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Production | untouched; not deployed, migrated, or configured |

## Verified on this build (runtime evidence)

**QuickBooks queue recovery and health reporting.** The cron log captures the exact
transition across the deployment:

```
21:50:04  0 succeeded, 0 retrying, 0 dead-lettered, 42 skipped
21:55:00  0 succeeded, 0 retrying, 0 dead-lettered, 0 skipped, 9 reclaimed, 51 deferred (no connection)
```

- The nine legacy `processing` rows were reclaimed on the first tick. Queue moved
  from 9 `processing` / 42 `pending` to **0 `processing` / 51 `pending`**.
  Reclaim was provably safe: the owning venue has no `quickbooks_connections`
  row and zero `quickbooks_sync_log` entries, so dispatch was unreachable.
- Disconnected-venue work is **deferred, not claimed**: `skipped` went 42 to 0,
  ending the claim/release churn that created the stranded rows.
- Health output distinguishes processing, deferral, recovery and idle, and
  reports counts and ages only — no venue, entity or customer identifiers.

## Fixed in code, not provable read-only

These require a real Intuit timeout and are **unverified**:

- An uncertain write populating its diagnostic fields.
- A dispatch-marked row resisting automatic reclaim at runtime.

Both are covered by unit tests and by the live reclaim above (which only moved
rows with a null dispatch marker), but neither has been exercised end to end.
Proving them requires the QuickBooks E2E test.

## Not yet verified

- QuickBooks **invoice, payment and refund** synchronization. Customer sync is
  proven (QuickBooks Customer id `58`). The connected venue
  (Sweet Daisy Barn & Farm, realm `9341457813988375`, sandbox) now has **zero
  client records** — all deleted — which is the confirmed root cause of the
  historical failure cascade, and means the E2E must create fresh records.
- Document-delivery edit safety in runtime. Server guard and tests are in place;
  no Sandbox proof performed.

## Test results

| Suite | Result |
|---|---|
| `lib/quickbooks/*.test.ts` | 49 / 49 pass |
| `lib/invoices/*.test.ts` | 94 / 94 pass |
| Baseline 28-file batch | 285 / 285 pass |
| Broader 8-domain regression | 1087 tests, 1082 pass, **5 fail** |
| Full repository suite | 6005 tests, 5953 pass, **51 fail** |

The 5 broader failures are characterized and unrelated: a stale contract
back-nav assertion, a regex matching `events.booked_at` inside a comment, and
three local-database state problems. **The remaining 46 full-suite failures have
not been individually investigated** and are not claimed to be pre-existing.

## Invoice edit-safety coverage

`assertInvoiceEditable` is the single enforcement point for both `addLineItem`
and `removeLineItem`. It previously had **no direct test coverage**. Added
`lib/invoices/sent-invoice-edit-safety.test.ts` (8 tests): draft permitted, sent
refused with the expected message, other resolved statuses refused, missing
invoice handled, venue scoping asserted, and both mutation paths proven to guard
before writing. The only production change was exporting the function.

## Accepted limitations

1. **`needs_review` has no operator UI or runbook.** Resolution requires manual
   investigation and a database decision, and the dedupe index means the entity
   cannot re-enqueue until a human clears it. Fails closed; near-zero expected
   volume at one connected venue.
2. **A timed-out refresh-token rotation can strand a connection.** Intuit rotates
   on use; a timeout may consume our token, after which the venue must reconnect.
   No financial record is at risk and the failure is loud.
3. **Duplicate protection is not guaranteed under true concurrent writes.**
   Read-before-write is a lookup then a create, not atomic. QuickBooks enforces
   uniqueness on `Customer.DisplayName` and `Item.Name`; `Payment` and
   `RefundReceipt` keyed on `PrivateNote` have no server-side constraint.

## Remaining steps before Jennifer's final walkthrough

1. Approve and run the QuickBooks end-to-end test (customer, invoice, payment,
   refund). Creates permanent Intuit sandbox objects — a Customer and an Item
   cannot be deleted, only deactivated.
2. Approve the single rejected-edit action proving document-delivery safety at
   runtime (expected result: nothing changes).
3. Re-read the queue and health output after the E2E to confirm dependency
   ordering and dedupe.

Nothing above is GREEN. No blanket readiness claim is made by this correction.

---

# E2E EXECUTION — 2026-10-08 (appended; nothing above was altered)

The end-to-end test listed as step 1 above was approved and executed. It
**stopped at the Invoice stage on a confirmed product defect.** Steps 2 and 3
remain open. This section records what was proven, what was not, and the exact
state everything was left in.

## Environment

| | |
|---|---|
| Sandbox runtime SHA | `6093cd31344b9c677ab2e02bd188dff42d9ff2ba` (re-confirmed live before the first write) |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Venue | `5c84e74e-355d-4ce1-9e6b-913a9267f543` — Sweet Daisy Barn & Farm |
| Intuit realm | `9341457813988375` — matches approved |
| Environment | `sandbox` on both the connection row and the deployed `QUICKBOOKS_ENVIRONMENT` |
| Company | Sandbox Company US 1ff4 |
| Other connected venues | none — Sweet Daisy is the only one, so no other venue's queue was claimable |

Production was not deployed to, modified, or contacted.

## Per-stage result

| Stage | Result | Evidence |
|---|---|---|
| Customer | **PASS** | client `cf139813-75b1-4a5f-9c2b-0d07616960ba` → QuickBooks Customer **Id 59**; queue `succeeded`; sync log `customer succeeded qbo=59` |
| Default Item | **FAIL — defect** | QuickBooks rejected the create, see below |
| Invoice | **BLOCKED by Item** | invoice `1fb819ba-4ca8-44bc-9d7a-729eecf42e52` (`INV-2026-1FB819`) dead-lettered after 1 attempt |
| Payment | **NOT ATTEMPTED** | prerequisite failed; no financial write issued |
| Refund | **NOT ATTEMPTED** | prerequisite failed; no financial write issued |

Dependency ordering behaved correctly: the Invoice push only ran after the
Customer carried a QuickBooks id, and the Payment/Refund stages were never
enqueued because their prerequisite never produced one.

## DEFECT — default QuickBooks Item cannot be created

`lib/quickbooks/items.ts::ensureDefaultItem` creates the single placeholder
Item with:

```json
{ "Name": "Hello to Cheers Services", "Type": "Service" }
```

QuickBooks rejects this:

```
QuickBooks API error 400: {"Fault":{"Error":[{"Message":"Required param missing,
need to supply the required value for the API","Detail":"Required parameter
ExpenseAccountRef or IncomeAccountRef is missing in the request","code":"2020"}],
"type":"ValidationFault"}}
```

The function's own docstring states the opposite — "QBO assigns its own default
income account, the one place account selection is intentionally left to QBO
rather than mapped." That assumption is factually wrong: QuickBooks requires an
income account reference for a Service item.

**Impact.** Invoice sync and Refund sync both call `ensureDefaultItem` and both
fail permanently for any venue whose `quickbooks_connections.default_item_quickbooks_id`
is null — which is every newly connected venue. Customer sync and Payment sync
do not touch the Item and are unaffected. A venue that happens to already have a
QuickBooks Item named exactly "Hello to Cheers Services" would adopt it and
succeed, which is why this was never caught by inspection.

This is launch-critical for the QuickBooks integration. It is not yet fixed;
fixing it requires choosing an income account and is outside the approved scope
of this test.

**Classification note.** The failure was correctly handled: a 400 validation
error is non-retryable, so the item dead-lettered immediately instead of burning
eight attempts, and the error text was preserved verbatim on the queue row, in
the sync log, and on the connection. Diagnosis took one query.

## Intuit objects created

| Object | Id | Deletable |
|---|---|---|
| Customer "Quinn QBOE2E-1008A" | **59** | No — deactivate only |

Nothing else was created. No Item exists: QuickBooks rejected the create
outright, and `default_item_quickbooks_id` is still null, which is the system's
own record that `setDefaultItemId` was never reached. No Invoice, Payment or
RefundReceipt was POSTed — `syncInvoice` returns at `ensureDefaultItem`, before
the DocNumber query and before any create.

## Application-side records — deliberately retained

| Record | Id |
|---|---|
| client | `cf139813-75b1-4a5f-9c2b-0d07616960ba` |
| invoice | `1fb819ba-4ca8-44bc-9d7a-729eecf42e52` (`INV-2026-1FB819`, sent, $1,000) |
| invoice line item | `897d519d-1693-4f5b-81ae-09857dd8d3dd` |
| queue row (customer) | succeeded |
| queue row (invoice) | dead_letter, carries the verbatim QuickBooks error |

These were **not** deleted. The dead-lettered queue row and its sync-log entry
are the evidence of the defect, and the client row is the only local anchor to
QuickBooks Customer 59 — deleting it would orphan a Customer that cannot be
deleted, which is exactly the cascade that produced this venue's existing
10 dead-lettered rows. They should be removed only after the defect is fixed and
the test re-run.

## Queue left in a safe state

A final sweep after the failure returned:

```
{"processed":0,"succeeded":0,"failedRetrying":0,"deadLettered":0,"skipped":0,
 "reclaimed":0,"needsReview":0,"uncertainWrites":0,"deferredNoConnection":51,
 "oldestEligiblePendingAgeMs":null}
```

Nothing is processing, nothing is uncertain, nothing awaits review. No queue row
was manually mutated at any point, and no sync was retried after a failure.

## Token refresh — incidentally verified

The access token had been expired for roughly 30 days. The first call refreshed
it automatically and the connection stayed `connected`. This exercises the
lazy-refresh path in `getValidAccessToken` against real Intuit infrastructure
for the first time.

## Sent-invoice edit safety — BLOCKED, not failed

The runtime rejection could not be performed. The only authenticated browser
session available belongs to a disposable onboarding account
(`lb2.b.1791318625931@hellotocheers-test.invalid`) whose venue is mid-onboarding;
every Financials URL hard-redirects to `/onboarding/intake`. Reaching a real sent
invoice needs a Jen's Fancy Venue staff session, and credentials must not be
rotated to obtain one.

No edit was attempted. The target was identified and confirmed read-only:

| | |
|---|---|
| Invoice | `53ff9feb-8d4d-4f3e-af62-d50037fa5f48` — `INV-2026-53FF9F`, "Initial Payment" |
| Venue | Jen's Fancy Venue (no QuickBooks connection, so no Intuit write is possible) |
| Status / total / balance | `sent` / 17500 / 17500 |
| Line items | 1 — `6103eeee-2633-446e-9e46-59bc5f1989ad` "Essential Wedding", qty 1, 17500 |
| Expected refusal | "This invoice is no longer a draft — revert it to draft before changing its line items." |

Automated coverage for this guard passes (8 tests in
`lib/invoices/sent-invoice-edit-safety.test.ts`), and `assertInvoiceEditable`
returns before any repository write, activity insert, QuickBooks enqueue or
payment-plan sync in both `addLineItem` and `removeLineItem`, so a rejected edit
has no reachable notification path. That is proof from source and tests, not
from runtime.

## Launch-critical gaps after this run

1. **The Item defect above.** Invoice and Refund sync cannot succeed for a new
   venue until it is fixed.
2. **Invoice, Payment and Refund sync remain unproven end to end.** Customer
   sync is now proven twice (Ids 58 and 59).
3. **Sent-invoice edit rejection is unproven at runtime.** Needs a staff session.

Previously accepted limitations are unchanged: no `needs_review` operator UI, a
timed-out refresh-token rotation can require reconnect, and duplicate protection
is not guaranteed under true concurrent writes.

Nothing in this section is GREEN.

---

# QUICKBOOKS REFUND RECONCILIATION ACCEPTANCE — 2026-10-09 (appended; nothing above was altered)

**Core QuickBooks invoice-linked refund reconciliation acceptance in Sandbox: PASSED.**

This closes the Sandbox financial acceptance for invoice-linked Payment reconcile
(update / void) on commit `f83ad5897dbde5ba7d3600dd2012db46866b2afb`. It does
**not** re-declare overall HTC product release readiness GREEN/COMPLETE, and it
does not claim every refund UI or recovery path is proven.

## Release identity

| | |
|---|---|
| Commit | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Subject | QuickBooks: reconcile invoice-linked refunds on Payment with deposit safety. |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Migration | `20261413900000_quickbooks_refund_net_synced.sql` — Apply Sandbox Migration run `37883945485` (applied and recorded; `verify-sandbox-database` passed) |
| Column | `payment_line_items.quickbooks_refund_net_synced` verified present |
| Deploy | Deploy Sandbox run `37883993118` — success |
| Serving image / live `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Task definition | `htc-sandbox-venue-app:625` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Environment | Sandbox only — Production untouched |
| Venue / Intuit | Sweet Daisy Barn & Farm · realm `9341457813988375` · Sandbox Company US 1ff4 · connection `environment=sandbox` |

## What is now proven (supersedes earlier “unproven” claims for these paths)

Earlier sections in this handoff recorded Item creation failure and stated that
Invoice, Payment, and Refund sync remained unproven. Subsequent Sandbox work
(income-account Item fix, Payment create on PaymentRefNum, then this refund
reconcile) closed those accounting paths for the connected Sweet Daisy company
as follows:

| Stage | Status | Evidence |
|---|---|---|
| Customer | Previously proven | Customer **59** (client `cf139813-75b1-4a5f-9c2b-0d07616960ba`) |
| Default Item | Previously fixed and used | Item **19** with explicit IncomeAccountRef |
| Invoice sync | Proven (prior + this run) | Prior Invoice **145**; this run Invoices **147**, **149** |
| Payment sync | Proven (prior + this run) | Prior Payment **146** ($600); this run Payments **148** ($100), **150** ($50) |
| Invoice-linked **partial refund** (Payment update) | **PASSED** | Payment **148** → $75; Invoice **147** Balance $25; cache `75` |
| Invoice-linked **full refund** (Payment void) | **PASSED** | Payment **150** voided TotalAmt 0 / empty lines; Invoice **149** Balance $50; cache `0` |
| Cache short-circuit / no duplicate mutation | Exercised | Re-enqueue + sweep: Payment **148** stayed $75, SyncToken **1** |

RefundReceipt is **not** used for invoice-linked refunds. Customer 59 had **0**
RefundReceipts after both acceptance runs.

## Partial refund acceptance

| | |
|---|---|
| App invoice | `325f6750-926b-438e-aca5-50b8c0657847` (`INV-REF-P-09043829`) |
| App line | `32860662-653e-43f1-996d-19e056b35332` |
| QuickBooks Invoice | **147** |
| QuickBooks Payment | **148** |
| Baseline | Payment $100 applied; Invoice Balance $0 |
| Refund | $25 via ledger `refundLineItem` + `enqueueSync` + cron sweep |
| After | Payment TotalAmt **$75** linked to Invoice 147; Invoice Balance **$25** |
| App ledger | `partially_refunded`, `refunded_amount=25`, `quickbooks_refund_net_synced=75` |
| Queue | refund row `6622578f-111c-4dd4-8d27-ffd824871fd2` → `succeeded` |
| RefundReceipt | none created |

## Full refund / void acceptance

| | |
|---|---|
| App invoice | `aa226d62-2aa1-462e-befd-8d280b009691` (`INV-REF-V-09043829`) |
| App line | `7a498e49-3dc3-40ec-be7c-36766605d066` |
| QuickBooks Invoice | **149** |
| QuickBooks Payment | **150** |
| Baseline | Payment $50 applied; Invoice Balance $0; Deposit scan clear |
| Refund | $50 full via same ledger + queue + sweep path |
| After | Payment **voided** (TotalAmt **0**, empty lines, PrivateNote void marker); Invoice Balance **$50** |
| App ledger | `refunded`, `refunded_amount=50`, `quickbooks_refund_net_synced=0` |
| Queue | refund row `d731838a-4b40-468e-9f15-32946e7f97f2` → `succeeded` |
| RefundReceipt | none created |

## Idempotency (cache path only)

Re-enqueued the partial-refund sync for line `32860662…` and ran one sweep.
Payment **148** remained TotalAmt **75** with SyncToken **1**; no second Payment
mutation. Queue row `5c44d694-375a-48ca-86da-6c3cfbec9220` succeeded.

**Not claimed:** uncertain-write / transport-replay recovery.

## Protected records verified unchanged

| Record | After acceptance |
|---|---|
| QuickBooks Payment **146** | paid $600, refunded $0 (app line `1b88e352-5939-48cc-9427-6fe520ae5907`) |
| QuickBooks Invoice **145** | app balance_due **400** (invoice `1fb819ba-4ca8-44bc-9d7a-729eecf42e52`) |
| Dead-letter `78448fc9-ac32-4c4b-966d-1e3891b808c6` | still `dead_letter`, attempt_count **1**, `updated_at` `2026-10-09T03:09:39.565064+00:00`, error fingerprint `a1080c2a9ad1d8973308adcacab1c39f` |

Production was not deployed, migrated, or financially contacted.

## Coverage limitations (not failures of the accepted paths)

1. Live refusal when a Payment is found in a Bank Deposit was **not** exercised;
   both accepted fixtures were Deposit-clear.
2. Uncertain-write / transport-replay recovery was **not** live-tested.
3. Full browser/UI click-path acceptance was **not** performed; the ledger refund
   operation, sync queue, and processor were exercised.
4. A second cumulative partial refund was **not** tested.

## Status relative to earlier handoff gaps

For the **core invoice-linked Sandbox refund reconciliation** paths above: the
prior “Invoice, Payment and Refund sync remain unproven” and “Nothing in this
section is GREEN” statements from the 2026-10-08 E2E section are **superseded
for those accounting paths**. Sent-invoice edit rejection at runtime remains
unproven (unchanged). Fancy OAuth / external-connection pending items at the
top of this handoff are unchanged and are not reopened here.

**Do not treat this append as a blanket product-release GREEN.**

---

# SENT-INVOICE EDIT REFUSAL — 2026-10-09 (appended; nothing above was altered)

**Sent-invoice line-item edit refusal at runtime: GREEN for this verification.**

This closes the remaining launch-critical gap recorded on 2026-10-08 (runtime proof blocked) and restated as unproven in the 2026-10-09 QuickBooks append. It does **not** declare overall product release readiness GREEN/COMPLETE.

| | |
|---|---|
| Runtime `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Venue | Jen's Fancy Venue `a415ac52-cd74-42a6-8df7-7a8f6e71d080` |
| Staff session | `jennifer@hellotocheers.com` (owner/administrator on Fancy), via the established Sandbox magic-link cookie helper. The open onboarding browser session was not used. |
| Invoice | `53ff9feb-8d4d-4f3e-af62-d50037fa5f48` · `INV-2026-53FF9F` · “Initial Payment” |
| Action | Opened `/invoices/53ff9feb-…` and clicked **Remove** on line `6103eeee-2633-446e-9e46-59bc5f1989ad` (“Essential Wedding”) |
| Observed refusal | `This invoice is no longer a draft — revert it to draft before changing its line items.` |
| Before and after | status `sent`; total `17500`; balance_due `17500`; one line “Essential Wedding” qty 1 amount `17500`; `updated_at` `2026-10-06T00:00:02.099547+00:00` unchanged |

No draft reversion, no successful line write, no QuickBooks or production contact.

---

# CURRENT STATUS — READY FOR A HUMAN PRODUCTION-LAUNCH DECISION (2026-10-09; appended; nothing above was altered)

**Sandbox candidate:** `f83ad5897dbde5ba7d3600dd2012db46866b2afb`  
**Sandbox health at verification:** `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`

On this SHA, later evidence superseded the 2026-10-08 statements that QuickBooks Item creation, invoice/payment/refund sync, and sent-invoice edit refusal were unproven or blocked:

- Item creation with an explicit income account, invoice sync, payment sync, and invoice-linked refund reconciliation (partial update and full void) — recorded in the 2026-10-09 QuickBooks acceptance section.
- Sent-invoice line-item edit refusal — recorded in the 2026-10-09 sent-invoice section. The sentence in the QuickBooks append that still calls that refusal unproven is historical relative to the later section.

Those 2026-10-08 “unproven” lines remain in the file as history. They are not the current status.

This section means the Sandbox release is ready for an **explicit human production-launch decision**. It does **not** mean production is deployed, migrated, or verified.

Refund coverage that stays untested, and is not treated as a failure of the accepted paths: live Bank Deposit refusal, uncertain-write / transport-replay recovery, full browser refund click-path, and a second cumulative partial refund.

Product readiness is separate from external account/carrier prerequisites (Facebook OAuth, QuickBooks connection, and Twilio/A2P on a target production venue). Those remain outside this Sandbox proof.

**Before any production migration is applied, production migration history and schema state must be inspected.** Do not assume Sandbox `schema_migrations` matches production. In particular, confirm whether `20261412800000_help_task_center_lenses_copy.sql` and `20261413900000_quickbooks_refund_net_synced.sql` are already recorded, and whether each version sorts before the production tracked maximum, before applying either file. The refund column must exist before a runtime that selects `quickbooks_refund_net_synced` processes refunds.

---

# CUSTOMER RETRIEVAL OF SENT INVOICE AND PAYMENT PLAN — 2026-10-09 (appended; nothing above was altered)

**Couple retrieval of the existing sent invoice and payment plan: GREEN for this verification.**

This does **not** declare overall product release readiness GREEN/COMPLETE. Production was not deployed, migrated, or contacted.

| | |
|---|---|
| Runtime `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Venue | Jen's Fancy Venue |
| Staff | `jennifer@hellotocheers.com` opened `/invoices/c9c5b7d6-a084-41d5-90de-de0936bd20a0` |
| Invoice | `INV-2026-C9C5B7` · “Initial Payment” · already `sent` · couple-visible · total and balance due `25000` |
| Couple | Mira Vale · portal session `be8e5540-7406-43f2-a52c-27843ce2f96e` (“Vale Documents Proof”) |
| Staff action | Send control was visible and was **not** activated. A prior `invoice_email` message `a14d0b3b-6dcb-40e8-a7f6-7b0d147c96a0` is `delivered`. Send-once blocks a repeat only when status is `accepted`, so a click would have emailed the client again. |
| Couple result | After the portal welcome terms, Documents → Details opened “Full Service Wedding” $25,000.00 and the four payment-plan lines (Initial, Planning 1, Planning 2, Final), each $6,250.00. |
| After | `updated_at` still `2026-09-28T04:28:15.634674+00:00`. Same single line. Same single delivery message. One invoice for this client. |

Protected records were re-read and still match the QuickBooks acceptance section: Payment 146 paid $600 / refunded $0, Invoice 145 balance_due 400, dead-letter `78448fc9-ac32-4c4b-966d-1e3891b808c6` still `dead_letter` at `2026-10-09T03:09:39.565064+00:00`. This verification did not write them.

---

# LUV FIRST PORTAL INVITE — 2026-10-09 (appended; nothing above was altered)

**Fancy Dashboard first-portal-invite factuality: GREEN for this verification.**

Locked rule: the milestone is complete when the venue has at least one booked client (`events.booked_at` set, status not cancelled) with a `client_invitations` row in `pending` or `accepted`. It is not engagement telemetry and not a portal session.

| | |
|---|---|
| Runtime `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Venue | Jen's Fancy Venue, already selected |
| Staff | `jennifer@hellotocheers.com` opened `/dashboard` |
| Evidence already on file | Minnie Mouse invitation `e46344ee-f192-4c14-89cc-5204a9be235e` accepted; event `8e666a40-37d6-43c2-8181-a2e8109e09f8` booked 2026-10-02. Ivy Quinn accepted and Alison Morrill pending are additional qualifying rows. |
| Dashboard | Luv showed “Everything sent in the last day reached its destination — 4 messages, no failures.” The page did not show “Invite your first couple to their portal”. |
| Unchanged | `first_portal_invite_sent_at` remained `2026-10-03T01:18:59.657466+00:00`. No invitation was sent. |

This does **not** declare overall product release readiness GREEN/COMPLETE. Production was not contacted.

---

# LUV THREE-COUPLE PORTAL ACTIVATION — 2026-10-09 (appended; nothing above was altered)

**Three booked couples have opened their planning portal: GREEN for this verification.**

Locked rule: a couple counts when a booked client’s portal session has `last_accessed_at` set. The target is 3 unique booked couples.

| | |
|---|---|
| Runtime `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Venue | Jen's Fancy Venue |
| Staff | `jennifer@hellotocheers.com` |
| Stamp | `third_couple_portal_active_at` `2026-10-03T04:18:29.533+00:00` (unchanged by this read) |
| Dashboard | Did not show “Get 3 couples started in their portals” |
| Clients handoff | `/clients?filter=portal_activation` showed “11 of 3 booked couples have opened their planning portal.” |
| Row check | Minnie Mouse **Opened**. Alison Morrill **Invited — not opened** (pending invitation, no open). Jane Smith **Not invited** (no invitation, no session). Invite and Resend were not clicked. |

Fancy still has 4 `client_invitations` rows. This does **not** declare overall product release readiness GREEN/COMPLETE. Production was not contacted.

---

# FINAL SANDBOX RELEASE RECONCILIATION — 2026-10-09 (appended; nothing above was altered)

**Sandbox release-ready under the documented acceptance criteria.**

This is not a production launch, and it does not revive the 2026-10-06 “GREEN / COMPLETE” declaration. That declaration, and the 2026-10-08 “nothing in this section is GREEN” statement, stay in this file as history. Later sections supersede them for the paths they name.

## Baseline

| | |
|---|---|
| Live `dpl` | `f83ad5897dbde5ba7d3600dd2012db46866b2afb` |
| Health | `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Serving image | SHA-tagged venue-app image for this `dpl`; task definition `htc-sandbox-venue-app:625` as recorded in the QuickBooks acceptance section |
| Task definition | `htc-sandbox-venue-app:625` |
| HEAD | same SHA |
| Retest | Not repeated. `dpl` is the runtime those proofs used. |

## Closed on this runtime

Customer-facing proofs recorded later in this handoff, all on this SHA:

- Couple retrieval and opening of the existing sent invoice and payment plan — GREEN (`docs/qa/payment-document-delivery-edit-safety/STATUS.md`).
- Sent-invoice line-item edit refusal — GREEN.
- Luv first-portal-invite — GREEN (`docs/qa/luv-first-portal-invite/STATUS.md`).
- Three-couple portal activation — GREEN (`docs/qa/luv-portal-activation-milestone/STATUS.md`).
- QuickBooks customer, item, invoice, payment, partial refund, and full refund/void for the fixtures in the 2026-10-09 acceptance section — PASSED.

Earlier focused proofs whose commits are ancestors of this SHA, reused without a new walkthrough:

- Identity A+B — `6490374a` (`docs/qa/release-test-foundation/STATUS.md`).
- Inquiry form preview — `109543fb` (`docs/qa/inquiry-form-preview/STATUS.md`).
- Setup hub completion — `beca4bd8` (`docs/qa/setup-hub-completion-truth/STATUS.md`).
- Vendor required versus recommended — `263bb3b2` / serving proof `56b19cda` (`docs/qa/vendor-required-option-a/STATUS.md`).
- Planning capabilities — GREEN (`docs/qa/planning-capabilities-settings/STATUS.md`).
- Help / Guides and the other journeys named in the 2026-10-06 “already GREEN/CLOSED” list remain closed unless a later section reopened them. None of the 2026-10-08 launch-critical gaps remain open after the sections above.

No known product defect and no required customer-facing proof remain open on this SHA.

## Remaining items — none block this Sandbox decision

| Item | Class | Blocks Sandbox release-readiness? |
|---|---|---|
| Live Bank Deposit refusal | Accepted coverage limitation. Both accepted refunds were Deposit-clear. Not described as proven. | No. Outside the passed partial-update and full-void criteria. |
| Uncertain-write / transport-replay recovery | Accepted coverage limitation. Not live-tested. | No. |
| Browser click-path for the refund itself | Accepted coverage limitation. Ledger, queue, and processor were the exercised path. | No. |
| A second cumulative partial refund | Accepted coverage limitation. Not tested. | No. |
| Facebook Lead Ads OAuth on a target venue | External prerequisite. Product path already demonstrated on a connected Sandbox venue. | No. |
| QuickBooks connection on a venue that is not already connected | External prerequisite. Sweet Daisy Sandbox company is the proven connection. Fancy has none, by design for the sent-invoice proof. | No. |
| Twilio / A2P carrier verification | External prerequisite. Carrier approval is outside the product. | No. |
| Production migration inspection before any production apply | Production process step, not a Sandbox product gap. Confirm `20261412800000` and `20261413900000` against production history before a later, separately authorized apply. | No for Sandbox. Required before a production migration. |

Production was not deployed, migrated, or contacted by this reconciliation.
