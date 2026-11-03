# HTC Visual Design System — Light Mode Foundation

**Status:** Visually approved for Clients, Offerings, and **Dashboard** (Contemporary Botanical + expanded shade families).  
**Dashboard Light-Mode Palette Refinement:** **GREEN / VISUALLY APPROVED / CLOSED**  
**Authority:** Sadie Arch palette + Nexora interface craft (composition / hierarchy inspiration only).  
**Token home:** `.htc-staff` in `app/globals.css` — do not invent a parallel theme.  
**Color distribution rules (Phase 11D):** `docs/design/HTC-COLOR-DISTRIBUTION-RULES.md` — when to use white / linen / eucalyptus / calm blue / botanical / blush.  
**Dashboard approval evidence:** `docs/qa/staff-light-canvas/stage2b/dashboard-palette-refine/` (desktop + mobile `01-top` … `05-reports` reviewed and approved).

Hospitality pages prove the system first. Other screens expand only after visual approval. Dark-mode visual QA remains a **separate outstanding** workstream.

---

## 1. Approved palette

### 1.1 Locked base colors (do not change values)

| Role | Value | Text on surface |
|------|--------|------------------|
| Botanical green | `#446B56` (`--htc-botanical` / `--primary`) | White |
| Eucalyptus | `#DCE8E0` (`--htc-eucalyptus-surface`) | Dark charcoal `#24332B` |
| Eucalyptus accent (raw) | `#A7C2AF` (`--htc-eucalyptus` / `--accent`) | Dark charcoal |
| Blush | `#F7E9EB` (`--htc-soft-blush` / `--panel-blush`) | Dark charcoal |
| Blush accent / dusty rose | `#D99A9E` (`--htc-blush` / `--htc-dusty-rose`) | Dark charcoal |
| Warm neutral page canvas | `#F8F7F3` (`--htc-canvas`) | Dark charcoal |
| Calm blue surface | `#EAF1F7` (`--htc-calm-blue`) | Dark charcoal |
| White | `#FFFFFF` (`--card`) | Dark charcoal |
| Body / secondary text | `#5F6F68` (`--muted-foreground`) | — |
| Warm border | `#E6E3DC` (`--htc-border-warm`) | — |
| Soft blue border | `#D5E1EB` (`--htc-border-calm`) | — |

### 1.2 Expanded shade families (coordinated — not a second theme)

**Botanical greens**

| Shade | Token | Hex | Typical use |
|-------|-------|-----|-------------|
| Botanical (base) | `--htc-botanical` | `#446B56` | Primary buttons, selected fills, botanical bars |
| Muted leaf | `--htc-leaf-muted` | `#7E9E88` | Icons / accents when botanical fill is too strong |
| Eucalyptus accent | `--htc-eucalyptus` | `#A7C2AF` | Borders, guides, selected rim |
| Soft sage | `--htc-soft-sage` | `#C9D9CE` | Secondary washes, gentle feature surfaces |
| Eucalyptus surface | `--htc-eucalyptus-surface` | `#DCE8E0` | Section headers, table headers, parent majors |
| Pale botanical | `--htc-botanical-pale` | `#E8F0EA` | Quiet green card washes (e.g. Cash Collected) |
| Green mist | `--htc-green-mist` | `#F1F5F2` | Very light botanical working surfaces (e.g. Booked) |

**Blush / rose**

| Shade | Token | Hex | Typical use |
|-------|-------|-----|-------------|
| Dusty rose | `--htc-dusty-rose` / `--htc-blush` | `#D99A9E` | Severity accents, chips (restrained) |
| Soft rose | `--htc-soft-rose` | `#E8C5C8` | Narrow critical indicators (not full panels) |
| Petal | `--htc-petal` | `#F0D8DB` | Soft rose mid-tone if needed |
| Soft blush | `--htc-soft-blush` | `#F7E9EB` | Luv identity and intentional attention accents — **not** default task backgrounds; **not** every warning |
| Pale blush | `--htc-blush-pale` | `#FBF6F7` | Rare whisper tint |

**Calm blue (supporting — informational / scheduling)**

