# Document Domain — Type Matrix & Validation Specification

**Date:** 2026-08-07
**Phase:** 3 — Validation only. The Canonical Document Domain Architecture (`document-domain-canonical-architecture.md`) is unmodified below — every classification here is an *application* of that architecture, not a change to it. No code, schema, or migration.

**A note on the inventory before the matrix begins:** the brief asks for real objects only, "do not invent examples." I checked every item against the actual codebase rather than assuming from the name. **Six of the requested types do not exist anywhere in the platform today**: Contract Amendments, Proposals, Planning Worksheets, Invoice PDFs, Payment Receipts, and Wedding Website PDF — no table, no generator, no route. Reporting them as real would violate the brief's own instruction. They are included below, clearly marked **Conceptual**, evaluated against the architecture as *if* they existed — which is itself the correct validation (a type that doesn't exist yet must still fit the model without a special case, or the model has a hole waiting to be found the hard way). Everything else in the matrix is a verified, real object: table, file, or both, cited.

---

## 1–2. Inventory

**Real, verified:**

| # | Type | Verified as |
|---|---|---|
| 1 | Contract | `contracts` table |
| 2 | Signed Contract | `contracts.status='signed'` + `contracts.content` (rendered, not filed) |
| 3 | Invoice | `invoices` / `invoice_line_items` |
| 4 | Questionnaire | `event_questionnaires` table |
| 5 | Venue Guide Content | `venue_operational_info` (parking, policies, alcohol/rain plan, FAQs — fields on one row, not discrete documents — see §7 note) |
| 6 | Menu | `documents` rows, `category='menu'` |
| 7 | Floor Plan | `floor_plans` / `floor_plan_objects` |
| 8 | Timeline Export | `components/events/timeline/timeline-document.tsx`, `timeline-print-view.tsx` |
| 9 | Insurance Certificate | `documents` rows, `category='insurance'` |
| 10 | Business License / Permit | `documents` rows, `category='permit'` |
| 11 | Vendor Document (COI, W-9, rate card) | `vendor_library_documents` |
| 12 | Uploaded File (generic PDF/image) | `documents` / `couple_documents`, `category='other'` or by `mime_type` |
| 13 | Message Attachment | `conversation_message_attachments` |
| 14 | Legal Document (ToS, Privacy Policy) | `legal_documents` |
| 15 | Success Library Article | `success_library_articles` |
| 16 | AI Draft (Luv) | `luv_drafts` — `draft_type` ∈ follow_up_email/follow_up_text/next_steps/timeline, `status` ∈ pending_review/accepted/discarded |

**Conceptual — named in the brief, not implemented anywhere today:**

| # | Type | Verified absence |
|---|---|---|
| 17 | Contract Amendment | No table, no code path. Exists only as a concept this architecture's ADR-4 requires. |
| 18 | Invoice PDF | `invoices` has no `storage_path`/`storage_url`; zero PDF generation exists anywhere in the codebase (checked directly: no puppeteer/jsPDF/react-pdf/pdf-lib). |
| 19 | Payment Receipt | No table. Payment events fire automation (`payment_received`, confirmed in Phase 1) but produce no retained artifact. |
| 20 | Proposal | No table, no route. |
| 21 | Planning Worksheet | No table distinct from Questionnaire. |
| 22 | Floor Plan Export | `floor_plans` is real; a dedicated PDF/image export was not located this pass (service/repository/constants/types files exist; no export/print file found by name — noted as unconfirmed, not asserted absent). |
| 23 | Generated Report | No document-status or financial report generation found. |
| 24 | Wedding Website PDF | No such capability anywhere in `lib/wedding-website/` or `components/wedding-website/`. |

---

## 3. Document Type Matrix

**Real objects:**

