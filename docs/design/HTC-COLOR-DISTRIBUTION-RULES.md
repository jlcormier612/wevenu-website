# HTC Color Distribution Rules

**Status:** Formalized for Phase 11D; extended for Phase 12 surface layering + Rule J Waves A/B/C/D/E + Rule K (relationship workspaces)  

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

Use linen for filters, toolbars, staff/team assignments, secondary operational groupings, and neutral supporting sections. On Lead workspaces, Space preferences use eucalyptus summary (Rule K) rather than linen.

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

**Exceptions:** Calendar, Reports, Messaging inbox, and dense open workspaces keep specialized body layouts. They still use white title cards + botanical strip, record-link names, botanical primary actions, blush for true attention, eucalyptus for quiet grouping chips, and calm blue for real guidance/empty info. **Calendar** view/date toolbar is eucalyptus (`.htc-calendar-toolbar`); taxonomy color dots use one size (`.htc-calendar-dot`, matching Month-at-a-glance) in filter chips, month cells, and at-a-glance.

**Wave B (internal / detail workspaces):** Questionnaires delivery guidance + kind title cards; Event setup title + orientation guidance + white working body; Event Inventory share how-to + Venue-only visibility disclosure; Support Access; Event Order couple-choice constraint cards; Venue Guide Complete chips via `.htc-badge-active`; BusinessAssetHeader relationship links via `.htc-record-link`. Venue Guide orientation already uses calm blue via `.htc-venue-guide-orientation`.

**Wave C (mechanical remaining-staff sweep):** Reports white title (drop eucalyptus intro fill); Settings how-to / before-you-start / email intake / texting orientation / reminder cadence / website share+embed / migration guidance / starter ownership → calm blue; inquiry-form field editor → white working; Contracts/Payments/Packages/Inventory/Offerings/Documents/Saved Reports informational empties → calm blue; EO overview white working + record-links; Lead Capture + Change password white title cards; Library apply-template consequence notes → compact guidance. Payment Plan Builder totals and invoice drift banners stay muted/semantic (not guidance).

**Wave D (screenshot polish):** Library Documents empty → calm blue; Task titles + Templates catalog titles → record-link underline on hover; Task perspective pills white → botanical when selected; Calendar Tour chip eucalyptus; taxonomy dots shared size; Public Event Availability + Tour Scheduling both eucalyptus header + eucalyptus left strip (linen guidance nest kept); Setup BYB Add/Fresh → calm blue; Setup quiet CTAs white outline; Settings / Help / Guidance / Feedback tiles → **white at rest, soft blush on hover** (same hover as Templates toolbox, calendar day cells, inbox rows); Feedback footer tip → calm blue; Reports Outstanding KPI → soft blush; Reporting date bar white; Save Report eucalyptus; report empty cards calm blue; **Saved Reports** calm-blue guidance above the list, then **white cards on beige** (not a blue nest around the cards).

**Wave E (Dashboard F/U):** Today's Focus rows blush on hover + record-link titles; Luv white body with blush top strip; Coming up calm-blue guidance shell.

**Wave F (deeper edit / detail workspaces):** Beige page canvas; **one** calm-blue orientation box (consolidate redundant how-to / save-scope copy); white working cards with **eucalyptus header banners** (`.htc-working-card`); botanical primary / directional actions; quiet eucalyptus chips (`.htc-badge-active`); blush only for Luv / true attention; openable rows / client-style bars use blush hover + `.htc-record-link` underline; staff inputs/selects stay white. Pilot: Automations edit/new; same working-card chrome on Message/Contract/Pipeline template edits, Vendor/Lead/Client/Event edit pages.

**Wave G1 (deeper-page consistency):** CollectionBackLink on template/inventory editors; merge-field chips white + blush hover (`.htc-merge-field-chip`); booking space chips white; client/event Vendors Required → `.htc-badge-attention`; Floor Plans empty → calm blue; notification bell rows → white cards on beige with blush hover (`.htc-notification-row`).

**Wave G2 (template workspaces):** EO template edit — white `.htc-working-card` sections + eucalyptus headers (not beige-on-beige); one calm-blue orientation; empty “No couple choices” / no sections → calm blue; workflow chips eucalyptus (not charcoal). Timeline template edit — working-card items list, calm empty, botanical icon buttons (not muted gray). Floor Plan template edit — hospitality shell + working-card around layout editor; editor empty/info panels → calm guidance (not muted wash).

**Wave G3 (relationship tab parity):** Lead + Booking tabs use Documents recipe via `RelationshipTabShell` (white title + botanical strip); Activity icons all eucalyptus; Activity/Payments empties calm blue; invoice rows blush hover; Questionnaire apply panel calm guidance; quiet invoice/questionnaire status → `.htc-badge-active` (not muted gray).

---

## 3. Shared utilities (Phase 11D + Phase 12 + list recipe)

| Class | Role |
|-------|------|
| `.htc-surface-working` | Explicit white working panel |
| `.htc-surface-operational` | Linen operational grouping |
| `.htc-surface-summary` | Selective eucalyptus primary summary |
| `.htc-surface-summary-pale` | Paler eucalyptus booking summary (Booked chip stays standard) |
| `.htc-surface-guidance` | Calm-blue informational panel |
| `.htc-surface-guidance-compact` | Calm-blue subsection inside a white card |
| `.htc-group-shell` | Linen parent grouping that forces nested cards white |
| `.htc-working-card` | White edit/detail card with eucalyptus header banner |
| `.htc-working-row` | White row with soft-blush hover (openable / enrollment bars) |
| `.htc-badge-active` | Restrained eucalyptus Active indicator |
| `.htc-badge-attention` | Soft-blush attention / Required indicator |
| `.htc-merge-field-chip` | White merge-field chip; soft blush on hover |
| `.htc-notification-row` | White notification card; soft blush on hover |