Calm is a central HTC value. This family adds a quiet informational surface that complements botanical green, eucalyptus, warm canvas, and blush without replacing them. It must never feel like corporate SaaS blue, a hyperlink wash, a disabled state, or a status badge.

| Shade | Token | Hex | Typical use |
|-------|-------|-----|-------------|
| Calm blue surface | `--htc-calm-blue` | `#EAF1F7` | Dominant pale informational panels (scheduling guidance, neutral calm support) |
| Calm blue deep | `--htc-calm-blue-deep` | `#DFE9F1` | Subtle hierarchy within a calm-blue block (e.g. restrained side edge) |
| Soft blue border | `--htc-border-calm` | `#D5E1EB` | Borders on calm-blue surfaces |
| Calm accent | `--htc-calm-accent` | `#63819A` | Rare muted accent inside calm-blue contexts — **not** a primary action color |

**Initial approved reference implementation:** Lead detail → Tour & follow-up → personalized scheduling-link block (`.htc-lead-tour-personal-link`). Evidence: `docs/qa/staff-light-canvas/lead-personal-link-blue-experiment/`. That block currently uses matching hex values scoped to the Lead surface; wiring these names into `.htc-staff` CSS variables is a **separate authorized token-governance step** — do not invent parallel blues elsewhere until authorized.

**Warm neutrals**

| Shade | Token | Hex | Typical use |
|-------|-------|-----|-------------|
| Oatmeal | `--htc-oatmeal` | `#EDE9E1` | Stronger warm depth (use sparingly) |
| Linen | `--htc-linen` | `#F3F0E9` | Quiet secondary cards (e.g. Coming up) |
| Warm pale | `--htc-warm-pale` | `#F5F3EE` | Hover / subtle depth on ivory |
| Warm canvas | `--htc-canvas` | `#F8F7F3` | Page background |
| Ivory | `--htc-ivory` | `#FAF9F5` | Soft working surfaces (Luv body, Outstanding body) |
| White | `--card` | `#FFFFFF` | Primary working surfaces, headings, tables |

### 1.3 Explicitly rejected accents

Do **not** introduce: champagne, pale sand, muted olive, rainbow pastels, saturated “link” blues, icy cyan, or **any blue outside the approved calm-blue family** above. Earlier reviews rejected unspecified blue-gray / mist-blue *as a free accent family*; that rejection still applies to ad-hoc blues. The **documented calm-blue tokens** (§1.1–1.2) are the sole approved blue supporting direction.

### 1.4 Core rules

- Do not replace locked base hex values.
- Ordinary navigation, labels, and body text stay charcoal — never botanical green, blush, or calm blue “for brand.”
- Brand color belongs in meaningful surfaces, primary buttons, selected states, badges, and accents.
- White text only on sufficiently dark botanical surfaces (e.g. primary buttons, selected filter chips).
- No terracotta, burgundy, muddy olive, or generic gray-SaaS chrome.
- **White is an important working surface, but not the only one.** Botanical greens, blush/rose, warm neutrals, and **calm blue (supporting)** provide coordinated variation and hierarchy.
- **Calm blue does not replace** botanical primary, eucalyptus operational surfaces, blush/Luv identity, warm canvas, or semantic success / warning / overdue / destructive / error treatments.

---

## 2. Usage by surface role

| Role | Appropriate colors |
|------|-------------------|
| Page background | Warm canvas `#F8F7F3` |
| Primary working cards / tables / forms | White |
| Soft working surfaces | Ivory, linen, green mist, botanical pale |
| Section / grouping headers | Eucalyptus surface `#DCE8E0` |
| Primary actions | Botanical `#446B56` + white text |
| Selected states | Botanical fill + white text, or eucalyptus wash + dark label |
| Accents / indicators | Soft rose, dusty rose, eucalyptus accent — narrow, not full-bleed |
| Guidance / partner identity accents | Soft blush bands or chips — Luv identity and intentional attention; not every attention row; semantic meaning still takes precedence over pink |
| Calm informational / scheduling support | Calm blue surface `#EAF1F7` (+ deep / border / accent as needed) — restrained supporting panels only |
| Text | Charcoal `#24332B` / muted `#5F6F68` on all light surfaces |
| Icons | Charcoal or muted; botanical tint allowed on **icons only** sparingly |

