# HTC Color Distribution Rules

**Status:** Formalized for Phase 11D; extended for Phase 12 surface layering  
**Authority:** Approved HTC palette + hospitality redesign Phases 1–11D  
**Token home:** `.htc-staff` in `app/globals.css`  
**Companion:** `docs/design/htc-visual-system.md` (locked hex values and Dashboard/Clients/Offerings approvals)

Color communicates purpose, hierarchy, and meaning — not decoration.  
Hello to Cheers should feel warm and polished, not green-everywhere, beige-everywhere, or generic white-and-gray SaaS.

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

### Rule H — Surface layering and visual contrast (Phase 12)

The correct hospitality design is not a collection of colored cards. Color must work across the hierarchy of the page.

**Preferred structure**

Warm canvas → purposeful section treatment → white content surfaces → selective accents

Examples:

- Warm canvas + eucalyptus introduction + white working cards
- Warm canvas + linen control toolbar + white data table
- Linen section shell + white nested records
- White card + calm-blue instructional subsection
- Eucalyptus primary summary + white neighboring cards
- White content area + selective linen supporting section

**Avoid**

- Linen outer shell containing indistinguishable linen cards
- Large beige areas with additional beige surfaces on top
- Green outer panels filled with more green cards
- Multiple consecutive pale-green sections with no white separation
- Entire pages where every major panel has a tinted background
- Returning to almost entirely white pages with no hospitality hierarchy

**When a parent surface is tinted, nested content should usually be white.**  
Exceptions need a specific purpose (approved selected state, compact informational subsection, semantic status).

**White is not the enemy.** Use it generously for working content, record cards, controls, and readable detail. The old problem was missing hierarchy — not white itself.

**Linen is supporting, not dominant.** It creates warmth around operational controls and groupings. It must not become the default fill for every large content panel. If a section already sits on warm canvas and holds many records, prefer a white shell (optionally with linen controls) over a large beige slab.

**Eucalyptus is the signature, not the wallpaper.** Keep meaningful introductions and primary summaries. Do not fill every supporting card with eucalyptus.

**Calm blue should be present where useful** — restrained instructional treatments — so the product uses its full palette. Blue remains informational, never decorative wallpaper.

Judge balance at **page level**: dominant color, consecutive tinted sections, parent/child contrast, primary action visibility, white working content vs colored framing, guidance visibility, typography, and mobile readability. Avoid artificial color quotas.

### Rule I — Active indicators (hospitality)

When a staff surface needs a restrained “Active” indicator that is not a dark botanical fill, use the eucalyptus Active treatment (`.htc-badge-active`): eucalyptus surface wash + dark charcoal text. Preserve distinct Paused / Draft / Failed / Overdue meanings — do not make every status green.

### Rule J — Platform consistency recipe (Clients as canonical)

These treatments apply across **most staff pages**, not only classic list screens. Tasks, Setup, Settings (including Availability / Team / Import), Library collections, Guide, Help, Feedback, Communication Health, Contracts, Payments, Documents, Automations forms, and similar modules should reuse the same top-card, guidance, action, and attention language even when the body layout differs. When a page lacks a search/table shell, still give it the white title card + botanical left strip and put how-to copy on calm blue.

| Slot | Treatment | Classes / tokens |
|------|-----------|------------------|
| Page canvas | Warm beige | `.htc-hospitality-page` / `--htc-canvas` |
| Primary label / title card | **White** + **dark green left strip** | `.htc-hospitality-heading` + `.htc-hospitality-intro-accent` |
| Search / filter card (when present) | White card; search field white | `.htc-hospitality-toolbar` |
| Table / record list card (when present) | White shell; **eucalyptus header bar** | `.htc-hospitality-table` |
| Directional open links | Charcoal text; **black underline on hover/focus** | `.htc-record-link` |
| Row / selectable-item hover | Soft blush wash | Shared table / list hover |
| Primary small actions | Botanical fill + white text | Default `Button` / `--primary` |
| Quiet status chips | Eucalyptus wash + dark text | `.htc-badge-active` (e.g. Active, Completed-like) |
| Attention / required chips | Soft blush + rose border | `.htc-badge-attention` / attention filter chips (Needs Attention, Required, populated New Inquiry) |
| Informational explainers / empty readiness notices | Calm blue | `.htc-surface-guidance`, empty “nothing upcoming/scheduled”, Setup orientation & ready-declared, Vendors Required categories |
| Quiet group / section chrome | Eucalyptus | Table headers, Task couple/staff group headers, active Tour taxonomy chips, Tours section headers |
| True attention / overdue | Soft blush | `.htc-badge-attention`, Task overdue banner — not calm blue |

**Do not** fill ordinary primary title cards with eucalyptus. Eucalyptus belongs on table header bars, quiet Active chips, group headers, and selective summaries — not the whole page title card.

**Guidance must read as calm blue**, including Setup Hub orientation (“Jennifer, here’s what helps…”), ready-declared notices, Bring-Your-Business / HoneyBook how-to panels, migration guidance, Automations help, empty informational panels, and Task Center informational callouts. When informational copy is orphaned on the canvas, wrap it in a calm-blue shell — do not invent blue boxes for every paragraph.

**Exceptions:** Calendar, Reports, Messaging inbox, and dense open workspaces keep specialized body layouts. They still use white title cards + botanical strip, white search/toolbars, record-link names, botanical primary actions, blush for true attention, eucalyptus for quiet grouping chips, and calm blue for real guidance/empty info.

---

## 3. Shared utilities (Phase 11D + Phase 12 + list recipe)

| Class | Role |
|-------|------|
| `.htc-surface-working` | Explicit white working panel |
| `.htc-surface-operational` | Linen operational grouping |
| `.htc-surface-summary` | Selective eucalyptus primary summary |
| `.htc-surface-guidance` | Calm-blue informational panel |
| `.htc-surface-guidance-compact` | Calm-blue subsection inside a white card |
| `.htc-group-shell` | Linen parent grouping that forces nested cards white |
| `.htc-badge-active` | Restrained eucalyptus Active indicator |
| `.htc-badge-attention` | Soft-blush attention / Required indicator |

All are scoped under `.htc-staff`. Do not apply to portal, vendor-app, marketing, or print/PDF.

Existing hospitality utilities remain valid:

- `.htc-hospitality-page` / `.htc-hospitality-heading` / `.htc-hospitality-toolbar`
- `.htc-hospitality-filter` (linen toolbars)
- `.htc-hospitality-intro` (+ optional `.htc-hospitality-intro-accent`) — eucalyptus intro for approved non-list summaries; list primary cards prefer **heading + accent strip**
- `.htc-hospitality-section-label` / `.htc-hospitality-table` / `.htc-record-link`

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
3. Judge the whole viewport — avoid green domination, beige domination, and pastel quilts.
4. Prefer white nested content inside tinted parents.
5. Keep dark-mode and print/PDF out of scope unless separately authorized.
6. Stop for product visual approval before deploying decorative color sweeps.

---

## 6. Protected exceptions

- Dashboard Snapshot KPI families and closed Focus / Luv behaviors in `htc-visual-system.md` (Phase 12 may refine Coming Up shell for page-level beige balance without reopening Snapshot families)
- Clients list and Offerings catalog closed approvals in `htc-visual-system.md`
- Calendar `--cal-*` taxonomy
- Floor Plan / Seating object colors
- Luv blush identity
- Semantic success / warning / destructive / overdue treatments
- Phase 11D relationship-workspace structure (Lead Sales / Space Prefs / Contact; Booking summary / Team / Questionnaires / Inventory) — refine only for clear layering defects; do not reopen functional UX
