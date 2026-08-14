# Work Package BA2 — Business Asset Behavior Certification

**Date:** 2026-08-08
**Scope:** Certification only — no code, no migrations, nothing implemented, nothing redesigned. Every conclusion below traces to a real file, function, table, trigger, or RLS policy, cited where found. Where a behavior doesn't exist, that's stated as a finding, not filled in. Builds directly on `docs/business-asset-system-definition.md` (BA1) — facts already established there are reused, not re-derived, and cited as "(BA1)".

---

## 1. Complete Behavior Inventory

One row per asset named in the brief, plus assets discovered during the audit that turned out to be load-bearing for the behavior model (Conversations, Requests, Feedback — these are where Review/Approve/Reject actually live).

| Asset | Current behaviors (verbs) | Code | DB support | UI | Automation | Relationship | Portal |
|---|---|---|---|---|---|---|---|
| **Contracts** | Create, Edit (draft only), Send, Sign, Cancel, Delete (draft only) | `lib/contracts/service.ts`, `repository.ts` | `contracts.status` enum, app-layer guard only — no trigger/RLS enforcement (BA1) | `/contracts/[id]`, Booking workspace | `triggerAutoComplete("contract_signed")` on sign (repository.ts:284-287, §7 below) | Venue-level activation milestone only, no `clients` row touched | Sign link `/sign/[token]`; read via portal aggregation |
| **Contract Templates** | Create, Clone, Edit, Archive, Restore, Delete | `lib/contracts/{service,repository}.ts` | `contract_templates.is_archived` | `/contracts/templates` | none | none | none |
| **Packages** | Create, Clone, Edit, Delete (`is_active` toggle, not Archive) | `lib/packages/{service,repository}.ts` | `packages.is_active` | `/packages`, `/library/packages` | none | added as Event Order lines | shown read-only where selected |
| **Questionnaires** | Create, Edit (unguarded by status — BA1), Send, Submit (two divergent code paths — §7) | `lib/events/questionnaire.ts`, `app/api/public/questionnaire/route.ts` | `event_questionnaires.status` — `reviewed` is dead (BA1, reconfirmed §7) | Booking workspace (`final-details-form.tsx`) | Staff-submit path only: `triggerAutoComplete`, `refreshLeadScore` | Guest count/ceremony fields feed elsewhere | `/questionnaire/[key]` |
| **Event Orders (BEOs)** | Create, Edit (while open), Generate (lines from Package/Inventory/custom), Lock (`finalizeEventOrder`), Unlock (`reopenEventOrder`), Version (`revision` counter) | `lib/event-orders/{service,repository}.ts` | `event_orders.status` — the one consistently app-enforced lock (`assertOpen()` on every *other* mutation — BA1) | Booking workspace | None on finalize itself (§7 — confirmed nothing else fires) | none | not exposed to couple |
| **Floor Plans** | Create, Clone, Edit (always, even "Finalized"), Share (couple/vendor view), Print | `lib/floor-plans/{service,repository}.ts` | `finalizedAt` — cosmetic only, doesn't gate (BA1) | Booking workspace | none confirmed | reconciliation is read-time only, not event-driven (§7) | Seating section (view), vendor Documents tab (view) |
| **Floor Plan Templates** | Create, Clone, Edit, Archive, Restore, Import (paste-parse) | `lib/floor-plan-templates/{service,repository}.ts` | `is_archived` | `/library/floor-plan-templates` | applies onto a Floor Plan | none | none |
| **Task Templates (Playbooks)** | Create, Clone, Edit, Archive, Restore, Delete, Attach (existing doc/link/upload — 3-way pattern) | `lib/playbooks/{service,repository}.ts`, `components/playbooks/playbook-builder.tsx` | `is_archived` | `/library/playbooks` | Apply-to-event | none | none |
| **Event Tasks** | Create (via apply), Edit, Assign, Complete, Waive/Unwaive, Attach | `lib/playbooks/{service,repository}.ts` | `status`, `dueDateLocked`, `event_playbook_applications.released_at` (Draft/Released gates client *visibility* only — BA1) | Booking workspace, `/tasks` | Auto-complete on `contract_signed`/`payment_received`/`questionnaire_submitted` (§7); dependent-task unblocking | Feeds `readinessByKind` (read-time only) | Client/vendor-owned tasks once released |
| **Payment Plans** | Create, Edit (while unpaid), Lock (per line item, on payment), Regenerate, Acknowledge-drift | `lib/payments/{service,repository}.ts` | `payment_line_items.status` | Booking workspace, Payments | `triggerAutoComplete("payment_received")`; DB trigger recomputes `invoices.balance_due` (§7) | **Independently maintained from Invoices by explicit design** — "should NEVER update automatically" (service.ts comment, §7) | View-only |
| **Invoices** | Create, Edit (line items — **no status guard, confirmed gap, BA1**), Send, Email, Print, Amend (`createAmendedInvoice`) | `lib/invoices/{service,repository}.ts` | `invoices.status`, weakest-enforced lock in the app (BA1) | `/invoices/[id]`, Booking workspace | Balance recompute via DB trigger + TS `reconcileInvoiceBalance` (only the TS path flips `status→paid`, §7) | none direct | portal aggregation |
| **Vendor Documents** (shared) | Upload, Share (`sharedWithVendors`/couple-visible), View | `lib/vendor-documents/*`, generic `documents` table | `documents.uploaded_by_type='vendor'` (BA1) | Booking workspace, vendor portal | `document_uploaded`/`document_uploaded_insurance` auto-complete (BA1, not re-verified this round) | none | shared docs visible if flagged |
| **Vendor Library** | Create, Edit, Delete, Attach-to-event (share) | `lib/vendor-documents/*` | `vendor_library_documents` (BA1) | `/vendor/documents` | none | none | vendor-portal only |
| **Message Templates** (Email+SMS, unified) | Create, Clone, Edit, Archive, Restore, Delete (blocked if referenced by an Automation) | `lib/message-templates/{service,repository}.ts` | `message_templates.is_archived` | `/communication/templates` | consumed by Automation `sequence_steps` | none | none |
| **Conversations / Messages** | Create (compose), Send (channel-aware: email/sms/portal/internal_note/phone_log/voicemail/push), Read (implicit — viewing sets read state), Attach (upload only, never an existing Document), Assign (staff) | `lib/conversations/{service,repository}.ts` | `conversations`, `conversation_messages.status` (9-state delivery lifecycle for email/sms only), `conversation_message_events` | `/messaging`, portal, vendor portal | delivery-webhook events populate status | none direct | full parity — venue/portal/vendor all have real threads |
| **Playbooks** | *(see Task Templates — same entity)* | | | | | | |
| **AI Drafts (Luv)** | Create (AI-generated), Accept, Discard | `lib/luv/drafts.ts` | `luv_drafts.status` (`pending_review→accepted/discarded`) | Luv surfaces | consumed into a sent Message on accept | none stored | not exposed |
| **Legal Documents** | Create, Activate, Deactivate, Version (new version required — edits blocked) | `app/admin/legal/actions.ts` | `legal_documents` — the **only** DB-enforced immutable asset (`BEFORE UPDATE` trigger, BA1) | HQ admin | none | none | acceptance flow (couple/vendor) |
| **Photos (`client_media`)** | Upload (couple only), Delete, Set-hero, Categorize (upload time only) | `app/api/portal/media/route.ts` | `client_media.visibility` — **settable at upload only; `update_couple_media_visibility` RPC exists but is never called (dead code)** | Portal only — **no venue-side gallery exists at all** | none | none | native |
| **Wedding Website** | Create, Edit, Publish, Publish-updates (two-step — staged changes until republished) | `components/portal/website-editor.tsx`, `app/api/portal/website/route.ts` | `couple_websites.status` (`draft/preview/published/archived`) — **DB-enforced**: unpublished sites 404 for guests (BA1+confirmed) | Portal (couple builds it) | none | none | `/w/[slug]` public |
| **Reports** | View only — **no Create/Edit/Export/Print/Download/Save/Schedule of any kind** | `lib/metrics/*`, `components/analytics/*` | none — computed on read, no stored entity | `/analytics`, `/admin/analytics` | none | none | none |
| **Requests** *(discovered)* | Create, Review (`reviewed_at` stamp), Resolve | `lib/requests/service.ts` | `requests.status`, real `reviewed_at` column | Request Summary Card | none confirmed | linked to Event Tasks | portal |
| **Feedback** *(discovered)* | Create, Review, Approve (public display) | `app/(app)/events/[id]/feedback-actions.ts` | `resolve_feedback`, `approve_feedback_public` RPCs | wedding-day dashboard | none confirmed | none | testimonial/memory submission |

