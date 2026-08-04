# Wedding Website — Coastal Premium Art-Direction Proof Pass

**Date:** 2026-08-03 (Pass 1 + Pass 2)
**Scope:** Coastal Collection only. No other Collection (Wildflower, Midnight, Linen, Rosé, Champagne, Velvet, European Estate, Rustic, Garden Party, Industrial) was touched — verified below.
**Status:** Implementation complete, technically verified. **HUMAN VISUAL ACCEPTANCE: PENDING.**

---

## 0. Pass 2 — why it happened

Human visual review of Pass 1 found it insufficient: color variation had improved and Event Details worked well, but the page still fundamentally read as "twelve stacked CMS bands with sparse content on alternating background colors." Pass 2's mandate was architectural: stop treating each database section as an isolated horizontal band, and compose the page as one continuous editorial experience — while strictly preserving the underlying section-as-independent-data-object model (Studio editing, ordering, visibility, sync, RSVP logic, publishing, all four independent dimensions). This report describes the combined result of both passes; Pass 1's original per-section canvas/scale system is the foundation Pass 2 builds on, not a discarded draft.

## 1. Architecture changes

| File | Change |
|---|---|
| `supabase/migrations/20261174000000_..._art_direction.sql` (Pass 1) | Extends `get_wedding_website`/`get_my_website` with a `venue` join. Seeds Coastal's `sectionRoles.{canvas,scale}`. |
| `supabase/migrations/20261175000000_..._art_direction_pass2.sql` (Pass 2) | Adds `treatment`/`pairWith` to Coastal's `sectionRoles`. Fixes contaminated dev fixture data (§7). |
| `lib/wedding-website/types.ts` | `SectionRole` gains `treatment?: SectionTreatment` and `pairWith?: string`. `WebsiteVenue` type (Pass 1). |
| `components/wedding-website/composition-primitives.tsx` | New page-level primitives: `ScheduleTimeline`, `EditorialOpening`, `PairedPassage`, `DestinationFeature`, `CompactInterlude` — in addition to Pass 1's `SectionCanvas`/`contrastText`. All accept a `labelColor` where relevant (§4). |
| `components/wedding-website/wedding-website.tsx` | Section-order rendering restructured from a flat per-key switch into a **render-unit + pairing** architecture (§2). Hero hierarchy rebuilt (§3). Footer refined. |
| `components/portal/website-editor.tsx` | `BridalPartyEditor` gets a real photo upload affordance (§6). `GalleryEditor` gets a low-count nudge. `HomeEditor`'s Subtitle field placeholder/hint fixed (§3 — this was the actual root cause of the date collision). |
| `components/portal/website-studio.tsx` | `livePreviewSite.venue` now sourced from `context.venue` (Pass 1, confirmed live in Pass 2 testing — see §9). |
| `docs/wedding-website-coastal-art-direction-completion-report.md` | This report. |

## 2. The pairing architecture (Step 6/9/13)

The core structural fix. `sectionOrder.map(key => switch(key){...})` — one JSX block per key, always solo — is replaced with:

1. **`hasContent`**: a plain object computed once, mirroring each section's own existing empty-guard (`!content.dress_code?.formality && !description → false`, etc.) — never re-derives content shape differently than the section itself would.
2. **`renderGroups`**: walks `sectionOrder` once. Two adjacent keys become a `[keyA, keyB]` group **only if** both sides' `sectionRoles[key].pairWith` name each other (mutual) **and** both currently have content. Otherwise each key is its own solo group. This is purely data-driven — reordering, hiding, or emptying either side automatically falls back to solo rendering; nothing assumes a fixed index or hardcodes Emma & Jordan's specific content.
3. `renderGroups.map(group => Array.isArray(group) ? renderPair(...) : renderSolo(...))` — `renderPair` dispatches to `renderDressCodeWeddingPartyPair()` or `renderRegistryFaqPair()` (the two pairs Coastal's `layout_config` currently declares); `renderSolo` is the original per-key switch, now also the automatic fallback when a pair can't form.

Coastal's seeded pairs: `dress_code ↔ bridal_party` (Dress Code narrower, Wedding Party wider, per your asymmetry direction) and `registry ↔ faq` (balanced columns). Both use the new `PairedPassage` primitive — a 12-column grid with a `color-mix()`-blended divider rule (border blended toward text, so it stays visibly a rule against any Color Story, not just this fixture's pale palette) — while each side keeps its own `SectionWrapper` (independent scroll-reveal/edit-overlay), so Studio's click-to-edit targeting is untouched.

