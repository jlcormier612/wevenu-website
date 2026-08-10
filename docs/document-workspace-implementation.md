# Work Package D1 — Canonical Document Workspace — Implementation Report

**Date:** 2026-08-08
**Scope:** Real assembly of the customer-facing Document Workspace, per `docs/document-workspace-inventory.md` (Step 1). The Document Domain, Contracts, and Invoices were not touched — confirmed below.

---

## 1. What shipped

**Data layer** (`supabase/migrations/20261222000000_document_workspace.sql`, `lib/document-workspace/`):
- `get_venue_documents(p_lead_id, p_client_id, p_event_id, p_vendor_id)` — one read-only SQL function, unioning `documents` + `contracts` + `invoices` + `floor_plans` + `event_questionnaires` into the normalized `WorkspaceDocument` shape, exactly the pattern `get_couple_documents()` already established for the portal. Security-definer, no caller-supplied venue id (`current_user_venue_id()` only, matching every sibling RPC). Validated in a transaction against real dev data before being applied for real (5 doc types returned, event-scoped filter returns 0/N correctly, both new tables accept RLS-gated inserts) — see the session's own psql output; nothing here is untested SQL.
- `document_workspace_pins` / `document_workspace_interactions` — the two small, additive tables flagged in Step 1 as genuinely required (not scope creep) for Recent/Pinned to be real, multi-user, durable features.
- `lib/document-workspace/{types,normalize,service,actions,permissions,filter-sort,vendor-normalize}.ts` — normalization, data fetching, mutations (pin/unpin/record-interaction), permission surfacing (Step 11, declarative only, no new capability), search/filter/sort (Steps 7–9).

**Canonical components** (`components/document-workspace/`):
- `WorkspaceDocumentCard` — Step 3's exact field set (icon, title, category, relationship, status, version, updated, owner) and exact Quick Actions (Open/Preview/Share/Download/Version History/More).
- `DocumentPreviewSheet` — Step 4's exact section order (Header/Metadata/Version/Relationship/Representation/Activity/Actions/Comments-placeholder); Representation is the only place any type-specific fact appears.
- `VersionHistorySheet` — Step 5's exact fields. Honest, not embellished: every document normalizes to "Version 1," a second entry only appears when `updatedAt` genuinely differs from `createdAt` — no producer in this app has a real version chain yet (Step 1 finding), and this doesn't pretend otherwise.
- `WorkspaceEmptyState` — exactly the four states in Step 10, nothing else.
- `DocumentWorkspace` — the one shell: Pinned, Recent (cap 25), Categories (all 12, always present, showing 0 where nothing exists yet), Search, Filter (category/status/shared/signed — see §4 on Locked/Archived), Sort (all 7), the document list, Activity.

**Entry points wired** (Step 12):
- **Global** — new `app/(app)/documents/page.tsx`, the full, unfiltered reference build.
- **Relationship Workspace** — `lead-detail.tsx` (Lead), `vendor-detail.tsx` (Vendor), `booking-documents-tab.tsx` (Client/Event, reached via `/clients/[id]`) all now render the same `DocumentWorkspace`, filtered by `leadId`/`vendorId`/`eventId` through the same one RPC. The old `components/documents/{documents-section,document-card,document-preview-modal,document-category-badge}.tsx` — confirmed zero remaining importers after the swap — are deleted, not left orphaned.
- **Vendor Workspace** — the per-event Documents tab in `vendor-event-workspace.tsx` now renders `DocumentWorkspace` (read-only: `pinningEnabled={false}`, no upload target) fed by a new `vendor-normalize.ts` that reshapes the vendor RPCs' existing output — no new vendor-side query, no vendor-auth change. `VendorEventDocumentFolder`, its sole consumer before this, is deleted (confirmed zero remaining references). `VendorEventSharePanel` — the vendor's compose/share action, a producer capability — stays, unmodified, next to the read view, same pattern as Templates/Sent-Requested below.

**A capability that would have silently regressed if left out:** the old per-entity Documents tabs could all upload a file; nothing in Steps 2–11's fixed lists mentions "Upload." Rather than read that as "cut it," `WorkspaceUploadButton` reuses the exact same storage bucket/path/`saveDocumentAction` the old tab used, wired into `DocumentWorkspace` via an optional `uploadTarget` prop (Global has none, matching its prior behavior). Not scope creep — the alternative was a real, user-visible regression.

---

## 2. What stayed, deliberately unmodified

`booking-documents-tab.tsx`'s **Templates** (send-a-contract / send-a-questionnaire) and **Sent/Requested** (status + resend) sections — these are producer *creation/workflow* UI, not document *browsing*; folding them into the Workspace would be exactly the "producer integration" Step 13 forbids. Same reasoning kept `VendorEventSharePanel` (compose-only) in place beside the vendor event view. Contracts, Invoices, and the Document Domain backend were not opened for editing at any point — confirmed by `git diff` scope below.

---

## 3. A real, load-bearing scope decision — Client Workspace (couple portal)

