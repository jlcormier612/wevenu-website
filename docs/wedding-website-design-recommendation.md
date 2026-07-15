# Wedding Website Design Recommendation

**Status: research complete, design-only — no implementation.** This document synthesizes an internal audit of Wevenu's current wedding-website feature with an external competitive study of nine platforms (The Knot, Zola, Minted, Joy, Riley & Grey, Bliss & Bone, Appy Couple, Squarespace, Wix, plus Showit and Cargo as reference points). It exists to answer one question before any rebuild begins: **what should a premium Wevenu Website experience become?**

Per your instruction, this is not a feature checklist and not a mandate to recreate any competitor. It's a design point of view, grounded in evidence, that should be reviewed and argued with before a single line of implementation starts.

---

## The core thesis

Every competitor studied — mass-market, boutique, or freeform — is selling a **standalone artifact**. The couple types their story once, uploads photos once, builds their schedule once, and none of it talks to anything else in their wedding. That's a structural ceiling none of them can cross, because none of them has anything else.

Wevenu already has the wedding. The Timeline knows when things happen. Event Order knows what's included. Floor Plans know where things happen. Travel and Planning know what the couple has already decided. Communication knows what guests have already been told. Luv already writes in this platform's voice.

**The wedding website should be the guest-facing surface of a wedding Wevenu already knows — not a fourteenth place to type the same details in a different box.** That's the one advantage no competitor in this study can copy, because it requires owning the whole event, not just the page. Everything below is in service of that thesis: fix what's broken, adopt what the market has proven works, and then build the parts only an integrated platform can build.

---

## Part 1 — Fix first: these are bugs, not design gaps

The internal audit surfaced real defects that should be fixed on their own merit, independent of any redesign timeline. They undercut trust in a way no visual improvement can compensate for:

1. **The published site ignores the couple's chosen theme.** `get_wedding_website` (the public-facing RPC) doesn't return `themePalette`, `fontPairing`, or `sectionOrder` at all. A couple can spend an hour in the Studio picking a palette and reordering sections, publish, and their guests see none of it. This is the single most damaging bug in the current feature — it makes every other design decision downstream of it moot until it's fixed.
2. **The Font Pairing picker does nothing.** It's a real control in the editor with zero rendering effect — `resolveTheme()` never reads `fontPairing`. A dead control is worse than no control; it teaches couples not to trust the other controls either.
3. **The password gate compares in plaintext.** The original migration's own comment flags this ("bcrypt or plain text — compare in function"), and it's still plain text, passed as a URL query param. Low severity for a wedding site, but worth closing before any wider marketing push.
4. **Bridal party has no photo upload UI**, despite `bridal_party.members[].photoUrl` existing in the data model. The field was built; the editor to fill it wasn't.

None of Part 2 or Part 3 below matters if a couple can't trust that what they build is what guests see. This should be sequenced first.

---

## Part 2 — What the market has actually converged on

Nine products, three tiers, one consistent story: **the emotional and "premium" signal in this category comes from typographic restraint, curated bundling, and RSVP personalization — not from feature count, and only loosely from raw design freedom.**

### Restraint beats freedom, consistently

Every tier confirms this, from opposite directions:

- **Mass-market (Knot/Zola/Minted):** none of them gives couples a raw font picker or color wheel. All three sell a *named design* — a bundle of one font pairing, a small fixed set of colorways, and a matched illustration/photo treatment. The templates every reviewer calls premium (Zola's Verona, Minted's artist collections) use one accent color and two fonts with real white space. The ones called dated stack multiple decorative fonts and saturated palettes. **Premium and generic are the same mechanic at different levels of restraint, not different feature sets.**
- **Boutique (Joy/Riley & Grey/Bliss & Bone/Appy Couple):** scarcity and constraint are marketed as the feature, not apologized for. Riley & Grey has "under 100" designs against Zola's 200+, framed as curation. Bliss & Bone's editor **structurally forbids** per-page font or color drift — you cannot make your own site inconsistent even if you try. The strongest customer quote found anywhere in this research: *"We received many compliments on our website, and many thought we had hired a designer"* — about the platform with the most constrained editor in the entire study, not the most flexible one.
- **Freeform (Squarespace/Wix/Showit):** this is the controlled experiment that proves the point directly. Squarespace and Wix offer nearly identical raw design freedom. Squarespace gates it through a sitewide Style Editor (font-category changes and a generated color palette propagate everywhere automatically); Wix's classic editor styles per-element with no gate. The measurable result: Squarespace's median wedding site is visibly more coherent than Wix's, because **the system enforces consistency, not the couple's taste.** Freedom without a gate produces variance, not quality.