---

## 2. Canonical Behavior Vocabulary

The product currently uses more words than it has distinct behaviors. Consolidating to what's real:

| Canonical verb | Absorbs | Real meaning in this product | Recommendation |
|---|---|---|---|
| **Create** | Build, Generate (partially) | Bring a new instance into existence, from scratch or from a Template | Keep. "Generate" survives only where a *transformation* happens (template merge-fields, Event Order lines from Package/Inventory) — otherwise it's just Create |
| **Clone** | Duplicate, Copy | Every real duplication function in the codebase is named `duplicateX` — one behavior, three names in casual use | Standardize on **Clone** in any shared engine; `duplicate*` naming can stay in code, doesn't need a rename |
| **Edit** | Modify, Update, Save | Mutate an existing record's content | Keep. No asset distinguishes "Save" from "Edit" as separate user actions today — they're the same thing |
| **Submit** | — | The *other party* hands something back to the venue (Questionnaire, Request) | Keep, distinct from Share |
| **Share** | — | Venue grants an already-known party (couple/vendor) visibility via a boolean flag | Keep, distinct from Publish |
| **Publish** | — | Make visible to an unauthenticated public audience, DB-gated | Keep — today this is **real and enforced on exactly one asset** (Wedding Website). Everywhere else "publish" is used loosely (Legal Document activate/deactivate, guest timeline publish) without the same DB-level gate — a real vocabulary looseness, not a bug |
| **Lock** | Finalize | Content becomes (or is supposed to become) immutable | Keep as the canonical name. "Finalize" is the accepted synonym for financial/planning records (Event Orders) but should not be assumed to imply real enforcement — see §5 |
| **Sign** | Initial | Binding party consent that produces legal evidence | Keep as its own verb, distinct from Lock/Approve. "Initial" (per-page acknowledgment) **does not exist anywhere** — confirmed absent, not a synonym gap |
| **Archive / Restore** | — | Soft-delete/un-delete, consistent `is_archived` pattern across all 6 Template types | Keep as a pair. Two outliers (Inventory, Vendor Task Templates) use it inconsistently — Inventory has it, Vendor Task Templates uses a plain active/inactive toggle instead (BA1) |
| **Delete** | — | Hard removal | Keep, distinct from Archive |
| **Upload** | — | Bring a new file into storage | Keep |
| **Attach** | — | Link an *already-stored* file/document to something else, without uploading a new one | Keep as **genuinely distinct from Upload** — confirmed as a real, deliberate 3-way pattern (upload / attach-existing / link) on Playbook Tasks, Message Templates, Timeline entries |
| **Assign** | — | Route ownership of a task or conversation to a staff member | Keep |
| **Complete** | — | A task/workflow step is finished | Keep, distinct from Lock (a task completing doesn't make an asset immutable) |
| **Print** | — | Server-rendered HTML + the browser's native print dialog — **never** a generated file | Keep, but rename the mental model: this is not "Export" |
| **Export** | — | *(see below)* | **Retire as a distinct concept until real export infrastructure exists.** Everything in this product currently called "export" (Timeline Export, Wedding Website Export) is actually Print or Publish under a different name — no asset produces a downloadable artifact today except the one raw-file Download path on generic Documents |
| **Download** | — | Force a browser download of an already-stored file | Keep — this only exists for generic uploaded Documents today |
| **Review** | — | An explicit "marked reviewed" status transition, distinct from viewing | Keep as canonical, but **note it is not implemented on any of the 10 core transactional assets** (Contracts, Packages, Floor Plans, Event Orders, Payment Plans, Invoices, Vendor Documents) — only on Requests, Feedback, and (unreachably) Questionnaires |
| **Approve / Reject** | — | An explicit editorial decision on couple-submitted content | Keep as canonical pair, same caveat as Review — real but scattered (vendor removal requests, feedback/testimonial approval), never generalized |
| **Invite / Accept** | — | Vendor onboarding claim flow | Keep |
| **Decline** | — | **Ambiguous today — two unrelated meanings share the word**: declining a vendor *booking inquiry* (real) vs. declining a vendor *portal invite* (doesn't exist — an invite can only be used or left to expire) | Flag, don't consolidate — these need different words if both become real product concepts |
| **Version** | Supersede (in practice) | Today means either "an independent Clone" (Templates) or "a number that increments" (`revision` on Event Orders) — **never** a browsable prior-versions list | Keep as aspirational canonical verb; state plainly it doesn't mean what "version" usually implies yet |
| **Supersede** | — | Declared and fully implemented in `lib/document-domain/integration/contract.ts`/`service.ts` (`supersedeDocument`, transitions `finalized→superseded`) — **never called by any real producer** | Not absent, not implemented-in-practice either — a real, specific "built but dormant" finding, distinct from something that was never built |
| **Comment** | — | Threaded, attributed discussion | **Confirmed absent everywhere** — literally hardcoded `comment: false` in the Document Workspace's own permission type, labeled a future placeholder |
| **Compare** | — | Version-A-vs-B diff | **Confirmed absent everywhere** |
| **Convert / Embed** | — | *(not targeted this round — no evidence found either way; state as unverified, not confirmed-absent)* | Needs a dedicated check before being certified either way |

---

## 3. Business Asset × Behavior Matrix

`S` = Supported (real code), `U` = Unsupported (no evidence anywhere), `F` = Future (declared/scaffolded but not wired — e.g. Document Domain's `supersedeDocument`), `N/A` = doesn't apply to this asset's nature.

| Asset | Create | Clone | Edit | Submit | Share | Publish | Lock | Sign | Archive | Delete | Upload | Attach | Assign | Complete | Print | Download | Review | Approve | Version | Comment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Contracts | S | N/A | S | N/A | S | N/A | S(weak) | S | N/A | S | N/A | N/A | N/A | N/A | U | U | U | U | U | U |
| Contract Templates | S | S | S | N/A | N/A | N/A | N/A | N/A | S | S | N/A | N/A | N/A | N/A | N/A | N/A | U | U | U | U |
| Packages | S | S | S | N/A | S | N/A | N/A | N/A | U | S | N/A | N/A | N/A | N/A | N/A | N/A | U | U | U | U |
| Questionnaires | S | N/A | S | S | S | N/A | U | N/A | N/A | U | N/A | N/A | N/A | N/A | U | U | F(dead) | U | U | U |
| Event Orders | S | U | S | N/A | U | N/A | S | N/A | N/A | U | N/A | N/A | N/A | N/A | U | U | U | U | S(revision) | U |
| Floor Plans | S | S | S | N/A | S | N/A | U(cosmetic) | N/A | U | S | S(bg image) | N/A | N/A | N/A | S | U | U | U | U | U |
| Floor Plan Templates | S | S | S | N/A | N/A | N/A | N/A | N/A | S | S | S(import) | N/A | N/A | N/A | N/A | N/A | U | U | U | U |
| Task Templates | S | S | S | N/A | N/A | N/A | N/A | N/A | S | S | S | S | N/A | N/A | N/A | N/A | U | U | U | U |
| Event Tasks | S | N/A | S | N/A | S(release) | N/A | N/A | N/A | N/A | U | N/A | S | S | S | N/A | N/A | U | U | U | U |
| Payment Plans | S | U | S | N/A | U | N/A | S(per-line) | N/A | N/A | S(line) | N/A | N/A | N/A | N/A | U | U | U | U | U | U |
| Invoices | S | U | S(unguarded) | N/A | S | N/A | S(weak) | N/A | N/A | U | N/A | N/A | N/A | N/A | S | U | U | U | S(amend) | U |
| Vendor Documents | U | U | U | N/A | S | N/A | U | N/A | N/A | U | S | N/A | N/A | N/A | U | U | U | U | U | U |
| Vendor Library | S | U | S | N/A | S | N/A | U | N/A | N/A | S | S | N/A | N/A | N/A | U | U | U | U | U | U |
| Message Templates | S | S | S | N/A | N/A | N/A | N/A | N/A | S | S(guarded) | N/A | S | N/A | N/A | N/A | N/A | U | U | U | U |
| Conversations | S | U | N/A | N/A | N/A | N/A | N/A | N/A | U | U | S | S | S | N/A | U | U | U | U | U | U |
| AI Drafts | S | U | U | N/A | U | N/A | N/A | N/A | N/A | S(discard) | N/A | N/A | N/A | N/A | U | U | S(accept≈review) | S(accept) | U | U |
| Legal Documents | S | U | U(blocked) | N/A | N/A | N/A | S(real) | N/A | N/A | U | N/A | N/A | N/A | N/A | U | U | U | S(activate) | S(new version) | U |
| Photos | S | U | U | N/A | F(dead RPC) | N/A | N/A | N/A | N/A | S | S | N/A | N/A | N/A | U | U | U | U | U | U |
| Wedding Website | S | U | S | N/A | N/A | S(real) | N/A | N/A | S(status) | U | N/A | N/A | N/A | N/A | U | U | U | U | U | U |
| Reports | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U | U |
| Requests | S | U | U | S | N/A | N/A | N/A | N/A | N/A | U | N/A | N/A | N/A | S | U | U | S | U | U | U |
| Feedback | S | U | U | S | N/A | S(public) | N/A | N/A | N/A | U | N/A | N/A | N/A | N/A | U | U | S | S | U | U |

---

## 4. Collaboration Matrix

| Workflow | Who collaborates | Owner | Editor | Reviewer | Approver | Locker | Ends automatically? | Creates versions? | Creates representations? | Updates Relationship? |
|---|---|---|---|---|---|---|---|---|---|---|
| Contract negotiation | Venue only (no real negotiation — draft is venue-authored, couple only signs or doesn't) | Venue | Venue (draft only) | — | — | Couple (signs → app-layer lock) | Yes, at signature | No | No (no PDF exists) | Venue-level activation milestone only |
| Questionnaire completion | Venue + Couple | Venue | Both, unguarded by status | — | — | **Nobody — never locks in practice** | No | No | No | Only via the staff path (auto-complete + lead-score refresh); the couple-submission path updates nothing else |
| Floor Plan editing | Venue (sole editor); Couple/Vendor view-only despite a reserved "edit" flag | Venue | Venue only | — | — | **Nobody — "Finalized" is cosmetic** | No | No (Clone exists, not a version chain) | Yes (print) | No |
| Inventory | N/A — no per-event working list exists (BA1); only the venue-wide catalog is edited, by venue staff alone | Venue | Venue | — | — | N/A | N/A | N/A | N/A | N/A |
| Task completion | Venue + Couple/Vendor (per `TaskVisibility`) | Venue | Whoever owns the task | — | — | N/A (tasks don't lock, they complete) | Yes, on completion | No | No | Feeds read-time readiness only |
| Vendor document exchange | Venue + Vendor | Vendor (own library) / Venue (event-shared copy) | Vendor uploads, Venue shares | — | — | N/A | N/A | No | No | No |
| Conversations | Venue + Couple/Vendor | Venue | All participants | — | — | N/A | No (threads are open-ended) | No | No | No |
| Feedback/testimonial | Couple submits, Venue reviews | Couple (content) / Venue (visibility) | Venue (response) | **Venue (real)** | **Venue (real, public-display gate)** | N/A | No | No | No | No |

**The pattern across every real workflow:** collaboration in this product means "one party edits, the other party views or takes a single terminal action (sign/submit/complete)" — there is no asset anywhere with genuine two-way, ongoing co-editing, and no asset produces a version history from collaboration. Feedback/testimonials is the one place a real Review→Approve chain exists end to end.

---

## 5. Finalization Matrix

Every real implementation of "finalized," certified against actual enforcement (BA1 identified the inconsistency; this pass confirms and completes it).

| Asset | What "finalized" means here | Enforcement | Evidence |
|---|---|---|---|
| Event Orders | Real lock | **App-layer, but consistent** — `assertOpen()` gates every other mutation function | `lib/event-orders/service.ts` |
| Legal Documents | Real lock | **DB-enforced** — `BEFORE UPDATE` trigger raises an exception on content/title/version/effective_date change | `legal_documents_immutable_content()` (BA1) |
| Contracts | Signature = lock | App-layer only — RLS has no status guard; a code comment admits this is intentional ("blocked for everyone at the app layer") | `lib/contracts/repository.ts` |
| Invoices | Status = lock | **Weakest of all** — line-item edit functions have zero status guard even post-send; only status-transition functions are guarded | `lib/invoices/repository.ts` |
| Floor Plans | `finalizedAt` | **Cosmetic — explicitly non-gating**, a checkpoint stamp, not a lock, by the type's own doc comment | `lib/floor-plans/types.ts` |
| Questionnaires | `status='reviewed'` | **Unreachable** — declared, checked by 3 consumers, never set by any code path | multiple (BA1) |
| Wedding Website | `status='published'` | **DB-enforced** — unpublished sites 404 at the RPC layer for any guest | `20261005000000_wedding_website_stabilization_public_rpc.sql` |

**Recommended single canonical behavior (certification, not implementation):** "Finalized" should mean exactly what Event Orders and Legal Documents already do — mutations blocked, an explicit, deliberate unlock required to resume editing — with Legal Documents' DB-level trigger as the stronger reference pattern where true evidence integrity matters (Contracts, Invoices), and Event Orders' consistent app-layer guard as the acceptable minimum elsewhere. Floor Plans' current "finalized" should stop being called that (it's a checkpoint, and is already correctly documented as one in its own code) — reusing the same word for a non-lock is the actual defect, not the absence of a Floor Plan lock feature.

---

## 6. Representation Matrix

Every place the system produces a user-facing artifact — confirmed, not assumed. **No PDF generation exists anywhere in this codebase** (BA1, reconfirmed this round for Reports).

| Representation | Assets | Created how | Versioned? | Branded? | Immutable? | Regenerated? | Belongs to |
|---|---|---|---|---|---|---|---|
| Printable HTML + browser print | Invoices, Floor Plans, Timeline, Day Sheet | Server-rendered page, live at request time | No — always renders current state | Yes (logo + primaryColor, consistent — BA1) | No — re-rendered fresh every time, reflects live data even for a "locked" Invoice | Always (it's not a stored file) | The Working Asset — there is no separate Locked Record artifact |
| Public live page | Wedding Website | Rendered from `couple_websites` at request time, gated by `status='published'` | No | Deliberately not venue-branded (BA1) | No | Always | The Working Asset (the "Locked Record" would be the last-published snapshot, but no such snapshot is actually stored — `hasPendingChanges` just means the live page hasn't caught up yet) |
| Sign-page HTML | Contracts | Rendered from `contracts.content` at `/sign/[token]` | No | Yes (the most complete branding of any surface — primary/secondary/accent/neutral, BA1) | No — same content renders whether draft, sent, or already signed | Always | Working Asset |
| Portal aggregation cards | Contracts, Invoices, generic Documents | Read-time union query (`get_couple_documents`) | No | Inherits venue branding via portal shell | No | Always | Working Asset |
| Email | Conversations, questionnaire/contract send notifications | `sendEmail`/`sendSms` at send-time | No | Not verified this round | N/A (a sent message is its own record) | N/A | N/A |
| Download (forced blob) | Generic Documents only | Client-side fetch-as-blob | N/A — downloads the original uploaded file, unchanged | N/A (whatever the original file is) | Yes, in the sense that it's the original bytes | N/A | Working Asset (the one raw upload) |

**No asset in this product has a Locked-Record-specific representation distinct from its Working-Asset rendering.** A "signed" Contract and a "draft" Contract render through the identical code path; the only difference is the status badge. This is the direct, product-level consequence of §5 and §6 combined: nothing actually freezes what a party sees at the moment of signing/finalizing.

---

## 7. Relationship Effects — traced, not inferred

Precise chains for the six state changes that matter most, each confirmed against real code this round.

| State change | Confirmed chain | Confirmed **not** to happen |
|---|---|---|
| **Contract signed** | `sign_contract` RPC (one transaction): updates `contracts` → inserts `contract_activities` → inserts `luv_celebrations`. Then TS: `recordEngagementEvent` → venue-level `venue_activation_state`/`venue_milestones` (NOT a client/relationship status change) → `triggerAutoComplete("contract_signed")` completes/unblocks matching Event Tasks | No notification row of any kind. No `clients`/`leads` status write. |
| **Invoice marked paid** | `markLineItemPaid` → `payment_activities` insert → **two independent balance writers**: a DB trigger recomputes `balance_due` immediately, and a separate TS `reconcileInvoiceBalance` call is the *only* thing that flips `status→'paid'` → `triggerAutoComplete("payment_received")` → `recordEngagementEvent` (same venue-milestone pattern as above) → a Luv celebration only if `computePaymentsReadiness()===complete` | Decision Engine deliberately does **not** read raw payment status directly (by design, matching its own documented reasoning) |
| **Questionnaire submitted** | **Two different, non-equivalent paths**: the couple-portal RPC only sets `status='submitted'` + inserts one system chat message; the staff-side save additionally fires `triggerAutoComplete("questionnaire_submitted")` and `refreshLeadScore`. Luv's own query for pending questionnaires simply stops matching the row — it never observes submission as an event | The couple-submitted path — the far more common real-world one — triggers **no task completion and no lead-score refresh at all** |
| **Task completed** | Status update → cancels reminders → unblocks dependent tasks. A notification fires **only** if a human (couple/vendor) completed it, via either a TS check or a separate DB trigger keyed on `completed_by` | **System-completed tasks** (the ones auto-completed by contract-signed/payment-received/questionnaire-submitted above) generate **zero notification anywhere** — the entire automation chain is invisible to the venue unless they happen to look |
| **Payment Plan line-item edited** | Only ever touches `payment_schedules`/`payment_line_items`/`payment_activities` | **Never** touches `invoices` — confirmed by the code's own comment: "Payment Plans should NEVER update automatically." Drift is computed live at render time and only silenced (never resolved) by acknowledging it |
| **Event Order finalized** | Updates `event_orders` (`status`, `revision+1`) → one `event_order_activities` row | Nothing else — no notification, no task completion, no Floor Plan write. `assertOpen()` is a guard *other* mutations call, not something `finalizeEventOrder` itself invokes |

**The single most material finding in this whole certification:** the automation chain the product already relies on (contract signed → task auto-completes; payment received → task auto-completes) is real and working, but **produces no visible trace anywhere** — no notification, no Decision Engine observation, nothing a venue owner would see. The system acts, correctly, silently.

---

## 8. Shared Engine Candidates (identify only — not building)

| Candidate engine | Why it qualifies | Assets that would consume it |
|---|---|---|
| **Locking/Finalization** | Currently 5 different implementations of the same concept, 2 real behaviors (enforced app-layer, DB-enforced) and 3 fakes (cosmetic, dead, weak) | Contracts, Invoices, Event Orders, Floor Plans, Legal Documents |
| **Archive/Restore** | Already a real, consistent pattern across 6 Template types independently — ready to be lifted into one shared primitive rather than formalized | All 8 venue-library Template assets |
| **Clone** | Same shape (`duplicateX`) reimplemented per asset, 6+ times | All Template assets |
| **Attach** | Already a genuinely consistent 3-way pattern (upload/attach-existing/link), independently built 3 times | Playbook Tasks, Message Templates, Timeline entries — and a clear candidate for every other asset that currently only supports raw Upload |
| **Automation-visibility / notification-on-system-action** | The gap found in §7 — every asset's automation fires silently | Contracts, Invoices, Payment Plans, Questionnaires, Event Tasks |
| **Branding/Representation** | Already consistent (logo + primaryColor) across 7 surfaces, missing only typography (BA1) — ready to formalize, not rebuild | Every client-facing Representation |
| **Review/Approve** | Real on 3 objects (Requests, Feedback, and the unreachable Questionnaire case), absent on the 7 core transactional assets that would benefit most | Vendor Documents, Floor Plans (change requests), Invoices |
| **Versioning** | Currently means three different things (Clone, `revision` counter, or nothing) with a fully-built-but-unused `supersede` verb sitting idle in the Document Domain | Contracts, Invoices, Legal Documents |
| **Signature** | One working, self-contained implementation (Contracts) that nothing else reuses | Currently Contracts only — a candidate if any other asset ever needs binding consent |

---

## 9. Product Gap Register

Only gaps that would materially change real venue operations — not feature-parity wishlisting.

| Gap | Asset(s) | Why it matters to a venue owner |
|---|---|---|
| **System-completed automation is invisible** (§7) | Contracts, Invoices, Questionnaires, Event Tasks | A coordinator has no way to know a task auto-completed because a couple paid or signed — they'd have to notice on their own |
| **Invoice line items are editable with zero guard, even after sending** | Invoices | The one asset most likely to be treated as authoritative is also the least protected against accidental post-send edits |
| **"Finalized" means three different things on three different assets, using the same word** | Event Orders, Floor Plans, Questionnaires | Direct source of confusion for anyone building on top of this concept, including future Decision Engine logic that might key off status strings |
| **Questionnaire submission behaves differently depending on who submits it** | Questionnaires | The couple-facing path (the common case) skips the automation the staff-facing path gets — an inconsistency, not a designed difference |
| **No representation is ever frozen at the moment of signing/finalizing** | Contracts, Invoices, Event Orders | A "signed" Contract and a still-editable draft render through the identical code path today — there is no artifact that proves what was actually agreed to at that moment |
| **Photo visibility can be set once, never changed** | Photos | A couple who marks a photo "venue" or "website" visible has no way to revert it — the RPC to change visibility exists in the database and is simply never called from any UI |
| **No venue-side photo management exists at all** | Photos | Venues cannot see, curate, or manage a couple's uploaded photos through any venue-facing screen |
| **Insurance/permit expiry tracking computes but never alerts** | Vendor Documents (carried over from BA1, reconfirmed relevant here since it's a behavior gap, not just a data gap) | The expiry math already exists and is unused |
| **A vendor invite can only be used or silently expire — never explicitly declined** | Vendor invites | No way for a vendor to signal "not interested" distinctly from ignoring the email |

---

## 10. Implementation Sequence (recommended order, not scheduled)

Stated as a sequencing recommendation only, per the brief's own instruction not to implement anything here.

1. **Fix the Invoice editability gap** (§5, §9) — a bug-fix-shaped correction, not new design, and the single highest-consequence item found.
2. **Resolve the "Finalized" naming collision** (§5) — a documentation/rename decision before any shared Locking engine is designed, so the engine isn't built around three incompatible existing meanings.
3. **Close the questionnaire submission-path inconsistency** (§7, §9) — align the couple-submitted path with the staff-submitted path's automation, or explicitly decide the difference is intentional and document why.
4. **Surface system-completed automation** (§7, §9) — the biggest trust/visibility gap found; likely resolved through the existing Decision Engine rather than a new notification system, consistent with how overdue payments/tasks are already surfaced there.
5. **Only then**, consider the larger shared-engine candidates in §8 (Locking, Archive/Restore, Clone, Attach, Branding) — each is a real consolidation opportunity, but none is blocking, and building them before the correctness gaps above are resolved would encode the current inconsistencies more deeply rather than fixing them.

**Stopping here, as instructed.** No code, no migrations, no redesign, no producer integration was performed for this phase.
