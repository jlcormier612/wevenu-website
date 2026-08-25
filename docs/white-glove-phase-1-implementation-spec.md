# White Glove + Planning + Brochure — Phase 1 Implementation Specification

**Status:** Awaiting Jennifer's approval. Not yet authorized for implementation.
**Source of truth:** `docs/white-glove-setup-research.md`. This specification does not contradict or broaden those findings; every claim below is re-labeled with its own evidence status, re-verified directly against source/database where noted.
**Type:** Specification only. No source, schema, migrations, UI, tests, or data have been changed in producing this document.

Evidence labels used throughout: **VERIFIED LIVE** / **VERIFIED FROM DATABASE** / **VERIFIED FROM SOURCE** / **UNVERIFIED**.

---

## 1. Executive Summary

Five independently-scoped workstreams, in dependency order:

- **A — White Glove activation correctness (release blocker).** The White Glove "Launch Workspace" action generates a real-looking activation link that can never resolve, because the token is written only to the CRM's local file store and never to the real Postgres `venue_enrollments` table. **VERIFIED FROM SOURCE.** This must ship before anything else in this spec matters, because no amount of intake/automation work helps a customer who can never log in.
- **B — White Glove token-scoped intake.** A new, pre-login page where a White Glove customer uploads materials and answers a short set of questions, reusing the `documents` table/bucket and the token-scoped-page pattern already proven twice in this codebase.
- **C — Existing extraction integrations.** Wire intake materials into the Package import pipeline, the Planning Template "Import a checklist" pipeline, and a small extension of Message Template import to accept a file — all three pipelines already exist and are unmodified by this work except the last, which gets one small addition.
- **D — Planning starter auto-provisioning.** Make the two existing, already-approved "Standard Wedding" templates auto-provision for every new venue, mirroring the exact pattern Questionnaires and Message Templates already use.
- **E — Brochure photo gallery.** The smallest coherent image-capable addition to the Brochure, reusing the venue-session upload mechanism already used for the venue logo and hero image.

Each workstream is independently shippable and independently testable. None of them depend on the CRM seven-step product-sync pipeline, none of them touch Contracts, Seating, Event Order, or authentication architecture beyond the one named defect in A.

---

## 2. Approved Scope

Exactly the five items in §1 (A–E), per Jennifer's decisions in the governing request. Nothing beyond these five is in scope for Phase 1.

## 3. Explicit Out-of-Scope Items

Per the governing request, none of the following are part of this specification or any Phase 1 implementation:

Questionnaire document extraction/import; AI contract extraction; cross-document conflict detection; automatic version/outdated-file detection; autonomous commercial decisions or commitments; a new generic document-management system; a new generic asset-management system; a new White Glove-specific task architecture; non-event-scoped Tasks; a sophisticated percentage-complete White Glove dashboard; the CRM seven-step product-sync pipeline; any AI agent platform; autonomous workspace configuration; Event Order; Seating; Help articles; Wedding Website; Automation P0/P1; Vendor architecture; Contracts architecture; Financial architecture; authentication architecture beyond item A; the Luv roadmap; terminology review; general engineering cleanup not directly required to safely implement A–E.

## 4. Current Architecture Dependencies

- **A** depends only on code already shipped: `venue_enrollments` table, `activate_venue_enrollment()` RPC, `upsertVenueEnrollment()`/`activateVenueAccount()` client functions, and the `launchWhiteGloveWorkspace()` CRM function. No new infrastructure.
- **B** depends on the `documents` table/bucket (already real), and on a new, small addition to `venue_enrollments` (two nullable columns — see §6) to carry an intake token and short answers. It also depends on A being fixed first, since B's intake token and A's activation token are related but distinct concepts on the same row (see §6 for why they must not be the same token).
- **C** depends on B existing (materials must be somewhere before they can be extracted) and reuses `lib/luv/import-assist.ts`, `lib/import/file-parsing.ts`, `lib/playbooks/service.ts`'s `createTemplateFromImport`, and `lib/luv/message-template-import.ts` completely unmodified except for the one named extension in C.3.
- **D** depends on nothing new — it wires two already-existing, already-correct functions (`createStandardClientPlanningTemplate`, `createStandardVenueWorkflowTemplate`) into the existing page-load provisioning pattern.
- **E** depends on the existing venue-session upload mechanism (`lib/storage/upload.ts`, `components/ui/image-upload.tsx`) and the existing `brochures` table, extended with one new small table.