**Implication for Wevenu:** the existing Collection × Palette model (8 collections, 24 palette combinations) already has the right shape — a bundled aesthetic system, not a toolkit. The mistake is that Font Pairing was bolted on as a separate, ungated control instead of being folded into the same bundle. Fix that inclusion, don't abandon the bundling philosophy — it's the thing the market rewards most.

### Motion is a hard cap, not a toolkit

Scroll animation shows up as a real feature in exactly two places worth learning from: Squarespace's four sitewide presets (Fade, Scale, Slide, Clip — applied at template level, no per-block control) and Wix's much more granular per-element system (parallax, reveal, 3D, skew, a dozen more, independently tunable). Squarespace's blunter tool produces more consistently tasteful results. The failure mode documented everywhere in the freeform tier is never "too subtle" — it's five different effects firing on one page. **A small number of sitewide presets, off by default, beats a rich per-element toolkit.**

### The single-scroll page has won

Even where multi-page navigation is offered (Zola), most named templates default to single continuous scroll with anchor-link navigation. Minted builds one scrolling page and fakes a multi-page nav bar on top of it. The wedding website has converged on functioning like a long-form keepsake document a guest scrolls top to bottom once, not a conventional informational site with real pages. Wevenu's current single-scroll, section-order model is already aligned with the market here — no change needed to the fundamental shape.

### Photo-and-copy-led composition is the actual differentiator, not photo quality

The most emotionally striking examples across every tier share one move: **type overlapping a photo, an asymmetric collage instead of a symmetric grid, a photo choice that's specific rather than generic** (a childhood photo, an overexposed candid, a proposal video as the hero, instead of a posed engagement portrait in a rectangle). None of this requires more data fields. It requires letting a photo and a headline share a composition instead of stacking in fixed, separate blocks. This is the highest-leverage, lowest-cost visual upgrade available — it's a layout capability, not a content requirement.

### RSVP personalization is the real emotional lever — and the one no freeform tool can build

This is the most important finding in the entire study, because it's the one place Wevenu is structurally best-positioned to win.

- The Knot auto-labels an unnamed plus-one as *"[Name]'s guest"* until updated.
- Zola tags specific events "Definitely Invited" so private events (a rehearsal brunch) only ever surface inside an *invited* guest's own RSVP flow — never on the public schedule.
- Minted does the same via per-event guest tagging with login-gated visibility.
- Riley & Grey goes furthest: the *couple's own editor* has a "preview as a specific guest" mode, so they can confirm exactly what a named guest will see — which events, which RSVP fields — before publishing.
- Every general-purpose tool (Squarespace, Wix, Showit) has **no native equivalent at all.** Every single reviewed example bolts on a third-party form (Typeform, ouRSVP, RSVPify), which reviewers consistently flag as the visible seam — different fonts, different colors, sometimes an off-site redirect — in an otherwise bespoke site. This is the freeform tier's one uncontested weakness, and it's uncontested because none of these products own a guest record.

**Wevenu already owns the guest record.** The internal audit confirmed Wevenu already has two RSVP surfaces built on real household/party data (`HouseholdMemberRow`, personalized tokens). No competitor in this study — not even Riley & Grey — has this data natively; they simulate it inside a website product. Wevenu can do the real thing: native per-event guest visibility, a genuine "preview as this guest" mode inside the Studio, and one consistent RSVP flow instead of the two inconsistent ones that exist today. This is the single highest-leverage opportunity in this entire document.

