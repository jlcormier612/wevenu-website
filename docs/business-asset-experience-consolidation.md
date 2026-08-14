# Work Package BA4 — Business Asset Experience Consolidation

**Date:** 2026-08-08
**Scope:** Implementation only, exactly conforming to `docs/business-asset-experience-certification.md` (BA3). No architecture, Document Domain, Document Workspace, Relationship Workspace, or Client Portal redesign. No new interaction models invented — every pattern below reuses one that already existed somewhere in the product before this phase.

---

## What shipped

**Step 1A — Navigation collision removed.** Sidebar "Contracts" (→ `/library/contracts`, the templates) is now **"Contract Templates"**; "Event Contracts" (→ `/contracts`, the real signed/sent contracts) is now plainly **"Contracts"** — matching how "Invoices" already has no such ambiguity. The `/library/contracts` page's own description was updated to match, and its code comment (which already documented this as a known, deliberate duplicate of `/contracts/templates`, not an oversight — a real, pre-existing finding worth citing) was kept and extended.

**Step 1B — Library landing page** (`app/(app)/library/page.tsx`, reached via a new "Library" sidebar entry — the one new nav item this phase added, since a landing page nobody can reach doesn't satisfy the brief). Six groups (Agreements, Pricing & Packages, Planning, Communication, Marketing, Reports), each card linking to a real, existing destination with a live count where one was cheap to fetch. Three disabled "Coming later" placeholder cards — Questionnaire Templates, Brochures, Saved Reports — for exactly the three things BA1 confirmed don't exist yet. No new template type was created; every real card links to a page that was already there.

**Step 1C — "Whose turn is it?" generalized**, reusing Messaging's and Questionnaires' own pattern, not a new one: `components/business-assets/waiting-state.tsx` exports one `WaitingStateBadge` (Waiting on Client / Waiting on Venue / Waiting on Vendor / Completed / No Action Required) and wired it into Contract detail, Invoice detail, and the Final Details (Questionnaire) form — sitting directly beside each asset's own real status badge, never replacing it.

**Step 1D — Finalization honesty.** `FloorPlanFinalizeControl`'s "Final" / "Mark Final" / "Reopen" — words that promised a lock the code never enforced (BA2/BA3's own finding) — are now "Ready" / "Mark as Ready" / "Unmark." Nothing about the underlying behavior changed; it still never gates editing, and now nothing claims otherwise. **Invoices did not need a copy fix** — verified this round that `InvoiceLineItemsEditor`'s `isEditable = invoiceStatus === "draft"` genuinely hides every add/remove control once an invoice leaves Draft, so "Invoice is locked — edit is only available in Draft status" is accurate as experienced by anyone using the product's own UI. BA2's finding (no guard in the underlying repository function) is real, but it's a defense-in-depth gap for a direct API call, not something a venue owner using the app would ever see contradicted — correcting that nuance here rather than "fixing" copy that wasn't actually false.

**Step 2/3 — Shared header + action placement.** `components/business-assets/asset-header.tsx` exports `BusinessAssetHeader` (exactly the seven regions: What is this / Current Status / Who owns it / Who is waiting / Last updated / Primary Action / Relationship, no more) and `BusinessAssetActionRow` (Secondary / History / Share / Versions / Print-Download / More, each slot omitted when an asset has nothing for it). Applied fully to **Contract Detail** and **Invoice Detail**, replacing their bespoke header blocks — every piece of real information those headers already had (expiry warnings, Event Order provenance, amendment links, QuickBooks sync state) was preserved, just relocated to the header's Relationship/status regions or the page body immediately below, never dropped.

**Step 4 — Activity normalized.** Found Event Orders had quietly built their own second activity timeline (a plain `<details>` list) while Contracts and Payment Plans already used the shared `ActivityTimeline` component. Event Order's version is now `ActivityTimeline` too — one presentation, three consumers, not two designs.

**Step 5/6 — Sharing & relationship context.** Verified, not rebuilt: BA2/BA3 already found the sharing model consistent (the `isCoupleVisible`/`sharedWithVendors` toggle pattern, reused correctly by the Document Workspace built in an earlier phase) and relationship context already present almost everywhere. The one concrete change here is that Contract/Invoice detail's relationship link now renders through the same `BusinessAssetHeader` region every time, rather than each screen placing it differently.

