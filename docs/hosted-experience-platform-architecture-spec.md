# Hosted Experience Platform — Product Requirements & Architecture

Status: **Approved. Phases 1–5 (Catalog Foundation, Section Model, Publishing Model & Version History, Guest Personalization, Luv Integration) implemented and live-validated** — see `docs/hosted-experience-platform-phase1-report.md` through `-phase5-report.md`. Phase 6 remains specification only. **2026-07-16: Timeline/Schedule-related work (§3's Schedule section model, Phase 3's schedule-sync behavior, Phase 5's change-notification nudge) was paused pending reconciliation with a superseding Timeline architecture — see `docs/client-workspace-product-architecture.md` §12.** **Update, 2026-07-17: Timeline's target model shipped — see `docs/timeline-implementation-report.md`.** §3's Schedule section now reads the reconciled `guests` vocabulary (was `guest`); its `owner`/`sync_mode`/`data_source` shape is otherwise unchanged, matching this section's own instruction that audience publication should remain a live read, not a frozen one. Phase 5's change-notification nudge (watches `timeline_entries.updated_at`) has **not** been re-scoped to the new Submit signal — still watches raw `updated_at`, now a known, not-yet-closed gap; see the implementation report's Deferred section.

This document translates the "Wevenu Hosted Experience Platform" vision (v1.0) into an implementation-ready architecture. It is grounded in three things simultaneously: the vision document's own stated philosophy, the *actual current* wedding-website data model (`couple_websites` and its RPCs, just stabilized in `docs/wedding-website-stabilization-report.md`), and the architectural principles this platform already applies elsewhere. Nothing here breaks or bypasses the stabilization work — this spec evolves the current schema forward, it does not reopen or replace it.

## How This Relates to Prior Work

- **The current, stabilized feature** (`couple_websites`, `get_wedding_website`, `update_my_website`) is the foundation this spec builds on. It is not being discarded — its write path, publish/unpublish mechanics, and RLS/security-definer pattern are sound and are preserved throughout.
- **The two earlier design-research documents** (`docs/wedding-website-design-recommendation.md`, `-v2-guest-experience.md`) already did the competitive research this vision doc's philosophy echoes — typographic restraint beating freedom, RSVP personalization as the highest-leverage differentiator, motion as a hard cap not a toolkit, "Beautiful by Default" as a name for a pattern that research already identified. Their findings are treated here as **already-incorporated prior art**, not re-derived. Where this spec makes a concrete decision, it's noted which finding grounds it.
- **This spec produces no code.** Every schema shown below is descriptive (field names, types, relationships) for review purposes — not migration SQL to be run.

## Terminology Map (vision doc → current code → this spec)

| Vision doc term | Current code | This spec |
|---|---|---|
| Hosted Experience | `couple_websites` row | `hosted_experiences` (evolved from `couple_websites`) |
| Theme Collection | `theme` (checked string, 8 hardcoded values) | `collections` catalog + `experience.collection_id` |
| Color Story | `theme_palette` (string, per-collection palette map in TS) | `color_stories` catalog + `experience.color_story_id` |
| Typography Style | `font_pairing` (string — **now applied by the renderer as of Phase 1**, via `TYPOGRAPHY_STYLES` in `wedding-website.tsx`) | `typography_styles` catalog + `experience.typography_style_id` (catalog exists; not yet the live rendering path — see Phase 1 scope note below) |
| Section (Hero, Story, RSVP, ...) | a key inside `content` jsonb, rendering logic hardcoded per key in `wedding-website.tsx` | `experience_sections` (first-class rows) |
| Publishing | `is_published` boolean + `password` | full state machine, see Publishing Model |

---

## 1. Experience Object Model

```
HostedExperience (1) ──────┬── Collection (reference, not copied)
  belongs to: Client/Event  ├── ColorStory (reference, chosen from Collection's curated set)
                            ├── TypographyStyle (reference, chosen from Collection's curated set)
                            ├── ExperienceSection (many, ordered)
                            ├── GuestPersonalizationConfig (one)
                            ├── PublishingState (one, with history)
                            └── AnalyticsSummary (read-only rollup, not editable state)
```

**Design decision worth flagging explicitly**, because the vision document is genuinely ambiguous on this point: the "Collections" section describes a Collection as controlling Typography and Color Story directly, while the separate "Color Story" and "Typography" sections describe them as their own named, chosen things. This spec resolves it as **bundled-with-curated-choice**: a Collection defines a *small, curated set* of Color Stories and Typography Styles that pair with it (not a global free cross-product, not a single locked value). This is the same mechanism the earlier research document's strongest finding recommends — Bliss & Bone's editor "structurally forbids per-page font or color drift" while still offering real choice within the guardrail. A couple picks a Collection first (this is the real aesthetic decision), then a Color Story and Typography Style from that Collection's own curated shortlist — never from the full global catalog.

**Phase 1 implementation note (2026-07-16):** Color Stories are curated per-Collection exactly as designed above — `color_stories.collection_id` is a required FK, matching the real, already-existing shape (3 palettes per collection today). Typography Styles are **not** yet curated per-Collection — `typography_styles.collection_id` is nullable and left null for all 4 seeded styles, because the actual current Font Pairing picker offers all 4 pairings regardless of chosen Collection, and narrowing that in the same pass as fixing its dead rendering would have been a real behavior change bundled into what was scoped as a foundational, non-disruptive step. Per-Collection typography curation remains this section's target design; it's deferred to a later phase rather than silently dropped.

Every relationship above is a **reference**, not an embedded copy — the experience stores `collection_id`, not a copy of the collection's tokens. This is Single Source of Truth: when Wevenu improves a Collection's token values, every experience using it updates automatically, the same way `resolveTheme()` already works today (it re-reads the Collection/Palette definitions on every render, not a frozen copy).

---

## 2. Theme Collection Schema

**Today**: Collections and their Color Story/Typography options are hardcoded TypeScript objects (`COLLECTIONS`, `PALETTES` in `components/wedding-website/wedding-website.tsx`). Adding a Collection requires a code deploy, and the check constraint on `couple_websites.theme` has to be widened by hand — this is the exact class of bug the stabilization pass found and fixed once already (a stale constraint blocking valid collection names). This spec proposes moving the catalog to data, while keeping *rendering* (how a token becomes actual CSS) in code.

**What fields exist:**

```
collections
  id, key (stable slug, e.g. "estate", "garden")
  name, description
  is_premium (boolean)
  required_plan_tier (nullable — which venue plan unlocks it, if gated)
  is_active (boolean — retire without deleting; experiences already using a
             retired collection keep rendering correctly)
  sort_order
  default_color_story_id, default_typography_style_id
  design_tokens (jsonb — layout/spacing/dividers/motion/photo-treatment/
                 button-style/iconography vocabulary; see §9)

color_stories
  id, collection_id (FK — a Color Story belongs to exactly one Collection's
                     curated set; shared stories across collections are a
                     future extension, not v1)
  key, name
  tokens (jsonb — background, accent, typography colors, buttons, dividers,
          cards, gallery frames, icons, links, decorative elements)

typography_styles
  id, collection_id (FK, same curated-per-collection shape as color_stories)
  key, name
  tokens (jsonb — display heading, accent script, section heading, body,
          nav, button, quote style, letter spacing, weights, vertical rhythm)
```

**How they're stored:** design tokens live in JSONB, not one column per property — matching the vocabulary-not-CSS approach in §9. The *catalog* tables (`collections`, `color_stories`, `typography_styles`) are venue-invisible platform data: readable by every venue/couple (for the picker), writable only by Wevenu internally (no venue-facing "create a collection" UI exists anywhere in this spec — that would violate Beautiful by Default).

**How Wevenu creates future collections** (the vision doc frames this as a venue-facing question, but "Collections are curated. Not assembled" and "Future collections should be introduced thoughtfully rather than frequently" both make clear this is a *platform* capability, not a venue self-service one — read the requirement that way here): a new row in `collections` plus its curated `color_stories`/`typography_styles` rows, defined by Wevenu's own design process, shipped as a data migration rather than a code deploy once this phase lands. No application code changes for a new Collection unless it needs a genuinely new *token*, not just a new *value* — e.g., adding "frame style" as a new vocabulary entry is a code change; adding "Champagne Garden" as a new Color Story using existing tokens is a data change only.

**How premium collections work:** `is_premium` + `required_plan_tier` are metadata only — this spec defines the *hook*, not a billing system (out of scope). The picker UI checks the venue's plan against `required_plan_tier` and either offers the Collection or shows it locked with an upsell affordance. A venue that downgrades keeps any experience already built on a premium Collection rendering correctly (references don't break); they just can't *newly select* it going forward. This mirrors how Stripe Connect gating already works elsewhere in this codebase — check entitlement at the point of new selection, never retroactively degrade what's already published.

