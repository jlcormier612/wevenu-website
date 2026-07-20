# Venue Branding — Architecture Audit

**Status: Approved 2026-07-17.** §5's recommendation (venue branding as a default input into the Hosted Experience Platform, not an override) is approved. See "Future Initiative: Venue Brand Experience" at the end of this document for the refined shape that recommendation takes — not part of the current Commitment Alignment Sprint.

Architectural review only, no implementation. Scope: where venue branding lives, everywhere it's actually applied today, where hardcoded styling stands in its place, which future surfaces should inherit it, and whether it should feed the Hosted Experience Platform (Collections / Color Stories / Typography) rather than sit beside it.

## 1. Where Venue Branding Is Stored

A four-color system plus a logo, on the `venues` table itself — not a separate branding table.

| Column | Type | Default | Added |
|---|---|---|---|
| `logo_url` | text, nullable | — | `20260626090000_venue_foundation.sql:46` |
| `primary_color` | text, not null | `#5D6F5D` | `20260626090000_venue_foundation.sql:47` |
| `secondary_color` | text, not null | `#4F5F4F` | `20260626090000_venue_foundation.sql:48` |
| `accent_color` | text, not null | `#B8AEA1` | `20260703150000_sprint76_brand_colors.sql:8` |
| `neutral_color` | text, not null | `#F7F5F1` | `20260703150000_sprint76_brand_colors.sql:9` |

- TypeScript shape: `lib/venue/types.ts:47-52` (`VenueSetupInput`) and `:83-87` (`Venue`) — both carry `logoUrl`/`primaryColor`/`secondaryColor`/`accentColor`/`neutralColor` as plain fields, no nesting, no versioning.
- Collected during onboarding: `components/setup/setup-steps.tsx` `BrandStep` (~line 458 on) — a 4-swatch color picker (`COLOR_ROLES`) plus a live preview strip, no logo upload at this stage ("Your logo can be added anytime from Settings after setup").
- Edited later via venue Settings: `app/(app)/settings/page.tsx` + `app/(app)/settings/actions.ts:6,50` (`saveBrandSection`).
- One canonical writer, no duplication: unlike the Lead/Client/Event triplication found in the Booking Financial review, branding has a single row, single owner, no copy-on-create anywhere.

## 2. Every Place Venue Branding Is Currently Rendered or Consumed

All consumption is **print/PDF and public lead-capture forms** — nothing in the couple-facing digital product.

| Surface | File:line | What it does |
|---|---|---|
| Calendar print view | `app/(app)/calendar/print/page.tsx:46` | Uses `venue.primaryColor` |
| Seating chart print | `app/(app)/events/[id]/seating-print/page.tsx:86` | Uses `venue.primaryColor` |
| Floor plan print | `app/(app)/events/[id]/floor-plan-print/[planId]/page.tsx:102` | Uses `venue.primaryColor` |
| Invoice PDF | `components/invoices/invoice-print-document.tsx:17,31` | Uses `venue.primaryColor` |
| Day-of sheet | `components/events/day-sheet/day-sheet-document.tsx:85,154` | Uses `venue.primaryColor` |
| Timeline document | `components/events/timeline/timeline-document.tsx:53` | Uses `venue.primaryColor` |
| Public inquiry form | `components/form/inquiry-form.tsx:63`, `app/form/[key]/page.tsx:55` | Uses `venue.primaryColor` |
| Couple questionnaire | `components/form/couple-questionnaire-form.tsx:63` | Uses `venue.primaryColor` |

Every hit is `primaryColor` only — `secondaryColor`, `accentColor`, `neutralColor`, and `logoUrl` were not found consumed anywhere outside the Settings edit form and the Brand-step preview itself. Logo in particular appears to be captured and stored but never rendered back anywhere in the product.

## 3. Where Hardcoded Styling Stands in Branding's Place

Checked every surface that visually represents the venue to a client or guest — a direct grep for `primaryColor`/`logoUrl`/`venue.logo` across the client portal, the wedding website renderer, and the contract flow returned **zero matches** in all three:

