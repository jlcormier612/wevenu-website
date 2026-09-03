# Pre-Launch Commercial Readiness — Initiative 1: Audit

**Date:** 2026-08-03
**Scope:** Full inventory of existing venue onboarding, setup, and data-import/migration architecture, performed before any implementation, per the initiative's own instruction to audit first.

**Headline finding, stated up front because it changes the shape of this initiative:** this is not a greenfield build. Two mature systems already exist and were found, not assumed:

1. **A real, resumable, real-data-driven guided setup wizard** (`/setup`) with persona capture (new / switching / Weven-returning), progressive-disclosure steps, and a dashboard "Getting Started" card that recomputes from live data hourly — not a checkbox.
2. **A real, working "Migration Center"** (`/settings/import`) — a full Upload → Understand → Map → Preview → Confirm → Import → Results pipeline for five domains (Clients/Couples, Leads, Vendors, Inventory, Packages), with duplicate detection, batch tracking, rollback, a white-glove staff-assisted counterpart, and Luv-assisted parsing for unstructured (Word/PDF/pasted) content.

What's genuinely missing is narrower than the initiative's full spec implies once you know this: **the two systems above are not connected to each other, and the guided setup wizard's steps are about the venue's own settings (name, hours, brand, owner, payments) — not about the 6-stage "Your Venue / Bring Your Business / Your Offerings / Your Business Tools / Your People & Business / Ready to Go" journey the initiative specifies.** The Migration Center is real but lives only in Settings, reachable after setup, never introduced during it — which the initiative explicitly says must not be true ("Do NOT make venues hunt through Settings later to discover migration").

This document records what exists, in detail, organized by the initiative's own audit checklist. Part 2 of this document (implementation) proceeds by **reusing every one of these systems**, not rebuilding them, per the initiative's explicit instruction: *"Do not build parallel data-writing paths where trusted existing creation paths already exist."*

---

## 1. Account creation / first login flow

There is **no self-serve signup** anywhere in this app for venue owners — venue owner/staff accounts are provisioned outside the app (Supabase Auth directly). The only in-app account-creation code creates **couple** accounts accepting a portal invite (`lib/client-auth/service.ts:200-210`), unrelated to venue onboarding.

- Login: `app/(auth)/login/page.tsx` + `components/auth/login-form.tsx` — email/password only, no signup/reset links.
- Sign-in server action: `app/auth/actions.ts`'s `signIn()` — unconditional `redirect("/dashboard")` on success.
- Session/route gating: `integrations/supabase/proxy.ts` — a logged-in user hitting `/login` is redirected to `/vendor/dashboard` (if a vendor session) or `/dashboard` (everyone else); venue-existence is **not** checked here.
- **The actual first-run gate** is `app/(app)/layout.tsx:34-39`:
  ```
  const venue = await getCurrentVenue();
  if (!venue?.setupCompleted) {
    const vendorUser = await getVendorUser();
    if (vendorUser) redirect("/vendor/dashboard");
    redirect("/setup");
  }
  ```
  This runs on **every** `(app)/*` navigation, not just first login — any authenticated user without a `setupCompleted` venue is bounced to `/setup` every time. `app/setup/page.tsx` itself redirects back to `/dashboard` if a completed venue already exists. This is the mechanism that satisfies Scenario F (existing configured venues never see onboarding) — it already works correctly and needed no changes.

## 2. Venue creation

No DB trigger creates a venue on user signup — creation is 100% explicit via one RPC, `complete_venue_setup(payload jsonb)` (`supabase/migrations/20260626090000_venue_foundation.sql`, evolved by two later migrations for brand colors and an RLS self-reference fix). Every write to `venues`/`venue_business_hours`/`venue_staff` goes through this one RPC — confirmed no other insert path exists.

**Critical architectural fact that shapes this initiative's implementation:** the RPC is called twice, not once:
- `saveSetupProgress()` (`lib/venue/service.ts:135-155`) — fires after **every** wizard step (as soon as `venue-info` is completed, since it only requires `name` to be non-empty), with `completed=false`. **This means a real `venues` row exists after the very first step**, long before the wizard's final "Create venue" button. The existing "Payments" step already depends on and exploits this fact (see its own code comment, `app/setup/actions.ts:38-45`): it fetches `getCurrentVenue()` with no venue id threaded through wizard state, because a real venue already exists by the time a user reaches it.
- `submitVenueSetup()` (`lib/venue/service.ts:66-124`) — the final, validated, `completed=true` path.