---

## 3. Section Model

Every section becomes a first-class row instead of an implicit key in a jsonb blob — this is the single biggest structural change in this spec, and it's what makes "every section belongs to exactly one ownership model" (the vision's own Information Ownership principle) a *database fact* instead of a convention a future engineer has to remember while editing a switch statement.

```
experience_sections
  id, experience_id (FK)
  section_key        -- stable identifier: "hero", "story", "schedule", "rsvp", ...
  title               -- couple/venue-editable display label
  visibility          -- enum: guest | password_required | hidden
  owner               -- enum: live_synced | guided | couple_authored | venue_managed
  sync_mode           -- enum: live | one_time_copy | manual
                          (live_synced sections are always sync_mode=live;
                           guided sections are one_time_copy + explicit refresh;
                           couple_authored/venue_managed are manual)
  data_source         -- nullable: which table/RPC this reads from live
                          (e.g. "timeline_entries", "events", "travel_logistics")
  last_synced_at      -- nullable, for guided sections' "sourced on [date]" indicator
  display_rules       -- jsonb: e.g. hide-if-empty, show-only-if-guest-attending,
                          show-only-within-N-days-of-event
  animation           -- enum, references the Collection's approved motion
                          presets only — never a free-form per-section value
  sort_order
  content              -- jsonb payload, populated when owner != live_synced
```