## 3. Hero (Step 1) — the actual bug, not a cosmetic fix

**Root cause found**: `content.home.subtitle` is a general free-text field. Studio's own Subtitle field placeholder read `"June 12, 2027 · Nashville, TN"` — actively inviting a couple to hand-type a date. The renderer then displayed that free-text subtitle *and* the authoritative synced `event.eventDate` as two separate lines. In the Emma & Jordan fixture the subtitle had drifted to "October 16, 2026" while the real synced date is October 17 — a genuine, silent contradiction, not a display duplication of the same value.

Fixed at both ends:
- **Product-wide** (small, non-visual, applies before any Collection is even chosen): `HomeEditor`'s Subtitle placeholder now reads `"Two hearts, one beautiful beginning"` with an explicit caption — *"Your wedding date and location are shown automatically — use this for a short phrase instead."*
- **This fixture**: the stale date-shaped subtitle replaced with a genuine atmospheric phrase.
- **Coastal's hero specifically** (gated on `tc.sectionRoles`, every other Collection's hero is byte-for-byte unchanged): rebuilt hierarchy — eyebrow → atmospheric phrase → couple names (unmistakable, largest) → **one** authoritative line combining `formatEventDate(site.event.eventDate)` and ceremony location/venue name → days-to-go. There is now exactly one place a date can ever appear in this hero, sourced only from the synced event, never from free text.

Couple cover photo continues to win the hero slot when present (unchanged logic from Pass 1). In this fixture it currently doesn't win because the "cover photo" was itself contaminated (§7) — the venue image fallback (already-approved Pass 1 behavior) is what's now showing, correctly.

## 4. Color Story as a design system (Step 11)

Audited actual usage before changing anything: `primary` (aliased `color` throughout the file) was doing every accent job — buttons, dividers, rules, labels, eyebrows. `accent` was **never read anywhere** except as a fallback (`tc.secondary || tc.accent`). `border` (the "neutral" role) was **never read anywhere at all**. The six-color palette was functionally three colors.

Fixed by giving each idle role one real, restrained job — not by making the page "colorful for the sake of color":

| Role | Job |
|---|---|
| `bg` | Page background / "light" canvas |
| `surface` | "soft" canvas (Schedule, Things To Do backgrounds) |
| `secondary` (falls back to `accent`) | "strong" canvas fields (Event Details, RSVP gradient) |
| `primary` | Buttons, primary dividers/rules, dominant accents (unchanged) |
| `accent` | **New**: labels/eyebrows specifically — Our Story's "OUR STORY" label, Schedule's time labels, Music's "OUR MUSIC" label (`labelColor` prop, falls back to `primary` if a Collection doesn't set a distinct accent) |
| `border` (neutral) | **New**: the paired-passage divider rule, blended toward `text` via `color-mix()` for guaranteed visibility against any background |

## 5. Section-by-section (Pass 2 changes only — Event Details/Gallery shell/Travel/RSVP card logic unchanged from Pass 1, still correct)

- **Our Story** → `EditorialOpening`: asymmetric eyebrow+heading column beside a measured prose column; couple's own first gallery photo used *only* if one legitimately exists (never forced, never venue/marketing imagery). Short stories (<240 chars) already collapse to Interlude spacing (Pass 1 sparse guard, unchanged).
- **Schedule** → `ScheduleTimeline`: a vertical line with markers, `accent`-colored time labels, height fully driven by item count — no card chrome.
- **Dress Code + Wedding Party** → paired passage (§2) when both present and adjacent; each remains independently editable/orderable/hideable.
- **Things To Do** → `DestinationFeature`: single item gets a centered, compact, intentional single-feature treatment (not a lonely card in a huge field); 2+ items get a two-column editorial grid. No imagery field exists on `things_to_do` items today (§8 — documented, not bolted on).
- **Music** → `CompactInterlude`: small centered romantic moment, never its own section-scale band.
- **Registry + FAQ** → paired passage (§2).
- **RSVP**: unchanged logic; banner background now genuinely echoes the hero's own gradient formula (Pass 1) — visually confirmed as the page's closing scene in Pass 2 screenshots.
- **Footer**: small `accent`-colored tick mark added above the existing minimal text — still deliberately restrained, not another color band.