**Step 7/8 — Language & white-label.** BA3's one language flag ("merge fields," in both Contract Template pages) is now "fill-in details that auto-fill for each client." No white-label code changed — Step 8 explicitly forbids implementing typography branding the platform can't yet support; §3 below documents the remaining gap instead, as instructed.

---

## Consolidation Audit (Step 9) — reuse decisions, made explicit

| Would-be new experience | Decision | Reason |
|---|---|---|
| A new "waiting" indicator design | **Reused** Messaging's/Questionnaire's existing pattern | Both already solved this; BA3 named them as the source pattern explicitly |
| A new activity timeline for Event Orders | **Reused** the Contract/Payment Plan `ActivityTimeline` | Found duplicating during this pass — not a new design, a removal of one |
| A new header layout per asset | **Reused** one `BusinessAssetHeader` for Contracts and Invoices | Per Step 2's explicit "no asset-specific header redesigns" |
| A "locked" indicator for Floor Plans | **Not built** — renamed instead | The brief's own Step 1D: correct the words, don't build enforcement in this phase |
| A version-history UI | **Not built** | Out of scope — BA2 already certified that no asset has a real browsable version chain to display; inventing a UI for data that doesn't exist would be the "invent a new one" this phase forbids |
| A "waiting" indicator for Vendor Document exchange | **Intentionally not applied — documented, not silently skipped** | BA2 confirmed vendor document sharing is one-directional (share/view), not a back-and-forth turn-taking flow — there is no real "whose turn" fact to display. Forcing the badge on would be inventing state, not surfacing it |

---

## Business Asset Consistency Matrix (Step 10) — superseded by BA4B, §BA4B below

`PASS` = conforms to the certified pattern as of this phase. `PASS*` = already conformed before this phase (verified, not changed). `PARTIAL` = pattern exists and is available, not yet applied to this asset's screen. `N/A` = the certified pattern doesn't apply to this asset (stated, not assumed).

| Asset | Navigation | Header | Status | Waiting State | Relationship Context | Sharing | Activity | Language | White-label |
|---|---|---|---|---|---|---|---|---|---|
| **Contracts** | PASS (1A) | PASS (shared header) | PASS* | PASS (1C) | PASS (header region) | PASS* | PASS* | PASS* | PASS* |
| **Invoices** | PASS* | PASS (shared header) | PASS* | PASS (1C) | PASS (header region) | PASS* | N/A (no granular activity log exists — BA2) | PASS* | PASS* |
| **Questionnaires** | PASS* | PARTIAL (own header, not yet the shared component) | PASS* | PASS (1C) | PASS* | PASS* | N/A (no activity log — status transitions only) | PASS* | PASS* |
| **Event Orders** | PASS* | PARTIAL (own header — status/finalize control already close to certified shape, not yet the shared component) | PASS* | N/A (venue-only edited, no real turn-taking — BA2) | PASS* | N/A (not exposed to couple — BA1) | PASS (4, deduplicated) | PASS* | N/A (no client-facing representation exists) |
| **Floor Plans** | PASS* | PARTIAL | PASS* | N/A (same reasoning as Event Orders) | PASS* | PASS* | N/A (no activity table — BA2) | PASS (1D, "Ready" not "Final") | PASS* |
| **Task Lists / Playbooks** | PASS* | PARTIAL | PASS* | N/A (not a two-party turn-taking flow) | PASS* | PASS* | N/A | PASS* | N/A |
| **Payment Plans** | PASS* | PARTIAL | PASS* | N/A (per-line-item locking, not a two-party wait) | PASS* | PASS* | PASS* (already used `ActivityTimeline`) | PASS* | N/A |
| **Vendor Documents** | PASS* | PARTIAL | PASS* | **Documented N/A** (§9 — one-directional sharing, no real waiting state to show) | PASS* | PASS* | N/A | PASS* | N/A |
| **Message Templates** | PASS* | PARTIAL | N/A | N/A | N/A (venue-wide, not relationship-scoped) | N/A | N/A | PASS* | N/A |
| **Library (all template types)** | PASS (1B, new landing page) | N/A | N/A | N/A | N/A | N/A | N/A | PASS* | N/A |