**Ownership mapping**, directly from the vision doc's own three categories plus the one it implicitly has a fourth for (venue-managed content isn't couple-authored, and isn't live-synced either):

| Owner | Sync Mode | Who edits | Examples |
|---|---|---|---|
| `live_synced` | `live` | Nobody — display only | Venue Address, Timeline/Schedule, RSVP Counts, Guest Status, Seating, Accommodations status |
| `guided` | `one_time_copy` | Couple, from a pre-filled starting point | Our Story (from Planning), Cover Photo, Venue Details text |
| `couple_authored` | `manual` | Couple, blank/free | Registry, Wedding Party, Personal Gallery, Thank You |
| `venue_managed` | `manual` | Venue coordinator | Welcome Message, Hero Image, Hotel Suggestions, FAQ, Directions, Parking Instructions |

**Phase 2 implementation finding (2026-07-16), honest and worth stating plainly:** `venue_managed` has **zero real occupants today**. There is no venue-facing editing surface anywhere in the current product — every section, including the ones this table lists as conceptually venue-owned (FAQ, Hotel Suggestions, Directions), is in practice edited exclusively through the couple's own Studio, because that's the only editor that exists. The live implementation classifies these sections `couple_authored` for now, matching what's actually true, rather than assigning `venue_managed` as an aspirational label with no access boundary behind it. This table remains the target design — building a real venue-side editing surface is what would let `venue_managed` become true, and is explicitly future scope (not scheduled in this spec's phase list), not something to paper over by mislabeling today's state.

This directly fixes the concrete gap the earlier design audit found live: Story/Cover Photo/Venue Details today are a one-time copy with **no visible indicator and no refresh** — `last_synced_at` plus a rendered "sourced from Planning, last synced [date] · Refresh" affordance in the Builder UX (§5) closes that specific finding structurally, not just for this one section but for every section that's ever marked `guided` in the future.

**Collection support:** a section's `animation` value must be one of the active Collection's defined motion presets (§9) — a section can't opt into a motion style its Collection doesn't offer. Visibility and display rules are per-experience (couple/venue choice), never per-Collection — the Collection governs *how something looks*, never *whether it's shown*.

**Timeline/Schedule model superseded 2026-07-16, implemented 2026-07-17.** The Schedule section's `live_synced`/`sync_mode=live`/`data_source: timeline_entries` model above used to read `timeline_entries.audiences` directly and live, with no distinction between "tagged for guests" and "deliberately published to guests after a commit point." `docs/client-workspace-product-architecture.md` §12 (implemented per `docs/timeline-implementation-report.md`) replaced the underlying data model — every timeline item now has an independent Owner (venue/client — `shared` deliberately not built, see that report), Lock State, and Visibility (venue/client/wedding_party/guests/vendors) — plus a whole-timeline client-submit action gating the *venue's* view of the couple's private planning items. **The Schedule section's own read stays a live filter, not a frozen/versioned one** — confirmed correct on implementation: §6 of the Commitment Lifecycle Architecture treats audience publication as independent of, not gated by, venue submission, so a couple can publish an item to guests before ever submitting anything to their venue. Only the filter value changed (`guests`, not `guest`); the `owner`/`sync_mode`/`data_source` shape above is otherwise unchanged. Phase 3's "Schedule when synced never freezes" behavior holds under the new model for the same reason. Phase 5's change-notification nudge was **not** re-scoped — see the Status line above.

---

## 4. Builder UX

**Exactly what happens when someone edits**, by owner type:

