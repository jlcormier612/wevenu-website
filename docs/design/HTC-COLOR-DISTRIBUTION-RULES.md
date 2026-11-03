# HTC Color Distribution Rules

**Status:** Formalized for Phase 11D relationship-workspace pilot  
**Authority:** Approved HTC palette + hospitality redesign Phases 1–11C  
**Token home:** `.htc-staff` in `app/globals.css`  
**Companion:** `docs/design/htc-visual-system.md` (locked hex values and Dashboard/Clients/Offerings approvals)

Color communicates purpose, hierarchy, and meaning — not decoration.  
Hello to Cheers should feel warm and polished, not green-everywhere, and not generic white-and-gray SaaS.

---

## 1. Canonical palette

| Role | Hex | Token |
|------|-----|-------|
| Warm canvas | `#F8F7F3` | `--htc-canvas` / `--htc-workspace` |
| White | `#FFFFFF` | `--card` |
| Linen | `#F3F0E9` | `--htc-linen` |
| Eucalyptus surface | `#DCE8E0` | `--htc-eucalyptus-surface` |
| Botanical | `#446B56` | `--htc-botanical` / `--primary` |
| Charcoal | `#24332B` | `--heading` / `--foreground` |
| Calm blue | `#EAF1F7` | `--htc-calm-blue` |
| Blue border | `#D5E1EB` | `--htc-border-calm` |
| Blue accent | `#63819A` | `--htc-calm-accent` |
| Soft blush | `#F7E9EB` | `--htc-soft-blush` |

Do not invent parallel tokens. Expand only through the visual system document.

---

## 2. Surface-role rules

### Rule A — White is the default working surface

**Class:** default Card / `.htc-surface-working` when an explicit wrapper is needed.

Use white for contact cards, data records, forms, tables, document lists, questionnaires, event-order editors, conversation/task/activity content.

Do not turn ordinary working content green.

### Rule B — Linen is the operational surface

**Class:** `.htc-surface-operational` (also `.htc-hospitality-filter` for filter/date toolbars).

Use linen for filters, toolbars, staff/team assignments, space-preference controls, secondary operational groupings, and neutral supporting sections.

When several pale-green panels appear in one viewport, prefer linen for operational groups.

### Rule C — Eucalyptus is selective, not universal

**Class:** `.htc-surface-summary`, `.htc-hospitality-intro`, `.htc-hospitality-section-label`.

Use eucalyptus for approved hospitality intros, primary event/booking summaries, meaningful selected states, and occasional major section headers.

Do not stack multiple eucalyptus panels in one viewport unless each has a clear purpose.

### Rule D — Calm blue is for genuinely informational content

**Class:** `.htc-surface-guidance` / `.htc-surface-guidance-compact` (plus established specialty classes such as `.htc-lead-tour-personal-link`, library/inbox calm panels).

Use calm blue for how-to guidance, feature explanations, reassurance, workflow distinctions, and “why this appears” copy.

A white card may contain a small calm-blue subsection. The whole card does not need to become blue.

Do **not** use calm blue for errors, warnings, missing required information, urgent actions, success, booking/availability status, primary buttons, ordinary body text, or every empty state.

### Rule E — Botanical green is an accent and action color

Use botanical for primary CTAs, active selection controls, left-edge hospitality accents, and purposeful interactive emphasis.

Default body/heading text on light surfaces is charcoal. White text only on dark botanical fills. Secondary actions must not all compete with the primary.

### Rule F — Blush remains intentional

Preserve approved Luv / intentional-attention treatments. Do not use blush as a general alternative to green or blue.

### Rule G — Preserve semantic meaning

Never recolor Calendar taxonomy, booking lifecycle, pipeline stages, warnings/errors, payment/contract states, floor-plan/seating states, availability protection, or permission indicators for decorative reasons.

---

## 3. Shared utilities (Phase 11D)

| Class | Role |
|-------|------|
| `.htc-surface-working` | Explicit white working panel |
| `.htc-surface-operational` | Linen operational grouping |
| `.htc-surface-summary` | Selective eucalyptus primary summary |
| `.htc-surface-guidance` | Calm-blue informational panel |
| `.htc-surface-guidance-compact` | Calm-blue subsection inside a white card |

All are scoped under `.htc-staff`. Do not apply to portal, vendor-app, marketing, or print/PDF.

Existing hospitality utilities remain valid:

- `.htc-hospitality-page` / `.htc-hospitality-heading` / `.htc-hospitality-toolbar`
- `.htc-hospitality-filter` (linen toolbars)
- `.htc-hospitality-intro` (+ optional `.htc-hospitality-intro-accent`)
- `.htc-hospitality-section-label` / `.htc-hospitality-table`

Prefer semantic variants over one-off `bg-muted/20` or `bg-primary/5` washes on relationship workspaces.

---

## 4. Pilot examples (Phase 11D)

| Surface | Treatment |
|---------|-----------|
| Lead Sales & availability | Linen operational |
| Lead Space preferences | Linen operational |
| Lead Contact information | White working card |
| Lead personalized scheduling-link guidance | Calm-blue guidance |
| Booking event schedule summary | Eucalyptus summary |
| Booking Team assignment | Linen operational |
| Booking Questionnaires card | White card + compact calm-blue guidance subsection |
| Booking Inventory & Event Order | White working card |
| Pipeline / hold / Booked badges | Unchanged semantic treatments |

---

## 5. Guidance for future work

1. Classify the surface before coloring: working / operational / summary / guidance / semantic / Luv.
2. Reuse a shared class when the role matches; do not invent a new wash.
3. Judge the whole viewport — avoid green domination and pastel quilts.
4. Keep dark-mode and print/PDF out of scope unless separately authorized.
5. Stop for product visual approval before deploying decorative color sweeps.

---

## 6. Protected exceptions

- Dashboard, Clients list, and Offerings catalog closed approvals in `htc-visual-system.md`
- Calendar `--cal-*` taxonomy
- Floor Plan / Seating object colors
- Luv blush identity
- Semantic success / warning / destructive / overdue treatments