### Contrast

- Dark charcoal on white, ivory, linen, eucalyptus, soft blush, green mist, botanical pale, **calm blue** — required.
- White on botanical primary — required.
- Do not place muted gray text on soft rose or dusty rose fills.
- Preserve WCAG AA for body text on every hospitality surface used.

### Semantic color rules

| Color | Means | Does **not** mean |
|-------|-------|-------------------|
| Eucalyptus / soft greens | Structure, grouping, quiet positive atmosphere | “Paid,” “complete,” or success unless product already defines that chip |
| Soft blush / soft rose | Luv identity, intentional attention accents, **restrained** critical indicator when product already defines it | Default overdue panel; automatic “every warning is pink”; destructive error banner |
| Outstanding blush accent | Still-owed balance > 0 (money to collect) | Overdue / past-due status |
| Botanical button | Primary action | Body brand coloring |
| Warm neutrals | Depth between canvas and white | Semantic status |
| Calm blue | Informational panels, scheduling guidance, neutral calm support | Warning, overdue, destructive, error, success, or primary action |

### Combining colored surfaces on one screen

1. Prefer **one strong colored header** per major module (e.g. Focus eucalyptus band).  
2. Prefer **accents** (left bar, thin top band, header strip) over full-card pastel fills for repeated rows.  
3. Snapshot may use a **coordinated family** of soft greens / ivory — not four unrelated pastels.  
4. Limit large blush surfaces to at most one intentional brand moment (e.g. Luv accent band), not a stack of pink cards.  
5. Use calm blue **sparingly** for informational / scheduling support — not on every info card, and never as a second primary beside botanical.  
6. Appropriate calm-blue neighbors: white primary cards, warm canvas page ground, eucalyptus section structure, botanical primary actions.  
7. Avoid painting every card a different pastel “just because.”

---

## 3. Surface hierarchy

### Page structure (operational hospitality pages)

| Layer | Treatment | Use |
|-------|-----------|-----|
| Canvas | Warm `#F8F7F3` (`.htc-hospitality-page`) | Working area behind content |
| Heading | White card, warm border, restrained elevation | Page title + actions |
| Operational content | White surfaces | Tables, toolbars, catalog, forms |
| Soft secondary | Ivory / linen / green mist | Quiet modules when white-on-white is too flat |
| Secondary / grouping | Eucalyptus `#DCE8E0` | Table headers, parent majors, section header bands |
| Attention / Luv identity | Soft blush accents or panels — **sparingly** | Luv and intentional attention; not every list row |
| Calm informational support | Calm blue `#EAF1F7` — **sparingly** | Scheduling / neutral guidance panels (see Lead personalized scheduling link) |
| Primary action | Botanical `#446B56` + white text | Primary buttons, selected filter chips |

Shell: white sidebar; dark nav labels/icons; active nav = eucalyptus wash + botanical left bar + **dark** label.

### Catalog hierarchy — Offerings (approved — do not reopen)

| Level | Surface | Indicator |
|-------|---------|-----------|
| Parent major **with children** | Full eucalyptus `#DCE8E0` | Botanical left bar |
| Category / items / standalones | White | Guides / indent as approved |

### Clients (approved — do not reopen)

- Warm canvas; white heading; white toolbar; eucalyptus table header.
- Blush **table rows** only for genuine Needs Attention (`attentionClientIds`).
- Booked chip: eucalyptus-tinted with dark text.

### Dashboard (command center) — VISUALLY APPROVED / CLOSED

May use a richer coordinated set of soft greens, ivory/linen, and restrained blush accents than operational tables — still within this palette. Color encodes hierarchy and rhythm, not decoration.

**Final approved Dashboard treatment:**

| Module | Approved treatment |
|--------|-------------------|
| Greeting | White heading card; botanical CTA |
| Today's Focus | Eucalyptus header retained; critical overdue rows = **ivory** working surface + soft-rose **left indicator** + restrained Overdue label; **no** repeated full-blush task backgrounds |
| Luv | Ivory working surface; thin blush top accent; blush heart brand identifier; **no** full-blush card |
| Coming up | Quiet linen; distinct from Focus without competing |
| Snapshot Lead Flow | Eucalyptus header retained |
| Snapshot Booked | Pale botanical / green mist |
| Snapshot Cash | Coordinated pale botanical |
| Snapshot Outstanding > 0 | Ivory body + restrained blush header band |
| Snapshot Outstanding = 0 | Neutral white |
| Reports | Quiet white |