All are scoped under `.htc-staff`. Do not apply to portal, vendor-app, marketing, or print/PDF.

Existing hospitality utilities remain valid:

- `.htc-hospitality-page` / `.htc-hospitality-heading` / `.htc-hospitality-toolbar`
- `.htc-hospitality-filter` (linen toolbars)
- `.htc-hospitality-intro` (+ optional `.htc-hospitality-intro-accent`) — eucalyptus intro for approved non-list summaries; list primary cards prefer **heading + accent strip**
- `.htc-hospitality-section-label` / `.htc-hospitality-table` / `.htc-record-link`

Prefer semantic variants over one-off `bg-muted/20` or `bg-primary/5` washes on relationship workspaces.

---

## 4. Rule K — Relationship workspace recipe

Rule J covers list/hub pages. **Rule K** covers dense **relationship workspaces** that share one skeleton so Lead, Booking, Event Setup, Questionnaires, Inventory, Event Order, and Client invite/support read as the same family — without cloning Clients-list chrome onto editors.

**In scope:** Lead detail; Booking / booked-client overview; Event setup; Questionnaires / Inventory / Event Order panels; Client invite + Support Access.  
**Out of scope (keep specialized):** Calendar body taxonomy, Reports KPI families, Inbox threads, Floor/Seating object colors, Luv identity, print/PDF.

### Structural contract (same order on every workspace)

1. **A — Record identity** — couple/event name + pipeline/actions on canvas; botanical primary; outline secondary; `.htc-record-link` for View lead / Edit contact / openable names. Workspace section titles that act as primary page headers (e.g. **Event Setup**) use **PageHeader scale** (`font-heading text-3xl`), not compact card-title size. On mobile Lead workspaces, action chips flow **left / full-width** — do not right-clump management + tour/booking buttons.  
2. **B — Primary summary** (at most one per band) — eucalyptus `.htc-surface-summary` for Lead **Space preferences**; booking schedule window uses **pale** `.htc-surface-summary-pale` (`--htc-eucalyptus-surface-pale`, explicit faded green — never pink oklch drift) so nested **Booked** (`.htc-badge-active`) stays the stronger standard green.  
3. **C — Operational rails** — linen `.htc-surface-operational` only when a true linen assignment rail is still warranted. Nested selects stay **white**.  
4. **D — Working modules** — white `.htc-surface-working` (Lead **Sales & availability**, Booking **Team assignment**, Contact, Tour list, Questionnaires/Inventory cards, Event setup feature rows, workspace tab bars).  
5. **E — How-to / readiness** — calm blue `.htc-surface-guidance` or compact (orientation, Support Access, “choose and send…”, **Your client's planning workspace**, empty info). Never blue entire editors.  
6. **F — Quiet chips** — eucalyptus `.htc-badge-active` for positive/quiet lifecycle chips: **Booked**, Included, Released, Decide, Complete, Completed, Active. **No gray/muted fills** for these chips.  
7. **G — Attention** — soft blush only for true problems/overdue (`.htc-surface-attention` / `.htc-badge-attention`).  
8. **H — Actions** — botanical fill = primary commit; white outline = secondary open/edit.  
9. **I — Chrome controls** — staff **tab bars** and **select/dropdown fields** are **white** (not muted gray). Selected tab keeps the eucalyptus highlight (`data-[active]` / `--selected`).

### Pilot examples (Phase 11D + Rule K)

| Surface | Slot | Treatment |
|---------|------|-----------|
| Lead Sales & availability | D | White working |
| Lead Space preferences | B | Eucalyptus summary (standard) |
| Lead Contact / Tour list | D | White working |
| Lead personalized scheduling-link guidance | E | Calm-blue guidance |
| Lead mobile action rows | A/H | Left-flow management chips; full-width tour/booking CTAs |
| Lead / Booking **Booked** chip | F | `.htc-badge-active` (not muted/gray) |
| Booking event schedule summary | B | Pale eucalyptus `.htc-surface-summary-pale` |
| Booking Team assignment | D | White working; white select field |
| Booking workspace tab bars | D/I | White tabs; eucalyptus selected highlight |
| Booking Questionnaires card | D + E | White card + compact calm-blue guidance |
| Booking Inventory & Event Order | D | White working |
| Event Setup title + orientation | A/E | White title “Event Setup” at PageHeader scale + calm-blue orientation |
| Event setup Decide / Included chips | F | `.htc-badge-active` |
| Event setup feature cards | D | White working |
| Your client's planning workspace | E | Calm-blue guidance |

Do **not** paint every card blue or green. Do **not** force list-page search/table shells onto these editors. Do **not** use gray/muted washes for Booked, Decide, or other quiet positive chips.

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
- Phase 11D / Rule K relationship-workspace structure (Lead Sales / Space Prefs / Contact; Booking summary / Team / Questionnaires / Inventory; Event setup) — refine only for clear layering defects; do not reopen functional UX
