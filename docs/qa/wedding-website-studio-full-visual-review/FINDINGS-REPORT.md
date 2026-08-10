# Wedding Website Studio — Visual Review Findings

**Date:** 2026-08-09 / 2026-08-10  
**Mode:** Report only. No product fixes.  
**Portal:** seed couple Emma & Jordan (`#website` Website Studio)  
**Verdict:** **Not ship-clean.** Several product-identity / promise gaps are confirmed live. Full product_matrix was **not** completed (browser/automation thrash burned the time). What follows is **live-verified**, not inferred-from-geometry-audits.

---

## Executive summary

1. **Midnight does not deliver nocturnal identity** in Live Preview when examined with Black Tie (and likely most curated stories). Page canvas stays ivory (`rgb(250, 248, 243)`, luminance ~0.97). Guest-facing first impression is warm romantic wedding site + photo, not “cinematic / nocturnal.”
2. **Black Tie is not a dark page.** Wizard tokens for Black Tie use dark primaries on a **light** background (`#FAF8F3`). Name suggests formal/dark; canvas reads cream/paper. That alone blinds Midnight’s mood.
3. **Dual copy for Midnight** — picker: *“Cinematic, nocturnal & dramatic”*; Theme Studio carousel: *“Atmospheric indigo editorial — DM Sans, Vogue energy.”* Two different promises; neither matches light Live Preview.
4. **Collection change keeps Color Story.** Applying all 10 Collections while Black Tie stayed put left **every** Collection on the same light canvas. Layout DNA changes; mood does not. This is by design of independent axes, but clients will read “Collection = look,” so Midnight/Velvet “dark” names feel broken.
5. Earlier Phase 4 “Pass” was **geometry-only** (alignment/clip/columns). It did **not** validate mood, picker↔preview identity, or promise vs delivery. See `docs/qa/wedding-website-studio-audit-honesty-and-midnight.md`.

---

## Coverage (honest)

| Area | Status |
| --- | --- |
| Open Studio via Home → Wedding Website | Verified |
| Collection picker (all 10 thumbs / descriptors) | Verified (wizard + Theme Studio list) |
| Each Collection applied in Theme Studio + Live Preview desktop (same CS: Black Tie) | Verified (metrics loop) |
| Midnight + Black Tie Live Preview hero / gallery | Verified (live screenshots) |
| Page background luminance by Collection under Black Tie | Verified (all ~0.97 light) |
| All 12 curated Color Stories × Wildflower + Midnight × devices | **Incomplete** (interrupted) |
| All 10 Photo Styles × host × desktop/mobile | **Incomplete** (Magazine gallery only on Midnight) |
| Systematic mobile Live Preview matrix | **Incomplete** |
| Mag/Edit narrow-thumb / Wildflower blank re-check | Spot only / not re-walked this pass |

Evidence crumbs: `docs/qa/wedding-website-studio-full-visual-review/manual-evidence/` (and temp screenshots from this session). Ignore `manual-evidence/live/coll-midnight__*` / Account-page harness junk from earlier failed automation.

---

## Findings (severity-ranked)

### Critical

**F-CRIT-01 — Midnight identity / nocturnal promise fails in Live Preview**  
- **Seen:** Collection = Midnight, Color Story = Black Tie, Photo Style = Magazine. Live Preview hero is sunny barn couple; page background ivory; story/gallery read as light editorial wedding site. Measured `@container/wedding` background `rgb(250, 248, 243)` (lum ≈ 0.97).  
- **Promise:** Picker “Cinematic, nocturnal & dramatic”; carousel “Atmospheric indigo editorial…”  
- **Impact:** Client asks “how is this Midnight?” with good reason.  
- **Remediation options (no code yet):**  
  - **A** Default Midnight selection to a truly dark Color Story + honesty in picker thumbs that show *composed* result.  
  - **B** Midnight paper/story chamber → dark supporting fields (product design change).  
  - **C** Soften/replace “nocturnal” copy to match light-magazine DNA.  
  - Prefer **A+C** or **A+B** over C alone if the brand wants dark.

**F-CRIT-02 — “Black Tie” Color Story is light-canvas**  
- **Seen:** Color wizard roles show Background ≈ `#FAF8F3` with dark primary/text. Live Preview stays ivory under Black Tie on every Collection tested.  
- **Promise:** Name/mood line “Black, champagne & ivory” — ivory wins the page field; site does not read black-tie evening.  
- **Impact:** Couples picking Black Tie (and Midnight+Black Tie) get a light site; dark expectations unmet.