**Not wired in this pass, stated plainly rather than silently skipped.** `components/portal/couple-documents-section.tsx` isn't a plain list: inline contract review + sign CTA, invoice line-item breakdown + "go to Payments" CTA, and a **Receipts** section derived on the fly from paid payment line items (a document-shaped concept with no backing document row at all — found during Step 1, not part of the original ask). Its data source, `get_couple_documents()`, is itself already a real, working, couple-scoped union — the closest prior art to this whole Workspace.

Forcing this into the same generic `WorkspaceDocumentCard`/Preview in the same pass as everything else risked exactly the kind of false consolidation this whole multi-phase engagement has repeatedly and correctly declined (Celebration Card, Collection Card, in the Dashboard Component System phases) — here with real, customer-facing stakes (sign flow, balance-due CTA) and no way to verify a rebuild live in this session. The couple's document experience today already satisfies Steps 1–5's *intent* (one aggregated view, real content, real actions); it just doesn't yet render through the shared card. Recommended as a focused, single-purpose follow-up — extend the Preview panel's Actions section to carry a type-specific primary CTA (Sign / Go to Payments) so `ContractCard`/`InvoiceCard`/`ReceiptRow` can retire without losing what they do — not attempted here.

Also intentionally left alone: `app/vendor/documents/page.tsx` (the vendor's own reusable file *library*, as opposed to the read-only per-event folder above) — `VendorLibrarySection` combines browsing with real upload/delete CRUD in one 176-line component; the per-event folder it was compared against had no such write surface, making it the safe half to swap. Replacing the library page would mean partially rewriting vendor-side storage/CRUD code with no way to exercise a vendor session locally to verify it — the same reasoning as the Client Workspace, applied narrowly.

---

## 4. Honest gaps, not hidden

- **Search** covers title/relationship/event/category/status/owner (Step 7's list minus **tags** — `get_venue_documents()` doesn't currently surface the generic `documents.tags[]` array; a real, small gap, not a silent drop).
- **Filter**'s Locked/Archived options are present (Step 8 says "exactly these," not "only the ones with data") but structurally always empty — no producer in this app has a locked or archived state yet. Not faked, not hidden.
- **Version History** is honestly thin everywhere (§1) until a producer actually integrates with the Document Domain's real version chain — this phase didn't build a version chain, it built the one place it will render when one exists.
- **Wedding Website / Communication / Exports** categories exist in the fixed 12 (Step 2, Section 3) but have nothing to hold yet (Step 1 finding) — they render as empty category pills (0), not removed.

---

## 5. Remaining duplicate document surfaces (not touched by this phase)

| Surface | Why it's still separate |
|---|---|
| `components/portal/couple-documents-section.tsx` | §3 — deliberate deferral, real couple-facing risk |
| `app/vendor/documents/page.tsx` (`VendorLibrarySection`) | §3 — combines browse + write CRUD, no safe way to verify a vendor-side rewrite locally |
| Contracts' own list/search (`/contracts`), Invoices' own list/search+print (`/invoices`) | Explicitly forbidden to touch — "Do not migrate Contracts/Invoices" |

---

## 6. Blockers before producer integration (the next phase's starting point)

1. Give `get_venue_documents()` (or the Client Workspace's own future extension) a real `tags` field.
2. Decide how a signed contract's PDF/Representation gets attached — today contracts have no `fileUrl` at all (content is stored as text, confirmed in Step 1); Download is correctly disabled for contracts in the Preview panel (`computeVenuePermissions`), not broken.
3. The Client Workspace Preview-panel-CTA extension named in §3.
4. A real multi-version chain is Document Domain producer-integration work — out of this phase by design (Step 13).

---

## 7. Validation evidence

- **Typecheck:** `npx tsc --noEmit -p .` — clean; identical to this session's own pre-existing baseline (4 unrelated errors: one legal-document test fixture, three `.mts` smoke-script import-extension warnings — present before this phase, untouched by it).
- **Migration:** applied to the local Supabase instance after a `BEGIN…ROLLBACK` dry run against real dev data caught one real bug before it shipped — `vendors.name` doesn't exist; the live column is `business_name` (the CREATE TABLE migration's original column was renamed later and never re-checked) — fixed and re-verified before applying for real.
- **Dead code removed, not left orphaned:** `components/documents/{documents-section,document-card,document-preview-modal,document-category-badge}.tsx` and `components/vendor-app/vendor-event-document-folder.tsx` — each confirmed to have zero remaining importers by repo-wide grep before deletion.
- **No live authenticated UI walkthrough** — a second session was actively exercising this same local dev server throughout (visible in its shared log), so a login-flow verification wasn't attempted to avoid colliding with it; the same limitation named honestly in every prior phase of this engagement that lacked a scriptable login flow.

---

## 8. Pass / Fail

| Requirement | Status |
|---|---|
| One Document Workspace, one Card, one Preview, one Version History, one Search, one Filter model, one Navigation model | **Pass** for Global + Relationship Workspace + the vendor per-event view (3 of 4 named entry points, all through the identical component) |
| No producer migrations, no Contract/Invoice integration, no schema change to canonical/producer tables, no lifecycle redesign | **Pass** — only additive, workspace-scoped tables (`document_workspace_pins`/`interactions`) were added; nothing existing was altered |
| Stop after the Document Workspace is complete | Followed — no producer integration attempted; Client Workspace and the vendor library page named as explicit, reasoned follow-ups, not silently finished |