- **Live-synced section**: rendered read-only in the Builder, with a "Synced from [Timeline/Guest List/...]" badge and a link to the real source page. No edit form exists for these sections at all — editing them means going to the source (Timeline, RSVP, etc.), exactly like Schedule/Timeline sync already works today. **Note (2026-07-16):** for Schedule specifically, "going to the source" will mean the couple's private planning timeline per §3's superseded-model callout — Timeline implementation is paused pending `docs/client-workspace-product-architecture.md` §12.
- **Guided section**: shows the current content (pre-filled or previously accepted) plus a visible "Sourced from Planning · synced [date]" indicator and an explicit **Refresh** action that re-pulls the current source value into a proposed diff the couple accepts or dismisses — never silently overwritten. This is the fix for the "silently drifts, no indication" gap named in both the original design audit and this spec's Section Model above.
- **Couple-authored / venue-managed section**: a normal edit form, save-on-blur or explicit save (matching the current Studio's existing pattern), with an optional Luv-assist entry point (§10) — never Luv content inserted without an explicit action.

**Exactly what Luv suggests**: Luv only ever surfaces suggestions grounded in data the platform already has about *this* couple/event (Planning answers, event details, prior sections) — never generic filler. Concretely: pre-fill drafts for guided sections (already the mechanism today via `get_website_suggestions`, extended here to cover more sections); a restraint nudge on couple-authored text or photo choices ("this photo's tone doesn't quite match your Collection — want to see two others from your gallery that would?"); never a "write this for me from nothing" generator. This is a direct continuation of the earlier design document's explicit, deliberate rejection of the generic-AI-writer framing every competitor uses.

**Exactly how previews work**: the Builder's preview renders through the **same component** the public site uses, in an `editMode` prop — this is already true today (`website-studio.tsx`'s preview reuses `<WeddingWebsite>`) and this spec requires it stay true. One renderer, two contexts, never a second preview-only renderer that can drift from what guests actually see — this is the direct fix for the stabilization phase's headline regression (a renderer receiving data the public RPC didn't return), generalized into a standing rule: *if the preview and the public page ever render through different code, that's the bug waiting to happen.* Preview modes:
- **Device preview** (desktop/mobile toggle) — already exists, kept.
- **"Preview as this guest"** — new. Renders the public experience exactly as one specific named guest would see it: their personalized welcome, their RSVP status, their household's meal choices, any guest-specific visibility rules applied. This was the single highest-leverage recommendation in the original design research and has no schema dependency beyond what Guest Personalization (§7) already needs — it's a Builder-side read using an existing guest's token, not a new data model.

---

## 5. Publishing Model

**Confirmed 2026-07-16 as a compliant instance of `docs/commitment-lifecycle-architecture.md`**, the platform-wide Commitment Lifecycle formalized the same day — `draft`/`preview`/`published`/`archived` below map directly onto that document's Draft/Submitted(n/a)/Committed/Archived states, and `experience_versions`/`current_version_id` (below) are its Versioning rule (§5 there), independently arrived at here first and generalized from.

```
PublishingState:
  status: draft | preview | published | archived
  password: nullable (orthogonal modifier — a published site can also be password-protected)
  scheduled_publish_at: nullable timestamp
  scheduled_expire_at: nullable timestamp
  current_version_id: FK to the active experience_versions row
```

- **Draft** — default. Not resolvable at any public URL. Matches today's `is_published = false`.
- **Preview** — new state. Resolvable only via a distinct, unguessable preview link (not the couple's password, not the eventual public slug) — for sharing a work-in-progress with a coordinator or family member without publishing. Not indexed by search engines even if later published unindexed too (see §11 SEO controls).
- **Published** — resolvable at the public slug, matches today's `is_published = true`.
- **Archived** — new state. Read-only; the public URL still resolves (so old bookmarked links and guest QR codes keep working after the wedding) but the Builder no longer allows edits, and it's excluded from active-venue dashboards/analytics-as-current. Transition can be manual (coordinator archives it) or automatic (N days after the event date, configurable) — either way, this is a **Copy at Commitment** checkpoint, not a live-forever-mutable state: archiving snapshots the experience the same way Invoice-send freezes an Invoice elsewhere in this platform.
- **Password Protected** — orthogonal boolean/field on top of any of the above, unchanged from today's mechanism (plaintext storage/comparison is a separate, already-tracked, still-deferred security item from the stabilization work — not addressed by this spec, called out again in §12).
- **Scheduled** — `scheduled_publish_at`/`scheduled_expire_at` drive automatic status transitions via the same cron mechanism this platform already uses elsewhere (notification/automation processing jobs), not a new scheduling subsystem.

**Version History** — genuinely new, and the most direct application of **Copy at Commitment** in this whole spec:

```
experience_versions
  id, experience_id (FK)
  published_at
  snapshot (jsonb — a frozen copy of collection_id/color_story_id/
            typography_style_id/section content/section order at the
            moment of publish)
```

A new version row is written **on every transition into `published`** (not on every edit — that would be an audit log, not version history, and this platform already has activity logs for that purpose elsewhere). This answers a real question a coordinator or couple will eventually ask — "what did guests actually see on the wedding day?" — even after later edits, without needing a separate backup mechanism. The *current* live-synced sections still render live even when viewing a past version's snapshot for its authored content — a version snapshot freezes what was *chosen* (Collection, Color Story, authored text), not what was live-synced, since a frozen copy of "RSVP count as of publish day" would be actively misleading if displayed as if current.

---

## 6. Guest Personalization

**How it knows what it knows**, and why this doesn't become creepy — four rules, all enforced structurally, not just by convention:

1. **Personalization only ever reflects what the guest themselves is the subject of, and only via their own unique, unguessable link** — the existing `rsvp_token` mechanism, unchanged. Guest A can never see Guest B's meal choice, family details, or accessibility notes, under any circumstance, including shared household views (a household view shows *names*, never another member's sensitive fields, unless the viewer *is* that member).
2. **Personalization shows the guest things they gave the platform, reflected back — never things inferred about their behavior.** A welcome banner using their name, a schedule reflecting their specific invited events, their own prior meal selection: expected, because they clicked their own link. Anything derived from *how they used the page* (view counts, time-on-page, "you've visited 4 times") is never surfaced to the guest — that data may exist for the venue's own analytics (§13) but never renders back at a guest.
3. **Sensitive fields never appear on any page reachable without that specific guest's token** — accessibility notes, dietary restrictions, children/family detail are visible only in the guest's own personalized view and in the venue/couple's management tooling, never on a shared/public page, never in a "who's coming" list beyond names.
4. **The tone is hospitality, not a dashboard.** Personalized content reads like something a host arranged in advance ("Your seat is at the Garden Table," "We've noted Sam is dairy-free"), never like a system reporting status back at the guest ("RSVP received on 3/2. Status: Confirmed.").