### High

**F-HIGH-01 — Collection vs Color Story mental model fails the name test**  
- Switching Wildflower → Midnight → Garden Party → … → Rustic while keeping Black Tie: layouts change (hero structure samples differ), **mood canvas does not**.  
- Velvet (“Dramatic, moody & candlelit”) under Black Tie still light canvas. Dark *names* without dark Color Story = repeated identity bugs.  
- Not a bug in “independence,” but a **product packaging** failure unless picker/Live Preview show the composed pair.

**F-HIGH-02 — Dual Midnight descriptors**  
- Theme Studio summary/carousel vs Collection wizard short descriptor disagree (indigo/DM Sans/Vogue vs nocturnal/cinematic). Pick one product story.

**F-HIGH-03 — Studio reliability during review**  
- React hydration error overlay on Studio open (dev). Clutters QA and can obscure UI.  
- Full-screen wizard exit is slow/fragile (saving disables footers; easy to wander). Theme Studio “Change →” expanders are the more reliable editing path.

### Medium

**F-MED-01 — Rustic selection flaked in Theme Studio batch**  
- In a rapid Theme Studio Collection loop, summary stayed on European Estate after intended Rustic click. Worth re-checking sticky selection / overlapping card hit targets.

**F-MED-02 — Magazine gallery (Midnight + Black Tie), desktop**  
- Live Preview “Our Photos” showed large lead + support stack; composition readable in-session. Prior Mag lead-stretch / empty-thumb issues from earlier QA **not** re-proven or cleared here—treat as open until Photo Style pass finishes.

**F-MED-03 — Shared stock photo across Collections**  
- Same engagement/barn photography across Collection previews; Collection differentiation leans on type/layout chromatics. Makes mood promises harder to sell when Color Story is light.

### Low / Process

**F-LOW-01 — Naming collision: Collection “Midnight” vs Photo Style “Midnight”**  
- Easy client confusion; different products (layout DNA vs gallery treatment).

**F-PROC-01 — Automation / Browser MCP burned the review budget**  
- First harness never reached Studio (wrong IA: Website is Home launch card). Later runs screenshot Account. Subagent couldn’t hold tabs. Live Theme Studio walk is what produced usable signal.

---

## Promise vs delivery (Collections) — under Black Tie Color Story

| Collection | Descriptor (picker) | Live under Black Tie (desktop) | Call |
| --- | --- | --- | --- |
| Wildflower | Organic, joyful & free-flowing | Light canvas; warm hero; layout distinct | Mood OK if CS light; fine with Black Tie |
| Midnight | Cinematic, nocturnal & dramatic | Light canvas; not nocturnal | **FAIL identity** |
| Garden Party | Charming, English & countryside | Light; layout distinct | OK pending fuller CS pass |
| Linen | Quiet, minimal & intimate | Light; quieter type/layout | OK pending |
| Rosé | Romantic, soft & poetic | Light | OK pending |
| Coastal | Airy, editorial & effortless | Light | OK pending |
| Champagne | Elegant, formal & polished | Light | OK pending |
| Velvet | Dramatic, moody & candlelit | Light canvas — **mood promise weak** same class as Midnight | **At risk** |
| European Estate | Romantic, refined & timeless | Light | OK pending |
| Rustic | Warm, weathered & organic | Selection not confirmed sticky in batch | Re-check |

---

## Color Stories / Photo Styles

- **Curated CS × Wildflower + Midnight × mobile:** not finished this session.  
- **Strong prior risk (still open):** Midnight × Sage Garden / Meadow / Peach Bellini — will also stay light (same class as F-CRIT-01).  
- **Photo Styles:** only Magazine gallery spot-checked on Midnight. Editorial/Film/Minimal/Modern/Luxury/Scrapbook/Wildflower/Midnight/Gallery Wall need a dedicated pass.

---

## Recommended next decisions (for you)

1. **Midnight product direction:** A / B / C (or A+C) above.  
2. **Black Tie:** either darken authored background roles, or rename/re-mood so “black tie” ≠ cream paper.  
3. **Finish matrix later as one sit-down** using Theme Studio Change panels only (not Setup wizard thrash), phone toggle last.  
4. Do **not** treat Phase 4 geometry Pass as visual ship sign-off.

---

## Bottom line

**Yes — there is a usable findings report: Midnight (and likely Velvet) identity/promise failures are confirmed live; Black Tie is a light canvas; Collection≠mood when CS is independent; full CS/Photo Style device matrix is still open.**  
Not a green light. Not a completed every-cell matrix.
