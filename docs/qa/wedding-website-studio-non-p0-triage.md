# WW Studio — Non-P0 residual triage

**Date:** 2026-08-09 (triage) · **Evidence base:** combination audit + Phase 4 live matrix (2026-08-10)  
**Mode:** Docs / decision only — no product code.  
**P0 status:** Phases 1–3 accepted live; residual Fail cells = **0**.

Sources:

- `docs/qa/wedding-website-studio-combination-audit-report.md` (WW-AUDIT-01b, §4 density notes)
- `docs/qa/wedding-website-studio-phase-4-live-matrix.md`
- Phase 4 PNGs under `docs/qa/wedding-website-studio-phase-4/` (esp. Rustic/Wildflower heroes; Scrapbook / Gallery Wall / Wildflower desktop galleries)

---

## Decision key (AskQuestion options)

For each residual, pick one:

| Option | Meaning |
| --- | --- |
| **A — Keep as intentional** | Document only; do not schedule engineering. Collection / Photo Style DNA stands. |
| **B — Schedule small P1** | Surgical fix (1-sentence approach below); no Collection Phase B reopen. |
| **C — Needs more design judgment** | User / design must choose direction before engineering. |

---

## 1. WW-AUDIT-01b — Hero left/offset vs centered welcome

### Symptoms

Immediately under the hero, romantic/formal **welcome** stays horizontally centered while **hero type mass** is left or offset. Eye jumps center→left (or offset) across the fold. Story body itself is already fixed (Phase 1) — this is *only* hero ↔ welcome.

### By Collection (active catalog)

| Collection | Welcome | Hero type mass | Clash? | DNA read |
| --- | --- | --- | --- | --- |
| **Wildflower** | center | `heroAlign: offset` (left-biased) | **Yes** | Intentional Phase B offset DNA; romantic welcome stays center |
| **Rustic** | center | `heroAlign: left` (inset grounded) | **Yes** | Intentional left/grounded inset; romantic/flowing welcome center |
| Garden / Champagne / Estate / Rosé | center | center | No | Harmonized |
| Linen | center-ish | invitation center | No | Quiet center |
| Midnight / Velvet | left | left | No | Editorial family consistent |
| Coastal | left welcome | center hero | Mild | Coastal welcome left by design |
| Industrial | left | left | N/A | Inactive — untested |

**Evidence:** `col-rustic-desktop-hero.png`, `col-wildflower-desktop-hero.png`, `col-wildflower-mobile-hero.png` (hero left/offset + centered “We’re so excited…”). Contrast control: `col-garden-party-desktop-hero.png` (both center). Prior user crop: `user-reports/02-mobile-hero-clip-align.png` (desktop pane shows the clash clearly).

### Intentional DNA vs inconsistency

- **Intentional (product DNA):** Phase B / STOP explicitly preserve Wildflower *hero* offset and Rustic *hero* left. Welcome for romantic/formal families is a shared centered band, not Collection-left. Audit + Phase 1 notes already labeled 01b “intentional DNA residual / not Phase 1.”
- **Feels inconsistent:** Same vertical stack (hero → welcome) uses two alignment systems. Not a clip or unreadability bug; composition tension only.

### Effort if fixed

| Approach | Effort | Risk |
| --- | --- | --- |
| Left-align welcome (only) when Collection `heroAlign` ∈ `{left, offset}` and headerStyle is romantic/formal | **S** (~½–1 day) | Softens Collection invitation symmetry; must not drag story back left (Phase 1 gate) |
| Soften hero toward center on romantic Collections (partial re-center Wildflower/Rustic) | **M** | Reopens Phase B silhouette vs Garden Party / Estate — **avoid without design sign-off** |
| Add distinct offset/left welcome primitive for those Collections | **M** | New composition family; overkill for residual |

### Triage recommendation

| Residual | Severity | Recommended option | 1-sentence surgical (if B) |
| --- | --- | --- | --- |
| **01b Wildflower + Rustic** | Low (composition polish, not P0) | **A — Keep as intentional**, *or* **C** if product wants visual unity across the fold | If B: Gate welcome `textAlign` to match `heroAlign` when ∈ `{left,offset}` for romantic/formal only; leave Midnight/Velvet/Coastal editorial paths untouched. |
| **01b Coastal mild** | Very low | **A — Keep** | — |

**Suggested AskQuestion default:** **A** (document DNA). Escalate to **C** only if couple QA keeps calling out “welcome feels wrong” under Wildflower/Rustic.

---

## 2. Scrapbook / Gallery Wall / Wildflower — narrow density

### Symptoms (audit + desktop Phase 4)

| Photo Style | Arrangement / pattern | Narrow risk (audit) | What you see |
| --- | --- | --- | --- |
| **Scrapbook** | `scrapbook` + polaroid overlap/tilt | Medium | Clustered polaroids with side air on desktop; on narrow, overlaps can crowd and tilt more; readable but denser than Film/Modern |
| **Gallery Wall** | `gallery-wall` salon mats, non-overlap | Medium | Framed salon wrap; gaps uneven; on narrow, mats wrap tightly and can feel cramped vs intentional “salon spacing” |
| **Wildflower** (Photo Style) | `uniform` + `alternating` unequal windows | Medium | Organic unequal rounded windows with generous air on desktop; on narrow, unequal wrap can leave odd leftover columns / uneven margins |