This fact is what makes it *safe* to insert new mid-wizard stages that write real data (imports) before the wizard's final submit — there's already a real `venue_id` and real RLS-backed session (`current_user_venue_id()`) to write against from step 2 onward. Confirmed `current_user_venue_id()` and every checked RLS policy do **not** gate on `setup_completed` — grepped every migration; the only other reference to `setup_completed` besides the venue-setup migrations themselves is a read in an activation-engine reporting query. **This means `/setup`-embedded components can safely call the exact same server actions/services normal `(app)` pages use, without needing route-gate changes.**

**Required fields at creation** (`lib/venue/validation.ts`'s `validateVenueSetup()`): only `name` and `ownerFullName` are truly required; everything else (email, website, venue type, capacity, business hours for open days, brand colors) either has a working default or is validated only if non-empty.

## 3. Venue profile/setup — full field inventory

Every field the domain model supports for venue profile (name, logo, hero photo, story, address, contact, website, venue type, capacity, timezone, business hours, 4 brand colors, owner info, currency, week-start) is already collected in the wizard and separately editable at `/settings` afterward — see the audit conversation's full field/location table for the complete mapping (not reproduced here for length; every field the initiative's Part 3 Stage 1 asks for is already covered by the existing `venue-info`/`venue-details`/`brand` steps, satisfying "reuse information already collected... never ask for the same information twice").

**One gap found:** `hero_image_url` and `story` are Settings-only, never collected in the wizard — acceptable, since they're not in the initiative's Stage 1 list and aren't required.

## 4. Team setup/invitations

Real, working invite system: `lib/team/service.ts`'s `inviteStaffMember()` inserts a pending `venue_staff` row and emails an invite link (`/join?token=...`); `app/join/page.tsx` handles acceptance with distinct error states (wrong email, already a member, not found). Not modified by this initiative — Stage 5 ("Your People & Business") links to the existing team page rather than reimplementing invitations.

**One real gap, not part of this initiative's scope but worth recording:** a brand-new invited staff member with no existing Supabase Auth account has no in-app way to create one (no signup flow exists at all, per §1). Flagging, not fixing — out of scope for a migration/onboarding initiative.

## 5. Existing onboarding checklist/progress system — real-data-derived, not a checkbox

This already fully satisfies the initiative's Part 10 ("resumable, based on real data") and most of Part 11 ("restrained dashboard resume affordance").

- **`venue_activation_state`** (`supabase/migrations/20260709120000_sprint108_activation_engine.sql`) — one row per venue, ~17 write-once "first X happened at" timestamps across 5 dimensions (Setup, Couple Engagement, Workflow, Team, Habit), written by `record_engagement_event()` whenever real product events fire.
- **`compute_venue_activation_score(venue_id)`** — a 100-point score computed by querying **real rows** (packages table has an active row? `venue_staff` has a recently-active non-owner? etc.), not user-togglable flags. Returns a full `checklist` (every item, completed or not, with `{key, action, pts, href, completed}`).
- **`lib/dashboard/service.ts`'s `buildGuidedSetupChecklist()`** — reads that checklist directly (a prior refactor deliberately retired an earlier independent TS computation in favor of this single source of truth), attaches journey-voiced copy from `lib/dashboard/gap-copy.ts`.
- **UI:** `components/dashboard/getting-started.tsx`, the "Getting Started" card on `/dashboard` — shows progress %, per-item CTAs, a Luv coaching line, a milestone-celebration banner, and a "Dismiss" button. `show: !allComplete && !venue.onboardingDismissed` — **the card disappears entirely once everything is done**, exactly matching Part 11's requirement not to permanently clutter the dashboard.

**Verdict: Part 11 ("Finish setting up Hello to Cheers — 7 of 9 essentials ready — Continue setup →") is already built and already correct.** No changes needed there. This initiative's new onboarding stages should feed the *same* checklist rather than inventing a second one — e.g. a package imported during "Your Offerings" already flips `first_package` real, which the existing Getting Started card already reflects with zero new code.

**A second, separate system exists and must not be confused with the above:** `venue_onboarding_engagements` (`lib/hq/onboarding-service.ts`, `app/admin/onboarding/`) is an internal Customer-Success **staff case-tracking** tool (status, assigned CS rep, "current focus"), invisible to the venue itself. Unrelated to what a venue sees; not touched by this initiative.

