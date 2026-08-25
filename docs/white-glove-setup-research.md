# White Glove Setup — Automation, Intake & Operator-Leverage Research

**Type:** Research/specification only. No source, schema, migrations, RLS, UI, copy, or data were changed. All findings below are traced from actual code and confirmed live where noted.

Evidence labels: **VERIFIED LIVE** / **VERIFIED FROM DATABASE** / **VERIFIED FROM SOURCE** / **UNVERIFIED**.

This report merges the original White Glove automation research with the Venue Brochure + Planning Templates addendum. Sections marked with letters (A–M) correspond to the addendum; numbered sections correspond to the core request.

---

## 1. Executive Summary

**What can we automate today, with zero new engineering, by reusing what already exists:**
- Bulk package/pricing import from CSV, Excel, PDF, DOCX, or pasted text, with AI-assisted structuring reviewed before commit — already fully built and working, just not yet wired to a White Glove entry point.
- Turning a venue's own existing planning checklist (pasted text or a `.txt`/`.md` file) into a structured Planning Template with milestones, event-relative timing, and human-review flags on anything the system guessed — already fully built.
- A working, reviewed, real Client Planning and Venue Planning "Standard Wedding" starter template pair — exists in code today, just not surfaced as a one-click default the way Questionnaires and Message Templates already are.
- A real, cron-driven, audit-logged reminder/escalation/digest engine — already sends real email on a schedule, today, for task-based follow-up.
- A real draft-then-human-review-then-send discipline for AI-generated content, enforced consistently everywhere Claude is used in this codebase.