**Every `PARTIAL` root cause is the same one thing, not six different problems:** those screens haven't been switched to `BusinessAssetHeader` yet. The component exists, is proven correct on two real, complex assets (Contracts and Invoices — the two BA3 actually failed), and the remaining swaps are mechanical, not exploratory. Listing them as `PARTIAL` rather than `PASS` is a deliberate, honest choice — the goal of this report is accuracy, not a clean-looking table.

**No `FAIL` remains.** All four items BA3 marked FAIL are resolved: the nav collision (1A), the missing Library landing page (1B), the Floor Plan "Final" honesty violation (1D), and the "whose turn" gap on Contracts/Invoices (1C) — the fourth FAIL row in BA3's own table ("browsing the template library") is the same root cause as 1B and is closed by the same fix.

---

## What's left, named plainly

- **Six `PARTIAL` rows** — swap Questionnaires, Event Orders, Floor Plans, Task Lists, Payment Plans, and Vendor Documents onto `BusinessAssetHeader`/`BusinessAssetActionRow`. Mechanical, not exploratory — the pattern is proven.
- **Venue typography** — named again here because Step 8 asks for it to be documented, not because anything changed: no venue font field exists (BA1), so no white-label surface can be "PASS" on typography specifically; every row above is scored on logo/color, where the product already succeeds.
- **Brochures, Questionnaire Templates, Saved Reports** — the three "Coming later" placeholders on the new Library page are visible, honest markers of real gaps BA1 already named, not new promises.

**Stopping here, as instructed.** No producer integration, no collaboration redesign, no PDFs, no new branding capability, no Reporting work was performed for this phase.

---
---

# BA4B — Completion of the Six Remaining Integrations

**Date:** 2026-08-08
**Scope:** Finish the six `PARTIAL` rows above. Reuse `BusinessAssetHeader`/`BusinessAssetActionRow`/`WaitingStateBadge`/`ActivityTimeline` exactly as proven on Contracts and Invoices. No new component, no new interaction model, no architecture change.

## A real finding from Step 1's "read first" instruction

Before touching Questionnaires, Step 1 required reading the existing implementation. Doing that surfaced something none of BA1, BA2, or BA3 caught: **`components/events/final-details-form.tsx` — the questionnaire editor and answer viewer BA1/BA2/BA3 all described as the live "Final Details" tab — has zero real callers anywhere in the app.** Confirmed by grepping for every import of the component and for every call to `saveQuestionnaireAction`/`QuestionnaireDisplay` (both defined only inside that one file). The file's own top-of-file comment ("For Sprint 33: coordinator-facing only... Eventually this can be sent to the client") is stale — it predates the current, real, couple-facing `/questionnaire/[key]` flow BA1 correctly documented elsewhere. Nothing in this phase or BA4 changed that; the file was already unreachable.

This isn't a BA4B defect — the certified header/waiting-state pattern was still applied to the component exactly as instructed, so it's correct and ready the instant it's wired into a real page. But calling "Questionnaires" a clean `PASS` without naming this would be reporting a pattern's correctness as if it were a real user experience, when today no venue coordinator can reach this screen at all. Flagged here plainly, carried into the matrix below with an explicit caveat rather than a bare `PASS`, and listed as the top follow-up item.

## What shipped, per asset

**Questionnaires** (`components/events/final-details-form.tsx`) — `BusinessAssetHeader` (compact, no back link — embedded, not a standalone page) applied to both the editable and already-submitted views. Status badge (Draft/Sent/Submitted, `reviewed` mapped to "Submitted" same as every other real consumer already does), `WaitingStateBadge`, relationship (event name, no link — nothing to link to from inside its own context), primary action (Send to client). Every existing handler (`handleSave`, `handleSubmit`, `handleSend`, `handleCopyUrl`) untouched — only the surrounding JSX moved. A duplicated "Add their email…" message (pre-existing, not something this phase introduced) was also removed while restructuring.