---

## Part 3 — Where Wevenu is currently behind

Stated plainly, grounded in the internal audit:

- **Trust-breaking bugs** (Part 1): theme/section order not rendering publicly, dead font-pairing control, plaintext password gate.
- **Two inconsistent RSVP surfaces** on the same site (a richer personalized token page vs. a thinner embedded lookup-code section) — exactly the kind of seam competitors get mocked for, except Wevenu didn't need to bolt on a third party to create it.
- **No genuine typography system** — Font Pairing exists as UI but isn't part of the bundle the way palette is, so there's no equivalent of Bliss & Bone's structural consistency or Minted's font+color bundling.
- **Section reordering is up/down-arrow only** — every competitor with any layout flexibility at all (Joy's mix-and-match, Squarespace's Fluid Engine) treats reordering as a drag operation, not a button you click N times.
- **Composition is rectangle-stacking, not layered** — photo blocks and text blocks are fixed, separate rectangles; none of the "photo and headline share a composition" pattern that drives the market's most emotional examples exists yet.
- **No motion system at all** — not even the restrained, sitewide-preset version that Squarespace shows is the right amount.
- **Data integration is inconsistent and mostly manual**, which is the most important gap relative to Wevenu's own stated advantage: only Event, RSVP stats, and Schedule (when synced) are genuinely live; Story, Cover Photo, and Venue Address are one-time-copied from Planning and then silently drift out of sync with no indication anything changed; Registry, Travel, Bridal Party, Dress Code, Music, FAQ, Gallery, and Things To Do are entirely manual, typed twice by the couple with zero connection to data Wevenu already has elsewhere. This is the platform's whole reason to exist in this category, and today it's true for maybe a quarter of the feature's surface area.

None of this is damning on its own — it's exactly what you'd expect from a v1 built to reach feature parity. The point of naming it precisely is that "where we're behind" and "where we can leapfrog" turn out to be the same list, viewed from two different angles.

---

## Part 4 — Where Wevenu can leapfrog, specifically through integration

This is the section no competitor in this study can copy, because it requires owning the whole event, not just the website. For each integration, the test is: *does the platform already know this, and if so, why is the couple typing it again?*

- **Timeline → Schedule.** Already genuinely live-synced today — this is proof the pattern works, not a new idea. The recommendation is to treat this as the template for every other section below, not to leave it as the one exception.
- **Event Order → "What's Included."** Event Order already knows the real, committed details of the day — catering selections, room setup, vendor coverage. A curated, couple-approved guest-facing teaser ("Dinner: plated three-course, bar: open until 10pm") turns a document that exists purely for internal financial/logistics tracking into guest-facing hospitality, with zero duplicate entry. No competitor has an Event Order to draw from.
- **Floor Plans → Venue Orientation.** A simple, guest-friendly visual of where the ceremony is versus the reception, where parking or the entrance is — pulled from a Floor Plan that already exists for the venue's own operational use. This is a genuinely new guest-experience category; nothing in the competitive study offers anything like it, because none of them have floor plan data.
- **Travel → real accommodation and logistics data.** The audit found Travel is currently fully manual on the website side. If Wevenu's platform already captures venue-side travel/accommodation logistics (room blocks, parking, preferred vendors) anywhere else, that should flow in as a starting point the couple edits, not a blank form.
- **Planning → Story, Cover Photo, Venue Details.** Currently one-time-copied and then silently stale. The fix isn't necessarily full live sync (the couple's "our story" text is their voice, not data) — it's making the relationship between Planning and the website *visible and intentional*: a "synced from Planning" indicator with an explicit refresh action, so staleness is a choice the couple made, not something that happened to them silently.
- **Communication → guest updates.** If a synced Timeline detail changes after the site is published (a venue change, a time shift), that's exactly the kind of update that currently requires the couple to remember to separately message guests. The platform already knows a change happened — surfacing "this changed, want to notify your guests?" closes a loop every other product leaves entirely manual.
- **Luv → assisted content, grounded in real data.** Every competitor's "our story" and event-description fields are blank textareas. Luv already exists elsewhere in this platform and already has context on this couple's actual Planning answers and event details. A first-draft assist that's genuinely grounded in what Wevenu already knows about this specific wedding — not a generic AI-writes-anything gimmick — is a capability no wedding-website competitor can build, because none of them have an assistant with real relationship/event context to draw from.

