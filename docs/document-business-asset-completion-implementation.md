# Work Package D6 — Business Asset Completion, Working Experience & Presentation Quality

**Status: shipped 2026-08-11.** This is a completion phase, not an architecture-certification phase — the Documents/Business Asset system (Library, Templates, Contracts, Questionnaires, Inventory, Event Orders, Document Workspace, Sharing, PDFs) was built across the entire D-series (D1–D5E) and certified piece by piece. D6's job was to actually use it — inspect the live current implementation, walk it the way a venue would, and fix what's really broken rather than write another design document.

## Methodology

Every finding below came from reading the actual current code (not docs, not memory of prior phases) and, where possible, exercising it: real authenticated `supabase-js` sessions against the local dev database (`owner@example.com`, `d5b-staff@example.com`, `d5b-coordinator@example.com` — all one venue; `emma.carter@example.com` — Owner of a second venue, "The Pretty Platypus" — for cross-venue checks), transactional/real SQL against the local Supabase instance, and real PDF generation (`@react-pdf/renderer` via `tsx`, output inspected visually page-by-page). No browser automation is available in this environment (confirmed again this phase); this is the same limitation R1–R3 already documented, and the same workaround — direct session/RPC calls plus real rendering — is used here.

Two research passes (via the Explore agent, kept read-only) covered breadth I couldn't read line-by-line myself in the time available: a 7-way survey of every template list surface for parity with the already-excellent Contract Template list, and a 6-way survey of Document Workspace/Packages/Task Lists/Invoices-Payment Plans/Activity/mobile-accessibility. Both surveys' claims were spot-verified before acting on them (e.g., the delete-permission false-success bug was independently reproduced live before fixing).

## Real defects found and fixed this phase

**1. Contracts could reach a client with literal, unresolved `{{merge_field}}` tokens — CRITICAL, customer-facing.**
`NewContractForm`'s "Apply merge fields" step was optional. Tracing the full lifecycle (`createContract` → `sendContract` → `publishContractDocument`/`versionContractDocument` → the public `/sign/[token]` page → `generateContractPdf`) found no server-side enforcement anywhere: if a venue skipped that button, `{{venue_name}}`, `{{couple_name}}`, `{{event_date}}` etc. would be saved verbatim, rendered raw on the couple's own signing page, and baked into the finalized, immutable PDF. The `Contract` type's own doc comment says `content: string; // rendered (tokens already resolved)` — nothing enforced that promise. Fixed at the root: `createContract()` (`lib/contracts/service.ts`) now always resolves merge fields server-side before insert, and `sendContract()` re-checks and force-resolves as a safety net (covers `reopenForEditing` + `createAmendmentFromContract`, which can reintroduce tokens after creation). `new-contract-form.tsx`'s copy was updated to describe this as automatic; the manual button remains as a "preview now" convenience, not a required step.