## 6. First-run gating logic

Fully covered in §1/§2. No changes required — already correct for Scenario F.

## 7. Luv's existing onboarding-specific behavior

Three real surfaces already exist, all reusing one shared "Welcome! I'm Luv." intro card component (`components/luv/luv-intro-card.tsx`):
- Dashboard intro (gated on `!venue.luvIntroSeenAt`, dismiss is permanent).
- **`lib/luv/setup-observations.ts`'s `computeSetupGapObservations()`** — converts the Activation Engine's top-3 incomplete checklist items into Luv's normal observation stream, reusing the same `GAP_COPY` table the dashboard card uses. Explicit design rule already in the docs: *"Luv never points at an answer, she does it with you."*
- The wizard's own `journeyLine()` — one persona-varying greeting line shown above each step (`components/setup/setup-wizard.tsx:52-61`).
- **Separately, the Migration Center already has its own Luv integration** (`lib/luv/import-assist.ts`) for two distinct jobs: turning unstructured pasted/Word/PDF text into proposed structured rows, and suggesting column→field mappings for already-columnar data. This is real, live (Anthropic `claude-sonnet-4-6`), and everything it proposes is reviewed in the same map→preview→import flow — nothing is ever saved from Luv's proposal alone.

**Verdict:** Part 9's Luv requirements are largely already met by existing infrastructure. This initiative's job is to make sure the *new* onboarding stages narrate through the same `GAP_COPY`/journey-line patterns rather than inventing new Luv UI.

## 8. Dead code / gaps found

- `components/setup/post-setup-financial.tsx` — confirmed dead (99 lines, zero references), superseded by the Payments step being folded into the wizard directly on 2026-07-22. Left in place per repo convention (no force-deleting without explicit instruction) — not part of this initiative's scope to remove.
- `venues.onboarding_persona` is captured by the wizard's `OriginStep` but is **almost entirely inert downstream** — the only behavioral read site anywhere in the codebase is the wizard's own `journeyLine()` greeting text. It does not currently affect the Migration Center, the dashboard, Luv's voice, or the Activation checklist. This directly contradicts the aspiration recorded in an earlier planning doc that it would be "what every persona-varying piece of copy... reads." **This initiative closes part of that gap**: the new "Bring Your Business" stage reads persona to decide its opening framing (Path A/"new" skips ahead faster; Path B/"switching" leads with migration), and picking "Weven" inside the Migration Center's new source picker sets persona to `weven_returning` if not already set.
- `onboarding_persona` is not editable from Settings despite a planning doc's promise that it would be — a real, pre-existing gap, out of scope for this initiative (it's a Settings change, not an onboarding/migration one).

---

# Part B — Import / Migration Architecture Audit

## 9. The existing Migration Center (`/settings/import`)

Real and substantially complete. `app/(app)/settings/import/page.tsx` + `app/(app)/settings/import/actions.ts` (370 lines) + `components/settings/import-wizard.tsx` (865 lines).

**Flow, already matching the initiative's Part 6 spec almost exactly:** entity select → upload (CSV/Excel/Word/PDF/paste) → field mapping (fuzzy auto-guess + remembered-per-entity) → dry-run preview (flags missing-required-field rows before any write) → results (downloadable error CSV, entity-specific next-step CTA).

**Five importable entities today:** Clients (couples), Leads, Vendors, Inventory, Packages. Events/Contracts/Invoices are explicitly labeled "Coming soon" in the existing UI (`components/settings/import-health-widget.tsx:10`) — a real, current, honest label already in production, not something this initiative invented.

**Every entity's import reuses the exact same service function the normal (non-import) UI uses to create a record** — confirmed by direct code read, not assumed:
- Couples → `createClient_()` (`lib/clients/service.ts`)
- Leads → `createLead(row, "import")` (`lib/leads/service.ts`)
- Vendors → `createVendor()` (`lib/vendors/service.ts`)
- Inventory → `createCategory()`/`createItem()` (`lib/inventory/service.ts`)
- Packages → `createPackage()` (`lib/packages/service.ts`)

This satisfies the initiative's explicit instruction ("imports use the SAME business rules as normal product creation... do not build parallel data-writing paths") completely, for these five domains, already, before this initiative began.

