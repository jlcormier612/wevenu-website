# Wedding Website v2 — The Guest-Facing Experience of the Platform

**Status: design only, evolving the original recommendation. No implementation has started.** This document builds directly on `docs/wedding-website-design-recommendation.md` — it doesn't replace that document's competitive grounding or its "digital front door" thesis, it deepens seven specific dimensions of it per your direction, anchored by one guiding principle stated as plainly as possible:

> **The website should feel like a luxury invitation suite that stays alive throughout the entire guest journey.**

The reframe underneath everything below: stop thinking of this feature as a website — a collection of pages a couple fills in — and start thinking of it as **the guest-facing experience of the entire platform.** Every other module (Timeline, RSVP, Travel, Event Order, Floor Plans, Communication, Planning) already exists and already knows things about this specific wedding. The website's job is to be the one place a guest experiences all of that as a single, considered, beautiful object — not a form, not a page, an *invitation suite* that happens to live on a screen and happens to keep working after the guest has already RSVP'd.

---

## 1. Typography as a first-class design system

### What real premium invitation brands actually do

Grounding this in direct research across five stationery houses — Minted's invitation marketplace, Bella Figura, Papier, Rifle Paper Co., plus Crane & Co. and Smock as additional evidence — rather than wedding *website* builders (already covered in the original document and confirmed shallow: a font-pairing dropdown, nothing more). The findings converge with unusual consistency across brands with no reason to agree with each other:

- **Total typeface count caps at 2–3, and going lower reads as more sophisticated, not less.** Bella Figura's most polished examples (Alcott, Aviva) use exactly *one* type family, deriving all hierarchy from size, weight, and case alone. Where a second family appears, it's a deliberate register-shift (ornate ↔ plain), not decoration for its own sake.
- **The role hierarchy is real, but it's a hierarchy of roles, not necessarily of separate families**: a display/monogram treatment for the couple's names (the one place ornamentation is earned); a formal serif for announcement text; a plain, highly legible face for logistics (date, time, address, RSVP) — confirmed, without a single exception found in this research, to be **the plainest type on the entire piece, every time, across every brand**; and an optional script/accent reserved for a single word, a monogram, or a divider.
- **Legibility-critical text has zero exceptions.** Not one sourced example anywhere in this research used script or decorative type for an address, an RSVP instruction, or any dense information block. Bella Figura's own real suite pairs an ornate script (Ecatherina) for names against a restrained classical serif (Galliard Pro) for every logistical line on the same card.
- **Full-suite consistency is the actual definition of "a system."** Bella Figura's Deveril and Smock's model both carry the identical two-font pairing across every single piece — invitation, program, menu, RSVP card, save-the-date — rather than letting each piece choose its own fonts. Smock goes further: commissioning bespoke, exclusive hand-calligraphy typefaces from named calligraphers as proprietary brand IP, not licensing a stock script.
- **Non-typographic craft does real "premium" work a screen has to consciously replace.** Ink color, foil depth, paper texture, and — repeatedly cited across sources — generous whitespace, carry as much of the "feels expensive" signal as the letterforms themselves. A digital product loses the physical-material axis entirely and has to compensate through color discipline and spacing, not typography alone.
- **No competitor has convincingly solved this on the web yet.** Papier claims paper-to-digital typographic continuity as a selling point but it's unverifiable from the outside; Rifle Paper Co. sidesteps building its own digital typographic system entirely by partnering with Paperless Post rather than solving it in-house. This is a real, open gap — not a solved problem Wevenu would be copying.

### What this means for the digital system

Not "font choices." A locked, role-based system, defined once per Collection:

| Role | What it renders | Typeface | Hard constraint |
|---|---|---|---|
| **Display / Names** | The couple's names, the hero moment | The most expressive face in the Collection — a refined script or an engraved-style display serif | Never used for anything longer than a name or a short phrase |
| **Announcement** | Section headings, the ceremony/story opening line | A formal serif — often the same family as Info, at larger size/lighter or heavier weight, not a third face by default | Optional per Collection — some Collections collapse this into Info at a different weight, matching Bella Figura's single-family examples |
| **Info / Utility** | Dates, times, addresses, RSVP instructions, all logistics, all form labels | The plainest, most legible face in the Collection, always | **Structurally locked.** This is a distinct component (`InfoText`) that cannot render in the Display or Accent face under any customization path — not a style convention a couple could accidentally violate, an actual constraint in the component library |
| **Accent** *(optional)* | A single word, a monogram, a divider glyph | A script or hand-lettered face, only where a Collection specifically includes one | Capped at a short character count in the component itself — the same discipline Smock and Bella Figura apply by hand, enforced here in code |

