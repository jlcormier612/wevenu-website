# Switching Without Pain — Migration, Import & Operational Cutover Foundation

**Workstream:** A (Migration architecture, historical import, source profiles, normalization, dedupe/conflict, import sessions, import history, white-glove capability, operational readiness model).
**Status:** Architecture report only. Awaiting review. Not yet authorized for broad implementation.
**Source of truth:** `docs/` "Switching Without Pain" research (external source verification: The Knot/WeddingWire, Planning Pod, HoneyBook, Weven, Meta Lead Ads) plus fresh, direct source/database audit performed for this report.
**Type:** Audit + architecture proposal. No source, schema, migrations, UI, tests, or data have been changed in producing this document, except where explicitly noted in §G.

Evidence labels used throughout, matching this repo's established convention: **VERIFIED FROM SOURCE** / **VERIFIED FROM DATABASE** / **UNVERIFIED**.

---

## Ownership boundary (restated)

**Own:** migration architecture, historical data import architecture, source profiles/adapters, file ingestion, source recognition, normalization, mapping, validation, duplicate detection, conflict handling, import sessions/jobs, progress/resume, import history, safe rollback/undo, white-glove/admin-assisted migration, the operational-readiness/cutover model.

**Do not own, do not touch, do not duplicate:** Facebook/Instagram webhook delivery, QR capture, website inquiry capture, email-forwarding, HoneyBook/Zapier *live* forwarding, general Lead Intake UI, GA4. Where these appear below it is only as an existing, unmodified dependency or a source-matrix fact.

---

## A. Current-State Audit

### A.1 — The canonical Lead Intake pipeline (re-verified)

**VERIFIED FROM SOURCE.** `ingestLead()` (`lib/lead-intake/pipeline.ts:28-116`) remains the single TS orchestrator; `public.ingest_lead()` (`supabase/migrations/20261110000000_lead_intake_architecture.sql:202-274`) remains the *only* writer of `public.leads` — confirmed by grepping every `.from("leads")` call site (all `.select`/`.update`, zero `.insert`) and every migration containing `insert into public.leads` (9 hits, all inside function bodies superseded by `create or replace` before the canonical migration). `create_lead_atomic` (`20261151000000_white_glove_lead_venue_override.sql:18-48`) is a thin wrapper adding `p_venue_id_override`, honored only when `auth.role() = 'service_role'` — the existing white-glove mechanism for leads specifically (see A.2).

`lead_sources` already reserves a `category = 'import'` vocabulary slot. `lead_intake_attempts` already has `trust_tier` values `'import'` and `'manual'`, and a real idempotency key: unique index on `(source, external_ref) where external_ref is not null` (`20261110000000...sql:99,123-124`). `find_or_create_relationship` (`:148-194`) is exact-match only: email if present (`(venue_id, lower(email))`), else exact first+last name **restricted to no-email rows** — no fuzzy/phonetic matching anywhere in this path.

**Implication for this report:** the relationship/lead layer already has almost everything a migration engine needs at the identity layer. Nothing here needs to change.

### A.2 — Import infrastructure that already exists (materially more than "a CSV uploader")

**VERIFIED FROM SOURCE.** Five entity types — `couples | leads | vendors | inventory | packages` (`lib/import/types.ts:1`) — each importing through the **same canonical create function** every other UI surface uses (`createClientCore`, `createLeadCore`→`ingestLead()`, vendor/inventory/package repository creates). No bypass insert path exists anywhere in the import code.

