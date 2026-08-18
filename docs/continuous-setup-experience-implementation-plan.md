# Continuous Setup Experience — Reconciliation & Implementation Plan

**Status:** Approved. Lead Capture's completion model is resolved (see §D/§B below). Implementation authorized — see "Implementation sequence & blocker assessment" for what proceeds now vs. what remains gated on the still-open items in §I.
**Type:** Reconciliation + sequencing. Sections A–I below are the original pre-implementation reconciliation; the sequencing section reflects the authorization to proceed.
**Scope:** Items A–I as required by the approved spec, plus item 21 (Smart Fields re-investigation).

Evidence labels used throughout: **VERIFIED FROM SOURCE** / **VERIFIED FROM DATABASE** (via prior E2E sandbox testing this session) / **UNVERIFIED — genuine gap, needs a decision**.

---

## Two corrections to carry into planning

Before the stage-by-stage plan: two things this reconciliation found that don't match assumptions carried in the Cursor blueprint or the prior investigation turn. Neither invalidates the approved architecture — both change what "smallest truthful mechanism" means for two specific items.

### Correction 1 — White Glove does not currently bypass `/setup`

The working assumption (mine, in the prior turn, and implicit in the approved spec's §16 framing "our team may configure the venue before the venue has supplied every asset") was that a White Glove venue arrives at the dashboard pre-filled, having skipped the wizard. **This is not what the code does today.**

`activate_venue_enrollment(p_activation_token, p_owner_user_id)` (`supabase/migrations/20261293000000_venue_enrollments.sql:66-115`) is the **only** function anywhere that creates a `venues` row from the enrollment/activation path — a structurally separate call chain from `complete_venue_setup`/`insertVenueSetup` (the wizard's own path; confirmed by repo-wide grep that `lib/venue/service.ts`'s `submitVenueSetup`/`saveSetupProgress` are never called from `workspace/`, `marketing/`, or `shared/`). Its insert is bare:

```sql
insert into public.venues (owner_user_id, name, email)
  values (p_owner_user_id, v_enrollment.venue_name, v_enrollment.owner_email)
  returning id into v_venue_id;
```

No `setup_completed` is set, so it takes the column default: `false`. On login, `app/(app)/layout.tsx:44-50` gates on exactly that column — a fresh White Glove venue lands in `/setup`, same wizard, same blank slate, identical to self-service. This is also explicitly confirmed by the White Glove Phase 1 spec itself (`docs/white-glove-phase-1-implementation-spec.md:59`): *"customer authenticates via the already-correct, already-real ... path (**same one Self-Setup already uses successfully**) → `/setup` or dashboard reachable."*

**Open question this surfaces, not resolved by this document:** the approved spec's customer journey (also documented in `docs/white-glove-setup-research.md:56-65`) has "Jennifer builds the workspace" as a step between intake and "ready" — but no code path exists today for Jennifer to write real product data (packages, imported clients, templates) into a venue that doesn't exist in Postgres yet, since the venue row isn't created until the *owner* activates. How "Jennifer builds the workspace" is meant to mechanically happen — before or after the real `venues` row exists — is unresolved in both the current code and the White Glove spec. Flagged in §I as decision #10; not something to guess at here.

### Correction 2 — Smart Fields is confirmed by-design, not a regression, and not sandbox-specific

Re-investigated per item 21. Two findings:

1. **The literal term "Smart Field" doesn't exist in the codebase** — the implemented concept is uniformly called "merge field" (`{{merge_field}}` tokens), with one shared substitution engine (`lib/shared-merge/tokens.ts`) used by both Contracts and Communication (Email/SMS) Templates.
2. **The current interaction pattern, both domains, is click-to-copy-to-clipboard, not click-to-insert-at-cursor** — confirmed identical in `components/contracts/template-form.tsx:188-205` and `components/communication/template-form.tsx:230-244`. `git log -p --follow` on both files shows this was the pattern from the feature's original introduction (`9c37a75`, "Sprint 15: Contracts — templates, generation, send workflow, e-signature"), whose own commit message documents it as the intended design: *"Click any field token to copy to clipboard."* No subsequent commit touched the insertion logic. There is exactly one code path (identical in both files, same client-only conditional, no server/environment branching) — so there is no sandbox-vs-local discrepancy to find; whatever behavior is seen in the sandbox is the same behavior local would show.

So: the gap between current behavior and the stated intent ("users should not have to type Smart Field syntax") is real, but it is a **pre-existing, always-been-this-way product gap**, not a regression and not an environment difference. Full detail in §H.

---

## A. Final Setup Hub stage list

| Stage | Existing components/functions that power it | Net-new vs. relocated |
|---|---|---|
| **Your Venue** | `VenueInfoStep`, `VenueDetailsStep`, `BusinessHoursStep`, `BrandStep`, `OwnerStep` (`components/setup/setup-steps.tsx`) — identical to what Settings already reuses (`components/settings/venue-settings.tsx`). Logo/hero image upload exists (`components/ui/image-upload.tsx`, wired in `venue-settings.tsx:196-230`) but is **not currently part of any wizard step** — needs to be added here. | Existing content relocated; image upload is new to this surface (component itself is reused, not built new). |
| **Calendar & Availability** | `VenueSpacesSection` (`components/availability/venue-spaces-section.tsx`), `CapacityRulesSection` (`components/availability/capacity-rules-section.tsx`), `TourSettingsSection` (`components/settings/tour-settings-section.tsx`). All three are real, working Settings-only components today. | **Net new stage** — no `SETUP_STEPS`/`SETUP_STAGES` entry exists for this at all currently. |
| **Bring Your Business** | `BringYourBusinessStep` (`components/setup/setup-migration-steps.tsx:242-344`), `ImportWizard` (`components/settings/import-wizard.tsx`), `import_batches` table, manual-creation flows for Leads/Clients/Vendors (existing, unrelated pages). | Existing, already at the right step id (`"bring-your-business"`). |
| **Your Offerings** | `YourOfferingsStep` (`components/setup/setup-migration-steps.tsx:348-389`), Packages (`lib/packages/`), Inventory (`lib/inventory/`). | Existing, already at the right step id. |
| **Client Experience** | Not currently mapped to any wizard step. Candidate existing systems (see §I decision #1 for exact scope): Contract Templates (`lib/contracts/`), Questionnaire Templates (`lib/questionnaire-family/`), Communication/Message Templates (`lib/message-templates/`), Planning Templates/Playbooks (`lib/playbooks/`). | **Net new stage**, scope TBD by decision. |
| **Lead Capture** | `WebsiteFormsSection` (form embed + `EmailIntakeSection`), `FacebookConnectSection`, `TourSettingsSection` (as a lead channel, distinct from its Calendar & Availability role), `QrCampaignList`/`/library/qr-campaigns`, `LeadIntakeHealthSection`, `lib/lead-intake/pipeline.ts`/`getIntakeHealthSummary()`. Full map in §D. | Existing step id (`"lead-capture"`), scope expands significantly per §D. |
| **Your Team** | `components/settings/team-roster.tsx`, `lib/team/service.ts` (`getTeamMembers`, invite/accept flow, `venue_staff` table). | **Net new stage** — the existing `"your-people"` step id is about contacts/vendors (displaced to Bring Your Business, see §I decision below), not Team. |
| **Financials** | `PostSetupFinancial` (`components/setup/post-setup-financial.tsx`) — a complete screen rendering `StripeConnectSection` + `QuickBooksConnectSection`, currently **dead code, imported nowhere**. | Component exists; needs to be wired in. Genuinely new as a *reachable* stage. |
| **Setup Review** | No existing component. The wizard's current final `"review"` step (`ReadyToGoSummary`, `components/setup-steps.tsx:783-812`) is the closest analog but is scoped to the pre-workspace wizard's exit, not a persistent, revisitable review of Hub progress. | Net new. |
| **Ready to Invite Couples** | No existing field or UI. | Net new — see §B. |

---

## B. State model per stage

Format per stage: existing state → new state required → venue action → deliberate acknowledgment → completion → deferrable.

### Your Venue
- **Existing state:** all `STEP_FIELDS["venue-info"|"venue-details"|"business-hours"|"brand"|"owner"]` (`lib/venue/validation.ts`) — fully validated today.
- **New state required:** a signal for logo/primary-image presence being *addressed* (not necessarily uploaded — see completion note).
- **Venue action:** filling any of the existing validated fields; uploading logo/hero image.
- **Deliberate acknowledgment:** N/A — existing field validation already requires explicit entry for required fields.
- **Completion:** **UNVERIFIED — decision needed** (§I #1... actually §I item covers this — see decision list) whether logo+image are required or may be explicitly deferred.
- **Deferrable:** Per the approved spec §3, yes — the venue must be able to skip/continue without being blocked from workspace creation.

### Calendar & Availability
- **Existing state:** `venue_spaces` (no seeded default row — empty result set is a clean "not configured" signal), `venue_capacity_rules` (no seeded row, but UI pre-fill = DB default — see §C), `tour_scheduling_enabled` (clean boolean, `default false`, only flips via explicit toggle).
- **New state required:** per the approved spec §4's "smallest truthful persisted state needed to represent deliberate review" — a decision is needed on the exact mechanism (see §I #2). Row-existence alone is insufficient for Capacity Rules specifically, since a reflexive Save produces a row identical to "never touched."
- **Venue action:** adding a space; enabling/leaving-off tour scheduling *deliberately*; saving capacity rules *deliberately*.
- **Deliberate acknowledgment:** A venue with no bookable tours must be able to say so explicitly rather than being read as incomplete (approved spec §4, explicit example).
- **Completion:** Not "every technical setting configured" — "the venue has deliberately reviewed the availability concepts relevant to its business" (approved spec §4, verbatim).
- **Deferrable:** Implied yes, consistent with the rest of the Hub's revisitability principle (§15 of the approved spec).

### Bring Your Business
- **Existing state:** `import_batches` (real rows for Import/Files choices, `source_label`, `imported_count`, `rolled_back_at`). "Manual" choice today produces **no persisted row at all**.
- **New state required:** a place to persist "chose manual, deliberately" — schema decision open (§I #3).
- **Venue action:** running an import; uploading files; choosing manual.
- **Deliberate acknowledgment:** the three-way choice itself (Not yet addressed / Import / Manual) **is** the deliberate acknowledgment, per approved spec §5.
- **Completion:** Either Import or Manual is a legitimate completion — approved spec §5 explicitly forbids requiring actual imported/created records to make either choice "count."
- **Deferrable:** "Not yet addressed" must remain a real, non-penalized third state, not merely the absence of the other two (approved spec §5, "Absence of imported data must NEVER count as incomplete setup" — read together with the requirement that all three states be *distinguishable*, this means "not yet addressed" needs its own explicit un-set state, not inferred from empty `import_batches` alone, since empty could also mean "chose manual, forgot to persist it" today).

### Your Offerings
- **Existing state:** `getSetupReadyCounts()` counts `packages`/`inventory` with no `source_master_key` filter (see §C for the false-positive detail).
- **New state required:** a corrected count function (or new function) that excludes starter content; for `inventory_items` specifically, a schema decision is needed since that table has no `source_master_key` column at all (only its parent `inventory_categories`/`inventory_templates` do) — §I #4.
- **Venue action:** adding a real package or inventory item, or building on/customizing a starter (which correctly clears `source_master_key` on duplication per `lib/packages/repository.ts:154`'s existing convention).
- **Deliberate acknowledgment:** not currently modeled — a venue that reviews the starters and decides they're sufficient as-is has no way to say so today (this is the same class of gap as Calendar's capacity rules).
- **Completion:** venue-authored (or duplicated-and-thus-authored) offering exists, OR a deliberate "reviewed, using starters as-is" acknowledgment — per the approved spec §6's "venue action or deliberate venue acknowledgment, not merely the existence of platform-provided rows."
- **Deferrable:** Yes, consistent with Hub-wide revisitability.

### Client Experience
- **Existing state:** depends entirely on final scope decision (§I #1). If Contract/Questionnaire/Message Templates are included, the same `source_master_key` starter-exclusion problem applies to `contract_templates` and `message_templates` (both have the column, neither is filtered by any existing counting function). `questionnaire_templates` also has the column (`supabase/migrations/20261269000000_questionnaire_family.sql:29`) but was not investigated for a specific counting function analogous to `getSetupReadyCounts` — worth confirming before implementation, not assumed here.
- **New state required:** depends on scope decision.
- **Venue action / deliberate acknowledgment / completion / deferrable:** all depend on scope decision — not characterized further until §I #1 is resolved, per the "do not invent scope" instruction.

### Lead Capture — **RESOLVED, approved product direction**
- **Existing state:** none of the four candidate signals (embed link presence, `email_intake_connected_at`, Facebook connection status, QR campaign existence) individually or in combination represented "configured" before this decision. That gap is now closed by product decision, not by a new discovered signal.
- **New state required:** a new per-channel `configured` / `verified` pair (see §D for the exact shape), plus one stage-level field recording which path the venue took: automated-channel(s) configured, or an explicit "manual/external for now" declaration. Both are real, equally legitimate completion paths — not a fallback/failure state for the second one.
- **Venue action:** either configuring ≥1 automated channel the venue actually intends to use (not all of them), or explicitly declaring "I'll enter leads manually for now."
- **Deliberate acknowledgment:** the manual/external declaration **is** the deliberate acknowledgment for venues that choose that path — persisted, not inferred from the absence of channel configuration (the same "must be distinguishable from not-yet-addressed" principle as Bring Your Business's manual choice).
- **Completion:** **A. Automated intake** — ≥1 channel configured (and verified where verification is practical) that the venue intends to use, **OR B. Manual/external workflow** — an explicit, persisted "manual for now" choice. Neither path requires touching every channel; per-channel configuration must never be required for channels the venue has deliberately decided not to use.
- **Deferrable:** N/A in the usual sense — a venue must land on A or B to complete this stage, but B is always available as a first-class, non-penalized choice, so nothing is actually blocking.

### Your Team
- **Existing state:** `venue_staff` (`accepted_at`, `is_active`, `is_owner` — a clean "≥1 accepted, active, non-owner member" existence check is constructible but doesn't currently exist as a discrete function; the Activation Engine has a *recency*-based version — `last_active_at within 14 days` — which is a different, stricter concept than "has a team.")
- **New state required:** a simple existence-based function (distinct from the Activation Engine's recency-based one), plus a deliberate "not adding a team right now" acknowledgment for solo venues.
- **Venue action:** inviting ≥1 staff member.
- **Deliberate acknowledgment:** required — approved spec §9 is explicit that "a one-person venue must not be forced to create a team in order to complete setup."
- **Completion:** an invite sent (or accepted?) OR deliberate "just me for now" — exact bar is §I #6.
- **Deferrable:** Yes.

### Financials
- **Existing state:** `stripeOnboardingStatus` (enum + `stripeChargesEnabledVerifiedAt` timestamp) and `quickbooks_connections.status` (enum) both exist, both clean, **neither used as a completion signal anywhere today**.
- **New state required:** a "reviewed/acknowledged, connect later" state distinct from actual connection — per approved spec §10, "Stripe connected + QuickBooks connected = complete" is explicitly forbidden as the rule.
- **Venue action:** connecting Stripe and/or QuickBooks.
- **Deliberate acknowledgment:** required, exact mechanism is §I #7.
- **Completion:** deliberate review/acknowledgment, with actual connections as optional bonus progress, not the gate (approved spec §10, verbatim).
- **Deferrable:** Yes, explicitly — approved spec §10 states Financials belongs later in the journey and is optional.

### Setup Review
- **Existing state:** none persisted (the wizard's current `ReadyToGoSummary` is a one-time, non-revisitable screen).
- **New state required:** none beyond aggregating the other stages' state — this stage is a read/summary layer, not a new completion signal of its own.
- **Completion:** N/A — Review is a checkpoint, not itself a gated stage.

### Ready to Invite Couples
- **Existing state:** none. `setupCompleted`/`onboardingDismissed` explicitly off-limits (approved spec §12, and structurally wrong for it regardless — `setupCompleted` is sticky-permanent and already gates the entire workspace at a different, earlier point in the journey).
- **New state required:** a new column (or table row), written only by a deliberate, reversible owner action — exact trigger mechanism is §I #8.
- **Venue action:** the "I'm ready to invite couples" action itself.
- **Deliberate acknowledgment:** this **is** the deliberate acknowledgment — the entire concept, per approved spec §12.
- **Completion:** N/A — this is the terminal state that gates Activation.
- **Deferrable:** N/A, and per §12 must be reversible (the venue can un-declare readiness).

---

## C. False-positive audit

Every existing setup/readiness signal that can currently be satisfied by platform-seeded or default content, confirmed against source:

| Signal | Table/column | Why it's a false positive today | Confirmed by |
|---|---|---|---|
| `getSetupReadyCounts().packages > 0` | `packages`, no `source_master_key` filter | `seedPackageStarters(venueId)` runs unconditionally inside `submitVenueSetup` — every venue has ≥3 packages (`PKG-01..03`) before authoring anything | `lib/venue/service.ts:191-268`, `lib/packages/provision.ts:93` |
| `getSetupReadyCounts().inventory > 0` | `inventory_items`, no `source_master_key` column at all (structural — only `inventory_categories`/`inventory_templates` have it) | `seedStarterInventory(venueId)` runs unconditionally; the affected table can't even be filtered without a schema change or a join through category | `lib/inventory/provision.ts:19-53`, `supabase/migrations/20261272000000_inventory_starter_library.sql:6,16` (column exists only on categories/templates) |
| `getSetupReadyCounts().contractTemplates > 0` | `contract_templates`, has `source_master_key`, unfiltered | `seedContractStarters(venueId)` runs unconditionally | `lib/contracts/provision.ts:66`, `supabase/migrations/20261270000000_contract_starter_library.sql:7` |
| `getSetupReadyCounts().communicationTemplates > 0` | `message_templates`, has `source_master_key`, unfiltered | `seedStarterMessageTemplates(venueId)` runs unconditionally | `lib/message-templates/provision.ts:83`, `supabase/migrations/20261268000001_message_starter_library.sql:11` |
| Capacity Rules "configured" (row-existence) | `venue_capacity_rules` | No seeded row exists, but the UI pre-fills the identical values (1/1/0) the DB defaults to — a reflexive Save without any real input produces a row byte-identical to "never considered" | `components/availability/capacity-rules-section.tsx:34-37` vs. `supabase/migrations/20260627060000_availability_foundation.sql:41-49` |
| Tour Settings numeric sub-fields (row-existence, if ever used this way) | `venue_scheduling_enabled`'s sibling columns (`tour_duration_minutes`, `tour_min_notice_hours`, `tour_max_advance_days`, `tour_buffer_minutes`) | All ship with non-null column defaults applied to every venue at migration time — non-null is not evidence of review. (`tour_scheduling_enabled` itself is clean — `default false`, only a human toggle flips it.) | `supabase/migrations/20260628160000_tour_scheduling.sql:21-33` |
| Inquiry form "configured" (embed link presence) | `venues.embed_key` | Auto-generated for every venue at creation — can never distinguish authored from untouched | `supabase/migrations/20260627220000_lead_capture.sql:19-25` |
| Email intake "connected" (`email_intake_connected_at` non-null) | `venues.email_intake_connected_at` | The type's own code comment states it's a "pure UX gate," not functional — forwarding works identically whether or not a venue clicks Connect | `lib/lead-intake/email-status.ts:16` |
| `venue_activation_state.availability_configured_at` | dead column | Exists specifically to represent "Calendar & Availability configured" as an Activation milestone, but is never written or read anywhere outside its own `CREATE TABLE`/`ALTER TABLE` statement — a trap for anyone who assumes its presence means it's live | `supabase/migrations/20260709120000_sprint108_activation_engine.sql` (declared); confirmed via repo-wide grep, zero other references |
| **Forward-looking risk, not yet live:** `playbook_templates` starter-seeding | `playbook_templates`, **no `source_master_key` column exists on this table today** | Currently NOT a false-positive risk (no starter-seeding path exists for playbooks at all). But the separately-pending White Glove Phase 1 spec (§D of `docs/white-glove-phase-1-implementation-spec.md`) proposes auto-provisioning two "Standard Wedding" starter playbooks for every venue, using an existence-check (not a `source_master_key` check, since the column doesn't exist) as its idempotency mechanism. If that ships before Client Experience's playbook-based completion signal (if playbooks end up in scope) is designed, the same false-positive class will appear here too, with no existing column to filter on. | `docs/white-glove-phase-1-implementation-spec.md:110-113` (documents the exact idempotency gap itself) |

**No filter exists anywhere today that excludes `source_master_key IS NOT NULL` rows from a completion count.** This is a single, mechanical fix pattern (add `.is("source_master_key", null)` to the relevant queries) for the tables that already carry the column — `packages`, `contract_templates`, `message_templates` — but is structurally blocked for `inventory_items` and forward-blocked for `playbook_templates` until a decision is made (§I #4, and the new forward-looking flag above).

---

## D. Lead Capture implementation map — **approved completion model**

Product intent, verbatim from the approved decision: *"The venue has deliberately established how it intends to receive new inquiries in Hello to Cheers and has a workable intake path."* A venue configures only the channel(s) it intends to use; every other channel stays legitimately unconfigured, forever, without penalty.

### Per-channel Configured/Verified map

| Channel | Existing component | Currently in the wizard? | `Configured` means | `Verified` means (where practical) |
|---|---|---|---|---|
| Website inquiry form | `WebsiteFormsSection` (form link + iframe embed) | Yes (`LeadCaptureStep` → `WebsiteFormsSection`) | Venue has viewed/acknowledged the form as their intake channel — always technically present (§C false-positive), so "configured" here means a deliberate venue action of adopting it, not merely its existence | A test inquiry submitted and confirmed to land in `/leads` — reusing the existing `lead_intake_attempts` pipeline, `source = website` |
| Email forwarding intake | `EmailIntakeSection` (same `WebsiteFormsSection` surface) | Yes | `email_intake_connected_at` set (an explicit click, per its own existing "UX gate" semantics — already a real deliberate action even though functionally the address works either way) | A real forwarded email observed, `lead_intake_attempts.source = email_parsed_generic` |
| Tour booking → lead | `TourSettingsSection` | No — Settings-only today, needs linking/embedding into this stage | `tour_scheduling_enabled = true` (already a clean, deliberate boolean — see §C) | A test tour booked through the public scheduler, confirmed as a real lead + appointment |
| QR campaigns | `QrCampaignList` (`/library/qr-campaigns`) | No | ≥1 campaign created | A scan/conversion event recorded on a real campaign |
| Facebook Lead Ads | `FacebookConnectSection` | No — the wizard's `WebsiteFormsSection` currently has a dead `#facebook` anchor pointing nowhere inside the wizard context; needs a real link/embed | `facebook_connections.status = 'connected'` + ≥1 lead form enabled | A webhook-delivered lead observed, `source = facebook_lead_ads` |
| Manual entry | `/leads` "new lead" | N/A — always available | Choosing manual **is** configuration for this channel — no further setup exists or is needed | N/A — there's nothing to verify beyond the existing, already-working manual-create flow |
| CSV/Migration import | `/settings/import` | Belongs to Bring Your Business, not this stage | — | — |
| Verification surface (not a channel) | `LeadIntakeHealthSection` + `getIntakeHealthSummary()` | No — Settings-only today | — | This **is** the shared verification panel for every channel above, reused as-is |

### Guided container structure (per approved spec, reusing the architecture already identified)

1. **Start Here** — explains the available ways inquiries can reach Hello to Cheers; recommends the website inquiry form as the default starting point where appropriate (per approved copy intent: *"the easiest way to make sure new inquiries automatically arrive in Hello to Cheers"* — exact copy TBD, not invented here); frames the first decision as "How do you want new inquiries to reach Hello to Cheers?" rather than a channel checklist. Offers the manual/external path as an equally legitimate first answer, not a fallback shown only after declining everything else.
2. **Website Form** — embeds `WebsiteFormsSection` as-is.
3. **Email Intake** — embeds `EmailIntakeSection` as-is.
4. **Tour Booking** — links/embeds `TourSettingsSection`, framed as a lead channel in this context (distinct from its Calendar & Availability role, per §E's non-conflation).
5. **Other Sources** (progressively disclosed, not front-loaded) — QR campaigns, Facebook/external sources, manual entry — introduced with "you can add other lead sources whenever they're useful for your business" (intent only, exact copy TBD).
6. **Verify It Works** — reuses `LeadIntakeHealthSection` as-is; provides a test-inquiry path where practical per channel (per the Configured/Verified map above), framed as "send yourself a test inquiry so you can see exactly what happens" (intent only, exact copy TBD).

**Reuse, not rebuild:** `WebsiteFormsSection`, `EmailIntakeSection`, `FacebookConnectSection`, `QrCampaignList`, `LeadIntakeHealthSection`, and `lib/lead-intake/pipeline.ts` are embedded/linked into this container exactly as they exist today — no parallel Lead Capture system, no duplicated intake logic. The wizard's existing `LeadCaptureStep` (currently just `WebsiteFormsSection`) becomes this six-part container.

**Stage completion (the actual gate), quoting the approved decision exactly:** *"A. Automated intake: The venue configures and, where applicable, verifies at least one automated intake channel they intend to use. OR B. Manual/external workflow: The venue explicitly chooses a valid manual/external workflow for now."* Read literally: for a channel where a test/verify path exists (website form, email intake, tour booking, Facebook), completion requires configuration **and** verification of that channel; for a channel with no practical verification path (manual entry has none by definition; QR campaign "verification" would mean waiting for a real scan, not something a venue can do on demand), configuration alone is the bar. This is not this reconciliation's interpretation to soften — implementation should hold the "and, where applicable, verifies" language exactly as given, and only treat a channel as complete on configuration-alone when verification is genuinely impractical for that channel, not by default.

---

## E. Calendar implementation map

Explicit non-conflation, per approved spec §4:

| Concept | Table/column | Stage | Not to be confused with |
|---|---|---|---|
| **Business Hours** | (part of `venues` core profile fields, validated via `BusinessHoursStep`) | **Your Venue** | Tour Availability — this is general open/closed operating hours only |
| **Tour Availability** | `tour_scheduling_enabled` + `tour_duration_minutes`/`tour_min_notice_hours`/`tour_max_advance_days`/`tour_buffer_minutes` on `venues`, plus tour availability windows/exceptions (`lib/tours/service.ts`) | **Calendar & Availability** | Business Hours — this determines when *tours specifically* can be booked, separately configured, separately toggle-gated |
| **Event Spaces** | `venue_spaces` table | **Calendar & Availability** | — |
| **Scheduling Capacity** | `venue_capacity_rules` (max simultaneous events/tours, turnaround) | **Calendar & Availability** | — (see §C for its false-positive risk) |
| **Calendar (the actual operational calendar)** | `calendar_blocks`, `date_holds`, `tour_appointments`, `events`, `leads` (read via `checkAvailability`, `lib/availability/repository.ts:174-267`) | Not a setup stage — this is the day-to-day operational tool the *other* rows in this table configure the rules for | The setup stage configures the *rules*; the Calendar page itself is where those rules play out operationally, unchanged by this work |
| **Key Dates** | `client_key_dates` table, surfaced as an auto-generated calendar entry type (confirmed working this session via E2E test) | Not a setup concept — these are per-client milestones created after a client exists, unrelated to venue-level availability configuration | Should not be pulled into this stage; it's downstream of Bring Your Business/Your Offerings, not a setup input |
| **Client-facing scheduling behavior** | Same `tour_scheduling_enabled` gate — when off, the public tour-booking surface is simply unavailable (already how it works today, confirmed by the boolean's clean semantics in §C) | Governed by Calendar & Availability's Tour Availability sub-item | — |

The stage's completion signal (§B, Calendar & Availability) needs to represent "deliberately reviewed the concepts relevant to this venue's business" without conflating any of the rows above — a venue that reviews Business Hours during **Your Venue** has not thereby reviewed Tour Availability, Event Spaces, or Capacity, and vice versa; each needs to be independently, deliberately addressed or deferred within this one stage.

---

## F. Customer-facing venue-image audit

Every consumer of `hero_image_url`/`logo_url`, and its exact current fallback behavior:

### Hero image (`hero_image_url`)

| Surface | File:line | Fallback when null |
|---|---|---|
| Wedding website — Hero section | `components/wedding-website/wedding-website.tsx:1832-1837` | The couple's own `coverImageUrl` is tried first (venue image is a fallback of a fallback); if both null, falls to the active Color Story's CSS gradient (`tc.heroGradient`) — no image, but not blank either |
| Wedding website — Event Details section | `components/wedding-website/wedding-website.tsx:2506-2526` | Entire two-column photo block is omitted; layout collapses to one column. No gradient, no placeholder — the section simply doesn't render |
| Couple/client portal — Overview hero | `components/portal/portal-shell.tsx:1730,1754-1779` | A materially different decorative branch renders instead: dot pattern + two blurred color blooms + a `<FloralLineart />` SVG (vs. a simple dark gradient scrim when a photo exists) |
| Couple/client portal — Venue Guide tab | `components/portal/venue-guide-section.tsx:297-299` | Block omitted entirely, no fallback of any kind |
| Vendor portal — venue hero | `components/vendor-app/vendor-venue-hero.tsx:127-131` | A plain two-stop CSS gradient built from the venue's own brand colors (with hardcoded defaults if those are also null) |
| Brochure (public page) | `app/brochure/[token]/page.tsx:55-58` | `<img>` element omitted entirely |
| Brochure PDF | `lib/brochures/pdf.ts:73` | Image node omitted entirely, no reserved space |

### Logo (`logo_url`)

Every consumer found (dashboard header, all print documents — Calendar/Seating/Floor Plan/Day Sheet/Timeline — Brochure page+PDF, Sign/Contract page+PDF, Invoice, Event Order PDF, Inquiry/Questionnaire/Tour forms, couple portal header, vendor portal shell+hero, transactional email header) uses the identical `{logoUrl && <img ...>}` pattern: **omit entirely, no placeholder, no reserved space.**

**Two exceptions, both generic/shared components, not specific to these customer-facing surfaces:**
- `components/brand/wordmark.tsx:34-61` — the platform's own header wordmark falls back to the Hello to Cheers platform logo when the venue has none (a genuine branded-replacement fallback).
- `lib/venue-brand/favicon.tsx:37-49` — every `icon.tsx` across the app falls back to a solid neutral-taupe circle placeholder (explicitly *not* Hello to Cheers' own brand color, per its own code comment) when `logoUrl` is null or fails to fetch.

### Consistency verdict

**Not consistent.** Four distinct fallback families exist across the surfaces above (hide-the-block / theme-gradient-fill / rich-decorative-fallback / actual-placeholder-graphic), each independently implemented per component. No shared `VenueHero`/`VenueLogo` component exists — `wedding-website.tsx`, `portal-shell.tsx`, `venue-guide-section.tsx`, `vendor-venue-hero.tsx`, and `app/brochure/[token]/page.tsx` each inline their own conditional. The RPCs that supply this data (`get_wedding_website`, `get_portal_context`, `get_brochure_by_token`) pass the raw column through with no `COALESCE`/normalization — all null-handling is frontend-only.

**None of the surfaces produce a literally blank/broken box** (no unstyled `<img src="">`, no layout-shift-causing empty space with visible borders) — every path found either omits cleanly or substitutes something. So the approved spec's hard requirement ("no customer-facing experience should render an empty/broken hero/header") is **already true today**, just inconsistently, across four different treatments. Per instruction, no visual fallback is proposed here — this is reported as a decision point (§I #11): converge on one consistent smallest treatment, or leave as-is since nothing is currently broken.

---

## G. White Glove compatibility

What must exist now so White Glove can later use the same Setup Hub without a parallel system — grounded in the actual current architecture (see "Correction 1" above for why this differs from the initial assumption):

**Confirmed today:**
- `venue_enrollments.onboarding_type` (`'self_setup' | 'white_glove'`) exists and is set correctly at checkout (`app/api/internal/enrollment/upsert/route.ts:69,89`) — this is real provenance data.
- That provenance **does not currently propagate onto the `venues` row itself.** Repo-wide grep for `onboarding_type`/`is_white_glove`/`setup_type`/`white_glove` across all migrations returns zero hits outside `venue_enrollments`. Once `venue_enrollments` is joined away (which happens as soon as the venue exists — the enrollment row's only remaining link is `venue_id`), there is no column on `venues` itself, and no column on any future Setup Hub state table, that says how a given venue was onboarded.
- Both journeys create the `venues` row through the identical bare `activate_venue_enrollment` insert (owner_user_id/name/email only) — there is currently no code path where HQ staff pre-fill *any* Setup Hub field before the owner activates.

**What this means for the state model, concretely:**
1. The new Setup Hub state model (§B, and the new progress table/columns it requires) should carry `onboarding_type` (or a similar provenance marker) forward from `venue_enrollments` at venue-creation time, onto either the `venues` row or the new Hub state table — otherwise the "configured by venue vs. configured by HQ team" distinction the approved spec requires (§16) has no data to exist against.
2. Per-field/per-stage provenance (`configured_by_venue` / `configured_by_hq` / `reviewed_by_venue` / `accepted_by_venue`) is a materially bigger addition than a single venue-level flag — the approved spec's §16 language ("must be able to distinguish configured by venue / configured by HQ / reviewed by venue / accepted/confirmed by venue / still requiring venue attention") describes *per-stage* states, not one blanket flag. This reconciliation does not attempt to design that granularity — it's flagged as a real requirement the new state table's schema needs room for, not optional polish.
3. **The genuine open gap:** since HQ currently has no mechanism to touch a venue's real data before the owner activates, "White Glove configures the venue before the customer supplies assets" (approved spec §3's framing) isn't something today's code can do yet, full stop — independent of the Setup Hub. This is the same category of gap the separate White Glove Phase 1 spec is scoped to close (its workstreams B/C are exactly "get materials from the customer, land them in the existing Import Wizard/extraction pipelines an operator drives") — but that spec's own described operator flow doesn't yet specify *when*, mechanically, "Jennifer builds the workspace" happens relative to the real `venues` row's existence. This reconciliation surfaces the question; resolving it is a decision for whoever owns the White Glove spec's approval, not invented here (§I #10).

**Bottom line:** nothing about the approved Continuous Setup Experience architecture is blocked by this gap — a self-service venue's Setup Hub works today regardless. But building the Hub's state model without at least reserving room for `onboarding_type` provenance (point 1 above) would make the future White Glove integration require a schema migration to retrofit, which the approved spec's §16 explicitly wants to avoid ("do not create a state model that makes it impossible").

---

## H. Smart Fields audit

Full re-investigation, superseding the earlier lost-context flag. See "Correction 2" above for the headline finding. Detail:

**Terminology:** "Smart Field" as a literal term doesn't exist in the codebase. The implemented concept is "merge field" (`{{token}}` syntax), with a single shared engine (`lib/shared-merge/tokens.ts`, extracted from two previously-duplicated copies).

**Where it exists:**

| Domain | Field vocabulary | Insertion UI | Current interaction |
|---|---|---|---|
| Contracts (`components/contracts/template-form.tsx`) | `MERGE_FIELDS`, 26 fields (`lib/contracts/constants.ts:12-46`) | Yes — a picker panel, lines 188-205 | **Click-to-copy-to-clipboard.** `onClick` calls `navigator.clipboard.writeText(token)` + toast. No cursor-position tracking, no insert-at-cursor, no drag-and-drop. UI copy explicitly instructs manual typing/pasting ("Type these tokens in your template," "Click any field to copy it to your clipboard"). |
| Communication/Message Templates (`components/communication/template-form.tsx`) | `MESSAGE_MERGE_FIELDS`, 11 fields (`lib/message-templates/constants.ts:26-47`) | Yes — identical picker panel, lines 230-244 | Identical pattern, identical `copyToken()` implementation. |
| Event Order Templates | none | N/A | No merge-field concept exists in this domain at all |
| Questionnaire Templates | none | N/A | No merge-field concept exists in this domain at all |
| Brochures | none | N/A | No merge-field concept exists in this domain at all |

**Separately, a bulk-resolve mechanism exists** (`components/contracts/new-contract-form.tsx:80-98`, a "Merge" button calling `previewMergedContentAction`) that replaces the *entire* template body with all tokens resolved against real client/event data at once, at contract-creation time. This is not a per-field authoring-time insert and doesn't substitute for one.

**Confirmed via `git log -p --follow`:** the copy-to-clipboard pattern was the original, intentional design at the feature's introduction (commit `9c37a75`, "Sprint 15: Contracts — templates, generation, send workflow, e-signature"; commit message: *"Click any field token to copy to clipboard"*). No later commit attempted cursor-insertion, dropdown-insert, or drag-and-drop for either domain. Drag-and-drop patterns exist elsewhere in the app (pipeline stage reordering, seating chart, timeline template editor) but none are wired to merge fields.

**Conclusion:** the gap between current behavior (copy-to-clipboard) and the stated product intent (click-to-insert, no manual typing required) is real and unaddressed — but it is not a regression, not sandbox-specific, and has never been anything other than what it is today. Whether to fix this now, and whether the fix extends beyond Contracts/Communication into Event Order/Questionnaire/Brochures (where no merge-field concept exists at all yet), is a scope decision (§I #12), not something to redesign here per the "do not redesign without approval" instruction.

---

## I. Remaining decisions

Only genuinely open items — filtered against what this reconciliation resolved. Each is answerable without writing code.

1. **Client Experience scope** — which of Contract Templates / Questionnaire Templates / Message Templates / Planning Templates (Playbooks) belong in this stage, confirmed exhaustively (not "and other relevant Library content," which isn't a bounded scope). Client Experience ≠ Wedding Website is already decided by the approved spec; this decision is the inclusion list among the four candidates above.
2. **Calendar & Availability completion mechanism** — the exact "smallest truthful persisted state" representing deliberate review, specifically solving the Capacity Rules ambiguity (UI defaults = DB defaults, so row-existence can't be trusted alone). A "reviewed" timestamp distinct from "saved" is one candidate; not proposed as the answer, just the shape of what's needed.
3. **Bring Your Business — "manual" persistence mechanism** — new `venues`/Hub-state column, vs. a synthetic `import_batches` row (would need a new `entity_type` value or a parallel mechanism, since `import_batches.entity_type` is currently constrained to the five real import entities).
4. **Your Offerings — inventory starter-exclusion fix** — add `source_master_key` to `inventory_items` directly (schema change, most precise), join through `category_id → inventory_categories.source_master_key` (no schema change, misses one-off items not seeded via the standard catalog), or accept a coarser signal for this one domain.
5. ~~Lead Capture completion characterization~~ — **RESOLVED.** See §B/§D for the approved model: configure-and-verify-where-practical ≥1 intended channel, OR an explicit manual/external declaration. Neither path requires unused channels to be touched.
6. **Your Team completion bar** — for a venue that does invite staff, does the stage complete on invite-sent or invite-accepted? For a solo venue, is the deliberate "just me" acknowledgment sufficient on its own, with no further gate?
7. **Financials acknowledgment mechanism** — what specifically satisfies "deliberate review," beyond just visiting the stage — a single click-through, a short "what these tools are for" confirmation, something else?
8. **Ready to Invite Couples — exact trigger** — a literal button/action the owner takes, its copy (not to be invented per §23), and whether/how it's surfaced (Setup Review screen, a persistent Hub-level affordance, both).
9. **Hub placement** — dedicated persistent route reachable from nav at all times, vs. dashboard-embedded module. ("Persistent" in the approved spec strongly implies a real destination, but this wasn't explicitly confirmed as a route-level decision.)
10. **White Glove pre-activation configuration mechanism** — per §G: no code path today lets HQ staff write real product data into a venue before the owner activates, since the `venues` row doesn't exist until then. This needs a decision independent of (but adjacent to) the separately-pending White Glove Phase 1 spec: does "Jennifer builds the workspace" happen via a staff-proxy session against a not-yet-activated venue, does venue creation move earlier in the White Glove flow (before owner activation), or something else?
11. **Venue-image fallback consistency** — four different existing fallback treatments were found (hide-block / theme-gradient / rich-decorative / placeholder-graphic), none of them broken, all of them different. Converge on one smallest consistent treatment, or leave the current per-surface variation as acceptable? No visual design is proposed here per instruction.
12. **Smart Fields fix scope** — confirm click-to-insert-at-cursor (or another specific mechanism) as the target interaction, and confirm whether the fix is Contracts + Communication Templates only, or also extends merge-field support into Event Order/Questionnaire/Brochure Templates where the concept doesn't exist yet at all (that would be new scope, not a fix, and should be named as such if approved).

---

## Implementation sequence & blocker assessment

Authorization to proceed is granted with only decision #5 (Lead Capture) explicitly resolved; decisions #1–4, #6–9, #11–12 remain individually open. Reconciling that against "proceed with implementation": nothing in §I blocks *starting*. Each remaining open decision blocks only the specific stage(s) it governs, and only the exact moment that stage's **completion gate** needs to be computed — not the stage's existence, its reuse of existing components, its data display, or its editability. So implementation proceeds in the order below, doing real, complete work at each phase, and stopping short of inventing a completion rule only where §I is still open.

**Phase 1 — Correct false-positive setup signals (§C).** No open decision blocks this. Add `source_master_key IS NULL` filtering to the counts that already have the column (`packages`, `contract_templates`, `message_templates`) inside `getSetupReadyCounts` or its successor. `inventory_items` stays blocked on decision #4 specifically — leave its count as-is (documented as a known limitation) rather than inventing a join-based approximation.

**Phase 2 — Persistent Setup Hub state model + route shell.** No open decision blocks the *shape* of this: a new state table separate from `setupCompleted`/`onboardingDismissed`/`setup_last_step` (per §B's "Ready to Invite Couples" and the Hub-wide principle that nothing repurposes those fields), with room reserved for the `onboarding_type` provenance column per §G's finding — needed regardless of how decision #10 (White Glove pre-activation mechanism) eventually resolves, since adding it now costs nothing and retrofitting it later costs a migration. Decision #9 (dedicated route vs. dashboard-embedded) does need an answer before this phase's route/page structure is built — treated as resolved-by-implication: "persistent Business Setup Hub" (approved spec §2) reads as a real, nav-reachable destination, consistent with "the venue should be able to... enter an area, leave it, return later." Building it as a dedicated route is the natural reading; flagged here as an inference, not a re-litigation.

**Phase 3 — Connect existing domains, stage by stage:**
- **Lead Capture** — fully specified now (§D). Build completely, including the real completion gate.
- **Your Venue, Calendar & Availability, Bring Your Business, Your Offerings, Client Experience, Your Team, Financials** — for each, build the stage's presence in the Hub (reachable, reuses the exact existing components named in §A, shows live truthful state, fully editable, revisitable) **without** asserting a fabricated completion checkmark where §I's corresponding decision (#1–4, #6, #7, plus the Your Venue image-requirement question) is still open. A stage without an approved completion rule shows its real underlying state honestly (e.g., "3 packages, all starters" / "Stripe not connected") and stays visually distinct from "done" — it does not block the venue, and it does not lie about being complete either. This is the direct implementation of "truthful progress" (approved spec §19) applied to the implementation process itself, not just the product.

**Phases 4–6 — Setup Review, Ready to Invite Couples, Activation gating.** Setup Review (Phase 4) can be built now — it's a read/aggregation layer, not a new rule. Ready to Invite Couples (Phase 5) needs decision #8 (exact trigger) before its action/copy can be wired, though the schema for it (Phase 2) doesn't need to wait. Activation gating (Phase 6) is a small, mechanical change once Phase 5 exists (swap what gates the dashboard's Activation card from `!onboardingDismissed` to the new readiness field) and isn't blocked by anything else.

**Phases 7–9 (Help/Luv integration, revisitability audit, White Glove compatibility verification)** proceed after the above, unchanged from the approved spec's own sequencing — none are blocked by anything found in this reconciliation.

**No genuine technical blocker exists to beginning implementation now.** The open items in §I are product decisions gating specific completion rules, not technical obstacles — every one of them can be answered without new investigation, and none of them prevent the structural work (schema, routing, component reuse, honest state display) from proceeding in parallel.

**Explicitly out of scope for this implementation, per this session's direction:** the White Glove pre-activation mechanism (decision #10) and the Smart Fields/merge-field interaction fix (decision #12) are both separate, future work — not touched here.

---

**STOP for re-approval only if:** an implementation detail surfaces that isn't covered by the approved spec, this document, or reasonable reuse of existing patterns. Otherwise, proceeding directly per the phases above.