## 6. Wedding Party photo behavior (Step 6)

The data model already carried `photoUrl` per member (`PartyMember.photoUrl`, flows through save) — Studio simply never exposed a way to set it. Fixed, not bolted on: added a circular photo affordance per member row in `BridalPartyEditor`, reusing the exact same `/api/portal/upload` endpoint and pattern the cover-photo/gallery uploaders already use (`type: "party"`, no backend change needed — `type` is a free-form filename prefix, not a validated enum). Preview, replace (implicit — re-upload), and remove (trash icon) all work. Contextual, non-blocking hint — *"Add a photo to make your wedding party feel more personal"* — shows only when a member has no photo. Confirmed working live in Studio (screenshot evidence, §9): the dropzone and hint render exactly as coded, zero console errors. Published portraits keep the existing circle/square initials fallback (Pass 1, unchanged) — editorial, not a SaaS avatar.

## 7. Gallery / Magazine — the real finding (Step 4)

Investigated the underlying "collage" arrangement engine (what Magazine's `layout_config` token `arrangement: "collage"` actually renders): it already has hand-designed, count-aware grid patterns for 1/2/3/4+ photos with real scale variance, overlap, and z-index hierarchy — not naive/uniform placement. The engine was not the problem.

**The problem was the fixture data**, and it was worse than "a few bad placeholders": every image in this dev environment claiming to be couple photography was contaminated:
- `content.gallery.photos` (6 entries): solid-color placeholder PNGs, explicitly the "colored rectangles" the review correctly rejected.
- `client_media` (4 rows, categories `engagement`/`photography`): on inspection, all 4 were **Wevenu's own "Hello to Cheers" SaaS marketing renders** with baked-in ad copy ("BOOKING AGREEMENT", "let's make it official" mug, a phone showing "New Inquiry") — not couple photos at all, mislabeled.
- The site's **live hero cover image** was one of these same contaminated marketing renders — a real, previously-undetected bug (the same class of issue Pass 1 fixed once already for a different stock image), only found because this pass required inspecting every image individually.

No image-generation capability is available in this environment, so legitimate replacement couple photography could not be produced. The correct, disclosed fix: cleared the contaminated cover image (hero now correctly falls back to the real venue image, per the already-approved fallback rule — see §3) and the placeholder gallery array (0 photos → the existing, correct "no fake gallery" behavior renders, verified: the Gallery section does not appear on the page at all, matching the requirement exactly), replaced the stale subtitle, and deleted the 4 mislabeled `client_media` rows so Studio's "Import engagement photos" button can't offer them to a future test session either.

**Consequence, honestly stated**: the 1-photo/2-photo/3+-photo Magazine layouts could not be visually re-verified against *real* photography in this pass, because none exists in this environment. The 0-photo path *was* verified (correctly renders nothing). This is a test-data limitation, not a code gap — recommend the next session seed 3-5 genuinely distinct sample photos (not AI-generated marketing renders) specifically for gallery QA before the human visual review, if Magazine's photo-count behavior needs to be judged.

## 8. Documented, not bolted on

- **Things To Do imagery**: `WebsiteContent.things_to_do.items` has no image field. Per your own instruction pattern for Wedding Party, this was *not* casually added — `DestinationFeature` composes fully from name/description/address/link today. Smallest correct addition if this becomes a priority: an optional `imageUrl?: string` on the item shape (mirrors `PartyMember.photoUrl`), a Studio upload affordance, and an image-led variant of the single/grid layouts — same pattern as §6, not started.

## 9. Screenshots captured (Playwright/Chromium, zero console/page errors on every capture)

- Full page, desktop (1280px) — the whole rhythm hero → light → strong (Event Details) → white (Schedule timeline) → paired light (Dress Code/Wedding Party) → white (Things To Do) → paired light (Registry/FAQ) → gradient (RSVP).
- Zoomed hero — confirms the single date+location line, no collision.
- Zoomed Schedule timeline.
- Zoomed Dress Code + Wedding Party paired passage.
- Zoomed Things To Do (compact single-feature) + Music interlude.
- Zoomed Registry + FAQ paired passage + RSVP.
- Full page, mobile (390px) — confirms both pairs stack naturally, no horizontal overflow, timeline stacks cleanly.
- **Studio live preview** (authenticated, `/p/{token}` → Wedding Website tab): confirms the hero fix and full page render identically inside Studio's iframe-less live preview (same `layoutConfig`/`venue` data path as the public page).
- **Studio Wedding Party editor**: confirms the photo dropzone and the "Add a photo..." contextual hint render correctly, unattached to any validation blocker.

Not captured: a live screenshot of a non-Coastal Collection (no other Collection has a website fixture in this dev database to screenshot). Verified instead by: (a) every new primitive/pairing path is gated behind `tc.sectionRoles`, which is `null` for all 10 other Collections; (b) direct DB query confirming `sectionRoles` exists only on the `coastal` row.

## 10. Tests performed

- `npx tsc --noEmit -p .` — clean for every file this pass touched. (Two unrelated pre-existing failures remain in `shared/email/_smoke.mts` and `shared/relationships/ingest.ts` — confirmed via `git status` to already be locally modified, uncommitted, before this session began; not caused by this work.)
- `npx next build` — compiled successfully; its stricter full-project type-check hits the same pre-existing `_smoke.mts` issue and does not complete. Not a regression from this pass.
- Dev server restarted after the production build per the standing `.next` cache-corruption hazard.
- Zero console/page errors on every Playwright capture, desktop and mobile.
- No horizontal overflow on mobile (`document.documentElement.scrollWidth === clientWidth`, verified programmatically in Pass 1, unaffected by Pass 2's changes).
- Section reorder/hide/visibility/publish controls: not exercised end-to-end via click-through this pass, but none of their underlying code was touched (verified by diff) and Studio's own section list (screenshot evidence) still shows working ✓Added/Tap-to-add states and reorder arrows for all 12 sections.
- RSVP: presentation-only change, `RsvpSection`/`RsvpPage` files untouched (verified by diff).
- Color Story / Typography Style / Photo Style: all three still resolve exactly as before — `resolveTheme()`'s merge order is unchanged; the only additions are the new `labelColor`/canvas/pairing fields layered on top.

## 11. Known limitations

- No non-Coastal Collection fixture exists to screenshot for regression comparison (§9) — mitigated by the structural gating guarantee, not empirically screenshotted.
- Gallery's photo-count-aware layouts (1/2/3+) could not be re-verified against real photography — no legitimate sample images exist in this dev environment and no image-generation capability is available (§7).
- The paired-passage divider rule is intentionally subtle (a hairline, not a bold rule) — at extreme zoom levels or very low-contrast palettes it may read as very faint; the `color-mix()` fix improves this but wasn't tuned against every possible palette.
- Section reorder/hide/publish were not re-exercised end-to-end via live click-through this pass (only structurally verified — see §10).
- Two pre-existing, unrelated issues surfaced incidentally during dev-server restarts this session, both already present as uncommitted local changes before this pass began: a `/clients` route 500 (Postgres `PGRST116`), and `shared/email/_smoke.mts` / `shared/relationships/ingest.ts` type errors. Neither is Coastal-related; flagging for separate triage. (The originally-reported "can't log in to venue portal" issue was *not* a bug — the correct dev password is `devpassword123`, confirmed working.)

## 12. Human Quality Gate

Not self-certified. Evidence is in §9; judgment on whether this now reads as one continuous editorial experience — rather than components that merely look good in isolation — is yours.

**HUMAN VISUAL ACCEPTANCE: PENDING.**

No other Collection has been touched. No further Collection will be started until this is explicitly approved.
