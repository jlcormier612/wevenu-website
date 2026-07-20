# Venue Brand Experience — Phase 1 — Implementation Plan

**Governing principle:** *A couple should remember the venue — not the software.*
**Built from:** `docs/venue-brand-experience-phase1-assessment.md` (Research + Assessment + answered scope questions).
**Architecture check:** No new architectural concept. This wires already-existing venue data (`primary_color`/`secondary_color`/`accent_color`/`neutral_color`/`logo_url`, all already on `venues`) into surfaces that currently hardcode Wevenu's own look, and removes Wevenu attribution text/assets from customer-facing surfaces. The one net-new piece (a contract-send email) is a template using the same pattern as every other email, not a new subsystem.

---

## Color Roles (applied consistently everywhere, not re-derived per file)

| Role | Applies to |
|---|---|
| **Primary** | Header/hero backgrounds, primary CTA buttons ("Save," "Submit," "Finalize"), active-nav state |
| **Secondary** | CTA hover/pressed states, gradient second-stops |
| **Accent** | Progress rings, checkboxes' checked state, badges, focus rings |
| **Neutral** | Soft background/panel tinting |

Luv's own dusty-rose (`#D8A7AA`) and every functional/semantic status color (paid/overdue green/red/amber, RSVP status colors) stay exactly as they are — not brand targets, per the assessment's own finding.

---

## Work Stream A — Data Layer

1. **Migration**: extend `get_portal_context` RPC's `jsonb_build_object('venue', ...)` to include `primaryColor`/`secondaryColor`/`accentColor`/`neutralColor`/`logoUrl`. Update `PortalContext["venue"]` type (`lib/portal/types.ts`) to match.
2. **Migration**: extend `get_contract_by_token` RPC to include venue name (currently missing entirely) plus the same 4 colors + logo. Update `lib/contracts/repository.ts`'s mapping and whatever type the sign page consumes.
3. Verify both RPCs at exactly one overload after the corrective migrations (standing discipline).

## Work Stream B — Couple Portal

1. Inject `--venue-primary`/`--venue-secondary`/`--venue-accent`/`--venue-neutral` as inline CSS custom properties on `PortalShell`'s root wrapper, sourced from `context.venue`.
2. Across the ~16 portal section files (`portal-shell.tsx`, `budget-section.tsx`, `guest-section.tsx`, `payment-section.tsx`, `seating-section.tsx`, `timeline-section.tsx`, `vendor-section.tsx`, `venue-guide-section.tsx`, `couple-documents-section.tsx`, `requests-section.tsx`, `message-section.tsx`, `finalize-guest-count-card.tsx`, `website-studio.tsx`'s own wizard chrome): replace every hardcoded Wevenu-palette usage (`SAGE`/`TAUPE`/`LINEN`/`CREAM` constants *and* the several inline literal hex values that don't even go through those constants) with the matching `var(--venue-*)` reference, per the role table above. Leave every Luv-rose (`#D8A7AA`/`ROSE`) and functional-status color untouched.
3. Add the venue logo to the portal header (currently plain text only) — conditionally rendered, matching the invoice document's already-proven `venue.logoUrl &&` pattern.
4. Remove the "Powered by Wevenu · {venue}" footer (`portal-shell.tsx`) — the venue's own name-only, no attribution.
5. Fix the "✦ Wevenu noticed" → "✦ Luv noticed" copy inconsistency found in passing (two spots) — a correctness fix, unrelated to branding, done because it was found.
6. Fix the browser tab title (`generateMetadata` in `app/(portal)/p/[token]/page.tsx`) to use `title: { absolute: ... }` so the root layout's `"· Wevenu"` template stops appending.
7. Add a per-segment `icon.tsx` for `app/(portal)/p/[token]/` (and the `not-found.tsx` case) rendering the venue's own logo as the favicon when set, falling back to a neutral (non-Wevenu) icon when not — one small shared icon-generation helper reused everywhere this is needed (see Work Stream E).
8. Explicitly preserved, not removed: the Wevenu-attributed NPS feedback step ("this goes only to Wevenu, never to {venue}") — this is a functional disclosure about who receives that specific answer, not brand attribution, and removing "Wevenu" from it would make it confusing about where the feedback actually goes.

## Work Stream C — Contract-Signing Page + New Contract-Send Email

1. Apply venue colors/logo to `app/sign/[token]/page.tsx` and `sign-form.tsx` (currently 100% gray-scale, doesn't even show the venue's name) — same CSS-var mechanism as the portal.
2. Remove "This document was prepared using Wevenu."
3. Fix title/favicon per B.6/B.7's pattern.
4. **New**: build a branded contract-send email (new file, e.g. `lib/email/contract-invite.ts`, mirroring the existing template shape) triggered from `sendContract()` (`lib/contracts/service.ts`) — venue logo, venue primary color header band, a clear "Review & Sign" CTA linking to `/sign/{token}`, no Wevenu attribution. This closes the gap where staff currently must manually copy-paste the sign link.

## Work Stream D — Print Documents (extend the existing partial pattern to full)

