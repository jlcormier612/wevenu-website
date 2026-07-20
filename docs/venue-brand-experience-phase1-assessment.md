# Venue Brand Experience — Phase 1 (Baseline Wiring) — Research & Assessment

**Governing principle:** *A couple should remember the venue — not the software.*
**Scope:** Baseline wiring only — render the venue's already-existing brand data (colors, logo) on every customer-facing surface that currently hardcodes Wevenu's own look. No advanced branding controls, no custom design system, no brand-recommendation engine (that's the separately-approved, still-deferred Venue Brand Experience *evolution* phase).

---

## 1. What already exists (the data model — nothing new needed here)

`venues` already has `primary_color`, `secondary_color`, `accent_color`, `neutral_color` (all `NOT NULL` with sane defaults) and a nullable `logo_url`. This is genuinely a wiring problem, not a data-model problem — confirmed by reading the schema directly, not assumed.

## 2. What's actually branded today — smaller than believed

**PDFs/print documents** (invoice, day-sheet, timeline, floor-plan, seating, calendar) are the reference pattern, but only partially:
- Only `primaryColor` is read anywhere — `secondaryColor`/`accentColor`/`neutralColor` exist on the model but are used by zero print documents.
- Logo renders on only 2 of 6 documents (invoice, day-sheet) — the other four (timeline, floor-plan, seating, calendar print) have no logo slot in their markup at all, despite having the same `venue` object available.
- **5 of 6 still print a literal "Powered by Wevenu" footer.** Only the invoice document is fully clean (venue's own business info only, no Wevenu attribution anywhere).

**Couple portal, transactional emails, and the contract-signing page are all unbranded today — confirmed at zero, not partially:**
- The portal's data layer (`get_portal_context` RPC) never returns venue colors or logo — the frontend literally cannot brand anything even if a component tried. ~16 portal component files each independently hardcode a Wevenu palette (`SAGE #5D6F5D`, `ROSE #D8A7AA`, `LINEN #F7F5F1`, `TAUPE #B8AEA1`), with at least 3 slightly-different copies of "the same" palette scattered across files (no shared theming module).
- "Powered by Wevenu · {venue name}" prints unconditionally in the portal's global footer. The browser tab title composes to `"{names} — {venue} · Wevenu"`. The favicon is Wevenu's, with no override mechanism.
- Several client-facing emails (portal invite, reminders) hardcode `#5D6F5D`/`#D8A7AA` — these happen to equal Wevenu's *own* default venue colors by coincidence, not because they're actually reading the venue row. Real per-venue branding will only become visible for venues who've actually customized their colors.
- The contract-signing page's own data layer (`get_contract_by_token`) doesn't return the venue's name, let alone colors or logo — this is the least venue-aware surface in the audit.
- **A genuine adjacent gap, found rather than assumed:** there is no "contract sent" email at all. `sendContract()` only flips status and logs an activity; staff manually copy-paste the sign link into their own outbound channel. There's no template to brand because the automated send doesn't exist.

## 3. A real, separate finding: Luv's identity vs. the portal's chrome

The dusty-rose `#D8A7AA` used throughout the portal is not generic decoration — it traces consistently back to Luv's own cross-app persona color (used identically in the dashboard widget, draft panels, the intro card, Settings). Every rose-tinted "observation" panel in the portal (budget, guests, payments, seating) is Luv-authored content. **Recommendation: Luv's own color stays constant across venues** — she's a consistent Wevenu-provided presence inside a venue-branded room, the same way a hotel's own concierge wears the hotel's badge but keeps their own name tag. `SAGE`/`TAUPE`/`LINEN`/`CREAM` (Wevenu's neutral/primary palette, unconnected to Luv) are the actual venue-branding targets.

One small, unambiguous bug found in passing, unrelated to branding: two spots in the portal say **"✦ Wevenu noticed"** instead of "Luv noticed" — a copy inconsistency against the platform's own established Luv-persona pattern everywhere else. Will fix as a small in-passing correction.

## 4. The mechanism to extend (already proven once)

`app/(portal)/layout.tsx` already does exactly the right kind of thing — it injects a `LIGHT_THEME_VARS` object of CSS custom properties onto the layout root to force light mode regardless of the coordinator's own OS preference. This is the natural, already-proven insertion point for venue CSS variables (`--venue-primary`, `--venue-accent`, etc.) that portal components can migrate onto instead of raw hex literals.

---

## Scope-defining questions — answered

1. **Wedding Website/RSVP theme:** stays fully the couple's own (Collections/Color Stories) — untouched. But Wevenu-attribution *chrome* (footer text, favicon, page-title suffix) on all public guest-facing surfaces is in scope, separately from the theme question.
2. **Color scope:** all 4 colors, each with one clear, consistent role — not full theming, not single-color:
   - **Primary** — dominant brand color: header/hero backgrounds, primary CTA buttons, active-nav state.
   - **Secondary** — CTA hover/pressed states, gradient second-stops.
   - **Accent** — highlights: progress rings, checkboxes, badges, focus rings.
   - **Neutral** — soft background/panel tinting (replacing the Wevenu-palette's soft creams/taupes used for panel backgrounds — not general muted body text, which stays theme-semantic).
3. **Wevenu attribution:** removed entirely from every customer-facing surface (portal, contract page, all 6 print documents, all client-facing emails, the public wedding site, RSVP, tour-booking). Wevenu branding is kept only inside the coordinator's own authenticated app (login, help, about, support) — that's a *different* audience (the venue itself, who knows and chose the software), not the couple/guest/vendor.
4. **Missing contract-send email:** build it now, branded from day one, as a first-class part of the core booking workflow — not deferred to Messaging & Conversations.

## Additional surfaces found via the attribution-removal lens (scope grew, not shrank)

Because "remove Wevenu attribution" reaches further than the original 3 named surfaces, a follow-up, more targeted audit of every public guest-facing route found:
- **The public wedding website's own footer** says "Made with Wevenu" — same category as "Powered by," needs removal.
- **The RSVP page** has its own "Powered by Wevenu · {venue}" footer.
- **The public tour-booking page** (`app/book/[key]`, `components/tours/tour-scheduler.tsx`) has its own "Powered by Wevenu" footer, and — like the couple portal — is fixed Wevenu-sage chrome that never reads the venue's own colors at all (unlike the inquiry form and questionnaire, which already correctly apply `venue.primaryColor`). This is a second full instance of "unbranded fixed chrome," not just an attribution string to delete.
- **The tour-booking page's `.ics` calendar export** embeds `PRODID:-//Wevenu//...` and a `@wevenu.com` UID — small, but genuinely customer-facing (it's what shows up in a couple's own calendar app).
- **Every public/guest route's browser tab title** composes through the root layout's title template (`"%s · Wevenu"`) and inherits the root Wevenu favicon, with no per-route override anywhere — this affects all 7 customer-facing routes (portal, contract page, wedding website, RSVP, tour-booking, inquiry form, questionnaire), not just the portal.
- The inquiry form and questionnaire are already correctly wired to `venue.primaryColor` — good, less work there; they still need the title/favicon fix like everything else.

**Honest sizing update:** the four answers meaningfully grew this phase past its original "baseline wiring" framing on paper size (4 colors with defined roles rather than 1–2; attribution removal across ~10 surfaces rather than 3; a net-new branded email). None of this is new *architecture* — it's still wiring and content-stripping against already-existing data — but it is now a genuinely large (L) implementation pass, not a medium one. Naming this plainly before starting, not discovering it partway through.