| Surface | Finding |
|---|---|
| Contract signing page | `app/sign/[token]/page.tsx` — entirely hardcoded gray. No venue name, no logo, no brand color anywhere on the page a client signs a legal document on. |
| Client portal (header/theme) | No reference to any `venue.*Color`/`logoUrl` field anywhere under `components/portal/`. |
| Wedding website renderer | `components/wedding-website/wedding-website.tsx` — confirmed clean search, zero venue-branding references; theming comes entirely from the Hosted Experience Platform's own Collection/Color Story system (§4 below), not venue branding. |
| Password gate (wedding website) | `wedding-website.tsx:536,540,543,548` — hardcoded `#F7F5F1` background, `'Playfair Display', Georgia, serif` font, `#5D6F5D`/`#B8AEA1`/`#DED6CA` colors. Notably these are the *venue brand defaults* (`DEFAULT_PRIMARY_COLOR`, `DEFAULT_SECONDARY_COLOR` in `lib/venue/constants.ts:82-83`) hardcoded as literals rather than sourced from either the venue or the couple's theme — coincidental match, not a real integration. |
| RSVP page | `components/wedding-website/rsvp-page.tsx` — extensive hardcoded hex values (`#DED6CA`, `#F7F5F1`, `#1A1A1A`, `#666`, `#999`, `#B8AEA1`), independent of venue branding and largely independent of the couple's own Collection/Typography choice too. |
| Emails | `lib/email/{daily-digest,send,team-invite,vendor-invite}.ts` — zero references to logo or brand colors in any of the four files. |

Net: branding is fully wired into the venue's own back-office print artifacts, and fully absent from everything a couple or wedding guest ever sees.

## 4. Future Surfaces That Should Naturally Inherit Venue Branding

In descending order of how load-bearing the gap currently is:

1. **Contract signing page** (`app/sign/[token]/page.tsx`) — highest priority. A client signs a legal document with no venue identity on the page at all; this is the single starkest gap found.
2. **Client portal** — the couple's entire day-to-day surface (`components/portal/`) currently carries zero venue identity; there's no portal "header" concept branded per-venue today.
3. **Invoices/proposals sent to clients** — the print documents already use `primaryColor`; logo is captured but never placed on them.
4. **Transactional emails** — invites, digests, notifications currently carry no venue name/logo/color at all.
5. **Wedding website / hosted experience** — deliberately listed last and treated separately in §5, because the right integration isn't "add venue branding here" — it's a design decision about how venue branding relates to the Collection/Color Story system that already owns this surface.

## 5. Should Venue Branding Feed the Hosted Experience Platform, Rather Than Override It?

**Yes — as a default input, not an override.** Reasoning, grounded in what's actually built:

- Collections/Color Stories/Typography are explicitly **curated, global presets** (`docs/hosted-experience-platform-architecture-spec.md:80-84`: "Collections are curated. Not assembled" — no venue-facing or couple-facing authoring UI exists for them anywhere, confirmed by RLS: no INSERT/UPDATE/DELETE policy exists on `collections`, `color_stories`, or `typography_styles` — `20261008000000_hosted_experience_phase1_catalog_tables.sql:91-103`). They're deliberately not a place for arbitrary per-venue color injection — that would break the "curated" guarantee the whole system is designed around.
- Today, **the couple** picks a Collection and Color Story, with only one further override: a free-text `accentColor` (`couple_websites.accent_color`, defaulting to `#5D6F5D` — which is itself the Wevenu-wide default sage, not the venue's own `primaryColor`). The venue currently has zero input into its own weddings' visual identity on this surface.
- The clean way to reconcile "curated, not assembled" with "the venue should have a voice here" is: **venue branding pre-seeds the couple's starting point, not the rendering engine.** Concretely, that would mean things like defaulting a new `couple_websites` row's `accentColor` to the venue's `primaryColor` (instead of the current hardcoded `#5D6F5D`) and/or biasing which Collection is suggested first toward one whose palette is close to the venue's brand colors — the couple can always change it, same as today. This preserves "Collections are curated" (no per-venue mutation of the catalog) while making the venue's identity the sensible starting default instead of a Wevenu-wide constant.
- This is a materially different design than "venue branding overrides Color Story," which was the alternative the question posed and which this audit recommends against: it would re-introduce exactly the kind of ambiguous-ownership problem the Commitment Lifecycle work has been eliminating elsewhere in this codebase — two sources (venue brand, couple's chosen Color Story) both claiming to determine the same rendered color, with no clear precedence rule.
- Separately, and lower-stakes: the venue's `logoUrl` has no natural place in Collections/Color Stories/Typography at all (those are pure aesthetic-token systems — see `color_stories.tokens`/`typography_styles.tokens` as `jsonb`, no image field). Logo placement on the wedding website, if wanted, is an independent decision from the color-defaulting question above.

## Summary

Venue branding is real, single-sourced, and correctly captured — but its only live consumers today are the venue's own internal print documents and public lead-capture forms. It reaches no client-facing or guest-facing digital surface: not the portal, not the contract page, not email, not the wedding website. The wedding website in particular already has its own mature, deliberately-curated theming system (Collections/Color Stories/Typography) that venue branding should feed as a *default*, not a *constraint* — preserving the curated-catalog guarantee while giving the venue a real starting voice instead of the current Wevenu-wide hardcoded default.

---

## Future Initiative: Venue Brand Experience

**Not part of the current Commitment Alignment Sprint.** Documented here as approved future direction, refining §5's recommendation above. No implementation until this initiative is separately scoped and scheduled.

**The refinement:** do not introduce a second, separate "Brand Style" field for venues to fill out. The venue already classifies itself once, during onboarding — `venue_type` (`lib/venue/constants.ts`'s `VENUE_TYPES`: Wedding Venue, Barn/Farm, Winery/Vineyard, Garden/Estate, Hotel/Resort, Inn/B&B, Estate, Camp/Retreat, etc.) — and that remains the single canonical source of what kind of venue this is. Asking a venue to *also* pick a "brand style" during a future branding flow would be the same architectural mistake the Booking Financial work has been eliminating all sprint: two fields claiming to answer the same underlying question, with no precedence rule between them. **One canonical owner, many consumers** — the principle applied throughout this platform — applies here too.

**The shape instead:**

1. **Brand recommendation engine.** A new capability that takes the venue's existing `venue_type` (plus its already-captured 4-color brand palette and logo) as input and generates *recommended* selections across every Hosted-Experience-Platform-owned dimension: Collection, Color Story, Typography Style, Gallery Style, and Motion. This is additive to the Hosted Experience Platform's existing catalog tables (`collections`, `color_stories`, `typography_styles`) — it does not touch the "curated, not assembled" guarantee documented in `docs/hosted-experience-platform-architecture-spec.md`; it's a recommendation layer sitting in front of that catalog, not a new authoring path into it.
2. **Review and override, never a second classification step.** The venue (and/or the couple, depending on where in the product this surfaces) sees the recommended defaults and can change any of them — exactly like today's Collection/Color Story picker — but is never asked to categorize the venue a second time to get there.
3. **Consumers of the recommendation engine**, once built:
   - **Hosted Experience defaults** — the wedding website's initial Collection/Color Story/Typography/Gallery Style/Motion selection, replacing today's hardcoded `#5D6F5D` couple-accent-color default with something informed by the venue's actual identity.
   - **Client Portal defaults** — the portal currently carries zero venue identity (§3 above); this is its natural theming source.
   - **Email branding** — transactional email (`lib/email/*`) currently has zero logo/color usage anywhere.
   - **PDF branding** — invoices/day-sheets/floor-plans already consume `venue.primaryColor` directly (§2); worth revisiting once the recommendation engine exists, so PDFs and the digital surfaces above draw from one coherent source rather than PDFs alone hardcoding just the primary color.
   - **Guest-facing branding** — the RSVP page, password gate, and other guest-facing surfaces identified as hardcoded in §3.
   - **Venue identity refinement** — logo placement and any brand-asset needs not covered by the current 4-color system, once the above consumers reveal what's actually missing.

This keeps the Hosted Experience Platform's curated-catalog guarantee fully intact (nothing here lets a venue or couple assemble an uncurated combination) while making Venue Style — a fact the venue already told us once — actually load-bearing across every surface that currently either ignores it or hardcodes a Wevenu-wide default in its place.