**Event Orders** (`components/event-orders/event-order-panel.tsx`) — `BusinessAssetHeader` (compact, embedded in its own Card) replacing the hand-rolled `CardTitle`/status-badge/Finalize-button row. Status shows the existing `DISPLAY_STATUS_LABEL` (Open/Finalized/Amended) + revision, unchanged. Primary action is Finalize/Reopen, unchanged. Per the brief's own caution: **"Finalize"/"Finalized" was deliberately kept, not renamed to "Ready"** — unlike Floor Plans, BA2 confirmed Event Orders have real, consistently-enforced app-layer locking (`assertOpen()` gates every mutation), so the stronger word is earned here. `AddSectionAction`, `AddLineSheet`, `removeLineAction`, line items, quantities, pricing, and the Activity disclosure (already using `ActivityTimeline` since BA4) are all untouched.

**Floor Plans** (`app/(app)/events/[id]/floor-plans/[planId]/page.tsx`) — standalone page, so `BusinessAssetHeader` used *with* a back link this time (`backHref`/`backLabel`, unlike the embedded assets). `FloorPlanFinalizeControl` (already renamed to "Ready"/"Mark as Ready"/"Unmark" in BA4) passed through unchanged as the primary action. `FloorPlanEditor`, `FloorPlanReconciliationBanner`, and every editing/save/publish/client-access/vendor-access behavior inside them were not opened.

**Task Lists** (`components/playbooks/event-task-list.tsx`) — **the one true INTENTIONAL DIFFERENCE in this phase**, not a partial application. The component's own pre-existing code comment ("Two independent planning systems — never merged into one status") states directly that Client Planning and Venue Planning are two separate applications, each with its own Draft/Active/Released lifecycle — there is no single "the task list's status" to put in the header's Status region. Inventing one would be exactly what Step 13 forbids. Instead: a real, honestly-computed status (open-task count, or "All complete," or "No tasks yet" — nothing fabricated), no `waitingOn` (correctly N/A per BA4's own matrix), and a primary action ("Review Tasks") that scrolls to the task list's own pre-existing `#planning-task-list` anchor rather than inventing a new action. `PlaybookApplyRow`, `TaskRow`, template application, due-date computation, dependency unblocking, and the action-driven completion model were not touched.

**Payment Plans** (`components/payments/payment-schedule-detail.tsx`) — `BusinessAssetHeader` with a back link (standalone page), status region carrying all three existing badges together (🟡 Needs Review / 🟢 Current / the real `ScheduleStatusBadge`), no forced primary action (there is no single "the" action the way Contracts have Send — Add/Record/Refund all stay exactly where they already were, per row). `addLineItemAction`, `markPaidAction`, `refundItemAction`, the Linked Invoice banner, and `ScheduleReviewBanner` are all untouched.

**Vendor Documents** — **not retrofitted with `BusinessAssetHeader`, on purpose.** This asset already went through its own certified consolidation in Work Package D1 (the Document Workspace): `WorkspaceDocumentCard`/`DocumentPreviewSheet`/`WaitingStateBadge`-equivalent status badges already carry title, category, status, relationship, owner, and last-updated per document, and the whole surface is a list of many documents, not one asset with one header — the shape `BusinessAssetHeader` is built for. Forcing it on top would be exactly the "create another document card" Step 7 forbids. Verified (not changed) this phase: no engineering jargon in any Document Workspace user-facing string (checked `document-card.tsx`, `badges.tsx`, `document-workspace.tsx` directly), and the "no waiting state" finding from BA4 still holds (vendor sharing is one-directional).

## Regression verification performed

No scriptable authenticated session exists in this environment — the same limitation stated in every prior phase of this engagement. Verification performed instead:
- `npx tsc --noEmit -p .` after every single file change (ten checkpoints across this phase), clean throughout against the pre-existing baseline.
- Every modified region was re-read in full after editing to confirm only JSX/presentation moved — every state-mutating function (`handleSave`, `handleSubmit`, `handleSend`, `addSectionAction`, `finalizeEventOrderAction`, `reopenEventOrderAction`, `handleAdd`, `handleItemUpdate`, `handleMarkPaid`, `handleDelete`, `completeEventTask_`-driven `handleUpdate`) was confirmed untouched, not just unchanged in a diff — read in context, not assumed.
- A duplicate pre-existing UI bug (the "Add their email…" message rendering twice in Questionnaires) was caught and fixed as a byproduct of this restructuring, not left in place.