**What would materially reduce Jennifer's setup effort, and is a bounded, small extension of existing architecture:**
- A pre-login, token-scoped intake page reusing the exact pattern already proven twice in this codebase (the public Brochure link and the public Contract sign link, plus the couple-portal's token-scoped upload route).
- Extending the existing message-template import (currently paste-only) to also accept a file upload, matching the pattern packages and planning checklists already use.

**What is genuinely missing and would require new work:**
- Any mechanism for detecting a conflict across multiple uploaded documents.
- Any internal, non-event-scoped "setup task" in the product's own Task system — `event_tasks.event_id` is a hard `NOT NULL` foreign key today.
- Questionnaire import from an existing document — the one major content type with zero import/upload path today.
- Any customer-facing image/gallery capability on the Brochure.

**Material release risks:** none of the above are launch-blocking in the way the provisioning bridge gap is. The one correctness defect carried forward from prior research is that White Glove's activation link is structurally broken today (§10) — that must be fixed regardless of anything else in this report.

---

## 2. Current Architecture Map

| Domain | Current capability | Level |
|---|---|---|
| File storage | Supabase Storage, multiple buckets (`documents` public, `contract-representations`/`event-order-representations` private+signed-URL, `client-media`, `uploads`, others) | Fragmented but real |
| Document metadata | 5 separate tables: `documents` (generic, multi-entity), `canonical_documents`+satellites (Document Domain, Contracts-only so far), `couple_documents` (client-initiated), `vendor_library_documents`, `document_workspace_pins/interactions` (read-model only) | Fragmented, unified only at the UI read layer |
| Document viewing | Metadata + Download button only — no in-app preview/render of any kind | Gap |
| Document categorization | Manual dropdown only — no content-based auto-detection | Manual |
| Document extraction | Real: `pdf-parse` + `mammoth` text extraction → Claude-based structuring, scoped to the Import Wizard's 5 entity types (couples/leads/vendors/inventory/**packages**) | Real, narrow |
| Contracts | Real templates/records/signing; content-hash + venue-first signing implemented; template ingestion from an existing document is text-only by deliberate design, no AI structuring | Real, deliberately non-extracted |
| Packages/Pricing | Real catalog + real bulk import (CSV/Excel deterministic; PDF/DOCX/paste via Claude), 4 flat fields only, no line-item extraction | Real |
| Message Templates | Real starter library (11 masters) + paste-based Claude import; no file-upload import | Real, one gap |
| Questionnaires | Real 3-master starter system with a working answer-destination model; no import/upload mechanism at all | Real, notable gap |
| Planning Templates/Playbooks | Real "Standard Wedding" starters (both kinds) exist in code; real "Import a checklist" (paste or `.txt`/`.md`, Claude-restructured, `needsReview` flagged) | Real |
| Venue branding/assets | Two separate, non-shared upload mechanisms (venue-session direct-upload vs. portal-token upload); no typography field at all | Fragmented |
| Brochure | Narrow: text sections + boolean toggles for packages/FAQs (live-pulled, not copied); reuses venue logo+hero (its only images); no gallery, no layout curation, no publish state | Real but minimal |
| Tasks/Task Center | Very mature: dependencies, milestones, event-day designation, real cron-driven reminders/escalation/digest, in-app notifications — but every task is `event_id NOT NULL`, no internal/setup task concept | Real, one hard architectural limit |
| Luv/AI | Real hybrid: large rules/template layer (no AI) + genuine, gated Anthropic Claude integration for draft generation and document extraction, with a consistently enforced draft-review-commit discipline | Real, well-governed |
| Provisioning | Real narrow bridge (`venue_enrollments`/`activate_venue_enrollment`) works for Self-Setup; structurally broken for White Glove | Real for one journey, broken for the other |

---

## 3. White Glove Customer Journey (Recommended)

1. Payment succeeds → immediate "we're preparing your workspace" email.
2. Email includes a link to a new, pre-login, token-scoped intake page (reusing the pattern already proven by `/brochure/[token]`, the Contract sign-token flow, and the couple-portal's token-scoped upload route `app/api/portal/upload/route.ts`).
3. Customer uploads multiple files in one action, optionally tagged to a material group, plus answers a short, operator-defined list of questions.
4. Customer can return to the same link at any time to upload more, see what's received, and see what's outstanding.
5. Jennifer builds the workspace.
6. Jennifer marks setup complete → real "ready" email + working credentials link (contingent on the provisioning fix in §10).
7. Customer signs in and begins using the workspace.

## 4. White Glove Operator Journey (Recommended, Phase 1)

Phase 1 reuses the CRM's existing, already-real 8-item White Glove checklist (Venue branding / Packages / Contracts / Questionnaires / Email templates / Website review / Launch review / Go Live) as the operator's "what's left" list. New in Phase 1: a view of materials that arrived via the intake page, organized by material group; for Packages and Planning Templates specifically, a one-click "propose from this file" action running the already-existing Import Wizard extraction pipeline, landing in the already-existing review screens; the existing "Launch Workspace" action, once fixed (§10).

Explicitly not Phase 1: a unified dashboard computing percent-complete, cross-document conflict detection, or a bespoke White Glove-only UI.

## 5. Automation Opportunity Matrix

| White Glove Activity | Current Capability | Could Automate? | Recommended Approach | Human Approval Needed? | Launch Priority |
|---|---|---|---|---|---|
| File collection | New pre-login token page (proven pattern, not yet built) | Yes | Small extension | N/A (collection only) | Required |
| File classification | Manual category dropdown only | Partially | Small extension (customer/operator tags a material group at upload) | No | Required |
| Document extraction — packages | Already exists, working | Yes | Reuse as-is | Yes (existing review screen) | Required |
| Document extraction — planning checklist | Already exists, working | Yes | Reuse as-is | Yes (existing `needsReview` flags) | Required |
| Document extraction — message templates | Exists for paste only | Yes | Small extension (accept file upload into same pipeline) | Yes (existing pattern) | High-value |
| Document extraction — contracts | Deliberately not AI-extracted | No — by design | Preserve as-is | N/A | Preserve |
| Document extraction — questionnaires | Not found | Only with new schema work | New capability | Yes | Later |
| Document extraction — branding | Not needed — direct upload is sufficient | N/A | Reuse existing upload, no extraction | No | Required |
| Duplicate detection (within one entity type) | Exists for packages (name match) | Yes | Reuse as-is | Yes | Required |
| Duplicate/conflict detection (across documents) | Not found anywhere | Only with new logic | New capability | Yes, always | Later |
| Version/outdated-file detection | Not found | Only with new logic | New capability | Yes | Later |
| Missing-information detection | Not found as a formal gap-tracker; closest analog is the CRM's flat checklist | Partially | Reuse checklist for Phase 1 | Yes | Later (formal); Required (checklist) |
| Customer questions (non-inferable) | No structured mechanism | Yes | Small extension | N/A | Required |
| Operator review | Exists per-feature | Already exists | Reuse | Yes | Required |
| Setup progress tracking | Exists only in the CRM's local checklist, not product-side | Partially | Reuse CRM checklist for Phase 1 | N/A | Required |
| Customer reminders | Real engine exists, but `event_tasks`-scoped only | Yes, with adaptation | Small extension (new cron mirroring existing engine, keyed off enrollment staleness) | No | High-value |
| Operator reminders | Not found for White Glove specifically | Yes | Small extension | No | Later |
| Setup completion | Already exists (`launch_workspace`), but broken (§10) | Fix, don't rebuild | Fix existing bridge | Yes (checklist-gated already) | Required — blocking |
| Ready notification | Already exists, correct copy/behavior | Reuse | Reuse as-is (once §10 fixed) | N/A | Required |
| Credentials/access | Already exists, same bridge as Self-Setup | Reuse | Reuse as-is (once §10 fixed) | N/A | Required — blocking |

## 6. AI / Document Intelligence Opportunities

Reusable today, as-is: the Import Wizard's Claude-based extraction pipeline (`lib/luv/import-assist.ts`, `lib/import/file-parsing.ts`) for Packages and Planning Templates; the message-template paste-import pipeline; the entire draft→`pending_review`→accept/discard pattern (`luv_drafts` table).

Not available: any vision/OCR/image-understanding capability; any cross-document comparison; any questionnaire extraction.

A second, separate "Luv" exists inside `workspace/` (Hello to Cheers' own internal sales CRM tool) — different codebase, out of scope for White Glove.

## 7. Human Approval Boundaries

| Category | Safe for automatic processing? |
|---|---|
| Packages/pricing extraction | Suggest only, human commits (existing pattern) |
| Planning Template extraction | Suggest only, human commits (existing `needsReview` pattern) |
| Message template extraction | Suggest only, human commits |
| Contract content | Never AI-extracted (existing design decision, preserve) |
| Branding assets | Safe to upload directly, no AI review needed |
| Questionnaire content | Would need review if ever built — no precedent yet |
| Cross-document conflict | Always surface to a human, never auto-resolve |
| Setup completion / credential release | Always an explicit human action (already correctly enforced) |

## 8. Phase 1 Recommendation

Fix the broken activation bridge (blocking, unrelated to automation); build the token-scoped intake page (small extension, high leverage); wire that page's uploads into the already-existing package and planning-template extraction pipelines; extend message-template import to accept a file; reuse the CRM's existing checklist as the operator's progress view.

## 9. Later Opportunities

Cross-document conflict detection; a real materials-aware operator dashboard; questionnaire import; unifying the fragmented document-table landscape.

## 10. Implementation Dependencies

Blocking, independent of everything else: the White Glove activation-token bridge gap (`launchWhiteGloveWorkspace` never writes its token to the real `venue_enrollments` table). The intake page depends on the `venue_enrollments` row existing (created at checkout). Extraction reuse depends on `ANTHROPIC_API_KEY`; every existing extraction path already fails soft without it. Reminders depend on the existing Resend-backed notification engine's cron infrastructure.

## 11. Jennifer Decisions Required

1. Intake page scope for Phase 1 (simple multi-file + short Q&A vs. more structured).
2. Which material types get AI-assisted extraction in Phase 1 (Packages + Planning Templates immediately; Message Templates with a small extension; Questionnaires/Contracts excluded).
3. Operator dashboard for Phase 1 — reuse the CRM's flat checklist, or require a new materials-aware view before launch.
4. Reminder cadence/tone for the new customer follow-up mechanism.
5. Confirm the activation-bridge fix is prioritized ahead of or alongside this work.
6. Should the "Standard Wedding" starters auto-provision for every new venue (both journeys)?
7. Is a photo gallery the right first brochure investment, or should curated layout variants come first?

## 12. Cursor-Ready Scope

**Safe to implement after approval:** fix the White Glove activation-token bridge; build the pre-login token-scoped intake page; wire uploads into existing package/planning-template pipelines; extend message-template import to accept a file; surface the existing CRM checklist as the Phase 1 operator view; auto-provision the two "Standard Wedding" starters.

**Not safe yet:** cross-document conflict/version detection; any new operator dashboard; questionnaire import/extraction; any change to Contract ingestion; any schema change making Tasks non-event-scoped; any brochure gallery/layout work (until sequencing is decided).

---

# Addendum: Venue Brochure + Planning Template Foundations

## A. Venue Brochure — Current-State Findings

**VERIFIED FROM DATABASE** (live `\d public.brochures`): `id, venue_id, name, is_archived, welcome_text, include_packages (bool), include_faqs (bool), closing_text, share_token (unique), source_master_key, created_at, updated_at`. No image, color, or layout field beyond what's listed.

| Capability | Verdict |
|---|---|
| Data model | EXISTS, narrow |
| Creation/editing UI | EXISTS, minimal |
| Venue branding pull | EXISTS, live, not overridable per-brochure |
| Typography | NOT FOUND |
| Hero/logo images | EXISTS — reuses `venues.logo_url`/`venues.hero_image_url` |
| Gallery/photo sections | NOT FOUND |
| Package inclusion | EXISTS, live pull, not copied |
| FAQ inclusion | EXISTS, live pull |
| Layout/section curation | NOT FOUND — one fixed template |
| Preview | PARTIAL — opens the generated PDF |
| Publish/draft state | NOT FOUND — only archive; link always live |
| PDF/export | EXISTS — `@react-pdf/renderer`, same pattern as Contracts/Event Orders |
| Hosted/shareable link | EXISTS, no auth, token-based |

## B. Venue Brochure — Product Gap

**B — missing meaningful product capabilities.** No image capacity beyond the two inherited venue-profile fields, no layout options, no typography control.

## C. Recommended Premium Brochure Phase

1. Photo gallery/hero beyond the single venue hero image — highest value, currently zero support.
2. Curated layout variants (2-3 fixed, not a builder).
3. Typography — lower priority, no venue-level font field exists anywhere.
4. Package images — nice-to-have, `packages` has no image column.

Do not build: a drag-and-drop layout builder, Canva-style tooling, arbitrary section reordering.

## D. Asset Reuse Findings

Two separate, non-shared upload mechanisms: (1) venue-session direct upload (`lib/storage/upload.ts`, `uploads` bucket) for venue logo/hero; (2) portal-token upload (`app/api/portal/upload/route.ts`, `client-media` bucket) for Wedding Website/couple-facing assets. The Brochure already reuses mechanism 1 correctly (logo/hero). Any new brochure gallery should extend mechanism 1, since Brochure is venue-authored, not couple-authored.

## E. Planning Templates — Current-State Findings

Real, mature data model: `playbook_templates` (kind: client/venue), `playbook_milestones`, `playbook_tasks`. Applying a template creates real `event_tasks`, idempotent per (event, kind) via a DB-level unique constraint. "Import a checklist" is real: paste or `.txt`/`.md` upload, Claude-restructured, `needsReview` flagged.

## F. Existing Starter Content Found

Both exist in code today, exact content confirmed, not database-seeded: "Standard Wedding" (Client Planning) — Booking/Planning/Final Details/After Your Day, 10 tasks. "Standard Wedding" (Venue Planning) — Booking/Final Details/Wedding Day/Post-Event, 9 tasks. Created via explicit starter-picker selection today, not auto-provisioned.

## G. Recommended Starter Template Set

| Starter | Type | Existing source | Recommendation |
|---|---|---|---|
| Standard Wedding — Client Planning | Client Planning | `lib/playbooks/constants.ts` | Auto-provision on first venue setup |
| Standard Wedding — Venue Planning | Venue Planning | Same file | Auto-provision, same as above |

No other starter content exists anywhere — do not invent additional starters or event types.

## H. White Glove → Brochure Automation Opportunities

Packages/FAQs already auto-populate once real data exists (no work needed). A gallery-suggestion feature is later work, dependent on the gallery capability existing first.

## I. White Glove → Planning Template Automation Opportunities

Turning an uploaded venue checklist into a Planning Template is already fully built (reuse as-is — the single highest-leverage, zero-effort item in this report). Auto-provisioning the two starters for new venues is low effort, high value.

## J. Updated Operator-Leverage Matrix

(Folded into §5/H/I — no separate table to avoid duplication.)

## K. Updated Phase 1 Recommendation

Auto-provision the two "Standard Wedding" starters for every new venue — very low effort, content already approved, closes a real first-run gap. Brochure gallery work should follow the White Glove intake work, not precede it.

## L. Jennifer Decisions Required (Addendum-specific)

Folded into §11 items 6–7.

## M. Cursor-Ready Scope (Addendum-specific)

Folded into §12.

---

**STOP.** No code, schema, copy, or data was changed. This document records completed research only.
