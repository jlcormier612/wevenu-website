# Work Package D3 — Collaborative Working Items

**Date:** 2026-08-10
**Scope:** Contracts, Questionnaires, Inventory, Event Orders. Builds on the certified D1/D2/BA1–BA4B model exactly as it exists. Every finding below traces to real code, a real RLS policy, or a real transactional SQL test (run against the dev database inside `BEGIN…ROLLBACK`, nothing left behind) — not inferred.

**A note on research conditions:** three parallel research agents were launched to verify Inventory's financial connection, Contract sharing/notification/concurrency behavior, and the Questionnaire wiring path. All three hit a weekly API limit mid-run. One (Questionnaire) returned a critical finding before stopping; the other two returned partial or no results. The remaining verification in this report was completed directly rather than by re-launching agents, to avoid the same failure mode. Where a finding rests on this session's own direct checks rather than an agent's broader sweep, that's noted.

---

## 1. Current-State Findings — what each asset actually did before D3

**Contracts.** Already the most complete of the four, thanks to D2/BA4/BA4B: real header, waiting-state, activity timeline, sharing (a genuine templated email with the sign link — confirmed this phase by reading `lib/contracts/service.ts:177-212`, not the "manual copy-paste only" assumption an earlier phase's research left ambiguous). What was still missing, confirmed this phase: **signing fired zero coordinator-facing notification** — `sign_contract()` wrote a `contract_activities` row and a `luv_celebrations` row, but nothing that would actually alert anyone to check. Also confirmed and unchanged: no concurrent-edit protection (`updateContractContent` does a blind fetch-then-overwrite, no version check), no comment/discussion feature, no version/diff capability, and signed-immutability enforced only at the app layer (`contracts_update` RLS policy has no status predicate — confirmed by reading the live policy).

**Questionnaires — the single largest finding of this phase.** `components/events/final-details-form.tsx` (the coordinator's editor/viewer, BA4B-certified with the shared header already applied) had **zero real render path anywhere in the app**, reconfirmed this phase. More precisely than BA4B established: `event-detail.tsx` passed the `questionnaire` prop only into `BookingDocumentsTab`, which renders a status badge (Sent/Completed) and nothing else — there was **no place in the entire venue app where a coordinator could see a couple's actual submitted answers** (guest count, ceremony time, songs, etc.), only that submission had happened. The couple-facing side (`/questionnaire/[key]`, `couple-questionnaire-form.tsx`) was and remains the only live path, and — confirmed this phase — has **no required-field validation at all**: the submit button is disabled only while a request is in flight, never by field completeness.

**Inventory.** Reconfirmed, not rebuilt: `lib/inventory/` is a venue-wide reusable catalog only. There is no per-event, editable, shareable "Working Inventory" entity anywhere in the schema — no table joins `inventory_items` to `events` for a selection/collaboration purpose. The only per-event-adjacent data is `InventoryUsage`, a computed, read-only count derived from Floor Plan object placements, explicitly documented in its own type comment as reporting-only.

**Event Orders.** Already had header/activity applied (BA4B). Reconfirmed this phase: `event_orders`/`event_order_sections`/`event_order_lines`/`event_order_activities` all carry only the generic venue-only `_all` RLS policy (`event_orders_all` etc., `20260923000000_event_order_foundation.sql:154-169`) — no client or vendor policy exists on any of the four tables, and a repo-wide search of `components/portal/` found zero Event Order rendering anywhere. This is genuinely single-party, venue-only — the same shape BA4B already established for Task Lists, not a gap, a confirmed fact.

---

## 2. Implementation Map

| Change | File(s) | What |
|---|---|---|
| Wired the orphaned Questionnaire editor into a real route | `components/events/event-detail.tsx` | Added a "Final Details" `Card` to the existing Planning tab, rendering `FinalDetailsForm` with props already available on the page (`event.id`, `questionnaire`, `coupleEmail`, `event.clientName`, `event.name`) — no new data fetching added |
| Added the missing contract-signed notification | `supabase/migrations/20261243000000_contract_signed_notification.sql` | `create or replace function sign_contract(...)` — identical body to the existing function, with one new `perform create_venue_notification(...)` call appended after the existing activity insert. Validated in a `BEGIN…ROLLBACK` transaction (created a synthetic sent contract, signed it, confirmed a real `venue_notifications` row was inserted, then rolled back) before being applied for real |

No other files were modified. No new tables, no new components beyond what D2/BA4B already built and certified.

---

## 3. Shared Experience Map

`BusinessAssetHeader` / `BusinessAssetActionRow` / `WaitingStateBadge` / `ActivityTimeline` — all reused exactly as certified, zero changes to any of the four shared components this phase.

| Asset | Header | Waiting State | Activity |
|---|---|---|---|
| Contract | Applied (D2) | Applied (BA4) | `ActivityTimeline` over `contract_activities` (D2) |
| Questionnaire | Applied (BA4B) — **now actually reachable** | Applied (BA4B) | N/A — no activity log exists for questionnaires (status transitions only) |
| Event Order | Applied (BA4B, compact/embedded) | N/A — no real turn-taking (single-party) | `ActivityTimeline` over `event_order_activities` (BA4, deduplicated from a hand-rolled version) |
| Inventory | N/A — no Working Item exists to header | N/A | N/A |

---

## 4. Asset-Specific Behavior Map — what stays intentionally different

- **Contract**: free-text content editor with `{{merge_field}}` tokens, manual "Apply merge fields" step, Send → email delivery → public `/sign/[token]` signature capture. Untouched.
- **Questionnaire**: field-by-field structured form (ceremony/reception times, guest count, songs, etc.), a `status` progression (`draft → sent → submitted`), couple-facing public link. Untouched — the fix this phase was purely "give the coordinator a place to see it," not a rework of the form itself.
- **Event Order**: sectioned line items with quantity/price/provenance (Package/Inventory/Custom), a floor-plan link per section, a real `open → finalized` lock enforced by `assertOpen()` on every mutation. Untouched.
- **Inventory**: a flat catalog with no per-event state at all. Not flattened into a fake "working item" to match the other three — genuinely different, preserved as such.

---

## 5. Collaboration Matrix

| Asset | Venue | Client | Vendor |
|---|---|---|---|
| Contract | Create, edit (draft), send, cancel, delete (owner/manager) | Sign only, via the public token link — no edit access ever | No access |
| Questionnaire | View, edit (now reachable), send | Fill in, save, submit, via public link — no login | No access |
| Event Order | Full CRUD while open, finalize/reopen | **No access at all** (RLS-confirmed) | **No access at all** (RLS-confirmed) |
| Inventory | Full CRUD on the catalog | No access | No access |

---

## 6. Waiting-State Matrix

| State | Asset(s) it applies to | Who must act |
|---|---|---|
| Waiting on Venue | Contract (draft), Questionnaire (not yet sent) | Coordinator |
| Waiting on Client | Contract (sent, unsigned), Questionnaire (sent, unsubmitted) | Client |
| Completed | Contract (signed), Questionnaire (submitted) | Nobody |
| No Action Required | Contract (cancelled/expired) | Nobody |
| *(not applicable)* | Event Order, Inventory | Single-party — there is no "other side" to wait on |

---

## 7. Template → Working Item Matrix

| Asset | Template exists? | Working Item exists? | Isolation |
|---|---|---|---|
| Contract | Yes (`contract_templates`) | Yes (`contracts`) | Verified live in D2's transactional test — full isolation both directions |
| Questionnaire | **No** — one hardcoded global structure per event, no venue-customizable template (BA1 finding, unchanged) | Yes (`event_questionnaires`) | N/A — nothing to isolate from |
| Event Order | **No** — confirmed again this phase, no `event_order_template` table/type anywhere | Yes (`event_orders`) | N/A |
| Inventory | Arguably the catalog itself is the "template" (D2's own framing) | **No per-event Working Item** | N/A |

---

## 8. Activity Matrix

| Asset | Events recorded | Not recorded |
|---|---|---|
| Contract | created (implicit), sent, signed, cancelled — all real `contract_activities` rows | edits to draft content (no activity row per edit) |
| Questionnaire | **Nothing** — `event_questionnaires` has no activity table; only `status`/`sentAt`/`openedAt`/`submittedAt` columns | Every field-level change |
| Event Order | section/line added/removed, finalized, reopened — real `event_order_activities` rows | N/A — reasonably complete |
| Inventory | N/A | N/A |

---

## 9. Notification Matrix

| Event | Fires today? | Mechanism |
|---|---|---|
| Contract sent | Yes | Real email (`sendEmail`, `lib/contracts/service.ts:200-205`) |
| **Contract signed** | **Now, yes — fixed this phase** | `create_venue_notification` (existing RPC, reused) |
| Contract edited after client viewed it | No | *(no "viewed" tracking exists for contracts at all — a separate, unfixed gap)* |
| Questionnaire sent | Not verified this phase whether an email fires (existing `sendQuestionnaireToCouple` was not re-traced) — assume unchanged from prior phases | — |
| Questionnaire submitted (couple path) | Only a single system chat message (confirmed by BA2, not re-verified this phase due to the agent failures) | `messages` insert |
| Questionnaire submitted (staff path) | Task auto-complete + lead-score refresh (confirmed by BA2) | `triggerAutoComplete`, `refreshLeadScore` |
| Event Order finalized | No | — |
| Inventory changed | N/A | — |

---

## 10. Security Validation

- **Contracts**: `contracts_update` RLS confirmed venue-scoped only (`venue_id = current_user_venue_id()`), no status predicate. A client cannot reach a contract's edit path at all (no client-facing edit UI exists); the only client-facing surface is `/sign/[token]`, a deliberately separate, token-scoped RPC path (`sign_contract`) that only ever transitions `sent → signed` for the exact contract that token belongs to — unchanged by this phase's migration except for the one added notification call.
- **Event Orders**: RLS confirmed venue-only on all four tables, no client/vendor grant exists — nothing to authorize differently, nothing new introduced.
- **The Questionnaire fix introduces no new data path.** `FinalDetailsForm` calls the same pre-existing `saveQuestionnaireAction`/`sendQuestionnaireAction` server actions the orphaned component always called; wiring it into a real tab doesn't change what those actions authorize, only who can now reach the button that calls them (any venue staff member who could already reach the Booking workspace's Planning tab, i.e. no privilege change).
- **The notification migration** was validated transactionally before being applied — confirmed to only add a `venue_notifications` insert, confirmed not to alter the RLS policies on `contracts` or `venue_notifications`, and confirmed to preserve `create_venue_notification`'s own existing exception-swallowing safety (a failed notification insert can never break the signing flow itself, same guarantee as every other caller of that function).

---

## 11. Complete Journey Validation

- **Contract**: full isolation journey already validated live in D2 (create template → working contract → modify each direction → duplicate → modify duplicate), not re-run here since nothing about contract data flow changed this phase. **New this phase**: sign → notification journey validated live in a transaction (synthetic sent contract → `sign_contract()` → confirmed real `venue_notifications` row → rolled back).
- **Questionnaire**: the wiring fix was verified by tracing prop availability end-to-end (confirmed `event-detail.tsx` already has `questionnaire`, `coupleEmail`, `event.clientName`, `event.name` in scope at the exact point `FinalDetailsForm` was added) and by a clean `tsc` pass, not by a live authenticated click-through — no scriptable session exists in this environment, the same limitation stated in every prior phase.
- **Inventory / Event Order**: no journey to run for Inventory (no Working Item exists). Event Order's existing create/edit/finalize/reopen journey was not re-tested this phase — unchanged from BA4B, which already validated it.

---

## 12. Known Gaps — carried to future work packages

1. **Contract concurrent editing is unsafe, undemonstrated as safe, and not fixed.** `updateContractContent` has no optimistic lock — two coordinators editing the same draft simultaneously will silently last-write-wins, with no warning to either. Confirmed by reading the actual query; not fixed, per the brief's own instruction not to invent a solution in this phase.
2. **No contract comment/discussion feature exists.** Confirmed absent, not built.
3. **No contract version/diff capability exists.** "What changed?" cannot be answered beyond the activity log's own coarse events (sent/signed/cancelled) — no field-level history.
4. **Signed-contract immutability is app-layer only**, not DB-enforced (no RLS status check, no trigger) — same finding as BA2, unchanged, real risk if any code path ever bypasses the one `if (existing.status !== "draft")` guard.
5. **Questionnaire has no required-field validation.** A completely empty questionnaire can be submitted and marked complete. Confirmed this phase; a real product decision (what fields are actually required, and how to communicate that) is needed before this is fixed — not decided here.
6. **Questionnaire has no activity log at all.** "What changed, and when" is answerable only at the coarse `sentAt`/`openedAt`/`submittedAt` level.
7. **Inventory has no collaborative Working Item to build on.** Steps 19-21 of this work package's own brief (share inventory, receive selections, finalize, connect to Payment Plan) describe behavior that has no data model to attach to today. The real financial connection that *does* exist runs through Event Orders (`addLineFromInventory` → `event_order_lines` with `provenance='inventory'` → eventually an Invoice line), not through any direct "Inventory → Payment Plan" link — Payment Plans remain, by explicit design (D2/BA2), fully independent of Invoices once created. Building a "Working Inventory" concept is new data-model work outside this phase's mandate not to invent architecture.
8. **Whether Questionnaire-send still triggers a real email was not re-verified this phase** — the two agents that would have confirmed this in full both failed on the API limit; this is a real coverage gap in this report's own validation, stated rather than assumed.

---

## Final PASS / FAIL Matrix

| Asset | Template | Create | Edit | Share | Collaborate | Waiting State | Activity | Permissions | Mobile | PASS/FAIL |
|---|---|---|---|---|---|---|---|---|---|---|
| **Contract** | PASS | PASS | PASS (concurrent-edit gap documented, not blocking) | PASS (real email) | PARTIAL (no comments, no diff — documented) | PASS | PASS | PASS (RLS-verified) | Not verified | **PASS**, with named limitations |
| **Questionnaire** | N/A (no template concept — correct, not a gap) | PASS | PASS (now reachable — the fix) | PASS (public link, pre-existing) | PARTIAL (no required-field validation — documented) | PASS | FAIL (no activity log exists) | PASS | Not verified | **PASS** on the fix's own scope, with named limitations |
| **Inventory** | N/A | N/A | N/A | N/A | **FAIL — no Working Item exists to collaborate on** | N/A | N/A | N/A | N/A | **FAIL** — honestly, not softened |
| **Event Order** | N/A (no template — correct, not a gap) | PASS* | PASS* | N/A (single-party, confirmed) | N/A (single-party, confirmed — not a failure, a fact) | N/A | PASS* | PASS (RLS-verified) | Not verified | **PASS** (unchanged from BA4B, reconfirmed) |

`PASS*` = unchanged from a prior phase, reconfirmed not rebuilt. Inventory is marked FAIL deliberately, not PARTIAL — there is no partial collaborative experience to point to; the honest state is that this asset cannot support what this work package asked for without new data-model work, which is out of scope by the brief's own rules.

**Stopping here, as instructed.** No PDF/signature architecture, no diff engine, no comment engine, no new Inventory schema, no Invoice redesign, no Task-as-Document conversion were built in this phase.