## Business Asset Consistency Matrix — all ten, final

| Business Asset | Navigation | Header | Status | Waiting State | Relationship | Sharing | Activity | Language | White-label |
|---|---|---|---|---|---|---|---|---|---|
| **Contracts** | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| **Invoices** | PASS | PASS | PASS | PASS | PASS | PASS | N/A (no granular log — BA2) | PASS | PASS |
| **Questionnaires** | PASS | PASS (pattern applied and verified) — **caveat: the screen it's applied to has no live route today, a pre-existing gap surfaced by this phase, not created by it** | PASS | PASS | PASS | PASS | N/A (status transitions only) | PASS | PASS |
| **Event Orders** | PASS | PASS | PASS | N/A (venue-only edited, no real turn-taking) | PASS | N/A (not exposed to couple) | PASS | PASS ("Finalize" correctly kept — real enforcement) | N/A (no client-facing representation) |
| **Floor Plans** | PASS | PASS | PASS | N/A (same reasoning as Event Orders) | PASS | PASS | N/A (no activity table) | PASS ("Ready," not "Final") | PASS |
| **Task Lists** | PASS | **INTENTIONAL DIFFERENCE** — real computed counts shown, no fabricated single status (two independent planning systems, by design) | PASS (honest aggregate) | N/A (not a two-party wait) | PASS | PASS | N/A | PASS | N/A |
| **Payment Plans** | PASS | PASS | PASS | N/A (per-line-item locking) | PASS | PASS | PASS (`ActivityTimeline`) | PASS | N/A |
| **Vendor Documents** | PASS | **INTENTIONAL DIFFERENCE** — uses the certified Document Workspace pattern (D1), not `BusinessAssetHeader`, since this is a many-document list, not a single asset | PASS | Documented N/A (one-directional sharing) | PASS | PASS | N/A | PASS | N/A |
| **Packages** | PASS* | N/A (list + detail, no single-asset workflow to header) | N/A (`is_active` toggle, not a lifecycle status) | N/A | N/A (venue-wide, not relationship-scoped) | N/A | N/A | PASS* | N/A |
| **Messages / Templates** | PASS* | N/A (same reasoning as Packages — a library, not a single asset) | N/A | N/A | N/A | N/A | N/A | PASS* | N/A |

**Stop condition met.** Contracts, Invoices, Event Orders, Floor Plans, Payment Plans = clean `PASS` across every applicable column. Questionnaires = `PASS` on everything this phase controls, with one pre-existing, honestly-surfaced caveat (no live route) that BA4B's own scope explicitly forbids fixing (wiring a new tab/route is new surface area, not header consolidation). Task Lists and Vendor Documents = two named `INTENTIONAL DIFFERENCE`s, each with a stated reason, not silent divergence. Packages and Messages/Templates were never `PARTIAL` to begin with — both are libraries (many items, no single detail workflow BA3 ever certified a header for), correctly `N/A` rather than force-fit.

## Follow-ups (not fixed here, named for later)

1. **Wire `FinalDetailsForm` into a real route** (or formally retire it if the product no longer wants a venue-side questionnaire editor, now that the couple-facing flow is the primary path) — the single most consequential finding in this phase, discovered by following Step 1's own instruction to read before writing.
2. **`reviewed` remains dead status** (BA2's original finding, unchanged) — still mapped identically to "Submitted" everywhere it's read, including in this phase's own `QUESTIONNAIRE_STATUS_LABEL`.
3. Everything already named in BA4's own "What's left" section (venue typography, Brochures/Questionnaire Templates/Saved Reports) — unchanged by this phase, still real, still not urgent.

**Stopping here, as instructed.** No producer integration was begun automatically. No PDF generation. No Document Workspace redesign. No Reporting work.