---

## 5. Detailed Implementation Requirements

### A. White Glove Activation Correctness (Release Blocker)

**The defect, precisely.** `workspace/app/api/relationships/lifecycle/route.ts`, case `"launch_workspace"` (**VERIFIED FROM SOURCE**, re-read directly for this spec): calls `launchWhiteGloveWorkspace()` (`shared/relationships/lifecycle.ts`), which generates a fresh activation token and writes it **only** to the CRM's local file-backed `Relationship` record (`relationship.activationToken = token`, inside `withLiveStore`). The route then builds `activateUrl` from that token and calls `sendWelcomeHomeEmail()` — all without ever calling `upsertVenueEnrollment()` (the one function, from `@shared/product-account`, that writes an activation token into the real Postgres `venue_enrollments` table). **VERIFIED FROM SOURCE**: repo-wide search confirms `upsertVenueEnrollment` has exactly one call site in the entire codebase, in `marketing/lib/crm/service.ts`'s checkout-time `createVenueEnrollment()` — never in `launch_workspace`. Since `/api/internal/enrollment/activate` (the real activation endpoint the customer's link hits) looks up `venue_enrollments WHERE activation_token = <token>`, and this token was never written there, activation will return `invalid_or_expired_token` for every White Glove customer, every time.

**Required fix.** In the `"launch_workspace"` case, after `launchWhiteGloveWorkspace()` succeeds and before sending the Welcome Home email:

1. Call `upsertVenueEnrollment()` (already imported pattern, `@shared/product-account`) with: `stripeCheckoutSessionId: launched.relationship.stripeCheckoutSessionId` (this is what makes the call an UPDATE of the same row created at checkout, not a duplicate insert — the underlying endpoint upserts keyed on this field), `venueName: launched.relationship.venue.name`, `ownerEmail: launched.relationship.owner.email`, `onboardingType: "white_glove"`, `activationToken: launched.activationToken`.
2. If `bridged.ok !== true`: do **not** send the Welcome Home email. Return an error to the operator (`{ error: "Could not persist the real activation record. Try Launch Workspace again." }`), leave the Relationship's CRM-local state exactly as `launchWhiteGloveWorkspace()` already left it (already-idempotent — re-running `launch_workspace` reuses `existing.activationToken` per `shared/relationships/lifecycle.ts`'s `const token = existing.activationToken || newActivationToken()`, so a retry does not generate a second, different token).
3. If `bridged.ok === true`: proceed to send the Welcome Home email exactly as today.

**Why this is minimal and correct.** No new endpoint, no new table, no schema change. `upsertVenueEnrollment`'s backend (`app/api/internal/enrollment/upsert/route.ts`) already accepts and stores `activationToken` unconditionally on both its insert and update paths, and already no-ops safely if the row is already `status: 'activated'` — this fix only adds the one missing call, at the one call site that was missing it.

**Sequencing requirement (governing request item 9), satisfied exactly:** Launch Workspace → `upsertVenueEnrollment` succeeds → (only then) Welcome Home email sent → customer authenticates via the already-correct, already-real `activateAccountAction`/`activateVenueAccount`/`activate_venue_enrollment()` path (same one Self-Setup already uses successfully) → `/setup` or dashboard reachable.

**Files involved:** `workspace/app/api/relationships/lifecycle/route.ts` (the one call site to modify), `@shared/product-account` (`shared/product-account/index.ts`, unmodified, reused as-is).

---

### B. White Glove Token-Scoped Intake

