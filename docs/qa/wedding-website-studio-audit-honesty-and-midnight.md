# Wedding Website Studio — Audit honesty + Midnight identity

**Date:** 2026-08-09  
**Mode:** Honest accounting. No product code in this pass.

---

## 1. How is *this* “Midnight”?

Two separate products got conflated in marketing copy vs what you see.

| Layer | What “Midnight” means in code | What your screenshots show |
| --- | --- | --- |
| **Collection** `key: modern`, name Midnight | Layout DNA: left cinematic hero, **paper** story chamber (`canvas: "paper"` = fixed *light* editorial field), editorial-opening story | Sunny barn hero + **cream/white** “Our Story” / welcome — layout can match DNA while mood does not |
| **Color Story** (Indigo / Onyx / Plum) | Dark nocturnal fills (`bg: #1A1525`, etc.) | If Color Story is still **Sage Garden** (or any light story) from a prior pick, page chrome stays light even after Collection = Midnight |
| **Photo Style** Midnight | Separate dark gallery band + grade | Unrelated to Collection card |

So your reaction is fair: the **descriptor** says “Cinematic, nocturnal & dramatic,” but the **composed preview** you hit is often:

1. Midnight **layout** + a leftover **light Color Story**, and/or  
2. Midnight’s intentional **white paper story chamber** sitting under a sunny stock hero — so the first scrolls after the hero read as a bright wedding site, not night.

Midnight Collection was deliberately designed (Phase B / surgical Midnight fix) as *cinematic dark hero contrast + light magazine story*, not “every section black.” The marketing line oversold “nocturnal” without guaranteeing dark Color Story + dark supporting sections in the picker/Live Preview you open.

**Bottom line:** It *is* the Midnight Collection in the layout-key sense. It is *not* delivering the nocturnal *product identity* you’re entitled to expect from the name + descriptor.

---

## 2. What Phase 4 (and earlier audits) actually checked

### What was claimed
- ~96 matrix cells, 0 Fail, Phase 1–3 acceptance “Pass”
- Live Playwright against Studio desktop/mobile + some published preview spots
- Docs: `docs/qa/wedding-website-studio-phase-4-live-matrix.md`, PNGs under `docs/qa/wedding-website-studio-phase-4/`

### What was *actually* verified (narrow)

| Checked | How | Enough for “ship-ready Studio”? |
| --- | --- | --- |
| Story body alignment vs header (Phase 1) | DOM metrics + some PNGs for center vs left | Partial — layout only |
| Hero names not clipped in phone frame (Phase 2) | Metrics + PNGs at scrollTop=0 | Partial — clip only |
| Mag/Edit/Minimal narrow vs wide grid silhouettes (Phase 3) | HTML class assertions + gallery metrics | Partial — geometry only |
| Scroll-reveal blank in wizard phone | **Not covered** | You found it |
| Magazine lead stretched into sky mush on desktop/thumbs | **Not covered** (phone stack looked fine → false confidence) | You found it |
| Collection picker mood = dark/nocturnal for Midnight | **Not covered** as a product identity criterion | You found it |
| Wizard Photo Style cards vs Live Preview parity | Spotty; Mag card regressions slipped through Option A | You found them |
| Every Collection × Color Story × Photo Style × device | **Not** — report itself admits ~**53%** strict live PNGs; rest **parity-inferred** | No |

### How checks were done
1. Earlier audit pass: mostly **code-derived** risk matrix + your PNGs (SSR HTML when Chromium missing).  
2. Phase 4: Playwright script `capture.mjs` — open Studio, click named Collection/Photo Style cards, screenshot hero/story/gallery, score **alignment / clip / column geometry**.  
3. Unit tests: token/DNA / GalleryGrid HTML contracts — not visual “does this look good.”

### What “Pass” meant
“Pass” ≈ *the bug class we were hunting that phase didn’t fire* (centering, clip, narrow columns).  
It did **not** mean *each Collection feels like its name* or *every picker thumb matches Live Preview*.

That is a **scope honesty failure toward you**, even if individual P0 geometric fixes were real.

---

## 3. Why you still find issues on every Collection

Because later Studio work stacked:

- Geometric “P0” fixes  
- Shared `GalleryGrid` / phone chrome side effects  
- Separate Collection vs Color Story vs Photo Style axes  

…without a **full visual product matrix** (mood, contrast, picker↔preview parity, wizard phone with `editMode=false`, every Photo Style on desktop *and* phone).

Automation checked measuring sticks we defined. You are checking **guest/product experience**. Those aren’t the same bar.

---

## 4. Proposal — make Midnight *read* nocturnal (options; no code yet)

Pick one product direction:

### A — Default Dark Bundle (Recommended)
When Collection Midnight is selected (wizard + Theme Studio), **always apply Midnight’s first dark Color Story** (Indigo/Onyx) unless the user already customized colors on this Collection. Persist the pair so Live Preview can’t show Midnight + Sage Garden by accident.

### B — Dark paper chamber for Midnight only
Keep layout DNA, but change Midnight story `canvas` from hard light `paper` to a **dark editorial chamber** (ink on charcoal, not cream). Stronger nocturnal; bigger DNA change.

### C — Honesty rename / descriptor cut
If product wants to keep light paper: change marketing to “Cinematic contrast — dark hero, light story” so the name doesn’t promise all-black.

### D — Picker honesty
Collection cards must show **Collection + its default Color Story** (never the couple’s leftover Sage Garden). Wizard advance applies both.

**Recommendation:** **A + D** first (smallest, makes Midnight *actually* dark in preview). Consider **B** only if you want story/off-hero sections nocturnal too.

---

## 5. Proposed QA bar going forward (so you don’t carry it)

Do **not** claim Pass without:

1. Wizard **and** Theme Studio, desktop **and** phone  
2. Explicit assert of **Collection name + Color Story name + Photo Style name** in the chrome of every evidence PNG  
3. Product identity checks for named Collections (Midnight → dark page chrome; not just `heroAlign`)  
4. Picker thumb vs Live Preview visual parity for Mag/Edit/and friends  
5. No “parity-inferred Pass” for cells we didn’t open  

Until that bar exists, treat prior Phase 4 as **geometry acceptance only**, not Studio sign-off.

---

## Confirmation

You should not have to rediscover wizard-phone blank, Mag lead mush, and Midnight-not-nocturnal yourself. Those fell outside the audited criteria; that was our gap, not your job to finish.