**File parsing:** `lib/import/file-parsing.ts` — ExcelJS for `.xlsx`/`.xls`, mammoth for `.docx` (raw text), `pdf-parse` for `.pdf` (raw text, with a "try Copy/Paste instead" fallback message if extraction is empty). CSV/paste parsed client-side with PapaParse. Unstructured text (Word/PDF/non-tabular paste) routes through a live Luv/Anthropic proposal step (`proposeStructuredRows()`), explicitly flagged `assisted: true` for extra scrutiny — never saved without review.

**A real defensive fix already shipped:** `looksLikeHeaderRow()` (`lib/import/utils.ts`) — added after a real customer's export files silently lost their first record to being consumed as a header row.

**A white-glove, staff-assisted counterpart already exists too:** `app/admin/onboarding/import-actions.ts` — the identical wizard UI and identical validation/dedup/batching, the only difference being an explicit `venueId` parameter instead of session-resolved, for an HQ staff member helping a venue that isn't their own session. "One migration engine, one data model, two entry points" (the file's own comment, verified true).

## 10. Weven-specific knowledge — verified, precisely, to be none

Grepped the entire repo (`app/`, `lib/`, `components/`, `docs/`, `supabase/`, `marketing/`) for every "Weven" mention (excluding trivial "Wevenu" self-matches). Every hit is one of: marketing/trust copy ("Welcome Back" pricing, a free-text `yearsWithWeven` intake field on the marketing site), or an architecture-lesson code comment ("Weven lesson: portal access ≠ messaging access" — three migrations cite this as *rationale for this app's own design*, not documentation of Weven's data model), or the `onboarding_persona` UI (§8 above).

**There is no Weven column-mapping table, header vocabulary, date-format knowledge, or parsing code anywhere in this codebase.** No file named anything like `weven-import.ts`/`weven-mapping.ts` exists. A prior internal assessment doc (`docs/hospitality-success-platform-assessment.md`) already reached and recorded this same conclusion independently.

**Consequence for this initiative, per its own Part 14 instruction ("do NOT build fake competitor integrations"):** Weven is treated exactly as the initiative specifies — a **recognized source label** in the Migration Center's new source picker, with warm acknowledging copy, routing into the exact same generic CSV/Excel/Word/PDF upload flow every other source uses. No claim of automatic parsing or field recognition specific to Weven is made anywhere in the implementation, because none exists.

## 11. Reusable "safe create" functions per domain — the full table

Every function below already exists, is already used by the Migration Center (except where noted "no import path exists"), and is what this initiative's new onboarding stages call — no new data-writing paths were created for any of these domains.

| Domain | Create function | Duplicate check already built | Notes |
|---|---|---|---|
| Leads | `createLead()` / `createLeadForVenue()`, `lib/leads/service.ts` | `findActiveDuplicateLead()` — email match, name fallback, active leads only | Underlying `create_lead_atomic` RPC resolves the shared `find_or_create_relationship()` — a prior "3-way dedup inconsistency" flagged in an earlier assessment doc is confirmed **already fixed** in current code |
| Clients (booked customers) | `createClient_()` / `createClientForVenue()`, `lib/clients/service.ts` | `findActiveDuplicateClient()` — same pattern, ported from Leads | |
| Vendors | `createVendor()` / `createVendorForVenue()`, `lib/vendors/service.ts` | `findActiveDuplicateVendor()` — business name + email, joined through `venue_vendor_relationships` since `vendors` has no venue_id of its own | **Gap for this initiative to document, not fix:** no existing function to attach an *existing* global vendor profile to a new venue relationship — every create path makes a new global vendor row. Out of scope to build in this pass. |
| Packages | `createPackage()` / `createPackageForVenue()`, `lib/packages/service.ts` | `findActiveDuplicatePackage()` — name match, active only | |
| Inventory | `createItem()`/`createCategory()` (+ `ForVenue` variants), `lib/inventory/service.ts` | `findActiveDuplicateInventoryItem()` — name match, non-archived only | |
| Events/bookings | `createEvent()`, `lib/events/service.ts` | No dedup function; Event INSERT/UPDATE is occupancy-trigger-enforced (`events_enforce_availability` / tag `TR-B1`) | **Not in the Migration Center today.** See §12 for this initiative's decision. |
| Contract templates | `createTemplate()`, `lib/contracts/service.ts` | None found | No import path exists for this domain at all. |
| Communication/message templates | `createTemplate()`, `lib/message-templates/service.ts` | None found | Paired with a Luv-assisted **freeform-text** import (`proposeMessageTemplate()`) — a different mechanism from CSV row-import, already shipped, not part of the 5-entity CSV wizard. |
| Playbook/task templates | `createTemplate()` (manual) / `createTemplateFromImport(rawText, ...)` (Luv-assisted "Bring Your Existing Checklist"), `lib/playbooks/service.ts` | None found | Both paths converge on the same `createFromReference()` helper the built-in starter templates also use — genuinely one create path for manual, starter, and imported alike. |
| Timeline templates | `createTemplate()` / `createTemplateFromImport()`, `lib/timeline-templates/service.ts` | None found | Same shared-insert-path pattern as playbooks. |
| Documents (generic file storage) | `saveDocument()` / `saveVenueDocument()`, `lib/documents/service.ts` | None found (no filename/hash dedup) | Backed by a real Supabase Storage bucket (`"documents"`) and entity-attachment model. This is the existing target for Part 8's "save the original file, don't structure it" requirement. |

