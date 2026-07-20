# Venue Brand Experience — Phase 1 (Baseline Wiring) — Final Report

**Status: Complete.** Verified via `tsc --noEmit` (clean) and a full `npm run build` (clean, all new `icon.tsx` routes generated correctly). All corrective migrations applied cleanly to the local database.

Governing principle honored throughout: **a couple should remember the venue, not the software.** Customer-facing surfaces present the venue as the only visible brand; software-user-facing surfaces (venue staff, team members, vendors in the Vendor App) keep Wevenu branding, since those users are intentionally using the software.

---

## What shipped

**Work Stream A — Data layer.** `get_portal_context` and `get_contract_by_token` now return the venue's `primaryColor`/`secondaryColor`/`accentColor`/`neutralColor`/`logoUrl`. `get_venue_by_tour_key` and `get_rsvp_context` extended the same way (found during implementation — see "Additional surfaces" below).

**Work Stream B — Couple portal.** All ~14 portal section components migrated from Wevenu's hardcoded sage/rose palette to `var(--venue-*)` CSS custom properties injected once on the portal shell's root. Logo added to the header. "Powered by Wevenu" footer removed. One color-role table governs every use: Primary → CTAs/hero/active-nav, Secondary → hover/gradient stops, Accent → progress/checkboxes/badges/focus rings, Neutral → soft background tinting only (never text).

**Work Stream C — Contract signing + invitation email.** `/sign/[token]` now shows the venue's logo/name/color and has its own favicon. `sign-form.tsx`'s Sign button and consent checkbox now use venue primary/accent. Built a new branded contract-invitation email (`lib/email/contract-invite.ts`) and a shared white-label email wrapper (`lib/email/venue-brand.ts`), wired into `sendContract()` — the contract-send workflow previously sent no email at all.

**Work Stream D — Print documents.** All 6 (invoice, day-sheet, timeline, floor plan, seating, calendar) now carry a logo slot in the header and no "Powered by Wevenu" footer. Invoice and day-sheet were already fully branded from earlier work; the other four were patched.

**Work Stream E — Transactional emails.** Wired real venue color into every email that was using Wevenu's own hex values "by coincidence" (tour confirmation, client/participant/contact portal invites, task-reminder emails). Removed Wevenu attribution from every customer-facing footer. Left team-invite, vendor-invite, and daily-digest emails untouched — their recipients are software users (staff, vendors, venue owners), not customers.

**Work Stream F — Public guest routes.** Tour scheduler (`/book/[key]`) rewired from hardcoded sage to venue colors, logo added, `.ics` export de-branded, "Powered by Wevenu" footer removed. RSVP and wedding-website footers de-branded. Fixed the title-template bug (`"%s · Wevenu"` root template silently appending to every one of these 5 public routes' tab titles) and added a per-venue favicon to all 5.

---

## Judgment calls

These are the decisions made without stopping to ask, per the standing instruction to remove any newly-discovered customer-facing Wevenu attribution and document the calls here.

1. **Daily digest keeps "Powered by Wevenu."** Its recipient is `venue.owner_email` — the venue owner, a software user managing their business, not a customer. The original plan draft (written before the customer-vs-software-user distinction was made explicit) had incorrectly listed this for removal; corrected during implementation.

2. **RSVP page's color system stays the couple's own wedding-website `accentColor`, not venue branding.** Confirmed by reading `get_rsvp_context`: the color has always come from `couple_websites.accent_color`, never from the venue. Only the "Powered by Wevenu" text was removed from the footer; the color itself was correctly out of scope, consistent with the explicit decision that the Hosted Experience stays under the couple's own aesthetic system.

3. **Wedding-website favicon uses a neutral fallback, not the venue's logo.** `get_wedding_website` is a large, actively-evolving Hosted Experience read RPC with no venue join today. Extending its shape for a browser-tab icon (chrome, not content) wasn't worth the risk to a complex RPC outside this initiative's boundary — the neutral fallback still removes the Wevenu favicon, which was the actual problem.

4. **TAUPE / neutral-for-text-legibility.** Wherever a hex like `#B8AEA1` was used for body text, borders, or icon-legibility (portal, tour scheduler footer), it was left as a fixed neutral gray rather than mapped to `venue.neutralColor`. A venue's own "neutral" color often defaults near-white; using it for text would be an accessibility regression. The Neutral role is scoped to background/panel tinting only.

5. **Semantic/status colors are never brand targets.** RSVP lifecycle states, invitation statuses, paid/overdue/error colors were left untouched everywhere they appear — they encode meaning, not brand.

6. **Luv's persona color (`#D8A7AA` / `#C17F84`) is not a venue-branding target**, except where it was actually being used as the *couple's own* outgoing chat-bubble color inside an otherwise Luv-branded file (`luv-ask-section.tsx`) — that one instance was corrected to venue-primary because it wasn't really Luv's color to begin with.

7. **Additional customer-facing surfaces found and fixed, beyond the original plan:**
   - The RSVP guest-invitation email (`app/api/portal/invite/route.ts`) — the single biggest miss. It was sending guests a fully hardcoded Wevenu-sage-branded HTML email with a literal "Powered by Wevenu" footer. Now uses the venue's real color/logo and has no software attribution.
   - The couple-participant invite email (`app/api/portal/participants/route.ts`) — hardcoded Luv-rose CTA button, now venue-primary (resolved via the existing `resolvePortalContext` helper rather than a new migration).
   - The tour-scheduler's public booking page and its `.ics` calendar export — entirely unbranded before this pass (hardcoded Wevenu sage throughout, `wevenu.com` in the ics `UID`).
   - Title-template inheritance bug affecting 5 separate public routes (portal, sign, RSVP, wedding website, tour booking, questionnaire, inquiry form) — the root layout's `"%s · Wevenu"` template was silently appending to every one of these customer-facing tab titles.

8. **Team-invite and vendor-invite emails keep "on Wevenu" / "Powered by Wevenu."** Their recipients (staff joining a venue's team, vendors joining the Vendor App) are software users per the explicit rule, not venue customers.

9. **`FROM_EMAIL` fallback (`"Wevenu <onboarding@resend.dev>"`) was left as-is.** This is a pre-existing platform-level sender-identity default used everywhere `sendEmail()` is called, not something newly introduced. Giving each venue its own verified sending domain is an email-infrastructure capability, not baseline color/logo wiring — Future Product Evolution, not this phase.

---

## Explicitly not touched (by design, not oversight)

- Advanced branding controls, custom design systems, per-section theming — future Venue Brand Experience work, per the original scope boundary.
- The Hosted Experience (wedding website)'s own color/typography/imagery system — stays entirely the couple's, never venue-branded.
- `hq/`, `admin/`, `vendor/` authenticated surfaces — software-user-facing, Wevenu branding intentionally retained.

## Next

Per the approved roadmap, next up is **RC2 — Messaging & Conversations**, not to be deferred further.