1. Wire `secondaryColor`/`accentColor`/`neutralColor` into all 6 print documents (invoice, day-sheet, timeline, floor-plan, seating, calendar) per the role table — today only `primaryColor` is used anywhere.
2. Add the missing logo slot to the 4 documents that don't have one (timeline, floor-plan, seating, calendar print), matching the invoice document's conditional pattern.
3. Remove "Powered by Wevenu" from the 5 documents that have it (day-sheet, timeline, floor-plan, seating, calendar) — the invoice document is already correctly clean; make the other 5 match it, not the reverse.

## Work Stream E — Client-Facing Emails

1. Add one small shared helper (e.g. `lib/email/venue-brand.ts`) that takes a `Venue`-shaped object and returns the resolved header/CTA colors + logo `<img>` HTML snippet — used by every template below, so this exists in one place instead of being re-derived per file.
2. Thread real venue color/logo data into every template currently hardcoding `#5D6F5D`/`#D8A7AA`/etc. "by coincidence": portal invite (`app/api/portal/invite/route.ts`), reminders (`lib/notifications/templates.ts`), tour confirmation (`lib/tours/communication.ts`), participant/client/contact portal invites (`app/api/portal/participants/route.ts`, `lib/client-auth/service.ts`, `lib/contacts/service.ts`), the new contract-send email (Work Stream C).
3. Remove Wevenu attribution from every template footer: daily digest, team invite, vendor invite, portal invite, reminders (`"Sent by {venue} via Wevenu"` → `"Sent by {venue}"`), legacy message notifications (`"Wevenu · Your venue planning platform"` → removed or replaced with the venue's own name).
4. Explicitly out of scope, confirmed intentional: `lib/feedback/notify.ts` — internal Wevenu-only inbox notification, not customer-facing, left untouched.
5. Team invite and vendor invite emails go to **venue staff and vendors respectively, not couples** — per the "Wevenu branding belongs only inside the venue's authenticated administration experience" rule, these arguably could keep Wevenu attribution (the recipient is joining *Wevenu*-the-software as a team member/vendor, not experiencing the venue's own brand as a customer). Flagged as a judgment call to confirm during implementation rather than assumed silently either way — team/vendor invites sit in a gray zone between "customer-facing" and "internal-to-the-software."

## Work Stream F — Public Guest-Facing Routes (theme untouched, attribution removed)

1. Wedding website (`components/wedding-website/wedding-website.tsx`): remove "Made with Wevenu" footer line.
2. RSVP page (`components/wedding-website/rsvp-page.tsx`): remove "Powered by Wevenu · {venue}" footer.
3. Tour-booking page (`components/tours/tour-scheduler.tsx`): remove "Powered by Wevenu" footer; wire its currently-fixed Wevenu-sage chrome to `venue.primaryColor`/`accentColor`, matching the pattern the inquiry form and questionnaire already correctly use; de-brand the `.ics` export (`PRODID`/`UID` no longer reference Wevenu).
4. Fix title/favicon inheritance (per B.6/B.7's shared pattern) on all 5 public routes: wedding website, RSVP, tour-booking, inquiry form, questionnaire — plus their respective `not-found.tsx` pages.
5. Inquiry form and questionnaire: no color-wiring work needed (already correct); title/favicon fix only.

---

## Explicitly Not Touched

- The wedding website's own Collections/Color-Story/Typography theme system — the couple's aesthetic, confirmed out of scope.
- Wevenu attribution inside the coordinator's own authenticated app (login, Settings, help/support surfaces) — this audience is the venue itself, a different rule applies.
- The Wevenu-attributed NPS feedback step in the couple portal — a functional disclosure, not brand attribution.
- Advanced branding controls, a brand-recommendation engine, custom design systems — remain the separately-approved, still-deferred Venue Brand Experience *evolution* phase.

---

## Verification Plan

- `tsc --noEmit` + `npm run build` after each Work Stream, not just at the end (standing discipline).
- Live-tested: a real venue with custom (non-default) colors and a real logo, confirmed rendering correctly across portal, contract page, all 6 print documents, and at least one representative email (rendered HTML inspected, not just sent) — specifically to catch the "coincidence" bug the assessment found (colors that happen to match Wevenu's own defaults would hide a wiring bug for any venue that never customized them).
- A second real venue *without* a custom logo/colors set, confirmed to fall back sanely (no broken image tags, sensible default colors) everywhere.
- Grep sweep for the literal string "Wevenu" across every touched customer-facing file after implementation, to confirm nothing was missed — cheap and exact given this phase's own subject matter.
- Manual/visual check of email rendering and the contract-signing page's look — this environment's standing browser-driving limitation, noted rather than silently skipped.

---

## Sizing, Honestly

Larger than the original "baseline wiring" framing implied, once the four scope answers were applied: full 4-color role system (not 1–2 colors), Wevenu-attribution removal across ~10 surfaces (not the original 3), and one net-new branded email. Still no new architecture — this is real, but bounded, mechanical work across many files rather than a small number of complex ones. Estimated as a single large (L) pass, not several separate initiatives.

**One open judgment call carried into implementation, not blocking the start:** whether team/vendor invite emails (Work Stream E.5) should keep or lose Wevenu attribution, given their recipients are joining the software as collaborators rather than experiencing it as the venue's customer. Will default to *keeping* Wevenu attribution there (treating "team/vendor onboarding into the software" as adjacent to the authenticated-app exception) unless corrected.