**Pattern being reused.** Two precedents already exist for a public, token-resolved page with no login: `/brochure/[token]` (read-only, `get_brochure_by_token` RPC, `SECURITY DEFINER`, granted to `anon`) and the Contract sign-token flow. A third, closer precedent already does exactly the write-with-a-token shape this needs: `app/api/portal/upload/route.ts` — accepts `{token, file, type}` as multipart form data, resolves the token against a session table (`client_portal_sessions`) with the Supabase service-role client, uploads to storage, returns a public URL. **VERIFIED FROM SOURCE** (re-read directly for this spec).

**Recommended shape, closely mirroring that existing route:**

- **New route:** `POST /api/white-glove/intake/upload` — accepts `{token, file, category}` multipart form data. Resolves `token` against `venue_enrollments.intake_token` (new column, §6) via the service-role client — no session, no login. Uploads to the existing `documents` bucket. Inserts a row into the existing `documents` table: `venue_id` = the enrollment's venue-to-be (see §6 note on venue_id-before-activation), `lead_id`/`client_id`/`event_id`/`vendor_id` all `null` (the existing, already-indexed, already-CHECK-constrained "venue-level document" pattern — **VERIFIED FROM DATABASE**: `documents_one_entity CHECK (... <= 1)` permits zero-of-four, and a partial index `documents_venue_level` already exists specifically for this case), `uploaded_by_type: 'venue'`, `tags: ['white_glove_intake']`.
- **New route:** `GET /api/white-glove/intake/[token]` — resolves the token, returns the enrollment's venue name, a list of already-uploaded documents (filtered to `tags @> ARRAY['white_glove_intake']`), and any saved short-answer responses, so the page can render "what's received / what's outstanding."
- **New route:** `POST /api/white-glove/intake/answers` — accepts `{token, answers: Record<string,string>}`, writes to the new `intake_answers` jsonb column (§6). Small, additive — same shape as the file-upload route's token resolution.
- **New page:** `app/white-glove/[token]/page.tsx` (or equivalent public route segment) — the customer-facing intake experience. No auth. Renders: an upload control (reusing the existing generic `UploadButton`/upload-flow pattern already used elsewhere in the product, adapted to call the new route above instead of the authenticated `documents` insert path it normally uses), a lightweight category picker using the categories from the governing request (Branding / Packages & Pricing / Contracts / Message Templates / Questionnaires & Forms / Venue Information / Other), a short list of operator-defined questions with plain text-answer inputs, and a simple received/outstanding summary.

**Categorization mechanism — implementation choice, not a schema risk either way:** the existing `documents.category` enum (`contract, insurance, inspiration, floor_plan, menu, permit, questionnaire, invoice_copy, other` — **VERIFIED FROM DATABASE**) does not have values for "Branding," "Packages & Pricing," "Message Templates," or "Venue Information." Two options, both small:
  - (a) Store the customer-facing category label in `tags` (already a free, unconstrained `text[]` column — zero schema change), and keep `category` as `'contract'`/`'questionnaire'` where those already match, `'other'` otherwise.
  - (b) Extend the `documents_category_check` CHECK constraint with the four missing values (one small, additive migration, non-breaking to any existing row).
  Recommend (a) for Phase 1 — it requires no migration for categorization at all, and `tags` is exactly the kind of unconstrained, low-commitment field this deliberately-lightweight categorization calls for ("do NOT require customers to perfectly organize their files").

**Multi-file support:** the route accepts one file per request (matching the existing `app/api/portal/upload/route.ts` shape exactly); the page issues one request per file selected, so a multi-file browser picker is a client-side concern only, not a new batch-upload backend.

**Returning later:** since the token is durable (stored on `venue_enrollments`, not single-use), the same link works indefinitely until the enrollment is activated. No new session/expiry concept needed beyond what already exists conceptually for the Brochure/Contract token pattern.

**Explicitly not built here:** any file preview/viewer (none exists anywhere in the product today — not a White Glove-specific gap to solve), any auto-classification of file contents (categorization is customer/operator-chosen, not inferred), any progress percentage.

**Files involved (new):** `app/white-glove/[token]/page.tsx`, `app/api/white-glove/intake/upload/route.ts`, `app/api/white-glove/intake/[token]/route.ts`, `app/api/white-glove/intake/answers/route.ts`.
**Files involved (reused unmodified):** `documents` table/bucket, existing generic upload UI pattern for the client-side control.