This is a natural extension of what already exists correctly today: `get_rsvp_context`'s token-gated, per-guest lookup is the right foundation; this spec's job is making sure every *new* personalized surface (preview-as-guest, live-synced sections that vary by guest, any Luv-assisted guest concierge answer) inherits the same token-scoping rather than introducing a parallel, looser mechanism.

---

## 7. Responsive Rules

Mobile-first, one build target — per the vision doc and consistent with the original design research's explicit rejection of Wix's failure mode (desktop and mobile edited independently, silently diverging). Concretely:

- Each section type has a defined mobile *and* desktop composition rule baked into the Collection's design tokens (§9) — not a couple-configurable setting, and not a second, separately-maintained mobile layout. A couple never sees a "mobile settings" panel; there is nothing to configure because the system guarantees a coherent result, matching Beautiful by Default.
- Layout decisions are expressed as responsive rules within one component tree (fluid typography via `clamp()`, breakpoint-driven grid collapse) — already the pattern the current public renderer and Studio use correctly (confirmed responsive on both sides during the stabilization audit); this spec extends the same approach to every new section type rather than introducing a different technique.
- "Preview as mobile" in the Builder (§4) is a viewport simulation of the *same* markup guests get, never a separate mobile-specific render path.

---

## 8. Collection Engine

**How Collections override typography/spacing/frames/dividers/icons without becoming custom CSS**: by exposing a **closed, named vocabulary** — never an open style property. A Collection is a complete assignment of every token in this vocabulary; there is no partial override and no path for a venue or couple to set an arbitrary value outside it.

| Token category | Vocabulary (closed set, not free values) |
|---|---|
| Typography | `displayHeading`, `accentScript`, `sectionHeading`, `body`, `nav`, `button`, `quote` — each a named font-stack + weight + letter-spacing bundle, not an individually swappable font |
| Spacing | `sectionSpacingScale`: small / medium / large — never a pixel value |
| Dividers | enum: none / rule / ornament / flourish |
| Photo frames | enum: full-bleed / framed / masonry / film-strip / fine-art / overlapping (matches the vision's Photography section's named styles) |
| Motion | 2–3 named presets per Collection: e.g. `fade`, `rise` — off by default, never a per-block picker (directly the "Motion is a hard cap, not a toolkit" finding) |
| Iconography | one icon set reference per Collection |
| Buttons | one named button style per Collection |

This is the mechanism, not a metaphor: the *storage* is `design_tokens jsonb` (§2), but the *keys* inside that JSON are drawn from this fixed vocabulary, validated at write time (by the same Collection-authoring tooling Wevenu uses internally, per §2 — never by venue/couple input). A new Collection can introduce new *values* for existing tokens freely; introducing a genuinely new *token category* is a deliberate, infrequent platform decision — matching "future collections should be introduced thoughtfully rather than frequently."

---

## 9. AI / Luv Integration

**Where Luv appears** (all grounded in real platform data about this specific event, never generic generation):
- Guided-section pre-fill and refresh suggestions (§4).
- A restraint nudge on couple-authored content — tone, length, photo-fit suggestions.
- Guest-facing concierge answers (FAQ, directions, parking, "what should I wear") — grounded strictly in the experience's own published content plus the venue's operational info already in the platform; never invents an answer it can't source.
- A coordinator/couple-facing (never guest-facing) nudge when a live-synced source changes after publish: "Your ceremony time changed on the Timeline — want to notify guests who've already RSVP'd?" — directly the "communication loop" gap the original design research named as a real, buildable capability no competitor has.