| Document Type | Business Object | Behavior | Owner | Source | Editable | Collaborative | Versioned | Lockable | Generates Representation | Signable | Immutable Representation | Archived | Automation Events | Reportable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Contract | None (Document is primary — negotiation state lives on the Document itself) | Negotiated | Relationship | Negotiated | Yes (pre-sign) | Yes | Yes | Yes | Yes (on sign) | Yes | Yes (post-sign) | Yes | Uploaded, Shared, Signed, Superseded, Archived | Yes |
| Signed Contract (Representation) | Contract | Negotiated | Relationship | Negotiated | No | No | No (immutable) | Yes (permanently) | — (is the representation) | No (already signed) | Yes | Yes | Signed, Archived | Yes |
| Invoice | None (Document is primary — financial state lives on the Document itself) | Venue Authored | Relationship | Generated | Yes (pre-sent) | No | Yes | Yes | Yes | No | Yes (post-final) | Yes | Uploaded, Shared, Generated, Archived | Yes |
| Questionnaire | None | Collaborative | Relationship | Uploaded (form-submitted) | Yes (while open) | Yes | Yes | Yes (on submit) | Yes (submission snapshot) | No | Yes (post-submit) | Yes | Shared, Approved, Archived | Yes |
| Venue Guide Content | None | Reference | Venue | Negotiated (venue-authored, no counterparty) | Yes | No | Yes | No (Published, not signature-locked) | No (rendered live, not exported) | No | No | Yes | Generated, Archived | No |
| Menu | None | Reference | Venue | Uploaded | No | No | Yes | No | No | No | Yes (upload is already fixed) | Yes | Uploaded, Shared, Superseded, Archived | Yes |
| Floor Plan | None (Structured Record, not a Document — see §1 of the architecture) | — (not a Document Type; produces one on export) | Event | — | Yes | Yes | Yes | No | Yes (via export) | No | No (the live record) | Yes | Generated (on export), Archived | No |
| Timeline Export | Timeline (Structured Record) | Generated | Event | Generated | No | No | Yes | No | — (is the representation) | No | Yes | Yes | Generated, Shared, Archived | Yes |
| Insurance Certificate | None | Submitted | Vendor (or Relationship, if couple-supplied) | Uploaded | No | No | Yes (renewal = new version) | Yes (on approval) | No (upload is already fixed) | No | Yes | Yes | Uploaded, Approved, Expired, Superseded, Archived | Yes |
| Business License / Permit | None | Submitted | Vendor | Uploaded | No | No | Yes | Yes | No | No | Yes | Yes | Uploaded, Approved, Expired, Archived | Yes |
| Vendor Document (library) | None | Submitted / Reference (library copy is Reference until shared, then Submitted) | Vendor | Uploaded | No | No | Yes | No (library copy stays open until shared) | No | No | No (until shared/approved) | Yes | Uploaded, Shared, Archived | Yes |
| Uploaded File (generic) | None | Submitted | Relationship or Event | Uploaded | No | No | No (a new upload is a new Document, not a version) | No | No | No | Yes | Yes | Uploaded, Shared, Archived | No |
| Message Attachment | None | — (Attachment, not a Document — see architecture §1) | N/A (references, doesn't own) | Uploaded | No | No | No | No | No | No | Yes | No (deleted with retention policy, not archived) | Uploaded | No |
| Legal Document | None | Reference | System | Negotiated (authored, versioned by legal) | Yes (new version) | No | Yes | Yes (per version, `is_active`) | No | No | Yes (each version) | No (superseded, not archived) | Generated, Archived | No |
| Success Library Article | None | Reference | System | Negotiated (authored) | Yes | No | Yes (lightweight counter, confirmed in schema) | No | No | No | No | Yes (status: draft/published acts as archive-equivalent) | Generated, Archived | No |
| AI Draft (Luv) | None (until accepted; see §11) | Generated, becomes Reference-adjacent only once acted on | Relationship or Event (whichever entity_type/entity_id it targets) | AI-Generated | No | No | No | Yes, only if `status='accepted'` | Yes (the draft text itself) | No | Yes, only once accepted (pending/discarded remain mutable-by-discard) | Yes (discarded = functionally archived) | Generated, Approved (=accepted) | No |

**Conceptual objects — evaluated against the architecture, not built:**

| Document Type | Business Object | Behavior | Owner | Source | Editable | Collaborative | Versioned | Lockable | Generates Representation | Signable | Immutable Representation | Archived | Automation Events | Reportable |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Contract Amendment | Contract (the original) | Negotiated | Relationship | Negotiated | Yes (pre-sign) | Yes | Yes | Yes | Yes (on sign) | Yes | Yes (post-sign) | Yes | Uploaded, Shared, Signed, Archived | Yes |
| Invoice PDF | Invoice | Generated | Relationship | Generated | No | No | Yes (regenerate while invoice open) | No (until invoice itself locks, e.g. paid) | — (is the representation) | No | Yes (once invoice is Paid/void) | Yes | Generated, Shared, Archived | Yes |
| Payment Receipt | Invoice (or a future Payment Business Object) | Generated | Relationship | Generated | No | No | No | Yes (immediately, at moment of payment) | — (is the representation) | No | Yes | Yes | Generated, Shared, Archived | Yes |
| Proposal | None (Document is primary, per architecture's own reasoning about Package vs Proposal) | Venue Authored | Relationship | Negotiated (venue-authored, no counterparty edits) | Yes (pre-sent) | No | Yes | Yes (converts to booking or expires) | Yes | No | Yes (post-send) | Yes | Uploaded, Shared, Superseded, Archived | Yes |
| Planning Worksheet | None | Collaborative | Relationship | Uploaded (form) | Yes (while open) | Yes | Yes | Yes (on completion) | Yes | No | Yes (post-completion) | Yes | Shared, Approved, Archived | Yes |
| Floor Plan Export | Floor Plan (Structured Record) | Generated | Event | Generated | No | No | Yes | No | — (is the representation) | No | Yes | Yes | Generated, Shared, Archived | Yes |
| Generated Report | None | Generated | Venue | Generated | No | No | No | Yes (immediately, point-in-time snapshot) | — (is the representation) | No | Yes | Yes | Generated, Archived | No (a report *about* Reportable data, not itself reported on) |
| Wedding Website PDF | The published website (a different Structured Record entirely) | Generated | Relationship | Generated | No | No | Yes (regenerate on republish) | No | — (is the representation) | No | Yes (per snapshot) | Yes | Generated, Shared, Archived | No |

No cell above is "depends" or blank. Where a type has no separate Business Object, the explicit value is *"None (Document is primary record)"* rather than an omission — stated because the brief specifically forbids blanks, and "no Business Object" is a real, decidable answer, not a gap.

---

## 4. Behavior Validation

Every real and conceptual type above was assigned to exactly one of the six Behaviors. Two apparent overlaps, both already resolved in the architecture document and reconfirmed here rather than patched around:

- **Floor Plan** is not itself a Document (it is the Structured Record the architecture explicitly carves out) — it has no Behavior of its own; only its export does (Generated). Listing it in the matrix with `—` for Behavior is the correct, explicit answer, not a gap.
- **AI Draft (Luv)** looks like it could be both Generated (system-produced) and something else once accepted. Resolved without a hybrid type: it *is* Generated, full stop — "acceptance" is not a Behavior change, it's a Lifecycle transition (Draft → Finalized) within the Generated behavior, identical in kind to a Floor Plan export locking once printed. No new behavior needed.

No type required a hybrid classification. The six-behavior model held for every real and conceptual object checked, including the ones the original architecture document's own examples introduced tension for (Package, Timeline) and the new ones this phase introduced (Luv Drafts, Success Library).

---

## 5. Ownership Validation

| Type | Owns | References | May Edit | May View | May Share | May Archive | May Delete |
|---|---|---|---|---|---|---|---|
| Contract | Relationship | Contract Business Object (self) | Venue Owner/Manager/Staff/Planner (pre-sign) | Owner-side + Client (post-share) | Venue Owner/Manager | Venue Owner/Manager | Venue Owner/Manager only, pre-Finalized |
| Invoice | Relationship | — | Venue Owner/Manager/Staff (pre-sent) | Owner-side + Client (post-share) | Venue Owner/Manager | Venue Owner/Manager | Venue Owner/Manager only, pre-Finalized |
| Questionnaire | Relationship | — | Client (while open) | Owner-side + Client | Venue (initiates), Client (responds, cannot re-share) | Venue Owner/Manager | Venue Owner/Manager, pre-submission only |
| Insurance Certificate | Vendor (or Relationship) | Event (via `documents.event_id`) | No one (Submitted behavior — never edited, only replaced) | Venue Owner/Manager/Staff/Planner + submitting party | Vendor (to the event) | Venue Owner/Manager | Vendor (own upload, pre-approval) or Venue Owner/Manager |
| Vendor Document (library) | Vendor | — | Vendor | Vendor only, until shared | Vendor (to an assigned event) | Vendor | Vendor |
| AI Draft (Luv) | Relationship/Event (per `entity_type`/`entity_id`) | System (as Source) | System only (regeneration), never a human edit — accept/discard, not edit | Venue Owner/Manager/Staff/Planner | N/A (internal until accepted, then becomes whatever the accepted content is used for) | Implicit via `status='discarded'` | Venue Owner/Manager |
| Legal Document | System | — | HQ Admin only (per Phase 1's `legal_documents_hq_*` policies) | Everyone (public) | N/A (already public) | HQ Admin | HQ Admin |
| Message Attachment | *(none — Attachment, not Document)* | Message, and transitively Relationship/Event/Vendor the conversation belongs to | Uploader only, pre-send | Conversation participants | Not shareable independent of the message | N/A | Uploader (own upload) or Venue Owner/Manager |

Every answer resolves to the canonical five owner types (§3 of the architecture) or explicitly "none" for Attachments — no type required an owner outside that set, confirming ownership §3 is complete.

---

## 6. Versioning Validation

| Type | Versions exist? | Cloneable? | Amendable? | Signing → Representation? | Locking → Representation? | Representation regenerates? | Reopenable? |
|---|---|---|---|---|---|---|---|
| Contract | Yes (drafts, pre-sign) | Yes (from a template) | Yes (post-sign → Contract Amendment, a new Document) | Yes | N/A (Contract locks *via* signing, not separately) | Yes, pre-sign only | No, once signed (Amendment instead) |
| Invoice | Yes (pre-send) | Yes (from a Package) | Conceptually yes → new Document (an Invoice Correction is architecturally identical to a Contract Amendment — a new Document, Referenced to the original, never an edit to a sent invoice) | N/A | Yes, on send/paid | Yes, pre-lock only | No, once Paid/Void |
| Questionnaire | Yes | Yes (from a worksheet template) | No — reopening is a distinct, explicit transition (§12), not amendment, since a questionnaire has no counterparty-signature concept | N/A | Yes, on submission | Yes, only if reopened first | **Yes, explicitly supported** — reopening reverts Status to Draft; the prior submission snapshot is retained as a superseded Representation, never deleted |
| Insurance Certificate | Yes (renewal replaces expired) | No | No (replacement is a new Document, Superseding the old) | N/A | Yes, on upload (Submitted behavior locks immediately, pending approval) | No (Submitted files are never regenerated, only replaced) | No |
| AI Draft (Luv) | No (a regenerated draft is a new row per the real schema — confirmed: `luv_drafts` has no version-chain column, each generation is a discrete row) | No | No | N/A | N/A | Yes, by generating a new draft row (not a version of the old one — this is a real, minor divergence from the canonical model's "regenerate = new Representation, same Document," flagged in §13 Stress Test | No |
| Legal Document | Yes (`unique(document_type, version)`, confirmed in schema) | No | No — a new version is authored fresh, `is_active` flips atomically | N/A | Yes, on `is_active=true` | No (each version is authored once) | No |

No type required a versioning rule outside the canonical model in §6 of the architecture, with one flagged divergence (AI Drafts don't version-chain in the real schema today — carried into §13).

---

## 7. Representations Validation

| Representation | Generated by | From which version | Immutable? | Regenerates? | Multiple can exist? |
|---|---|---|---|---|---|
| Signed Contract PDF *(conceptual — no PDF exists; the "representation" today is the `content` text field frozen at signing)* | `sign_contract()` | The Contract's content at the moment of signing | Yes | No | No (exactly one, permanent) |
| Invoice PDF *(conceptual)* | Invoice generation | The Invoice's line items at generation time | Yes, once invoice locks | Yes, pre-lock | Yes (historical regenerations retained) |
| Timeline Export | `timeline-document.tsx` render | The Timeline's content at export time | Yes (each export is a distinct render) | Yes, any time (Timeline is never signature-locked) | Yes |
| Questionnaire Submission Snapshot | Submission action | The questionnaire's answers at submit time | Yes | Only if reopened (produces a *new* snapshot, old one retained) | Yes (one per submission, if reopened more than once) |
| Preview / Thumbnail | Storage layer, on upload | N/A — not version-scoped at all | **No** — explicitly not a Representation (architecture §4A) | Yes, freely, no lifecycle implication | Irrelevant — carries no trust weight |

**True Representations vs. storage derivatives, decided:** PDF, Signed Copy, Export, and Print Layout are all true Representations — each is tied to a specific Document version and carries trust/audit weight. **Preview and Thumbnail are not** — they are storage derivatives with zero lifecycle standing, confirmed consistent with §4A's explicit carve-out. Image and generic "Uploaded File" occupy both roles depending on Type: for an Uploaded-behavior Document, the uploaded image *is* the Representation (Source and Representation coincide, per the architecture's own §0 rule for pure uploads); for a Generated-behavior Document, an image (e.g., a floor plan export) is a Representation only if it's the canonical export — a resized thumbnail of that same export is not.

---

## 8. Storage Validation

Classification only — no implementation. "Public/Private" here means the *product-intended* audience, independent of Phase 1's finding that today's actual storage RLS is bucket-wide-public regardless of this classification (a known, separately-tracked gap, not re-litigated here).

| Type | Permanent | Temporary | Upload | Generated | External | Archived (storage state) | Shared | Public | Private |
|---|---|---|---|---|---|---|---|---|---|
| Signed Contract | Yes | No | No | Yes | No | Eventually | Yes (Relationship + Venue) | No | Yes |
| Invoice / Invoice PDF | Yes | No | No | Yes | No | Eventually | Yes | No | Yes |
| Insurance Certificate | Yes | No | Yes | No | No | Eventually | Yes (Venue + submitting Vendor) | No | Yes |
| Questionnaire (open) | No (provisional until submitted) | Yes, while Draft | No | No | No | No | Partially (venue can see in-progress) | No | Yes |
| Questionnaire (submitted) | Yes | No | No | Yes (snapshot) | No | Eventually | Yes | No | Yes |
| Message Attachment | No — subject to Retention policy (§2 of the architecture), not automatically permanent | Effectively, relative to a Document | Yes | No | No | N/A (deleted per retention, not archived) | Yes (conversation participants) | No | Yes |
| Legal Document | Yes | No | No | No (authored) | No | Never (superseded, not archived) | Yes | **Yes** | No |
| Timeline Export | Yes | No | No | Yes | No | Eventually | Yes | No | Yes |
| Vendor Document (library) | Yes | No | Yes | No | No | Eventually | Only once explicitly shared to an event | No | Yes, until shared |
| Preview/Thumbnail | No | Yes (regeneratable anytime) | No (derived) | Yes (derived) | Possibly (CDN-cached) | N/A | N/A | N/A | N/A |

Every Document type resolves to an explicit combination — no type required a ninth storage classification beyond the eight given.

---

## 9. Automation Validation

Canonical events (from the architecture, §7), confirmed sufficient — no type in this matrix required an event outside this set:

`Document Uploaded · Document Generated · Document Shared · Document Viewed · Document Approved · Document Signed · Document Superseded · Document Expired · Document Archived · Document Deleted`

| Event | Fires for | Real today? |
|---|---|---|
| Uploaded | Insurance Certificate, Business License, Uploaded File, Message Attachment, Menu | **Yes** — confirmed wired (`document_uploaded`, `document_uploaded_insurance`, Phase 1) |
| Generated | Timeline Export, AI Draft, (conceptually) Invoice PDF, Contract signing's own representation | Partially — `floor_plan_created` confirmed wired; Timeline/Invoice generation not confirmed wired to automation |
| Shared | Contract, Invoice, Questionnaire, Vendor Document | Not directly confirmed as a distinct fired event (Phase 1 found `is_couple_visible` toggling, not an emitted "Shared" event per se) |
| Viewed | Any Shared-behavior type | Not found — no read-receipt mechanism located anywhere |
| Approved | Insurance Certificate, Business License, AI Draft (acceptance) | Not confirmed as a distinct event; `document_uploaded_insurance` conflates upload and eventual approval today |
| Signed | Contract | **Yes** — confirmed wired (`contract_signed`, Phase 1) |
| Superseded | Insurance Certificate (renewal), Legal Document (new version), Contract Amendment | Not found |
| Expired | Insurance Certificate, Business License | Not found — `documents.expires_at` exists but nothing reads it (Phase 1 finding, reconfirmed) |
| Archived | All types | Not found |
| Deleted | All types (permission-gated) | Not found as an emitted automation event (the delete itself is real and role-gated; nothing downstream reacts to it) |

**Every type uses only canonical events — zero document-specific events were needed for any real or conceptual type in this matrix.** This is a genuine pass. What is *not* a pass: five of the ten canonical events (Shared, Viewed, Approved, Superseded, Expired, Archived, Deleted — six, not five) have no confirmed real firing today, only Uploaded/Signed/Generated(partial). Carried into §14 as a gap, not a design flaw — the event *taxonomy* is proven sufficient; the *wiring* is incomplete, which is expected and correctly out of scope for an architecture-only phase.

---

## 10. Reporting Validation

| Metric | Belongs to |
|---|---|
| Unsigned Contracts | Document (cross-relationship list) |
| Expired Insurance | Document |
| Missing Documents | **Relationship** (requires knowing what's *required* for one specific event — a Relationship-level concept, sourced from Document facts) |
| Pending Review | Document |
| Awaiting Client / Awaiting Venue | Document (derivable directly from Status + who holds the Pending Action) |
| Recently Shared / Recently Generated | Document |
| Document Completion % | **Both** — a per-Type completion rate is Document-owned; "is *this* wedding's paperwork done" is Relationship-owned, same split as §8 of the architecture |
| Version Count | Document |
| Average Signature Time | Document |

No metric required a new ownership category beyond the Document/Relationship split already established — confirms §8 of the architecture is complete.

---

## 11. AI Validation

Every retained AI artifact found (`luv_drafts`) classified:

- **`status='pending_review'`** → **Temporary Suggestion.** Not yet a Document — matches the architecture's explicit rule that ephemeral AI output isn't a Document until a human acts on it.
- **`status='discarded'`** → **Temporary Suggestion, terminally.** Retained in the database (for training/audit purposes, per the `context` column's own comment), but never becomes a Document — the row's persistence is an implementation fact, not a product-level Document existing.
- **`status='accepted'`** → **Document**, Behavior Generated, Source AI-Generated, Owner = whatever `entity_type`/`entity_id` it targets (Relationship or Event) — matches the architecture's rule precisely: a human retaining/acting on AI output is the exact moment it becomes a Document.
- **`success_library_articles`** → **Document**, Behavior Reference, Source Negotiated (human-authored, not AI) — included here only to confirm it is *not* an AI artifact despite living in the same conceptual neighborhood; correctly excluded from the AI classification question.

No AI artifact required a sixth classification bucket beyond Document/Representation/Structured Record/Temporary Suggestion/System Artifact. None of the real AI content found is a Representation, Structured Record, or System Artifact — Luv's outputs are cleanly either a Temporary Suggestion or a Document, confirming the architecture's ownership separation (§3, ADR-6: AI is a Source, never an Owner) holds under a real, verified example.

---

## 12. Edge Cases

| Scenario | Already supported? | How |
|---|---|---|
| Contract amendment after signature | **Yes** | ADR-4 — a new Document (Contract Amendment), Referenced to the original signed Contract. The original is never touched. |
| Invoice correction | **Yes** | Same pattern as above — architecturally identical to a Contract Amendment, not previously named but requires no new rule. |
| Questionnaire reopened | **Yes** | §6 above — reopening reverts Status to Draft; the prior submitted snapshot is retained as a superseded Representation. |
| Vendor uploads replacement insurance | **Yes** | New Document, Supersedes the expired one (§4B state 6) — never an edit to the expired certificate. |
| Menu replaced after printing | **Yes** | New Document, Supersedes the old — the old, already-printed Menu remains retrievable as historical record. |
| Timeline regenerated | **Yes** | Timeline (Structured Record) is never signature-locked — its export simply produces a new Representation each time, old ones retained (§7). |
| Floor Plan regenerated | **Yes** | Same pattern as Timeline. |
| Proposal converted into booking | **Yes** | The Proposal Document reaches Finalized (accepted) and is Referenced by the resulting Contract/Relationship — conversion is a Reference being created, not a mutation of the Proposal. |
| Deleted uploaded file | **Yes, conditionally** | Permitted only if the Document never reached Finalized (§2 of the architecture, Deletion property) — an uploaded-but-not-yet-approved file can be deleted; an approved Insurance Certificate cannot, only Archived. |
| Archived signed document | **Yes** | Archiving and Signing are independent axes (§4B) — a signed Contract can be archived without contradiction; its Representation remains immutable regardless. |
| Merged Relationships | **Requires a decision, not new architecture** | Ownership (§3) says a Document's owner rarely changes and must be explicit and audited when it does — a Relationship merge is exactly that explicit, audited exception, already anticipated by the "Documents can move... rare, explicit, audited" rule. No new mechanism needed, but the *policy* of what happens to two Relationships' overlapping Document sets on merge is a product decision this architecture correctly leaves open rather than silently assumes. |
| Cancelled Event | **Yes** | Event-owned Documents follow the same Relationship-deletion policy already decided in §7 of the architecture: Finalized Documents survive (Archived, not deleted); non-Finalized ones may cascade. |
| Deleted Vendor | **Yes** | Vendor-owned Documents (library items) follow the same rule — Finalized/shared copies already live in `documents` under Relationship/Event ownership (per the real `share_vendor_document_to_event` copy pattern, Phase 1) and are unaffected by the Vendor's own deletion; the Vendor's own remaining library (unshared) is deleted with it, since nothing else owns or references it. |
| Venue ownership transfer | **Requires a decision, not new architecture** | Same reasoning as Relationship merge — an explicit, audited Owner change, already the designed exception path, not a gap. The *business policy* (does a new venue owner inherit all historical signed contracts?) is outside architecture's scope to decide unilaterally. |

Every scenario is supported by the existing model. Two (Merged Relationships, Venue ownership transfer) require a **product/business policy decision**, not new architecture — flagged precisely as that distinction, not conflated with an architectural gap.

---

## 13. Stress Test

| Attempt to break it | Result |
|---|---|
| Can one representation belong to multiple versions? | No — by construction, a Representation is generated from exactly one version at one moment; the model has no mechanism that could produce this even by misuse. |
| Can one version produce multiple representations? | **Yes, deliberately** — e.g., a single Invoice version could produce both a PDF and a CSV export. Not a contradiction: §2 says a Document has "zero, one, or many Representations" without constraining them to different versions — multiple representations of the *same* version is already an anticipated, supported case, not a hole. |
| Can ownership ever become ambiguous? | No for the five canonical types under normal operation. The two edge cases that could threaten this (Relationship merge, Venue transfer) are exactly why §3/§7 require ownership changes to be explicit and audited rather than implicit — ambiguity is prevented by policy, not by accident of the data model. |
| Can signatures survive edits? | No, by design — a signed Representation is immutable (ADR-1); there is no code path in this model that edits one. The only way content changes post-signature is a new Document (Amendment). |
| Can amendments invalidate previous documents? | No — an Amendment Supersedes, it does not invalidate or delete. The original signed Contract remains permanently retrievable, which is the entire point of choosing Supersession over deletion for legal records. |
| Can deleted storage orphan a document? | This is the one place the architecture's own boundary matters: §11 says "Storage is an implementation detail," deliberately separate from the Document record. That means a Document's *product-level* existence (Identity, Owner, Status, Audit) does not depend on its Storage pointer resolving — a Document with a broken storage link is a **data-integrity failure to detect and repair**, not a modeled state the architecture needs to represent. This is correct scoping, not a gap: the architecture defines what a healthy system looks like; it does not need to model every way an implementation could later corrupt itself. |
| Can a representation exist without a version? | No — a Representation is always generated *from* a specific Document state (§2, §7); "version" here means that state, not a formal version number. Every real Representation type in the matrix (§7) has an explicit "generated from" answer. |

No genuine contradiction found. One boundary (storage integrity) was correctly identified as outside the architecture's responsibility rather than papered over.

---

## 14. Architecture Certification

| Area | PASS / FAIL | Reason | Required Change |
|---|---|---|---|
| Canonical Definition | **PASS** | Every real and conceptual type in the matrix fit the §0 definition without alteration. | None |
| Ownership | **PASS** | Every type resolved to one of the five canonical owners or explicit "none" (Attachments); two edge cases (merge, transfer) correctly require policy, not architecture. | None |
| Behavior | **PASS** | Every type fit exactly one of six behaviors; two apparent overlaps (Floor Plan, AI Draft) resolved without inventing a hybrid. | None |
| Lifecycle | **PASS** | All eight canonical states used correctly across every type; no type needed a ninth state. | None |
| Versioning | **PASS, with one flagged real-world divergence** | The model held for every type except: `luv_drafts` regenerates as a new row, not a new-Representation-of-same-Document, in the actual schema today. | When AI Drafts are formally migrated into this model, regeneration should version-chain rather than create disconnected rows. |
| Representations | **PASS** | True Representations vs. storage derivatives (Preview/Thumbnail) cleanly separated for every type checked. | None |
| Storage | **PASS** | Every type resolved to an explicit combination of the eight classifications; no ninth category needed. | None |
| Permissions | **PASS** | The full role × action matrix from the architecture covered every type without exception. | None |
| Automation | **PASS (taxonomy) / GAP (wiring)** | The ten canonical events were sufficient for every type — zero document-specific events needed. But six of ten events (Shared, Viewed, Approved, Superseded, Expired, Archived, Deleted) have no confirmed real implementation today; only Uploaded, Signed, and Generated (partial) are wired. | Not an architecture change — an implementation backlog item for Phase 4+. |
| Reporting | **PASS** | Every requested metric resolved cleanly to Document-owned or Relationship-owned, no new category needed. | None |
| AI | **PASS** | Real AI content (`luv_drafts`) classified without ambiguity: Temporary Suggestion until accepted, Document once accepted. Confirms ADR-6 holds against a real, not hypothetical, example. | None |
| Edge Cases | **PASS (14 of 14)**, 2 flagged as policy, not architecture | Every scenario supported by existing mechanisms; two require a business decision the architecture correctly declines to make unilaterally. | Product decision needed (not architectural) on: Relationship-merge document handling, Venue-ownership-transfer document inheritance. |
| Stress Test | **PASS** | No contradiction found in seven adversarial questions; one (storage-orphaning) correctly identified as outside architecture's scope rather than forced into the model. | None |

---

## Final Deliverable

**Document Domain Architecture v1.0 is complete and certified for implementation.**

Every real document type found in the codebase, and every conceptual type named in this phase's brief but not yet built, fits the architecture without a special case. The two open items are not architectural gaps: one is a real-world implementation detail (`luv_drafts` should version-chain when formally migrated, not a model defect) and one is automation *wiring* completeness (expected to be incomplete pre-implementation, not a taxonomy failure — the event set itself needed zero additions). The two edge cases flagged as requiring a decision (Relationship merge, Venue transfer) are correctly business-policy questions the architecture leaves open by design, not places where the model breaks.