---

### C. Existing Extraction Integrations

**C.1 — Packages.** No new extraction code. The operator-facing entry point (likely surfaced from the CRM's Relationship/White Glove checklist view, or from a simple "Materials received" list referencing this spec's B.2 route) passes an uploaded intake document's `storage_url`/extracted text into the **existing, unmodified** Import Wizard flow (`app/(app)/settings/import/actions.ts`, `lib/import/file-parsing.ts`, `lib/luv/import-assist.ts`) targeting `entity: "packages"`. The existing field-mapping/preview/commit screens are reused exactly as a self-serve venue would use them today — Jennifer, not the customer, drives this screen, consistent with "operator reviews and commits."

**C.2 — Planning Templates.** No new import code. An uploaded intake checklist (paste, `.txt`, or `.md` — matching what "Import a checklist" already accepts) is routed through the existing `createTemplateFromImportAction` → `lib/playbooks/service.ts`'s `createTemplateFromImport` → `lib/luv/playbook-import.ts`'s `proposePlaybookDraft`, landing in the same Template Editor a venue's own self-serve import already uses, with the same `needsReview` flags on anything guessed. **Note:** the existing importer accepts `.txt`/`.md` only (not PDF/DOCX) — **VERIFIED FROM SOURCE**. If a White Glove customer uploads a PDF/DOCX checklist, C.2 should first run it through the same `extractPdfText`/`extractDocxText` functions already used for Packages (§C.1's dependency, `lib/import/file-parsing.ts`) to get plain text, then feed that text into the existing paste-import path unchanged — this is a small, consistent extension of file-type support, not a second import architecture.

**C.3 — Message Templates (the one approved extension).** Today, `importTemplateAction(rawText, channel, category)` (`app/(app)/communication/templates/actions.ts`) and the underlying `proposeMessageTemplate()` (`lib/luv/message-template-import.ts`) accept raw text only — **VERIFIED FROM SOURCE**, both signatures re-read directly for this spec. Required extension: accept an uploaded file (`.txt`, `.md`, `.pdf`, `.docx`, matching what Packages already accepts) by running it through the same `extractPdfText`/`extractDocxText` functions from `lib/import/file-parsing.ts`, then passing the resulting text into the **unchanged** `proposeMessageTemplate()`. No new AI call, no new prompt, no new architecture — literally the same two extraction functions already used for Packages, feeding the same message-template proposal function already used for pasted text. UI change: `components/communication/message-template-starter-picker.tsx`'s import card gains a file-upload option alongside its existing `Textarea`, mirroring the exact pattern `components/playbooks/playbook-starter-picker.tsx` already uses for its own file-vs-paste choice.

**Human review, all three:** unchanged from today — Packages land in the existing preview/commit screen, Planning Templates land in the existing editor with `needsReview` flags, Message Templates land as a `pending_review`-equivalent proposal the operator must accept before it becomes a real template row (existing `proposeMessageTemplate` return shape already requires an explicit save action in the existing UI).

**Files involved:** `app/(app)/settings/import/actions.ts`, `lib/import/file-parsing.ts` (reused, unmodified), `lib/playbooks/service.ts`, `lib/luv/playbook-import.ts` (reused, unmodified), `app/(app)/communication/templates/actions.ts` (extended), `lib/luv/message-template-import.ts` (reused, unmodified — only its caller gains a new text-extraction step before calling it), `components/communication/message-template-starter-picker.tsx` (extended).

---

### D. Planning Template Starter Auto-Provisioning

**Pattern being mirrored exactly.** `ensureStarterMessageTemplatesForCurrentVenue()` (`lib/message-templates/provision.ts:90`) and `ensureQuestionnaireFamilyForCurrentVenue()` (`lib/questionnaire-family/provision.ts:68`) are both called, unconditionally and idempotently, at the top of their respective library page's server component — `app/(app)/communication/templates/page.tsx:14` and `app/(app)/library/questionnaire-templates/page.tsx:13` respectively. **VERIFIED FROM SOURCE**, both call sites re-read directly for this spec.