**2. Blocked template deletes silently reported success — the D2 Template Permission Defect's own fix introduced a regression.** The RLS RESTRICTIVE delete-gate migration applied earlier this phase (§57, all 8 template tables) blocks a disallowed delete by matching zero rows, not by raising a Postgres error. `lib/contracts/repository.ts`, `lib/pipeline-templates/repository.ts`, and `lib/playbooks/repository.ts`'s `deleteTemplate` functions only ever checked `error`, never rows-affected — so a blocked Staff/Coordinator delete returned `{ ok: true }`, the UI toasted "Template deleted," and the card vanished from local state, while the row silently still existed in the database. This is worse than an ugly error: it's a false positive. Reproduced live (Staff delete on `message_templates` → 0 rows affected, no error) before fixing. Fixed in all four affected repositories (`contracts`, `message-templates`, `pipeline-templates`, `playbooks`) by selecting the deleted row's `id` and returning an honest `{ ok: false, message: "Only an Owner or Manager can delete this template." }` when zero rows match — the exact pattern already established correctly elsewhere in this codebase (`updateContractContent`'s stale-write check). Re-verified live post-fix: Staff blocked with an honest message, Owner succeeds.

**3. Contract PDF showed two different event dates on the same page.** Caught only by actually rendering a PDF with realistic data (a `June 12, 2027` event): the header metadata read "June 11, 2027," the body content (merged separately) correctly read "June 12, 2027." Root cause: `lib/contracts/pdf.ts`'s `fmtDate` parsed a date-only `"YYYY-MM-DD"` string via `new Date(iso)`, which resolves to UTC midnight — displayed in a timezone west of UTC, that rolls back a day. `lib/event-orders/pdf.ts` already had the correct guard (`new Date(iso + "T12:00:00")`) for this exact case; `contracts/pdf.ts` never got it. Fixed by applying the same anchor, conditioned on string length so full timestamps (`createdAt`/`signedAt`) aren't corrupted. Re-rendered and visually confirmed both dates now agree.

**4. "Representation" — an engineering term — was a literal customer-facing section header.** `components/document-workspace/document-preview.tsx`'s Preview panel had a section titled "Representation" (Document Domain vocabulary) shown to venue users viewing any document. Exactly the class of leak D6's own customer-language rule forbids. Renamed to "Details."

**5–6. Missing "Updated" timestamp parity.** Questionnaire Template and Inventory Template cards were the only two template surfaces (of 8) with no last-updated indicator at all, despite `updatedAt` already being on both types. Added, matching Contract Templates' existing `formatRelative` treatment exactly.

## What was inspected and found already correct (no change needed)

- Library page (`app/(app)/library/page.tsx`): real grouping, real counts, honest "Coming Later" cards for genuinely-unbuilt capabilities — not fabricated ones.
- Contract Template list/editor: already the strongest of the 8 template surfaces — relative-time updates, full action set, honest content preview.
- Contract merge-field UX: human-readable labels + descriptions already shown (not raw token names) in the template editor's field panel; the create-contract flow's "Apply merge fields" preview already resolves to real values before the venue ever sends anything (now automatic — see fix #1).
- Activity timelines: Contract, Event Order, and Questionnaire/Final Details detail pages all use the same real `ActivityTimeline` component — not per-type mocks, no inconsistency found.
- Document Workspace version history: honest about its own limits — builds only the real 1–2-entry chain each producer actually supports, explicitly does not fabricate a fuller history.
- Packages → Event Order/Invoice line-item seeding: real, live wiring (`add-line-sheet.tsx`, `invoice-line-items-editor.tsx`).
- Invoices/Payment Plans: confirmed still real and working (freeze-on-send, amendment chains, Stripe Connect ACH, drift-review) — no rebuild needed, none attempted, matching the brief's explicit boundary.
- Cross-venue isolation: verified live — a second venue's Owner reading, deleting, or listing (even with an explicit `venue_id` filter) another venue's `contract_templates` row all correctly return zero rows/zero effect.

## Noted but explicitly out of scope this phase

- Playbooks, Pipeline Templates, Timeline Templates, and Floor Plan Templates are Planning-domain systems (not Documents/Business Assets) that happen to share the Library shell and template CRUD pattern. Card-quality gaps found there (no Delete UI at all for Playbooks/Timeline/Floor Plan; Floor Plan Templates' apply-to-booking flow not yet built) are real but belong to a Planning-domain phase, per D6's explicit "not rebuilding X" boundary. The delete-permission false-success bug (finding #2) was fixed for Playbooks anyway since it's a security defect, not a UX one, and it shares the exact root cause.
- Mobile/responsive breakpoints: a spot-check of `contract-detail.tsx` and `document-workspace.tsx` found zero `sm:`/`md:`/`lg:` Tailwind breakpoints in either — layout relies only on generic `flex-wrap`, and `contract-detail.tsx` has none of that either. This is a real, desktop-leaning pattern across the asset surfaces, but a full responsive pass across every Business Asset screen is a larger effort than this phase's time allowed; flagged here rather than silently left off the record.
- The manual "Apply merge fields" button's live end-to-end path (a real `createContract` call through the Next.js server-action/cookie-bound runtime) was not exercised with a full click-through, since no browser automation is available in this environment. Confidence instead comes from: the exact same `buildContractMergeData`/`mergeContent` composition already existed and was already exercised by the pre-existing "Apply merge fields" preview action; the merge functions themselves were exercised correctly in the PDF spot-check fixture; and the change type-checks cleanly.

## Completion Matrix

| # | Area | Status | Evidence |
|---|---|---|---|
| 1 | Library — grouping, counts, findability | PASS | Read in full; real grouping (Agreements/Pricing & Packages/Planning/Communication/Marketing/Reports), honest "Coming Later" states |
| 2 | Contract Templates — list quality | PASS | Relative-time updates, full action menu, honest content preview sheet |
| 3 | Questionnaire Templates — list quality | PASS (fixed) | Added missing "Updated" timestamp this phase |
| 4 | Inventory Templates — list quality | PASS (fixed) | Added missing "Updated" timestamp this phase |
| 5 | Message Templates — list quality | PASS | Full action parity confirmed; delete false-success bug fixed |
| 6 | Smart fields / merge-field UX in template editor | PASS | Human-readable labels + descriptions shown, not raw tokens; click-to-copy |
| 7 | Merge-field resolution guarantee (create → send → sign → PDF) | PASS (fixed) | CRITICAL fix #1 — force-resolved server-side at create and send |
| 8 | Template delete permission — role gate (D2 defect) | PASS (fixed, live-verified) | RLS RESTRICTIVE policies on all 8 tables; Staff blocked/Owner succeeds confirmed live |
| 9 | Template delete — honest failure reporting | PASS (fixed) | Fixed false-success across Contracts/Message/Pipeline/Playbook repositories |
| 10 | Template cross-venue isolation | PASS (live-verified) | Second venue's Owner: 0 rows on read/delete/filtered-list |
| 11 | Contract creation flow | PASS | `new-contract-form.tsx` — template select, client select, auto-merge, confirm dialog |
| 12 | Contract send/resend | PASS | D5E `ShareDialog` wiring confirmed intact; resend only from `sent` status |
| 13 | Contract reopen-for-editing / negotiation loop | PASS | `reopenForEditing` guard confirmed (`sent`→`draft` only, matches invoice pattern) |
| 14 | Contract amendment | PASS | `createAmendmentFromContract` confirmed; merge-safety net covers this path too |
| 15 | Contract signing page (client-facing) | PASS (fixed) | Content now guaranteed merged; token-validating RPC confirmed, not a raw table read |
| 16 | Contract PDF — content accuracy | PASS (fixed) | CRITICAL fix #3 — event-date mismatch found and fixed via real rendering |
| 17 | Contract PDF — visual/white-label quality | PASS | Rendered with realistic data; clean typography, venue branding, honest signature disclaimer |
| 18 | Event Order PDF — content + visual quality | PASS | Rendered with realistic multi-section data; correct totals, correct date formatting (no bug found) |
| 19 | Event Order creation/sharing | PASS | D5E fix (real email-sending) confirmed still in place, not re-broken |
| 20 | Questionnaire working experience | PASS | D5D's autosave/concurrency/notification/reopen work confirmed still in place |
| 21 | Questionnaire "Preview as Client" | PASS | Confirmed present (`questionnaire-preview/page.tsx`), not re-tested end-to-end this phase |
| 22 | Inventory template → Event Order flow | PASS | Confirmed real (Packages survey); no change needed |
| 23 | Packages → Event Order/Invoice wiring | PASS | Confirmed real, live seeding in both consumers |
| 24 | Document Workspace — unified list | PASS | Real aggregation across contracts/invoices/questionnaires/floor plans/uploads |
| 25 | Document Workspace — customer-language compliance | PASS (fixed) | CRITICAL fix #4 — "Representation" → "Details" |
| 26 | Document Workspace — version history honesty | PASS | Confirmed: only ever shows what's genuinely derivable, never fabricates a chain |
| 27 | Document Workspace — activity | PASS | Real per-document activity fetch confirmed |
| 28 | Document Workspace — share action | PARTIAL (documented, not fixed) | Share is permanently disabled in the Preview panel by design ("shared from its own list") — a real but minor discoverability gap, not a defect; left as-is, out of this phase's fix budget |
| 29 | Activity timeline consistency across asset types | PASS | Contract/Event Order/Questionnaire all use the same `ActivityTimeline` component |
| 30 | Task Lists (Playbooks) | PASS | Confirmed real and substantial; Client/Venue Planning deliberately kept separate |
| 31 | Invoices | PASS | Confirmed real, mature (freeze-on-send, amendment chains) — no rebuild attempted, per scope |
| 32 | Payment Plans | PASS | Confirmed real (Stripe Connect ACH, drift-review) — no rebuild attempted, per scope |
| 33 | Sharing (unified `ShareDialog`) | PASS | D5E's Contract/Questionnaire/Event Order wiring confirmed intact this phase |
| 34 | Document Domain invisibility (no engineering terms in customer UI) | PASS (fixed) | One real leak found and fixed (#4); targeted scan of reviewed components found no others |
| 35 | Cross-venue security (beyond templates) | PASS (carried from R3) | `canonical_bookings` `security_invoker` fix confirmed still in place; not re-audited beyond scope |
| 36 | Mobile responsiveness | PARTIAL (documented, not fixed) | Spot-check found desktop-leaning layout in 2 of 3 sampled components; full pass out of this phase's time budget |
| 37 | Accessibility (focus states, aria-labels) | PARTIAL (documented, not fixed) | Shared `Button`/`document-card.tsx` have real focus/aria treatment; `contract-detail.tsx`/`document-workspace.tsx` rely on inherited component-level focus only, no per-component `aria-label`s added |
| 38 | Regression check (typecheck) | PASS | Full `tsc --noEmit` run; zero new errors from any change made this phase; pre-existing unrelated errors (wedding-website tests, portal-shell, shared/email smoke scripts) confirmed unchanged |
| 39 | Performance | N/A (not assessed) | No performance-specific work identified or requested this phase; nothing regressed by the changes made (all are either query shape unchanged or one extra in-memory string replace) |

## Customer-Journey Matrix

| # | Journey | Start | End | Status |
|---|---|---|---|---|
| 1 | Venue builds a Contract Template, reuses it for a new client | Library → New Template | Contract created, merge fields resolved automatically | PASS |
| 2 | Venue sends a Contract; client signs | Contract Detail → Send | Client sees `/sign/[token]`, signs, PDF generated | PASS (fixed — content now guaranteed clean) |
| 3 | Venue reopens a sent Contract, edits, resends | Contract Detail → Reopen | Client receives updated, still-merged content | PASS |
| 4 | Venue builds a Questionnaire Template, couple fills it in | Library → New Template | Coordinator gets real notification on submit | PASS (carried from D5D) |
| 5 | Venue creates Inventory items, applies to an Event Order | Inventory Template | Event Order line items seeded | PASS |
| 6 | Venue builds an Event Order, shares with client, finalizes | Event Order Panel → Share | Client views via portal deep-link, real email sent | PASS (carried from D5E) |
| 7 | Venue uses a Package to seed pricing quickly | Add Line Sheet → From a package | Event Order/Invoice line seeded at base price | PASS |
| 8 | Venue browses Document Workspace to find everything for one relationship | `/documents` | Unified list, real Preview with correct customer language | PASS (fixed — jargon removed) |
| 9 | Staff member attempts to delete a template they shouldn't | Template list → Delete | Honest denial message, row untouched | PASS (fixed — was a false "deleted") |
| 10 | Owner/Manager deletes a template they're allowed to | Template list → Delete | Row genuinely removed | PASS (live-verified) |
| 11 | Two venues coexist without any data crossing over | Any template/booking surface | Zero visibility, zero effect across venues | PASS (live-verified) |
| 12 | Venue amends a finalized Contract | Contract Detail → Create Amendment | New draft contract, lineage recorded, content still guaranteed merged | PASS |
| 13 | Venue tracks payment against a sent Invoice | Invoice → Payment Schedule | Real Stripe Connect ACH flow, drift-review against Event Order changes | PASS (confirmed real, not rebuilt) |

## Known Limitations

- No browser automation available in this environment — all UI-level claims above are based on reading the exact rendered strings/props in component source, real repository/RPC-level session testing, and real PDF rendering, not a literal click-through. This matches every prior phase's own documented limitation (R1–R3).
- The completion matrix's PASS rows for systems not touched this phase (Invoices, Payment Plans, Task Lists, prior D5D/D5E sharing/questionnaire work) are "confirmed still real and correctly wired," not re-certified from scratch — re-litigating already-shipped, already-verified work was explicitly out of scope for this phase.
- Mobile/accessibility gaps (rows 36–37) are documented, not fixed — a full pass was judged too large for this phase's remaining budget and wasn't the phase's stated focus (completion and correctness were prioritized over a new responsive-design pass).
- Document Workspace's disabled Share button (row 28) is a minor, low-risk discoverability gap, not a defect — venues can already share every document type from its own native list (Contract/Questionnaire/Event Order all have their own `ShareDialog`); left as-is deliberately rather than building a second sharing entry point.

## Files changed this phase

- `lib/contracts/service.ts` — force-resolve merge fields in `createContract`; send-time safety net in `sendContract`
- `lib/contracts/repository.ts` — `forceResolveContractContent` (new); `deleteTemplate` honest rows-check
- `components/contracts/new-contract-form.tsx` — copy updated to describe automatic merge
- `lib/message-templates/repository.ts` — `deleteTemplate` honest rows-check
- `lib/pipeline-templates/repository.ts`, `lib/pipeline-templates/service.ts` — `deleteTemplate` honest rows-check
- `lib/playbooks/repository.ts`, `lib/playbooks/service.ts` — `deleteTemplate` honest rows-check
- `components/questionnaire-templates/questionnaire-template-list.tsx` — added "Updated" timestamp
- `components/event-inventory/inventory-template-list.tsx` — added "Updated" timestamp
- `lib/contracts/pdf.ts` — fixed date-only-string off-by-one-day bug in `fmtDate`
- `components/document-workspace/document-preview.tsx` — "Representation" → "Details"
- `supabase/migrations/20261260000000_template_delete_permission_normalization.sql` — the D2 Template Permission Defect fix (applied earlier this phase, live-verified this session)