**Design tradeoff already made and inherited by this initiative:** every duplicate check above is wrapped in try/catch with an explicit comment, "Duplicate check failing must never block a legitimate import" — a deliberate fail-open choice. Recorded here, not changed.

## 12. Decisions this audit drives for the implementation

1. **Events are not added to the structured-import domain set in this pass.** No dedup function exists, the conflict-guard behavior for bulk historical import is untested territory, and Events isn't in the Migration Center's `EntityType` union today. Per the initiative's own Part 5 instruction ("if a domain cannot safely be imported... document the limitation and provide the safest alternative"): the safest alternative is the existing, working, single-event creation flow (`createEvent()`), which the "Your People & Business" onboarding stage links to directly for venues with upcoming bookings to add. Clients (booked customers) — which the spec's Stage 5 also names — **are** already fully supported and wired in.
2. **Contract templates, communication templates, playbook templates, and timeline templates are not added to the CSV Migration Center's structured entity set in this pass either** — no existing dedup, and building new CSV-row semantics for "a contract" or "a checklist" would be new, unproven data modeling under time pressure. Instead, the initiative's Part 5 "Templates & Documents" domain is satisfied by **linking the new "Your Business Tools" onboarding stage directly to the three already-existing, already-shipped Luv-assisted freeform-text importers** (playbooks' "Bring Your Existing Checklist," timeline templates' equivalent, and message templates' equivalent) — real functionality, not a new lossy shortcut, and exactly matching the initiative's own instruction not to invent one.
3. **Documents** (Word/PDF/other files that can't safely become structured data) get a real, new "bring your files" step reusing `saveVenueDocument()` — stored as-is, never silently converted into a contract/template/package. This is new UI, zero new backend.
4. **The Migration Center gets a new, small, additive layer, not a rewrite:** a source-selection screen (Weven / another platform / spreadsheets / files / "I'll enter things myself") that populates the already-existing-but-never-populated `import_batches.source_label` column, plus an "embedded in onboarding" mode so it can be rendered inside `/setup` (safe, per §2's confirmation that RLS/RPCs don't gate on `setup_completed`) and hand control back to the onboarding flow instead of navigating to a separate page.
5. **The wizard's existing `["welcome", "origin", ...SETUP_STEPS]` structure is restructured, not replaced.** `venue-info` / `venue-details` / `business-hours` / `brand` / `owner` become Stage 1 ("Your Venue") under a new stage-grouped progress header. New stages are inserted for "Bring Your Business," "Your Offerings," "Your Business Tools," and "Your People & Business." The existing `review` step becomes Stage 6 ("Ready to Go"), extended with real counts (packages, templates, vendor relationships, contacts, upcoming events) pulled live at render time — never fabricated.
6. **`onboarding_persona`'s two-choice Path A/B (per the initiative's Part 2 spec) replaces the wizard's current "welcome" + "origin" two-screen sequence** with one combined screen. The existing nested "Weven vs. somewhere else" sub-question moves to live inside the Migration Center's new source picker instead (Part 4's actual source list), where it belongs given the initiative's explicit source options — this is a more faithful match to the spec than the current implementation, and the DB constraint (`'new'|'switching'|'weven_returning'`) doesn't need to change since choosing "Weven" as a source later still sets the same persona value.

This audit is complete. Implementation proceeds directly per the decisions above — no destructive or data-integrity blockers were found that require stopping to ask.