**Phase 4 honesty:** Desktop galleries captured (`ps-scrapbook-desktop-gallery.png`, `ps-gallery-wall-desktop-gallery.png`, `ps-wildflower-desktop-gallery.png`). **Mobile density was not PNG-certified** this run — matrix marked Pass† / parity-inferred for P0 scope; residual called “still Pass for readability,” out of Phase 3 (Mag/Edit/Minimal only).

### Severity

| Style | Severity | Why not P0 |
| --- | --- | --- |
| Scrapbook | Low–Medium | Identity language *is* overlap/tilt; not an ultra-narrow amputating lead like pre-Phase-3 Magazine |
| Gallery Wall | Low–Medium | Salon still renders all 6; cramped wrap vs airy salon is polish, not fail |
| Wildflower PS | Low–Medium | Alternating organic DNA expects uneven air; wrap quirks only |

No Fail cells; content contract (6 photos) intact.

### Effort if fixed

| Approach | Effort | Scope |
| --- | --- | --- |
| Below `@min-[480px]/wedding`: reduce Scrapbook tilt/overlap scale; Gallery Wall → single-column / 2-col salon with larger gaps; Wildflower alternating → simpler 2-col wrap | **S–M** (1–2 days + mobile PNG certification) | GalleryGrid narrow branches only — mirror Phase 3 pattern |
| Retune desktop density for identity | **M+** | Out of residual triage — reopens Photo Style Phase B beauty gate |

### Triage recommendation

| Residual | Recommended option | 1-sentence surgical (if B) |
| --- | --- | --- |
| Scrapbook / Gallery Wall / Wildflower PS narrow density | **C — capture mobile first**, then choose A vs B; *or* **B** if couple QA already complains on phone | If B: Add Phase-3-style `@container/wedding` narrow softeners (less tilt/overlap on Scrapbook; stack or widen salon gaps on Gallery Wall; collapse Wildflower alternating to stable 1–2 col wrap) without changing ≥480 desktop DNA. |

**Suggested AskQuestion default:** **C** — schedule a short mobile PNG pass (Studio phone + published 390) before committing engineering, *unless* product already prefers documenting as intentional memory-page / salon / organic air (**A**).

---

## 3. Other Phase 4 non-P0 notes

| Note | Severity | Recommended option | Notes / surgical if B |
| --- | --- | --- | --- |
| **Industrial Untested** (inactive catalog → 3 story + 3 hero cells) | Ops / coverage gap | **A** until product activates Industrial | If activating: run Phase 4 capture for Industrial × desktop/mobile/published (half-day). Not a render bug. |
| **Draft + preview-token published path** (not production published slug) | Coverage honesty | **A** | Same `WeddingWebsite` renderer; re-spot after first real publish if desired. |
| **Scrapbook / GW / Wildflower mobile not PNG-certified** | Evidence gap | **C** (subsumed by §2) or light **B** as “evidence chore” only | Capture-only task; no product change required. |
| **Strict live-only coverage ~53%** of identity cells (rest parity-inferred) | Process | **A** | Mag/Edit/Minimal × Rustic already confirmed Photo-Style-global narrow behavior. Full 11×10 explosion out of scope. |
| **Midnight Photo Style** mobile Pass† (medium band risk in original audit) | Very low | **A** | Not listed as residual Fail risk after Phase 4; control styles already OK. |
| **Metric false positive on Minimal mobile** (2-col support ovals) | Resolved | **A** | Documented override; do not “fix.” |

---

## AskQuestion-ready decision table (summary)

| ID | Residual | Collections / Styles | Severity | **A Keep** | **B Small P1** | **C Design judgment** | Default lean |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | WW-AUDIT-01b hero vs welcome | Wildflower, Rustic (Coastal mild → keep) | Low | DNA: left/offset hero + romantic centered welcome | Welcome align follows `heroAlign` for romantic/formal left/offset only | Decide whether fold must feel one alignment family | **A** (or **C** if polish priority) |
| R2 | Narrow gallery density | Scrapbook, Gallery Wall, Wildflower PS | Low–Med | Document as intentional tactile/salon/organic | Narrow `@480cqw` softeners only | Need mobile PNGs + taste call before fix | **C** → then A or B |
| R3 | Industrial Untested | Industrial (inactive) | Coverage | Leave until catalog active | N/A (activation chore) | Product: activate or drop from matrix | **A** |
| R4 | Evidence gaps (draft preview; density mobile uncaptured; parity %) | — | Process | Accept Phase 4 honesty notes | Optional capture-only follow-up | Only if shipping review needs stricter bar | **A** (+ optional capture for R2) |

---

## Explicitly out of this triage

- Reopening Phase 1–3 P0s (story leak, hero clip, Mag/Edit/Minimal narrow) — **Pass live**.
- Collection Phase B DNA wholesale, typography isolation, Photo Style 6-photo contract, Minimal oval language.
- Couple Home / RSVP / payments / Color Story retunes.

---

## Handoff

Present **R1** and **R2** as the only product-facing residuals. Prefer keeping R1 as DNA unless design wants fold-level unity; prefer short mobile evidence pass for R2 before scheduling GalleryGrid work.