This is both a taste decision and, per §5 below, an accessibility requirement — the two arguments reinforce each other rather than competing.

---

## 2. Collection-based design systems, not independent themes

The existing Collection × Palette model (8 Collections, 24 palette combinations, documented in the original recommendation) already has the right instinct — a bundled aesthetic, not a toolkit — but today the bundle only really covers color. Every piece of research in both documents points the same direction: **premium reads as one designer's coherent decisions carried consistently across every surface, not independently-configurable knobs that happen to be pre-populated.**

A Collection should be redefined to bundle, as one inseparable unit:

- **Typography role-mapping** (§1) — which specific faces fill Display/Announcement/Info/Accent for this Collection.
- **Palette** — already built, extend to include the ink-color-does-real-work insight from §1: each Collection's palette should include one designated "ink" tone used consistently across all text roles, not just background/accent swatches.
- **Photography treatment** (§3) — the frame style, crop ratios, and composition patterns this Collection uses.
- **Spacing signature** — how generous the whitespace is, matching the finding that whitespace itself carries premium signal independent of type or color.
- **Motion signature** — at most 2–3 restrained, sitewide presets per the original document's competitive finding (Squarespace's blunt four-preset system reads more tasteful than Wix's granular per-element one); a Collection picks one, it doesn't expose a picker.

A couple picks a Collection the way they'd choose a stationery suite, not the way they'd configure a SaaS dashboard — one decision, everything downstream already coherent. This is the direct digital equivalent of what Deveril and Smock do on paper: the same two fonts, the same ink, the same restraint, on every single piece.

---

## 3. Rich photography presentation

Treat photography as a composition tool, not an upload box. Concretely, per Collection:

- **Framed/matted presentation** — a photo rendered with a deliberate border/mat treatment (simulating the physical-print-in-a-frame feeling a couple's parents' generation associates with "a nice photo of the wedding"), as one of several available treatments per Collection, not a global default.
- **Editorial hero composition** — type overlapping a photo, an asymmetric crop, a name lockup sitting across a horizon line or a shoulder — the single highest-impact pattern identified across every competitor tier in the original research (Squarespace's best examples, Riley & Grey's editorial framing), and one that requires zero new data from the couple, only a different rendering of the photo they already uploaded.
- **Collage/gallery variety by Collection** — a masonry grid, an editorial multi-photo spread, a filmstrip — as a property of the chosen Collection, not a single fixed gallery layout applied regardless of aesthetic.
- **Named "moments," not a generic gallery** — an arrival hero, a story spread (2–3 photos with the couple's story text woven between them, not stacked below), a gallery wall (the closest to a traditional grid, reserved for the largest photo count) — each a distinct, designed composition a couple selects per section rather than one undifferentiated "add photos here" block.

---

## 4. Mobile-first storytelling and section sequencing

The original document already established that a single continuous scroll has won across the market — this deepens *how* that scroll should feel. The target experience is **reading a beautifully designed invitation, not scrolling through blocks.**

- **Sequencing as an authored narrative arc, not a freely reorderable list of generic sections.** A real invitation suite has a deliberate order — the announcement, then the details, then the response card, then the extras — and that order is part of the design, not incidental. The website's section order should default to (and gently guide toward) an equivalent arc: arrival/hero → names and story → the day's shape → practical information → RSVP → staying in touch — rather than treating every section as an interchangeable card a coordinator or couple drags anywhere with no compositional consequence.
- **One idea per screen on mobile**, with generous vertical pacing between moments — matching the whitespace-as-premium-signal finding from §1, and directly avoiding the "block-scrolling" feeling the guiding principle explicitly rejects.
- **Mobile as the primary canvas, not a responsive afterthought.** The original document already recommended building on a grid/flex model rather than absolute positioning specifically to avoid Wix's most-documented failure (desktop and mobile edited independently, silently breaking); this section reinforces that the design and pacing decisions themselves — not just the layout mechanics — should be authored mobile-first, since that's where the overwhelming majority of guests will actually read it.

---

## 5. Accessibility as a core design requirement

Not a compliance afterthought layered on at the end — a constraint the typographic system in §1 was already partly designed to satisfy, made explicit:

- **The Info/Utility role's lock is an accessibility requirement, not only a taste one.** Every piece of legally/practically essential information — date, time, address, RSVP deadline, form labels and errors — renders in the plainest, most legible face in the Collection, at a contrast ratio meeting WCAG 2.1 AA (4.5:1 for body text) against its background, regardless of how expressive the Collection's Display/Accent faces are. This can never be overridden by a couple's customization choices, exactly as it can never be overridden in §1's component constraint.
- **Decorative script is always supplementary, never load-bearing.** Where an Accent-role script renders a name, a monogram, or a stylized word, the same information is always also present in accessible markup (proper semantic text, not an image of text, with the Info-role rendering available to assistive technology) — a screen reader or a low-vision guest should never lose access to a fact because it was only expressed in a flourished typeface.
- **Reduced motion is respected by default.** The motion signature in §2 honors `prefers-reduced-motion` — the handful of sitewide presets a Collection uses become static instantly for any guest who has that preference set, no exceptions.
- **Photography-heavy layouts carry real alt text**, authored per the "moment" (§3) rather than generically — a story-spread photo gets alt text describing the moment, not a filename.
- **RSVP and other forms meet real tap-target and label standards on mobile** — this is the single highest-stakes accessibility surface on the whole site, since it's the one place a guest must successfully complete an action, not just read.

This isn't a separate workstream bolted onto the design system — it's the same discipline the typography research already converged on independently (§1's "logistics text is always the plainest, always legible" rule), now stated as a requirement rather than an inference.

---

## 6. Luv as a design coach, not a content writer

Reframing Luv's role in this feature entirely. Every wedding-website competitor that offers any AI assistance at all (per the original competitive research, essentially none of them do this meaningfully) frames it as "write this for me" — a blank-page content generator. That's the wrong job for Luv here, for two reasons: it's a commodity capability any competitor could bolt on, and it works against the "premium reads as restraint" finding that runs through both documents — a generic content-writing AI has no taste, and taste is exactly what's being sold.

Instead: **Luv observes what the couple has already put into the platform — Planning answers, uploaded photos, their Timeline — and coaches toward the Collection's own discipline**, the way a real stationery consultant would sit with a couple and gently push back:

- *"Your story is beautiful, but this Collection's Story layout is built for three short paragraphs with breathing room between them — want help trimming it, or should we switch to a Collection built for longer-form storytelling?"*
- *"You've uploaded 40 photos to your gallery — this Collection's gallery wall is designed to feel curated at 8–12. Want help picking the strongest ones, or would you rather use a Collection built for a larger set?"*
- *"You've set three different sections to use the Accent script — that's more than this Collection's system is designed to carry gracefully. Want to reserve it for just your names?"*
- *Suggesting which Collection actually suits the couple's real story*, based on tone/length of their Planning answers and the photos they've actually uploaded — a recommendation, not a requirement — rather than a couple picking blind from eight thumbnails.

This is a genuinely differentiated capability no competitor in either research pass can build, because it requires both a real AI assistant *and* a design system opinionated enough to coach a couple toward — Wevenu already has the first (Luv exists elsewhere in the platform) and this document is what supplies the second.

---

## 7. The website as the guest's personalized experience of the event — and why it has to stay alive

This is the direct expression of the guiding principle. The original document's "digital front door" thesis and its three-tier data-integration model (live-synced / guided-and-owned / couple-authored) still hold — this section adds the dimension that was implicit but not yet made explicit: **time.** A luxury invitation suite isn't one artifact — it's a sequence (save-the-date, invitation, response card, day-of program, thank-you note), each arriving at the right moment. The website should behave the same way for each individual guest, not present the same static page from the day it's published until the wedding is over.

A concrete lifecycle, using modules that already exist elsewhere in the platform:

- **Before RSVP** — the site is the invitation: story, the day's shape, practical information, a clear path to RSVP. Nothing here is guest-specific yet.
- **The moment a guest RSVPs** — the site becomes personalized for the first time. Using data the platform already owns and no competitor has natively (per the original document's strongest finding): which specific events this guest is invited to (not a generic public schedule), their meal selection, their party/household. This is where Riley & Grey's "preview as this guest" pattern and the two-RSVP-surface inconsistency the internal audit found both get resolved into one real, personalized flow.
- **Between RSVP and the wedding** — the site keeps working *for that guest specifically*: Travel information relevant to them (already captured elsewhere in the platform, not re-typed here), and — if Communication sends an update (a venue change, a time shift) — the site reflects the same current truth the message did, so a guest checking the site later never sees something that contradicts what they were already told.
- **Day-of** — the site's highest-value, most differentiated moment, and the one no competitor's static page can ever offer: a live view of Timeline (what's happening right now, what's next), a Floor Plan-derived orientation (where the ceremony is versus the reception, where they're seated if Seating data exists for them), effectively a day-of companion rather than a document. This is the literal meaning of "stays alive throughout the guest journey" — the site is at its most useful on the one day a static invitation is least useful.
- **After the wedding** — rather than going dark or staying frozen mid-schedule, the site's final state is a considered one: a thank-you moment, the gallery becoming the place shared photos live on, a keepsake rather than an expired form.

None of this requires new data entry from the couple. Every input already exists somewhere in the platform — Timeline, RSVP, Travel, Event Order, Floor Plans, Communication, Planning — this section is entirely about the website choosing to *become* a different, more useful object at each stage of a guest's real relationship to the event, instead of rendering the same page regardless of when or who is looking at it.

---

## 8. What a Collection actually contains now

Synthesizing §1–§7 into one concrete manifest — this is the updated definition that supersedes the color-only bundle described in the original document:

A Collection = typography role-mapping (Display / Announcement / Info-locked / Accent-capped) + palette including a designated ink tone + photography treatment (frame style, crop patterns, named "moments" available) + spacing signature + one motion preset (reduced-motion-safe by construction) + a default section sequencing arc. One coherent decision a couple makes once, the same way they'd choose a stationery suite — not eight independent settings that happen to ship with defaults.

---

## 9. Beautiful by default

Stated as its own principle because it's the thing every section above is actually in service of, and it should be documented explicitly rather than left implicit: **the design system should intentionally constrain customization in service of producing consistently beautiful results.** The goal isn't to give couples every possible option — it's to make it difficult to create something that feels disjointed or amateurish.

This isn't a new idea introduced here — it's the load-bearing thread running through everything above, made explicit as a single rule so it can be checked against directly rather than re-derived per decision:

- **Collections, not endless themes** (§2) — one coherent designed bundle a couple picks, not independent knobs that happen to ship with defaults.
- **Typography roles, not arbitrary font choices** (§1) — a locked, role-based system where the highest-stakes text is structurally prevented from ever rendering in the wrong face, mirroring exactly what every real invitation house in the research already does by hand.
- **Curated color palettes, not unrestricted pickers** (§2) — a designated ink tone and a bounded set of combinations, not a hex-code input.
- **Editorial photo compositions, not freeform galleries** (§3) — a small set of named, designed "moments," not a blank grid a couple has to art-direct themselves.
- **Storytelling sequences, not random blocks** (§4) — an authored narrative arc a couple selects into, not an arbitrarily reorderable list.
- **Luv as a design coach, not a content generator** (§6) — actively pushing back toward the system's own restraint, the same role a real stationery consultant plays, rather than adding more raw generative freedom.

The through-line every one of these shares: **restraint is the actual premium lever**, confirmed independently by both research passes in this series — the competitive study (§2 of the original document: the templates every reviewer calls premium use one accent color and two fonts; the ones called dated stack decoration) and the invitation-brand research here (§1: Bella Figura's most polished examples use exactly one type family; every brand researched capped total typefaces at two or three, and going *lower* read as more sophisticated, not less). A platform that hands a couple unlimited freedom is optimizing for a different, lesser goal than the one this feature is actually chasing. **A couple should never be able to make their wedding website ugly** — every constraint above exists to make that structurally true, not just stylistically encouraged.

---

## What this document is not

Still design only — no schema, no component names beyond the illustrative `InfoText` example, no implementation sequencing. The next step, per the same discipline the Booking Financial Architecture series has used throughout, is your review of this direction before anything here becomes a build plan.