**Where Luv does not appear:**
- Never authors Couple-Authored sections (Our Story, personal photos, personal messages) unprompted — those must originate from the couple; Luv may assist only after the couple starts.
- Never speaks *as* the couple or venue to a guest — any Luv-generated guest-facing text is presented as a system helper (an FAQ answer), never narrated in the couple's voice.
- Never overrides a Collection/Color Story/photo choice on its own authority — it may flag a restraint concern, never silently change the selection.
- Never surfaces guest behavioral data back to the guest (§6, rule 2) — Luv's guest-facing surface only ever reflects what the guest themselves provided.

---

## 10. Future Extensibility — Event-Neutral Architecture

The current schema (`clients`, `couple_guests`, `couple_websites`) is wedding/couple-specific by name and by RLS design. This spec does **not** propose generalizing that in this phase — the object model above (Collection, Color Story, Typography Style, Section, Publishing, Personalization) is deliberately event-type-agnostic in *shape*, so that generalization becomes additive later rather than a rewrite:

- `hosted_experiences.event_type` (already effectively `clients.event_type` today) drives which `section_library_entries` are offered and what labels/terminology are used — e.g., "Registry" for a wedding vs. "Wish List" for a birthday — via a catalog table mapping `event_type → section_key → default_title`, not new application code per event type.
- Section ownership/sync-mode/visibility primitives (§3) are already generic — "live-synced," "guided," "couple-authored," "venue-managed" apply equally to a corporate gala's agenda as to a wedding's schedule.
- The couple-specific tables (`couple_guests`, `couple_websites`) becoming `event_hosts`/`hosted_experiences` (generic naming) is a **later** rename/generalization phase, sequenced deliberately after the object model above is proven correct on weddings — per this platform's own established discipline of not generalizing a pattern until it's been exercised for real once (the same reasoning applied to Timeline/Event Order elsewhere in this codebase).

---

## 11. Accessibility, SEO, and Publishing Controls

Named explicitly in the vision doc, worth a short, concrete section rather than folding into Publishing:

- Keyboard navigation, screen-reader compatibility, WCAG-AA color contrast, alt text on every image, `prefers-reduced-motion` honored (disables §9's approved motion presets automatically) — enforced at the Collection/token level (§8), not left to per-section discretion, so a Collection that fails contrast simply can't ship.
- Search-engine indexing is a Publishing-state-linked toggle (§5): `preview` status is never indexed regardless of the toggle; `published` status defaults to indexed but can be opted out (a couple who wants a private, unlisted site).
- Custom domains and venue subdomains, shareable links, and QR codes are delivery mechanisms on top of the same `published` state — no schema impact beyond a `custom_domain` field on the experience, out of this phase's critical path.

---

## 12. Implementation Phases

Sequenced to preserve the just-stabilized current system throughout, and to land foundational data model changes before guest-facing personalization work depends on them.

**Phase 0 — done.** Current system stabilized (create/save/publish/public-render all verified working). This spec builds on that baseline; nothing here reopens it.

**Phase 1 — Catalog foundation. ✅ Implemented and live-validated 2026-07-16** (`docs/hosted-experience-platform-phase1-report.md`). `collections`/`color_stories`/`typography_styles` tables created and seeded from the exact current `COLLECTIONS`/`PALETTES`/`FONT_PAIRINGS` TypeScript values (8 collections, 24 color stories, 4 typography styles) — a faithful data migration, not a redesign. `collection_id`/`color_story_id`/`typography_style_id` added to `couple_websites` alongside the existing string columns, with backfill logic written and verified correct. The deferred Font Pairing rendering gap is closed: `resolveTheme()` now applies typography tokens via a `TYPOGRAPHY_STYLES` lookup, live-verified to actually override a Collection's default fonts.

**Scope actually delivered vs. originally planned**: the RPCs (`get_my_website`, `update_my_website`, `get_wedding_website`) and the Studio's picker UI were deliberately **not** cut over to the new FK columns in this phase — they continue reading/writing the existing string columns, which remain fully authoritative for rendering. The new FK columns are populated only by the (verified-correct) backfill logic for now; nothing yet writes them on new saves. This was a real-time scope refinement, not an oversight: the two things Phase 1 needed to deliver — a real catalog foundation, and a closed Font Pairing bug — didn't require the larger, riskier RPC/UI cutover, so it was deferred to Phase 2 rather than bundled in. Full cutover (RPCs/Studio reading and writing `collection_id`/`color_story_id`/`typography_style_id` as the source of truth) is now explicitly part of Phase 2's scope, alongside the Section Model work already planned there.

**Phase 2 — Section Model. ✅ Implemented and live-validated 2026-07-16** (`docs/hosted-experience-platform-phase2-report.md`). `experience_sections` shipped as first-class rows for all 13 real sections this product has today (12 from the Studio's own section list plus RSVP, which has no editable form but is always live); every existing experience backfilled, and every new experience gets the same canonical set auto-created on first save (idempotent — self-heals). The public and Studio-read RPCs now return an ordered, visibility-filtered `sections` array, and the renderer consumes it for section order (falling back to the pre-Phase-2 logic if absent). `update_my_website`/`get_my_website`/`get_wedding_website` were also migrated onto the catalog: the Studio's Appearance picker now resolves and sends `collectionId`/`colorStoryId`/`typographyStyleId` on every selection (sent alongside the legacy strings as a safety net, not instead of — the read side already prefers the FK-derived value whenever present, so this is a real migration of the authoritative path, not just an additional field). See §3's ownership-mapping table for the one honest finding this phase surfaced: `venue_managed` has zero real sections today, because no venue-facing editor exists yet.

**Phase 3 — Publishing Model. ✅ Implemented and live-validated 2026-07-16** (`docs/hosted-experience-platform-phase3-report.md`). `status` (draft/preview/published/archived) replaces the two-state `is_published` boolean, which is preserved as a generated column so every existing reader keeps working unchanged. `experience_versions` snapshots the couple's design choices and authored section content on every explicit publish — live-tested to be the real thing this spec asked for: editing after a publish lands in the draft only, guests keep seeing the frozen version, and a couple can deliberately re-publish (a new, previously-nonexistent Studio affordance, "Publish updates") to move guests onto the latest draft. `live_synced` sections (Schedule when synced, RSVP) are confirmed to never freeze, even inside a published snapshot — live-tested by adding a real Timeline entry after publishing and confirming it appeared on the guest site immediately, while frozen authored content on the same page did not change. `preview_token` (new) lets a work-in-progress be shared via a distinct link regardless of publish status, including while still in `draft` — the vision doc's "preview with a coordinator or family member without publishing" case. **Scheduled publish/expire columns exist but have no automation wired to them yet** — deliberately deferred, since verifying a time-based cron trigger live within a single session isn't meaningful; noted as open, not silently dropped. **Update, 2026-07-16:** the "Schedule when synced never freezes" claim above was verified against the current Timeline model, which is now superseded (see §3's callout and `docs/client-workspace-product-architecture.md` §12). The underlying Copy at Commitment behavior for authored sections is unaffected; the live-sync behavior specifically for Schedule will need re-verification once Timeline's Owner/Lock-State/Visibility model ships. **Update, 2026-07-17: re-verified.** Timeline's target model shipped (`docs/timeline-implementation-report.md`); Schedule's read was updated to the reconciled `guests` vocabulary and confirmed to still never freeze, since audience publication is architecturally independent of venue submission (§6) — the claim above holds under the new model, not just the old one.

**Phase 4 — Guest Personalization. ✅ Implemented and live-validated 2026-07-16** (`docs/hosted-experience-platform-phase4-report.md`). The two existing RSVP surfaces — the personalized `/rsvp/[token]` link and the embedded on-site lookup form — are unified onto one component (`RsvpPage`); the on-site form no longer runs a fake client-side length check but validates the entered code through a real server route (`/api/portal/rsvp/lookup`) backed by the existing `get_rsvp_context` RPC, then renders the exact same component the personalized link uses. "Preview as this guest" ships in the Studio's guest list (`GuestRsvpPreviewButton`) via a new portal-token-authenticated `preview_rsvp_as_guest` RPC that mirrors `get_rsvp_context`'s output shape — closing the highest-leverage gap the original competitive research identified (Riley & Grey's guest-specific preview is a capability no freeform website builder can copy, because none of them own a guest record the way this platform does). Three independent, live-tested safeguards keep preview from ever becoming a real submission: the rendered `RsvpPage` is put into a `readOnly` mode that disables its submit button; the preview RPC deliberately omits the guest's real `rsvp_token` from its response, so there is nothing valid to submit against even if the button were bypassed; and `submit_rsvp` itself still rejects an empty/invalid token regardless. The RPC's guest lookup is scoped to the authenticated session's own `client_id`/`venue_id`, confirmed live to return `guest_not_found` for a guest belonging to a different client rather than leaking cross-tenant data. **Scope note**: "preview as this guest" is scoped to the RSVP experience specifically, not a full-site personalized render — today's non-RSVP website content doesn't vary by guest, so there is nothing else yet for a guest-specific preview to show; this should be revisited if/when other sections gain guest-level personalization (§6).

**Phase 5 — Luv Integration. ✅ Implemented and live-validated 2026-07-16** (`docs/hosted-experience-platform-phase5-report.md`). All three deliverables named in this section shipped: (1) **Guided-section refresh** — `experience_sections.last_synced_at` (present since Phase 2 but never populated) now drives a visible "Sourced from Planning · synced [date]" indicator on Home and Story (the platform's only two `guided` sections today), with an explicit Refresh action that re-pulls `get_website_suggestions` live rather than relying on the once-on-mount fetch, and a `mark_section_synced` RPC that stamps the sync timestamp only once the couple actually reviews and saves an accepted refresh — never a silent overwrite. (2) **Guest-facing concierge** — a new `get_guest_concierge_context(rsvp_token)` RPC (guest-token authenticated, mirroring `get_rsvp_context`'s auth pattern) grounds answers in exactly the two sources §9 names: the venue's operational info (`venue_operational_info`, already used by the couple-facing "Ask Luv") and the couple's own published dress_code/faq/travel/things_to_do section content, read through the same published/snapshot resolution `get_wedding_website` uses so a guest's concierge answer never gets ahead of what the site actually shows them. Deliberately built as a restrained concierge widget (collapsed by default, curated quick-questions, one Q&A visible at a time) rather than the couple portal's open-ended chat thread — per this phase's explicit instruction that Luv stay "a hospitality concierge rather than a conversational interface." (3) **Change-notification nudges** — a new couple-portal-scoped `website_change_nudges` table (the couple-facing analog of the venue-scoped `luv_recommendations` pattern, which has no per-couple concept) detects, on-demand, when the Schedule section's underlying Timeline data changed after the site was last published while guests have already RSVP'd — the exact scenario in this section's original example — and offers a "Notify guests who've RSVP'd" action that reuses the existing invite-email pipeline (`/api/portal/invite`, extended with a new `emailType: "update"`) rather than building a new send path. Scoped deliberately to Schedule only, since it remains the one `live_synced` section with real content (per Phase 2's finding that `venue_managed` still has none); generalizing to other live-synced sources is future work for whenever a second one exists. **A significant, unrelated pre-existing bug was found and fixed during this phase's live-testing**: `app/api/portal/website/route.ts` was double-JSON-encoding every section's content before saving (see the phase 5 report for full detail) — silently breaking guest-visible rendering of Dress Code, Travel, FAQ, and other couple-authored sections in production. Fixed at the root (one-line route fix) plus a one-time data-repair migration for already-corrupted rows; confirmed via a full `db reset --local` replay that the fix and repair are both part of a clean migration history. **Update, 2026-07-16:** the change-notification nudge above watches `timeline_entries.updated_at` directly against the current, now-superseded Timeline model (no Owner/Lock-State/Visibility distinction, no client-submit gate — see §3's callout and `docs/client-workspace-product-architecture.md` §12). It remains correct as a live-tested description of what was built, but the detection logic will need to be revisited once Timeline's target model ships, since "the source changed" will mean something more specific (a client-submitted or venue-published change) than "any row's `updated_at` moved." **Update, 2026-07-17: still open, not re-scoped.** Timeline's target model shipped (`docs/timeline-implementation-report.md`), but this nudge's detection logic was intentionally left untouched — out of that implementation's scope. It still watches raw `updated_at`, which no longer distinguishes a real Submit/publish event from any other live edit to the couple's private draft. Named here as a known gap, not silently carried forward.

**Phase 6 — Event-Neutral Generalization.** Section Library catalog driven by `event_type`; couple-specific table/RLS naming generalized only after Phases 1–5 are proven on weddings.

**Explicitly not scheduled by this spec**: the plaintext password storage/comparison gap identified during stabilization remains open and untouched — it's an existing security item, not new scope this platform introduces, and should be closed on its own timeline rather than bundled into a design-system rollout.

---

## Principles Checklist

Each phase above was checked against the principles this initiative was asked to apply, not just the vision document's own language:

- **Beautiful by Default** — closed token vocabulary (§8), no venue-facing collection authoring, no per-section free-form motion.
- **Progressive Disclosure** — Builder shows only the choices relevant to the section type being edited; live-synced sections show no edit form at all rather than a disabled one.
- **Single Source of Truth** — every relationship is a reference (§1), never a copy; one renderer for preview and public (§4); Section ownership makes "who owns this" a queryable fact, not tribal knowledge.
- **Copy at Commitment** — Version History snapshots on publish (§5), Archived state freezes authored content while live data stays live, guided sections copy explicitly and visibly rather than silently.
- **Relationship Workspace** — the Builder lives inside the same couple/event context this platform already organizes around; nothing in this spec introduces a second place to "find" a wedding.
- **Event-neutral architecture** — object model shapes are generic from the start (§10), even though the concrete rollout stays wedding-scoped through Phase 5.
- **Hospitality by Default** — Guest Personalization's four rules (§6) are written to make every guest-facing surface feel hosted, never tracked.