**One real difference that must be handled.** Unlike those two provisioners (which check for an existing row by `sourceMasterKey` before inserting — genuinely idempotent per-master), `lib/playbooks/service.ts`'s `createStandardClientPlanningTemplate()`/`createStandardVenueWorkflowTemplate()` (lines 488–510, re-read directly for this spec) call `createFromReference()`, which **always creates a new template** — the function's own comment states this explicitly ("Always creates a new template; a venue can start several from the same starting point"). Calling these unconditionally on every page load would create duplicate "Standard Wedding" templates on every visit. `playbook_templates` also has no `source_master_key` column (unlike Message Templates/Questionnaires), so the exact-match idempotency mechanism those two use isn't directly available.

**Required new function**, `ensurePlanningStartersForCurrentVenue()` (new file, `lib/playbooks/provision.ts`, mirroring the naming/location convention of the other two provisioners): for the current venue, check whether **any** `playbook_templates` row exists with `kind = 'client'`; if none, call `createStandardClientPlanningTemplate()`. Independently, check whether any row exists with `kind = 'venue'`; if none, call `createStandardVenueWorkflowTemplate()`. This targets the stated goal precisely ("eliminate the empty first-run Planning Template Library") without requiring a schema change: a venue that already has any template of a given kind — whether hand-built, White-Glove-imported, or from a previous provisioning run — is left alone; only a genuinely empty kind gets the starter.

**Call site:** `app/(app)/library/playbooks/page.tsx`, mirroring the other two page components exactly — `await ensurePlanningStartersForCurrentVenue()` before `getTemplatesForLibrary()`.

**Applies to both journeys**, per the approved decision — this is a page-load provisioning check, not tied to Self-Setup vs. White Glove in any way, so it fires identically for either.

**Explicitly not changed:** template content (used verbatim from `lib/playbooks/constants.ts`, already-approved), the Planning Template data model, the "Import a checklist" or manual "New template" paths, anything about how a template is applied to an event.

**Files involved:** new `lib/playbooks/provision.ts`, `app/(app)/library/playbooks/page.tsx` (one new call), `lib/playbooks/service.ts` (reused, unmodified).

---

### E. Venue Brochure Photo Gallery

**Data model — new, small, additive.** New table `brochure_images`: `id uuid pk`, `brochure_id uuid not null references brochures(id) on delete cascade`, `venue_id uuid not null references venues(id) on delete cascade` (denormalized for RLS symmetry with `brochures` itself, matching how `brochure_activities` already does this — **VERIFIED FROM DATABASE**, `brochure_activities` schema confirmed to include its own `venue_id`), `image_url text not null`, `sort_order integer not null default 0`, `created_at`, `updated_at`. RLS mirrors `brochures` exactly: `brochure_images_all` policy on `venue_id = current_user_venue_id()`.