**A genuinely surprising finding, correcting the working assumption going into this audit:** a white-glove/admin-assisted import path is not a gap — **it already exists and is live**: `app/admin/onboarding/[venueId]/page.tsx` embeds the exact same `<ImportWizard venueId={venueId} />` component self-serve venues use, gated by `requireAdminUser()`, writing via `createAdminClient()` (service-role) through `create_client_atomic`/`create_vendor_atomic`/`create_lead_atomic`'s `p_venue_id_override` (honored only for `service_role`, silently ignored for a real session — `20261141000000_white_glove_atomic_venue_override.sql:30-48,118-132`). Every batch it creates is stamped `imported_by_type: 'hq_staff'`, `imported_by` = the HQ admin's own id (never the venue's), linked to `venue_onboarding_engagements` (`lib/import/batches.ts:72-94`). The page's own comment: *"The exact same Migration Center wizard the venue would run themselves — every write lands in their venue, not yours."* It even self-documents its own resumability gap: *"Guided Setup resumability — §1.2's real resumable-wizard-step system isn't built yet."*

**Where the real gaps are**, all **VERIFIED FROM SOURCE**:

| Capability | Current state |
|---|---|
| Sync vs. async | Fully synchronous — one server action loops and `await`s each row sequentially. No queue/job table exists anywhere (grepped `import_queue`/`import_jobs`/`job_queue` — zero matches). |
| Size ceiling | Next.js 16.2.9's default 1MB Server Action body limit is never overridden (`next.config.ts` has no `bodySizeLimit`). CSV parses client-side (bypassing this at parse time) but the **entire parsed row array is still sent as the commit action's argument**, so even CSV is bounded by ~1MB at commit — regardless of source format. |
| File retention | Not retained. `file-parsing.ts` operates only on in-memory buffers; zero `.storage` calls anywhere in the import path. |
| Preview | Client-side, first 5 rows only (`import-wizard.tsx:452`); aggregate ready/issue counts are computed over all rows, but only 5 are ever shown. |
| Duplicate detection | Exists for all 5 entity types — case-insensitive exact/`ilike` match only, **never fuzzy**. Outcome on match: always silently **skipped**, never merged, never queued for review — just an error-row line in the results CSV. |
| **Vendor dedup — sharpest concrete gap found** | `vendors` is a global (no `venue_id`) table since a 2026 refactor. `create_vendor_atomic` **unconditionally inserts a new global vendor row every call** — there is no existing-vendor lookup at all, not even within one venue. This is a real gap today (manual "Add Vendor" has the same exposure); migration at volume will make it materially worse. |
| Resumability | None. No persisted row-level progress. If interrupted, whatever rows already committed stay committed, but nothing records where the run stopped. |
| Import history UI | `import_batches` already tracks row/imported/skipped/error counts and rollback state (`20261139000000_migration_center_foundation.sql:20-41`) — but **`getImportBatchesAction` has zero callers anywhere in the UI**. The only other reader, `app/(app)/setup-hub/page.tsx:34`, reduces the entire table to one boolean (`hasImportedData`). No batch-by-batch or record-by-record history view exists for anyone, venue or HQ. |
| Source metadata | Only aggregate/batch-level (`source_label` free text, e.g. "Weven"). No per-record raw payload, no per-record original source ID, is retained for any entity type except leads (which get `lead_intake_attempts.raw_payload`, a *Lead Intake* feature, not an import-general one). |
| Source-aware parsing | **Not found anywhere.** `source_label` is a user-picked label from a fixed 5-option list, never used to branch parsing/mapping logic. Field mapping is generic string-similarity plus opt-in, suggest-only Claude assistance (`lib/luv/import-assist.ts` — confirmed never auto-commits). No code anywhere detects "this looks like a HoneyBook export." |
| Quiet/historical commit mode | **Does not exist, and this is an active risk for a historical-migration tool specifically.** `createClientCore` unconditionally sends a real portal-invite email whenever the imported row has an email (`lib/clients/service.ts:193-195`). Imported leads use `trustTier: "import"`, which is **not** exempted from automatic message-sequence enrollment (only `"email_parsed"` is) — so a bulk historical import today would fire live customer-facing emails and automation for every migrated client/lead with an email address. |

### A.3 — Setup Hub / readiness (re-verified against the actual product, not assumed)

**VERIFIED FROM SOURCE.** Eight stages (`lib/setup-hub/stage-copy.ts`, `venue_setup_hub_state`, `20261295000000_setup_hub_state.sql`). Critically: **graduation is not "all stages complete."** It is one independent, owner-clicked boolean, `ready_to_invite_couples`, set via `setup-readiness.tsx:118-120` with the UI copy *"You don't need everything above finished to say yes"* and the code comment *"readiness is the owner's own deliberate call, not something computed for them."* This flag alone gates the rest of the app (`app/(app)/layout.tsx:58-78`). No server-side check exists that any stage — required or not — is actually complete before it can be set true.

Five of eight stages accept a bare click-through ("This looks good for now," "It's just me for now") as fully equivalent to real completion. Only Lead Capture has a semi-functional check (`computeLeadCaptureComplete()`), and even "verified" there means the owner self-reports having tested it — no server-side confirmation a test inquiry arrived. The `financials` stage is explicitly optional (`required: false`) — a venue can graduate having connected no payment processor at all.

A separate, legacy "Activation Engine" gap-checklist exists but is **explicitly suppressed on the Setup Hub path** (`lib/dashboard/service.ts:566-573`, comment: *"Never shown at all on the Setup Hub path"*) — except it still surfaces, unmodified, inside the HQ admin onboarding workspace (`app/admin/onboarding/[venueId]/page.tsx:50`, comment noting it is *"not yet the step-by-step resumability"* system). **No signal anywhere in the product — Setup Hub, dashboard, or HQ admin view — currently distinguishes "clicked through the checklist" from "can actually run a real inquiry through a real workflow."** This is the precise gap §D below addresses.

The `bring-your-business` Setup Hub stage links directly to `/settings/import` (`setup-hub-overview.tsx:109`) — i.e., **today's one and only migration entry point in the product is the generic 5-entity CSV wizard audited in A.2**, satisfied either by a real import or by a bare click-through (`bringYourBusinessManualConfirmedAt`).

Onboarding-path selection already exists at two independent points, both **VERIFIED FROM SOURCE**: (1) pre-purchase, marketing-site choice of `self_guided` vs `white_glove` (`marketing/lib/marketing/onboarding-packages.ts:40-61`), which sets `venue_enrollments.onboarding_type` and materially changes backend routing (white-glove venues get no activation URL and land in the HQ onboarding queue instead); (2) in the **old**, pre-Setup-Hub `/setup` wizard only, `PathChoiceStep` ("I'm starting fresh" vs. "I'm bringing my business with me") → `BringYourBusinessStep`, which already asks Weven / another platform ("HoneyBook, Aisle Planner, or anything similar") / spreadsheets / files / manual — a rudimentary source picker with **zero parsing intelligence behind it today**, routing everything into the same generic `ImportWizard`.

### A.4 — Domain model readiness for migration (by entity)

**VERIFIED FROM DATABASE**, condensed:

| Entity | Venue-scoped? | Idempotency key today | Jsonb/source metadata | FK prerequisites for import ordering |
|---|---|---|---|---|
| `venue_customer_relationships` | Yes | **Yes** — `(venue_id, lower(email)) where email is not null` | None | — |
| `clients` | Yes | None (app-level exact match only) | None | `venue_id`; `relationship_id` auto-resolved by `create_client_atomic` |
| `leads` | Yes | **Yes** — `lead_intake_attempts(source, external_ref)` | `source_data jsonb` (leads only) | `venue_id`; relationship auto-resolved |
| `events` | Yes | None | None | `venue_id` only (`client_id` optional) |
| `vendors` | **No — global table** | **None at all** — real, sharpest gap | None | must also write `venue_vendor_relationships` to become visible to any venue |
| `contracts` | Yes | None (`sign_token` is system-generated, not usable) | One jsonb, presentation-only (`branding_snapshot`) | `venue_id`; concurrent unrelated refactor in progress on this branch (`lib/contracts/*` — noted, not touched by this report) |
| `payment_schedules`/`payment_line_items` | Yes | None generic; Stripe/QuickBooks each have their own external-id column as precedent | None | `payment_schedules` needs `venue_id`; line items need an existing `schedule_id` |
| `documents` | Yes | None | `tags text[]` (free, unconstrained) | `venue_id` only — **a venue-level row with all four entity FKs null is a confirmed-supported pattern** (loosened from exactly-one to at-most-one by `20260728000000...sql:19-25`, comment: *"A row with all four null is now valid: a reusable, venue-owned document."*) |
| Message templates, questionnaires, playbooks | Yes | None | None | `venue_id` only |
| `venue_staff` | Yes | One-owner-per-venue unique index | None | `venue_id`; `user_id` nullable — staff can be imported before the person has an auth account |

**Only two entities have a real DB-level idempotency key today**: relationships (by email) and lead-intake attempts (by source+external_ref). Every other entity relies entirely on application-level exact matching, and vendors have none at all.

### A.5 — HQ admin / tenant-boundary precedent (already real, reusable as-is)

**VERIFIED FROM SOURCE.** `hq_admins` + `is_hq_admin()`/`current_hq_admin_role()` (`20260710020000_sprint108_5_hq_admins.sql`), gated at `app/admin/layout.tsx`. Tenant boundaries preserved two ways, both already proven: (1) additive RLS SELECT policies on `clients`/`vendors`/`venues`/etc., OR'd with the existing per-venue policy so an HQ admin gains read access without weakening a venue user's own policy; (2) explicit RPC guard clauses rejecting a cross-venue write unless `auth.role() = 'service_role'` or `is_hq_admin()`. "View-as" (`app/admin/venues/[venueId]/view-as/page.tsx`) is explicitly read-only today — real in-session impersonation is a named, deliberately-unbuilt future phase, not something this report should build. **This is the exact precedent the migration architecture below reuses — no new authorization concept is proposed anywhere in §B.**

### A.6 — Copy audit: The Knot, WeddingWire, Planning Pod, HoneyBook, Weven

**VERIFIED FROM SOURCE. No actively misleading language was found anywhere in the product.** Full findings:

- **The Knot / WeddingWire**: mentioned only in `components/settings/email-intake-section.tsx:14-15,80-82` — honest email-forwarding instructions ("Forward inquiry notifications from The Knot, WeddingWire, or anywhere else that emails you a new inquiry"), with correct per-platform steps (Storefront → Settings → Notifications, etc.). No connection implied.
- **Weven**: mentioned only in the old `/setup` wizard's `BringYourBusinessStep` (`components/setup/setup-migration-steps.tsx:85-88,328-329`) — copy says *"Upload a CSV or Excel export... and we'll help map it into place."* Honest.
- **HoneyBook**: mentioned once, bundled under "Another platform" (*"HoneyBook, Aisle Planner, or anything similar"*, same file, line 91) — same honest upload-your-export framing, no live-connection claim.
- **Planning Pod**: **not mentioned anywhere in the codebase** (confirmed by case-insensitive grep across all `.ts`/`.tsx`/`.sql` files — zero results). Not misleading; simply absent. It currently falls under the generic "Another platform" bucket.

**Conclusion for the "narrowly scoped correction" question (§G below): none required.** Every existing reference to these five platforms is already honestly scoped to email-forwarding or export-upload — the product has not overclaimed. The real gap is the one this report exists to close: none of these sources get *intelligent*, source-aware handling once uploaded — everything lands in the same generic parser.

---

## B. Proposed Architecture

Guiding constraint, restated: extend `import_batches`/`lib/import/*`/the canonical create functions — do not replace them, do not create a parallel entity model. Every new table below is either a session/orchestration layer sitting *above* what exists, or a staging/audit layer sitting *between* a source file and the existing create functions.

### B.1 — Source Profile

New reference table `source_profiles`, following the exact pattern already established by `lead_sources` (a registry table, not a CHECK-constraint enum — extensible via one INSERT):

```
key                       text primary key      -- e.g. 'planning_pod', 'honeybook', 'weven_legacy',
                                                  --      'the_knot', 'weddingwire', 'generic_csv'
display_name              text not null
has_direct_connection     boolean not null default false  -- historical retrieval via real API/OAuth
forward_only              boolean not null default false  -- new-record forwarding exists, history does not
                                                            -- (describes the SOURCE's reality; the forwarding
                                                            --  mechanism itself, e.g. HoneyBook/Zapier, is owned
                                                            --  by a separate, already-scoped workstream)
export_assisted           boolean not null default true   -- customer can produce a file we intelligently parse
white_glove_recommended   boolean not null default false
supported_file_types      text[] not null default '{}'
has_known_parser          boolean not null default false  -- true once a source-specific adapter exists in code
historical_limitations    text                             -- free text, e.g. Meta's 90-day cap, Weven's non-existence
is_enabled                boolean not null default true
```

**Hard rule, enforced structurally, not just by convention:** every existing and future source in this table starts `has_direct_connection = false`, because none of the five researched sources has one. UI copy describing a source must be *generated from these flags*, never hand-written per source — this is what makes the Setup-Hub-style "implies more than we do" failure mode structurally harder to reintroduce, per the explicit instruction in the governing request.

A parallel TS registry, `lib/migration/source-profiles.ts`, maps each `key` to its parser/adapter implementation (mirroring the DB-row-for-attribution / TS-code-for-behavior split `lead_sources` already established). Adding a new source is one migration INSERT plus one adapter file — never a Migration Center redesign.

### B.2 — Import Session

**Key design decision:** introduce a new `migration_sessions` table as the orchestration/resumability layer, and **keep `import_batches` exactly as it is today**, adding one nullable `migration_session_id` FK. Every self-serve import that doesn't go through the new Migration Center flow continues to work completely unchanged, with that column simply null.

```
migration_sessions
  id, venue_id (required), source_key (FK source_profiles),
  status  check (uploaded | recognizing | mapping | validating |
                 ready_for_review | committing | committed |
                 partially_committed | failed | abandoned),
  created_by_type check (venue | hq_staff),   -- mirrors import_batches.imported_by_type exactly
  created_by, engagement_id (nullable FK venue_onboarding_engagements, reused as-is),
  started_at, last_activity_at, completed_at, resumable boolean default true

migration_session_documents   -- join table, NOT a new FK on `documents`
  session_id (FK), document_id (FK documents)
```

Uploaded artifacts are stored as ordinary venue-level `documents` rows (all four entity FKs null — the already-confirmed-supported pattern from A.4), tagged `tags @> ARRAY['migration_artifact']`, linked via the join table above. This closes the "original file never retained" gap using the exact mechanism already proven for White Glove intake materials, with zero changes to the `documents` table itself.

### B.3 — Canonical Normalization Layer

New table `migration_records` — the explicit boundary between a source file and a real product entity:

```
migration_records
  id, session_id (FK), source_row_ref (row/sheet locator, for traceability),
  raw_payload jsonb,          -- verbatim source data
  target_entity_type check (client | lead | vendor | event | payment | document | ...),
  normalized_payload jsonb,   -- canonical-shape candidate, post source-specific parsing
  status check (parsed | normalized | validated | duplicate_exact | duplicate_likely |
                conflict | needs_review | approved | rejected | committed | skipped),
  match_type check (none | exact | likely), matched_entity_id, match_confidence,
  conflict_fields jsonb, validation_errors jsonb,
  created_entity_id,          -- filled in only once actually committed
  reviewed_by, reviewed_at, committed_at
```

Pipeline, restated as the explicit boundary requested: **source-specific parser** (a `lib/migration/sources/<key>.ts` adapter, `raw_payload → normalized_payload`) → **validation/dedupe** (status/match_type/conflict_fields, reusing existing `findActiveDuplicate*` functions as the exact-match tier) → **canonical product entity**, created only by calling the *existing, unmodified* `createClientCore`/`createLeadCore`(→`ingestLead()`)/`createVendorForVenue`/etc. — `migration_records` is a staging/audit record, never a second representation of a client, lead, vendor, or event. Nothing is created outside those existing functions.

### B.4 — Duplicate & Conflict Strategy

Reuse existing exact-match functions as-is for the exact tier (they're correct and require no changes). Add a "likely match" tier only where the audit found a real gap:

- **Vendors (the sharp gap, A.2):** no idempotency key exists at all today. Recommend a likely-match signal — normalized `business_name` + (email OR phone) — surfaced for human review, **never auto-merged**. Note explicitly: this is a pre-existing correctness gap in manual vendor creation too, not migration-specific; fixing it at the `create_vendor_atomic` level is arguably out of this workstream's scope and worth flagging to whoever owns vendor architecture, but migration must not make it worse silently.
- **Relationships:** no new tier needed — `find_or_create_relationship`'s existing rule is safe and idempotent; migration records route through it unchanged.
- **Multiple contacts within one couple/client (the explicit ask):** `client_contacts.client_id` is `NOT NULL`, so a second person discovered mid-migration has nowhere to go until the primary `clients` row exists. Handled by session **sequencing**, not a schema change: `normalized_payload` holds both people; commit creates the primary relationship/client first, then the second `client_contacts` row immediately after, in the same session.
- **Source IDs / repeat-import idempotency:** when a source export includes its own record ID (common for Planning Pod/HoneyBook-style platforms), it's captured in `raw_payload`. A repeat import for the same venue+source can then be checked against previously-committed `migration_records.raw_payload->>'source_id'` **before** falling back to name/email matching — cheaper, more precise, and the closest this system gets to true idempotency without a schema change to every target table. This does not achieve 100% idempotency for every source (not all exports carry stable IDs), but is honest about exactly where it does.
- Every `conflict`-status record requires an explicit human decision — never auto-resolved. This extends, rather than invents, the principle already established in the sibling White Glove research (*"cross-document conflict — always surface to a human, never auto-resolve"*).

### B.5 — Preview and Commit

Session reaches `ready_for_review` only after every record has an explicit `migration_records.status`. The review surface — one data model, viewed through either a venue self-serve UI or the HQ admin surface, never two backends — shows counts grouped by `target_entity_type` × status: what's approved and will be created, what matched an existing record and will be skipped (showing the match), what's a likely match or conflict needing a decision, what failed validation and why. **Nothing commits silently; nothing is dropped without an explicit, visible status.**

### B.6 — Import History

The gap here is UI, not data — `import_batches` already tracks nearly everything needed; it simply has no reader (A.2). `migration_sessions` adds the missing "which source, which files, spanning how many entity types, as one coherent event" umbrella over the `import_batches` rows it produces (each batch gains the new nullable `migration_session_id`). "What happened to this specific source record" is answered directly by querying `migration_records` for a session. Safe rerun is governed by session `status` plus the source-ID short-circuit in B.4; a `committed` session is viewable but not resumable (it's done), a `failed`/`abandoned` one resumes from wherever it stopped — `created_entity_id` being non-null on a record *is* the resume checkpoint, no separate cursor concept needed.

### B.7 — White-Glove / Admin-Assisted Capability

Reuses A.5's infrastructure wholesale — no new authorization concept. `migration_sessions`/`migration_records` RLS mirrors the existing additive-policy pattern (`clients_hq_select`-style) exactly: a venue sees only its own sessions; an HQ admin sees any venue's via the same `is_hq_admin()` OR-clause already proven. The concrete integration point is `app/admin/onboarding/[venueId]/page.tsx` — its current `<ImportWizard venueId={venueId} />` embed becomes the future swap-in point for the session-based UI (§F, Slice 8) once self-serve has proven the model. Inspecting uploaded data, recognition/mapping/validation results, duplicates/conflicts, retrying, resuming, and seeing exactly what has/hasn't imported are all direct reads of the B.2/B.3 model — the white-glove case needs no separate backend, satisfying "these are transition strategies, not three different product architectures" at the data-model level, not just conceptually.

### B.8 — Weven-Aware Legacy Profile (special case, not special architecture)

`source_profiles` row: `key: 'weven_legacy'`, `has_direct_connection: false`, `forward_only: false`, `export_assisted: true`, `white_glove_recommended: true`, `historical_limitations: 'Weven was acquired by The Knot Worldwide in 2022 and no longer operates independently; no live account exists to connect to. Coverage depends entirely on whatever export or file a venue happened to retain.'` A `weven_legacy` adapter in `lib/migration/sources/` can encode known Weven column names/terminology directly — this is domain-knowledge content work, not a new architectural pattern; B.1's adapter registry already accommodates it exactly like any other source. `has_direct_connection: false` being enforced at the copy-generation layer (B.1) is what structurally prevents ever implying a live Weven connection, rather than relying on someone remembering not to write that copy.

---

## C. Source Matrix

Carried forward from the prior "Switching Without Pain" research (externally verified there), reclassified into this report's `source_profiles` vocabulary:

| Source | `has_direct_connection` | `forward_only` | `export_assisted` | Historical coverage | Accurate customer-facing language |
|---|---|---|---|---|---|
| The Knot / WeddingWire | false | false (email-forward exists, owned by Lead Intake, not migration) | true | Whatever the venue can manually export/copy; no official bulk export confirmed | "Forward new inquiries by email. For your history, upload whatever you're able to export or copy from your account." |
| Planning Pod | false | false (Zapier possible, unverified for bulk history) | true | Unknown until a real export is seen — no adapter built yet | "Upload your Planning Pod export and we'll help map it in." |
| HoneyBook | false | true (Zapier "New Inquiry Created" — owned elsewhere, forward-only by platform design) | true | Zapier cannot backfill; history is upload-only | "New inquiries can forward automatically once that's connected. For your existing history, upload an export." |
| Weven (legacy) | false | false | true, if the venue retained one | No live platform exists at all (acquired by The Knot Worldwide, 2022) | "Weven isn't around anymore, but if you kept an export or file, we can help bring it in." |
| Facebook / Instagram Lead Ads | true (owned by a separate workstream) | — | — | 90-day platform-side hard cap (Meta's own retention limit) | Not this workstream's copy to write — reference only |

---

## D. Operational Readiness Model

**Do not gate or replace Setup Hub's graduation flag** — `ready_to_invite_couples` is a deliberate, explicit, reversible owner decision, correctly designed as self-declared per A.3, and the governing request explicitly rejects a mandatory checklist. Instead, add a **separate, non-blocking, computed** diagnostic that answers *"what still prevents this venue from confidently running its next inquiry"* — informational, not a gate, visible alongside (never instead of) the existing graduation flag:

| Readiness domain | Computed from real state (not a click-through) |
|---|---|
| Lead capture | At least one channel in `venue_lead_capture_channels` has `configured_at` set (reuses Setup Hub's own, already-granular data) |
| Tour/availability | If tour scheduling is enabled, at least one real row exists in `tour_availability_windows` |
| Packages/pricing | Real `packages` row count > 0 — not the current OR-with-click-through Setup Hub accepts |
| Proposal/contract | At least one non-archived contract template exists |
| Payment capability | Stripe connected, or an explicit "I'll invoice manually" acknowledgment — a genuine either/or, not "optional and silently ignored" the way the current `financials` stage behaves |
| Planning/playbooks | At least one planning template exists |
| Communication templates | At least one message template exists |
| Team/permissions | Real accepted `venue_staff` count > 0, or the existing solo-operator acknowledgment |

This is deliberately **not** a new mandatory gate and **not** a full checklist rebuild — it's a read model over data that (mostly) already exists, surfaced once, wherever a diagnostic naturally belongs (e.g., a dashboard card), that a venue or Jennifer can use to answer the real question Setup Hub's self-declared flag cannot: is there actually a package to quote, a contract to send, a way to get paid, right now, for the next real inquiry.

**Transition strategies map onto one engine, not three:**
- **Accelerated** — one or a few large `migration_sessions`, run close together ahead of go-live, covering as much practical history as the source allows.
- **Progressive** — new inquiries flow through the separately-owned live intake channels from day one, while smaller/staged `migration_sessions` continue per entity type or time range at the venue's own pace.
- **White-glove** — identical session model, `created_by_type: 'hq_staff'`, driven from the HQ admin surface.

All three literally reuse the same `migration_sessions`/`migration_records` engine from §B — the difference is operational cadence and who drives it, never a different backend.

---

## E. Explicit Implementation Boundaries

**New, owned by this workstream:**
- Migrations: `source_profiles`, `migration_sessions`, `migration_session_documents`, `migration_records`, plus one additive nullable `migration_session_id` column on `import_batches`.
- `lib/migration/` (new): `types.ts`, `service.ts`, `repository.ts`, `normalize.ts`, `dedupe.ts`, `source-profiles.ts`, `sources/{generic_csv,honeybook,planning_pod,weven_legacy,the_knot,weddingwire}.ts`.

**Reused, unmodified:** `ingestLead()`/`ingest_lead()`, `lead_sources`, `find_or_create_relationship`, `createClientCore`/`createClientForVenue`, `createVendorForVenue`, `createItemForVenue`, `createPackageForVenue`, `hq_admins`/`is_hq_admin()`, `requireAdminUser()`, `createAdminClient()`, the `p_venue_id_override` RPC pattern, the `documents` table/bucket, `import_batches` (extended, not restructured), `lib/import/*` (called, not modified, in early slices).

**Explicitly not touched, not redesigned, not duplicated:** `lib/facebook/*`, `app/api/facebook/*` (webhook delivery), `lib/qr-campaigns/*`, `app/qr/*`, `app/api/public/inquire/*`, `app/api/tours/book/*`, `lib/lead-intake/email-*`, `app/api/leads/email-intake/*`, `components/settings/email-intake-section.tsx`, any HoneyBook/Zapier live-forwarding build, GA4, general Lead Intake UI, `lib/contracts/*` (concurrent unrelated refactor in progress on this branch — noted in A.4, left alone).

---

## F. Recommended Implementation Slices

Each independently shippable and testable; schema changes throughout are additive only (no feature flag evidenced as necessary — existing `/settings/import` behavior is untouched until a slice explicitly points at the new flow).

1. **`source_profiles` table + seed data + TS registry interface.** No behavior change — purely descriptive. Lets any copy (Setup Hub, Settings) start reading honest capability flags instead of hand-written strings, closing the overclaim risk structurally before sessions even exist.
2. **`migration_sessions` + `migration_records` + artifact-linking, with a `generic_csv` adapter functionally equivalent to today's wizard.** Proves the session/record model end-to-end against the simplest case — parse → normalize (pass-through) → exact-dedupe (reuse existing functions) → preview → commit via existing create functions → linked `import_batches` row — before any source-specific intelligence is added.
3. **Read-only session/record review surface.** Makes Slice 2's output inspectable — session detail + record list with status/match/conflict — required before anyone trusts committing through it.
4. **"Likely match" dedupe tier + the vendor-dedup gap specifically**, with an approve/skip/merge decision wired into commit.
5. **Quiet/historical commit mode** — a small, additive suppression parameter threaded through `createClientCore`/`ingestLead()`, defaulting to today's (loud) behavior everywhere except the new migration commit path. Flagged explicitly: this touches shared functions other flows call, so the default must not change for anyone else.
6. **Resumability** — session status transitions and interruption handling in the commit loop; likely a cron-polled queue eventually (matching the `facebook_lead_queue` precedent already identified in the earlier research), moving off the fully-synchronous model.
7. **First real source-specific adapter beyond `generic_csv`.** Recommend `weven_legacy` first on technical grounds (lowest external-dependency risk, no live platform to coordinate with, and the governing request specifically notes unusually deep internal knowledge of it) — but whether Planning Pod or HoneyBook is more valuable given actual near-term prospect volume is a business call, not this report's to make.
8. **HQ admin surface swap** — replace `app/admin/onboarding/[venueId]/page.tsx`'s embedded `ImportWizard` with the new session-based UI, only once self-serve has proven it out.

---

## G. Narrowly-Scoped Corrections

Per the governing request's allowance to make narrow corrections if actively misleading live-connection language is found: **none were found (§A.6).** Every existing reference to The Knot, WeddingWire, Weven, and HoneyBook is already honestly scoped to email-forwarding or export-upload. No copy change is proposed or made in producing this report.

---

**STOP.** No source, schema, migrations, UI, tests, or data have been modified in producing this document (this file itself is the only write). Awaiting review before any implementation begins.