The throughline: **classify every section explicitly by its real relationship to platform data**, and stop treating "manual entry" as the default:

| Tier | Behavior | Sections |
|---|---|---|
| **Live-synced** | Reflects platform data automatically, no couple action needed | Schedule (already live), Event Order teaser, Floor Plan visual |
| **Guided, couple-owned** | Pulled once as a starting point, visibly marked as sourced, explicit refresh available | Story, Cover Photo, Venue Details, Travel |
| **Couple-authored** | Genuinely the couple's voice — should stay manual, possibly Luv-assisted | Registry, Music, FAQ, Things To Do, Dress Code, Bridal Party |

This tiering — not "sync everything" — is the actual recommendation. Some sections should stay hand-written because a wedding website full of auto-generated text stops feeling like the couple's.

---

## Part 5 — Design system recommendations

Translating Parts 2–4 into a coherent point of view for what to build:

1. **Extend the Collection × Palette bundle to include typography.** Replace the dead, freestanding Font Pairing picker with a small number (roughly 8–12) of named, curated font pairings baked into each Collection the same way palettes already are — bundled, not freely combinable. This is directly what the market rewards most (Part 2) and it's the smallest structural change relative to what already exists and already works.
2. **Add a real motion system, deliberately small.** 2–3 sitewide, restrained presets (a slow fade, a gentle rise) applied at the theme level, off by default, never a per-block picker. Matches the one place the freeform tier's evidence is unambiguous.
3. **Allow photo-and-copy composition to break the rectangle-stack, in a small number of curated layout variants per section** — not a freeform canvas. This keeps Wevenu's core promise (fast, low-friction, can't produce something ugly) while capturing the single biggest emotional-impact pattern found across every tier of competitor.
4. **Real drag-to-reorder for sections**, replacing up/down arrows.
5. **Unify the two RSVP surfaces into one**, and build a "preview as this guest" mode into the Studio — the highest-leverage, most defensible recommendation in this document, for the reasons in Part 2.
6. **Build the section-tiering model from Part 4 directly into the editor UI** — a visible distinction between "synced," "sourced, editable," and "written by you," rather than twelve identically-styled form panels that give no indication which of them are already stale.
7. **Keep editing panel-based with live preview, not a freeform WYSIWYG canvas.** This is a deliberate rejection of the Squarespace/Wix/Showit model — the evidence in Part 2 says non-designers produce more consistent, more premium-feeling results inside a well-gated system than inside true freedom, and that's already Wevenu's philosophy across the rest of the platform. The Studio's existing split-pane live-preview shell is the right shape; it needs a richer bundle (typography, motion, composition) to be gated through, not a different editing model.
8. **Build responsive layouts on a grid/flex model from the start, one build target, no separate mobile pass.** This avoids Wix's most-documented failure (desktop and mobile edited independently, silently breaking) without paying Showit's cost (fully separate hand-built mobile canvas, double the design labor).

---

## What this document is not

It is not a spec, a section-by-section wireframe, or a migration plan. It's the point of view the next design pass should be argued from. The recommended sequencing is: fix Part 1's trust-breaking bugs, review and refine this document with you, then move to actual design work (wireframes, a real section-tiering UI, the unified RSVP flow) — with no implementation starting before that review, per your instruction.