**Upload mechanism — reuse, not new.** The existing venue-session direct-upload path (`lib/storage/upload.ts`'s `uploadToStorage(bucket, basePath, file)`, `components/ui/image-upload.tsx`) — the same mechanism already used for `venues.logo_url` and `venues.hero_image_url` (`components/settings/venue-settings.tsx:196-230`, **VERIFIED FROM SOURCE**, re-confirmed from the underlying research). Gallery images upload to the existing `uploads` bucket at a `{venueId}/brochure/{brochureId}/` path, consistent with the existing `{venueId}/logo`/`{venueId}/hero` convention. No new bucket, no new auth model, no third upload mechanism — directly satisfying the governing request's explicit instruction.

**Editing UI.** `components/brochures/brochure-detail.tsx` gains a new "Photos" section: a simple ordered list of uploaded images with an add-image control (reusing `components/ui/image-upload.tsx`), a remove action per image, and up/down (or drag) reordering that persists `sort_order`. No layout choice, no per-image caption/styling options, no multi-variant anything — matching "no drag-and-drop layout builder, no arbitrary section reordering" (the *images* can be reordered among themselves; the *brochure's own section order* — header/hero/welcome/packages/FAQ/gallery placement — stays fixed, with the gallery landing in one new, fixed position in that existing sequence).

**Rendering — both surfaces.** `lib/brochures/pdf.ts` gains one new fixed section (a simple grid or stacked image layout, consistent with the existing single-hero-image treatment already in that file) rendering images in `sort_order`. `app/brochure/[token]/page.tsx` (public HTML) gains the equivalent section. Both already pull brochure data through `lib/brochures/service.ts`/the `get_brochure_by_token` RPC — that data-fetching function and RPC need to additionally select from `brochure_images`, ordered by `sort_order`; no other part of either fetch path changes.

**Explicitly not built:** any per-image caption, any layout-variant picker, any typography change, any package-specific photography, any drag-and-drop free-form canvas.

**Files involved (new):** one migration for `brochure_images` (table + RLS + trigger, mirroring `brochure_activities`'s exact shape).
**Files involved (modified):** `components/brochures/brochure-detail.tsx`, `lib/brochures/service.ts`, `lib/brochures/pdf.ts`, `app/brochure/[token]/page.tsx`, the `get_brochure_by_token` RPC definition (one additional subquery, same pattern already used there for packages/FAQs).
**Files involved (reused, unmodified):** `lib/storage/upload.ts`, `components/ui/image-upload.tsx`.

---

## 6. Data/Schema Changes (Complete List)

| Change | Item | Type | Risk |
|---|---|---|---|
| `venue_enrollments.intake_token uuid unique default gen_random_uuid()` | B | New nullable column, additive | Low — mirrors `brochures.share_token` exactly |
| `venue_enrollments.intake_answers jsonb not null default '{}'::jsonb` | B | New column, additive | Low |
| New table `brochure_images` (+RLS+trigger) | E | New table | Low — mirrors `brochure_activities` exactly |
| (Optional, not required) extend `documents_category_check` | B | Additive CHECK change | Only if categorization option (b) is chosen over (a) in §5.B — recommend (a), which requires none of this |

**Important distinction preserved:** `venue_enrollments.intake_token` is a **separate** token from `venue_enrollments.activation_token`. The intake token is issued at checkout (for both journeys, though only meaningfully used by White Glove) and remains valid indefinitely pre-activation; the activation token is generated later (at "Launch Workspace" for White Glove, or at checkout for Self-Setup) and is what actually creates the real account. Conflating them would let intake-page access double as account-activation access, which is not the approved behavior — nothing about the intake page should ever create or modify `auth.users` or `venues`.

No changes to `event_tasks`, no changes to any RLS policy on an existing table, no changes to the seven-step product-sync tables, no changes to Contracts/Event Order/Seating schema.

## 7. UI/UX Requirements

- Intake page: no login required, works on mobile, plain-language copy per the approved messaging ("Send us what you already have..."), the approved flexible-timing language (governing request §8) displayed once near the top, not repeated per-item.
- Category picker: the seven suggested groups from the governing request, presented as optional tags, not a required field — an upload must succeed even with no category chosen.
- Operator side: materials appear wherever Jennifer already looks for White Glove work today (the existing CRM Relationship/checklist view) — no new navigation entry, no new top-level nav item, consistent with "do not invent a new navigation structure."
- Brochure gallery editor: consistent with the brochure's existing minimal, form-like editing style (`brochure-detail.tsx`'s existing toggles/text fields) — not a new visual language.

## 8. Security / RLS / Token Requirements

- The intake token (B) and its two new routes must be checked against `venue_enrollments` with the **service-role client only** (no `authenticated`/`anon` RLS grant needed on `venue_enrollments` itself — it already has none, per the original provisioning research, and must stay that way). This exactly mirrors how `app/api/portal/upload/route.ts` resolves `client_portal_sessions` today.
- Cross-venue access must be structurally impossible, not just filtered: every intake route derives `venue_id`/enrollment scope from the token itself, never from a client-supplied id — matching the existing portal-upload route's own pattern exactly.
- `brochure_images` RLS (E) must be venue-scoped identically to `brochures`/`brochure_activities` — reuse the existing `current_user_venue_id()` helper, no new authorization concept.
- The activation-bridge fix (A) introduces no new security surface — it calls an existing, already-authenticated (Bearer `PRODUCT_SYNC_API_KEY`) internal endpoint exactly as the checkout path already does.

## 9. Error/Failure Behavior

- **A:** if the real bridge write fails, the operator sees an explicit error and no customer email is sent — never a silent "success" that later turns out false. Retrying is safe (idempotent token reuse, confirmed in §5.A).
- **B:** an invalid/unknown intake token returns a clear "this link isn't valid" page, not a generic 404 or 500. A valid token with a storage-upload failure returns a retryable error to the customer, matching the existing portal-upload route's own error handling (`"Upload failed. Please try again."`).
- **C:** every extraction failure (missing `ANTHROPIC_API_KEY`, unreadable scanned-image PDF, etc.) falls back to the same existing, already-implemented non-AI behavior each pipeline already has (deterministic line-split for checklists, `plainTemplateSplit` for messages, existing Import Wizard error states for packages) — no new failure mode introduced.
- **D:** if a venue somehow already has a `kind='client'` or `kind='venue'` template by the time this runs (race condition on a fast double page-load), the "any template exists" check simply prevents a duplicate — no error surfaces, matching the silent-idempotent behavior of the two existing provisioners.
- **E:** an image upload failure surfaces the same retryable error pattern as the existing logo/hero uploader already uses (`components/ui/image-upload.tsx`'s existing error handling, unmodified).

## 10. Customer Communications Affected

- The existing "White Glove Welcome" and "Welcome Home" email templates are unmodified by this spec except that the Welcome Home send (part of A) becomes conditional on the real bridge write succeeding, and — per the flexible-timing decision already approved in prior research — should not promise a fixed business-day window (this was flagged as a separate content fix in the prior provisioning research and is not re-litigated here; if not already applied, it should travel with this work since both touch the same email).
- No new email template is required for B — the existing Welcome/White Glove Welcome email can simply link to the new intake page instead of (or alongside) whatever it currently links to.

## 11. Testing Requirements

Exact test implementations are Cursor's to write once the real code is traced; this section specifies required coverage, not test code.

**Provisioning (A):** successful activation end-to-end; real enrollment token persistence confirmed by database read after `launch_workspace`; successful login/access after activation; a forced bridge failure does not send the ready email; retrying `launch_workspace` after a failure is idempotent (no duplicate token, no duplicate email).

**Intake (B):** valid token succeeds; invalid/expired/unknown token is rejected; correct venue/enrollment scoping (a token for enrollment X cannot read or write enrollment Y's materials); multiple uploads in sequence all persist; returning to the same link later still works and shows prior uploads; unauthorized cross-venue access is prevented at the query level, not just the UI level.

**Extraction (C):** existing package import behavior is unchanged by C.1's wiring; existing planning-checklist paste/`.txt`/`.md` import is unchanged by C.2; existing message-template paste import is unchanged by C.3; new message-template file import (`.txt`/`.md`/`.pdf`/`.docx`) produces the same proposal shape paste already does; every extraction path still requires an explicit human accept/commit action before any row becomes real venue content.

**Planning starters (D):** a brand-new venue receives both starters on first Planning Template Library visit; a venue that already has a `client`- or `venue`-kind template does not receive a duplicate; running the check twice in a row (double page load) does not create duplicates; starter content matches `lib/playbooks/constants.ts` verbatim, unmodified.

**Brochure (E):** all existing brochure behavior (name/welcome/packages toggle/FAQs toggle/closing text/logo/hero/PDF/public link) is unchanged; gallery images can be uploaded; order persists across a reload; images render correctly in the editor, the PDF, and the public page; correct venue scoping on `brochure_images`; unauthorized access to another venue's gallery images is prevented; no regression to existing logo/hero rendering.

**Also required, all workstreams:** `npx tsc --noEmit` clean; the relevant focused test files pass; the full existing test suite passes with no regressions.

## 12. Rollout/Activation Considerations

- A should ship and be verified independently before B/C are exercised in a real White Glove flow, since B/C are meaningless if the customer can never reach the finished workspace.
- D is fully independent and can ship at any point relative to A/B/C/E without sequencing risk.
- E is fully independent of A–D.
- No feature flag is evidenced as necessary — each workstream is additive and does not change existing behavior for any venue that doesn't use the new surfaces (Self-Setup venues are unaffected by A/B/C; existing brochures are unaffected by E until a venue adds a gallery image; existing Planning Template libraries with content already in them are unaffected by D).

## 13. Exact Files/Components/Services Likely Involved (Consolidated)

| Workstream | New files | Modified files | Reused unmodified |
|---|---|---|---|
| A | — | `workspace/app/api/relationships/lifecycle/route.ts` | `shared/product-account/index.ts`, `app/api/internal/enrollment/upsert/route.ts` |
| B | `app/white-glove/[token]/page.tsx`, `app/api/white-glove/intake/upload/route.ts`, `app/api/white-glove/intake/[token]/route.ts`, `app/api/white-glove/intake/answers/route.ts`, one migration for `venue_enrollments` columns | — | `documents` table/bucket, generic upload UI pattern |
| C | — | `app/(app)/settings/import/actions.ts` (wiring only), `app/(app)/communication/templates/actions.ts`, `components/communication/message-template-starter-picker.tsx` | `lib/import/file-parsing.ts`, `lib/luv/import-assist.ts`, `lib/playbooks/service.ts`, `lib/luv/playbook-import.ts`, `lib/luv/message-template-import.ts` |
| D | `lib/playbooks/provision.ts` | `app/(app)/library/playbooks/page.tsx` | `lib/playbooks/service.ts`, `lib/playbooks/constants.ts` |
| E | one migration for `brochure_images` | `components/brochures/brochure-detail.tsx`, `lib/brochures/service.ts`, `lib/brochures/pdf.ts`, `app/brochure/[token]/page.tsx`, `get_brochure_by_token` RPC | `lib/storage/upload.ts`, `components/ui/image-upload.tsx` |

## 14. Cursor Implementation Order

1. **A** — fix and independently verify before proceeding.
2. **D** — fully independent, low-risk, can run in parallel with B/C once A is done; sequenced here mainly because it's the smallest, fastest workstream to prove the "reuse existing provisioning pattern" approach before the more involved B.
3. **B** — the intake page and its routes.
4. **C** — wiring intake materials into existing extraction pipelines (depends on B existing).
5. **E** — fully independent; can run at any point, listed last only because it's the least urgent relative to the White Glove correctness/leverage goals.

Each item ships as its own, independently reviewable change — per the governing request, no combined mega-change.

## 15. Jennifer Approval Checklist

- [ ] Confirms the Activation Correctness fix (A) matches the required outcome exactly.
- [ ] Confirms the intake page's scope (B) — multi-file upload, lightweight categories, short Q&A, durable token, no progress percentage — matches what "small, token-scoped intake" was meant to mean.
- [ ] Confirms categorization approach (a) — tags-only, no schema change to `documents.category` — is acceptable, or prefers option (b).
- [ ] Confirms the three extraction integrations (C) and their boundaries (Packages/Planning Templates reused as-is; Message Templates gets the one file-upload extension; Questionnaires/Contracts untouched).
- [ ] Confirms auto-provisioning the two Standard Wedding starters (D) for every new venue, both journeys.
- [ ] Confirms the brochure gallery shape (E) — ordered image list, fixed placement, no layout variants, no captions — matches the intended Phase 1 scope.
- [ ] Confirms the two new `venue_enrollments` columns and the new `brochure_images` table are the only schema changes approved for Phase 1.
- [ ] Confirms implementation order (§14) and that each workstream ships independently.

---

**STOP.** No source, schema, migrations, UI, tests, or data have been modified in producing this specification. Awaiting Jennifer's review and explicit approval before Cursor receives any implementation prompt.