**Approved palette principles (Dashboard + system):** botanical greens, blush/rose, warm neutrals, and (where separately authorized) calm-blue supporting surfaces; locked base hex values unchanged; white remains important but not the only working surface; no champagne, pale sand, muted olive, or **ad-hoc** blue accent families outside §1.2 calm blue. Dashboard modules above remain as approved — calm blue was **not** applied to Dashboard in its closed refinement.

---

## 4. Borders and elevation

- Ordinary cards: `1px` warm border + soft dual shadow (restrained).
- Tables: light row dividers; eucalyptus header edge stronger than body.
- Critical Focus indicator: `3px` soft-rose left border — not a heavy frame.
- Do not float every control; avoid excessive shadows.

Utilities: `.htc-hospitality-elevated`, `.htc-hospitality-heading`, `.htc-hospitality-toolbar`, `.htc-hospitality-table`, `.htc-catalog-*`.

---

## 5. Corner radii

| Control | Radius |
|---------|--------|
| Inputs / small chips | `rounded-md`; filter chips may be pill |
| Buttons | component default (not forced pill) |
| Cards, headings, toolbars, catalog sections | `0.75rem` |
| Modals / sheets | existing Dialog / Sheet radii |

---

## 6. Typography

- **Serif (Cormorant / `--font-heading`):** page titles and selected feature headings.
- **Sans (Source Sans 3 under `.htc-staff`):** operational UI, tables, forms, nav.
- Hierarchy: title → description → section → body → meta (`text-xs`).
- Guidance panels: title and body are **separate block elements**.
- No ordinary green or pink body copy.

---

## 7. Spacing and proportions

| Region | Guidance |
|--------|----------|
| Hospitality page stack | `space-y-4` mobile → `space-y-6` desktop |
| Heading card | Compact on mobile; `~1.15–1.35rem` padding desktop |
| Toolbar | `~0.85–1rem` padding |
| Section gaps | Intentional between heading, tools, content |

---

## 8. Interaction states

| State | Pattern |
|-------|---------|
| Default | Surface + charcoal text |
| Hover | Subtle wash (warm-pale / muted) or underline for links |
| Focus | Botanical `--ring` |
| Selected | Botanical fill + white text |
| Active nav | Eucalyptus wash + botanical bar + dark label |

---

## 9. Responsive

Design for ~390px and ~1440px. On mobile, avoid full-blush repeated task rows — accents scale better than pastel stacks.

---

## 10. Dark mode — outstanding visual QA

Staff dark remaps exist under `.dark .htc-staff`. **Do not change dark-mode implementation** in light-mode palette expansion work. Dark visual QA remains outstanding.

---

## 11. Shared utilities (reference)

Under `.htc-staff` in `app/globals.css`:

- `.htc-hospitality-page` | `.htc-hospitality-heading` | `.htc-hospitality-toolbar` | `.htc-hospitality-table` | `.htc-hospitality-elevated`
- `.htc-hospitality-catalog` | `.htc-catalog-*`
- Expanded shade tokens listed in §1.2

Guidance: `LibraryHowItWorks` / `LibraryDependencyNote` with `tone="blush" | "eucalyptus"`.

---

## 12. Rollout

1. ~~Foundation tokens + utilities~~  
2. ~~Prove on **Clients** and **Offerings** (visually approved — locked)~~  
3. ~~Dashboard light-mode palette refinement — **GREEN / VISUALLY APPROVED / CLOSED**~~  
4. Later: Leads, Calendar, Templates, Contracts, Payments — same palette; page-appropriate density (separate authorization)  
5. Calm blue supporting family — **documented / Lead personalized scheduling-link reference approved**; further page applications and CSS variable wiring require separate authorization  
6. Dark-mode visual QA — **outstanding** (separate workstream; not implied by Dashboard light approval)  
