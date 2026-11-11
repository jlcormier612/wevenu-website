# HTC Dashboard — Light Mode Final Design Blueprint

**Workstream status:** **GREEN / VISUALLY APPROVED / CLOSED**  
**Product/design decision:** Dashboard light-mode palette refinement **APPROVED** (desktop + mobile screenshots reviewed).  
**Authority:** Locked product decisions + `docs/design/htc-visual-system.md`.  
**Prior discovery:** `docs/design/htc-dashboard-light-discovery.md`  
**Baseline (pre-hospitality):** `docs/qa/staff-light-canvas/stage2b/dashboard-baseline/`  
**Final approved evidence:** `docs/qa/staff-light-canvas/stage2b/dashboard-palette-refine/` (`01-top` … `05-reports`, desktop + mobile)  
**Scope:** Visual / hospitality treatment of the **existing** Dashboard only. Preserve IA, metrics, navigation, dismissal, and Luv behavior.

This document remains the implementation blueprint. The palette-refinement pass superseded early blush-heavy treatments; the **approved** surface treatments are recorded in §0 and in `htc-visual-system.md`.

---

## 0. Final approved visual direction (palette refinement)

Product/design reviewed desktop and mobile captures in `docs/qa/staff-light-canvas/stage2b/dashboard-palette-refine/` and **approved** the following.

### Today's Focus
- Eucalyptus section header retained.
- Critical overdue task rows use **ivory** working surfaces.
- Soft-rose left indicator distinguishes critical rows.
- Overdue label remains visible and restrained.
- **No** repeated full-blush task backgrounds.

### Luv
- Ivory working surface.
- Thin blush top accent.
- Blush heart remains the recognizable brand identifier.
- **No** full-blush card background.

### Coming Up
- Quiet linen surface.
- Visually distinct from Today's Focus without competing for attention.

### Business Snapshot
- Lead Flow retains eucalyptus header treatment.
- Booked Business uses pale botanical / green mist.
- Cash Collected uses a coordinated pale botanical shade.
- Outstanding uses ivory body + restrained blush header band when balance > 0.
- Outstanding at zero remains neutral white.

### Overall palette principles
- Botanical greens, blush/rose, and warm neutrals remain the approved families.
- Existing locked base colors remain unchanged.
- White remains an important working surface but is not the only working surface.
- Color variation creates hierarchy and warmth without unrelated accent families.
- **Rejected (Dashboard refinement):** champagne, pale sand, muted olive, and ad-hoc blue-gray / mist-blue accents outside the later-approved calm-blue family. **Authoritative palette (including calm blue):** `docs/design/htc-visual-system.md`. Dashboard closed treatments above do not use calm blue.

### What this approval does **not** cover
- Dark-mode visual QA (separate outstanding workstream).
- Live Sandbox verification of every data state (see §0.1).
- Overall HTC release approval.
- Production deployment authorization.

### 0.1 Verification qualifications (retained)

| Layer | Result |
|-------|--------|
| Implementation + focused tests | Hospitality / visual-system / Clients-Offerings / snapshot / contrast: **32/32 passed** |
| Desktop + mobile visual approval | **APPROVED** against `dashboard-palette-refine/` screenshots |
| Warning-only Focus (`needs_attention_today`) | **Fixture-verified**; live Sandbox state unavailable in the approval session |
| Outstanding = 0 | **Fixture-verified**; live Sandbox balance remained positive |
| Unrelated pre-existing failures (separately classified; not reopened) | Payments `scheduleStatus`; `getClientListFilterCounts` |

Do not claim a live state was verified when it was only fixture-verified.

---

## 1. Locked product and design decisions

### 1.1 Overall page

| Decision | Locked value |
|----------|--------------|
| Visual system | Approved HTC hospitality light mode |
| Page canvas | Warm `#F8F7F3` via established `.htc-hospitality-page` |
| Greeting | White hospitality heading card (`.htc-hospitality-heading`) |
| IA / business logic | Unchanged |

### 1.2 Today's Focus (approved refinement)

| Decision | Locked value |
|----------|--------------|
| Priority | Highest visual priority on the page |
| Section header | Eucalyptus `#DCE8E0` band |
| Critical rows | Ivory working surface + soft-rose **left indicator** + restrained severity/Overdue label |
| Noncritical rows | Neutral (no critical indicator) |
| Full-blush task backgrounds | **Forbidden** |
| Whole-card blush | **Forbidden** |

**Critical (do not conflate):**

- Overdue lead tasks
- Event Readiness `needsAttentionNow`

**`needs_attention_today` (ordinary today-work):**

- Overdue or due-today follow-ups
- Tours today

### 1.3 Coming up (approved refinement)

| Decision | Locked value |
|----------|--------------|
| Surface | Quiet linen |
| Content | Future events only, existing 30-day horizon |
| Priority | Secondary to Today's Focus |
| Data / hrefs | Preserve |

### 1.4 Luv (approved refinement)

| Decision | Locked value |
|----------|--------------|
| Surface | Ivory working surface + thin blush top accent |
| Typography | Dark charcoal |
| Identity | Clearly recognizable as Luv (keep 💗 + “Luv” title) |
| Semantics | Brand identity — **not** error / destructive |
| Full-blush card | **Forbidden** |
| Behavior / copy | Preserve |

### 1.5 Business Snapshot (approved refinement)

| Card | Locked treatment |
|------|------------------|
| Lead Flow | Eucalyptus **header/band** + white metric area; metrics/actions unchanged |
| Booked Business | Pale botanical / green mist |
| Cash Collected | Coordinated pale botanical |
| Outstanding > 0 | Ivory body + restrained blush header band |
| Outstanding = 0 | Neutral white (“Accounts current”) |
| Outstanding meaning | All still-owed booked balance = `gross booked − payments collected` (not overdue-only; not an error state) |
| Decorative color | Forbidden |

### 1.6 Reports

| Decision | Locked value |
|----------|--------------|
| Surface | Neutral white |
| Styling | Restrained secondary |
| Competition | Must not compete with Focus or Snapshot |

### 1.7 Palette

Locked bases + expanded shade families per `docs/design/htc-visual-system.md`. No rejected accent families. Dark text on light surfaces; white text only on botanical buttons; do not turn ordinary body/nav/labels green for branding.

---

## 2. Baseline evidence used

| Capture | Viewport | What it proves for this blueprint |
|---------|----------|-----------------------------------|
| `dashboard-desktop-01-top.png` | 1440 | Greeting floats (no heading card); Focus white twin-card; overdue labels; mint canvas |
| `dashboard-desktop-02-luv.png` | 1440 | Luv rose/destructive-adjacent card between Focus and Coming up |
| `dashboard-desktop-03-coming-up.png` | 1440 | Coming up visually equals Focus; events list |
| `dashboard-desktop-04-snapshot.png` | 1440 | Four equal white Snapshot cards in one row; green action links; Outstanding populated |
| `dashboard-desktop-05-reports.png` | 1440 | Full-width View Reports row |
| `dashboard-mobile-01-top.png` … `05-reports.png` | 390 | Stacked CTA; 1-col Snapshot; Focus row truncation; Luv/Coming up/Reports order |

**Evidence constraint:** `[data-workspace-main]` is an inner scroller. Playwright `fullPage` stays viewport-tall (`results.json`). This blueprint does **not** claim a true continuous full-page screenshot. Section captures `01`–`05` are the authoritative baseline set.

**Evidence gaps (non-blocking for blueprint; verify at implementation):**

1. No dedicated empty-state live shot for Focus, Coming up, or Outstanding = 0 (copy/structure taken from code).
2. No live shot isolating a `needs_attention_today` (warning) Focus row without “Overdue” — Sandbox baseline Focus was dominated by critical/overdue rows; classification is code-proven in `decision-engine.ts`.
3. No true stitched full-page image (scroller limitation above).

---

## 3. Final structural wireframes

Map 1:1 to existing page sections in `app/(app)/dashboard/page.tsx`.

### 3.1 Desktop (~1440)

```
┌ Sidebar white ─┐┌── .htc-hospitality-page canvas #F8F7F3 ─────────────────────┐
│ (unchanged)    ││                                                              │
│                ││ ┌ .htc-hospitality-heading (white) ────────────────────────┐ │
│                ││ │ Greeting (serif) · date/venue (muted)                    │ │
│                ││ │                              [Botanical + New Lead CTA]  │ │
│                ││ └──────────────────────────────────────────────────────────┘ │
│                ││                                                              │
│                ││ ┌ Today's Focus ── HIGHEST WEIGHT ─────────────────────────┐ │
│                ││ │ ▓▓▓ eucalyptus #DCE8E0 header band ▓▓▓                   │ │
│                ││ │ │ icon · title · “N of M” │ description                  │ │
│                ││ │ ├──────────────────────────────────────────────────────┤ │ │
│                ││ │ │ WHITE body                                           │ │ │
│                ││ │ │ critical row: blush wash + severity label + dismiss  │ │ │
│                ││ │ │ warning/neutral row: white + label + dismiss         │ │ │
│                ││ └──────────────────────────────────────────────────────────┘ │
│                ││                                                              │
│                ││ ┌ Luv ── blush #F7E9EB brand card ─────────────────────────┐ │
│                ││ │ 💗 Luv                              [dismiss if allowed] │ │
│                ││ │ message · suggestion · charcoal action link              │ │
│                ││ └──────────────────────────────────────────────────────────┘ │
│                ││                                                              │
│                ││ ┌ Coming up ── quiet white (SECONDARY to Focus) ───────────┐ │
│                ││ │ muted icon · title · description                         │ │
│                ││ │ event rows · date meta · no dismiss · no eucalyptus hdr  │ │
│                ││ └──────────────────────────────────────────────────────────┘ │
│                ││                                                              │
│                ││ Business Snapshot (section label charcoal)                   │
│                ││ ┌ Lead Flow ──┐┌ Booked ──┐┌ Cash ────┐┌ Outstanding ────┐ │
│                ││ │ eucalyptus  ││ white    ││ white    ││ blush iff > 0   │ │
│                ││ │ header band ││          ││          ││ else white      │ │
│                ││ │ white body  ││          ││          ││                 │ │
│                ││ └─────────────┘└──────────┘└──────────┘└─────────────────┘ │
│                ││                                                              │
│                ││ ┌ View Reports ── quiet white secondary row ───────────────┐ │
│                ││ └──────────────────────────────────────────────────────────┘ │
└────────────────┴──────────────────────────────────────────────────────────────┘
```

Relative visual weight (desktop): **Focus ≫ Luv ≈ Snapshot accents > Coming up > Reports**.

### 3.2 Mobile (~390)

```
┌ Shell top bar (unchanged) ─────────────────────┐
│ .htc-hospitality-page #F8F7F3                  │
│                                                │
│ ┌ heading card white ────────────────────────┐ │
│ │ Greeting (serif)                           │ │
│ │ date · venue (muted)                       │ │
│ │ [======= + New Lead full width =======]    │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌ Today's Focus ─────────────────────────────┐ │
│ │ eucalyptus header band                     │ │
│ │ white body · rows stack                    │ │
│ │ title truncates; meta wraps under label    │ │
│ │ dismiss X remains tappable (≥44px target)  │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌ Luv blush ─────────────────────────────────┐ │
│ │ full width · CTA link below copy           │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ ┌ Coming up white ───────────────────────────┐ │
│ │ scannable event list · date on right       │ │
│ └────────────────────────────────────────────┘ │
│                                                │
│ Business Snapshot                              │
│ ┌ Lead Flow (eucalyptus band) ─────────────┐ │
│ └──────────────────────────────────────────┘ │
│ ┌ Booked white ────────────────────────────┐ │
│ └──────────────────────────────────────────┘ │
│ ┌ Cash white ──────────────────────────────┐ │
│ └──────────────────────────────────────────┘ │
│ ┌ Outstanding (blush if >0) ───────────────┐ │
│ └──────────────────────────────────────────┘ │
│                                                │
│ ┌ View Reports white row ──────────────────┐ │
│ └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

**Mobile stacking order (exact):**

1. Heading card (Greeting → full-width + New Lead)  
2. Today's Focus  
3. Luv (if present)  
4. Coming up  
5. Business Snapshot (1 column below `sm`; see §8)  
6. View Reports  

Do not scale desktop chrome down; tighten stack and keep full-width primary CTA.

---

## 4. Component-level design blueprint

Each subsection names the **actual** source file. Propose refinements on existing components; flag any new helper as optional and justified.

### 4.0 Page shell

| Field | Spec |
|-------|------|
| Component | `DashboardPage` (default export) |
| File | `app/(app)/dashboard/page.tsx` |
| Reuse | Same composition pattern as Clients: wrapper `htc-hospitality-page space-y-4 sm:space-y-6` (replace current `space-y-8`) |
| Surface | Canvas `#F8F7F3` |
| Typography | Inherited; no page-level green text |
| Border / radius / elevation | Via child hospitality utilities |
| Desktop | Single column inside existing workspace `max-w-6xl` padding |
| Mobile | Same stack; reduced vertical gap |
| States | Unavailable: keep centered “Dashboard unavailable.” Prefer still wrapping warm canvas if the outer return mounts the hospitality wrapper; do not change copy |
| Actions | None at page root beyond children |
| Must preserve | Section order; data fetching; forensic wrappers; slice limits (Focus/Coming up 10) |

---

### 4.1 Milestone toast

| Field | Spec |
|-------|------|
| Component | `MilestoneToast` |
| File | `components/dashboard/milestone-toast.tsx` |
| Treatment | No hospitality redesign required in this pass; ensure it sits above the heading card on warm canvas without mint clash |
| States | Conditional render (existing) |

---

### 4.2 Greeting + primary CTA (heading card)

| Field | Spec |
|-------|------|
| Components | `Greeting` + `Button` + `Link` |
| Files | `components/dashboard/greeting.tsx`; `components/ui/button.tsx`; page composition in `page.tsx` |
| Reuse | Wrap existing flex row in `.htc-hospitality-heading` (same utility Clients use) — **do not fork Greeting** |
| Surface | White `#FFFFFF` heading card |
| Border | `1px` warm `#E6E3DC` (utility) |
| Radius | `0.75rem` (utility) |
| Elevation | Soft dual shadow from `.htc-hospitality-heading` |
| Padding | Utility defaults (~0.9–1rem mobile; ~1.15–1.35rem `sm+`) |
| Typography | Serif h1 `font-heading text-3xl font-medium tracking-tight text-heading` (existing Greeting); date line muted sans `text-[0.95rem] text-muted-foreground` |
| Actions | Botanical primary `Button` “+ New Lead” → `/leads/new`; white label on `#446B56` |
| Desktop | Inside heading card: `flex-row items-end justify-between`; CTA right, `shrink-0` |
| Mobile | `flex-col gap-3`; CTA **full width** under greeting |
| States | Greeting date/salutation client-hydrated (existing); no empty greeting state |
| Must preserve | Copy pattern “Good …, {name}.” / venue line |

---

### 4.3 Luv intro (onboarding)

| Field | Spec |
|-------|------|
| Component | `DashboardLuvIntro` |
| File | `components/dashboard/luv-intro.tsx` |
| Treatment | Keep behavior; if it already uses a card, ensure it does not reintroduce rose/destructive. Prefer blush or white elevated only if current styling conflicts with warm canvas — **no copy/logic change**. If current intro is already acceptable on light hospitality pages, leave structure; only neutralize destructive tints if present |
| Placement | After heading card, before Today's Focus (existing) |

---

### 4.4 Today's Focus

| Field | Spec |
|-------|------|
| Components | `AttentionList` → `DashboardCardShell`; rows via `FocusAttentionRow` |
| Files | `components/dashboard-system/attention-list.tsx`; `dashboard-card-shell.tsx`; `focus-attention-row.tsx`; invoked from `page.tsx` |
| Reuse / refine | **Refine** `DashboardCardShell` (and pass-through from `AttentionList`) with a tone/header-band API — e.g. `headerBand="eucalyptus"` — rather than forking a second list component |
| Card surface | White body |
| Header surface | Eucalyptus `#DCE8E0` band spanning CardHeader (title row + description). Stronger bottom edge optional: mix eucalyptus accent into warm border (match Clients table header edge language) |
| Border | Warm `#E6E3DC` on outer card; prefer hospitality elevated treatment |
| Radius | Prefer `0.75rem` hospitality radius on this card for parity with heading (refine Card className / shell; avoid inventing a third radius token) |
| Elevation | Soft dual shadow (hospitality elevated / staff card shadow) |
| Typography | Title: sans `text-base` charcoal with icon; description: muted; overflow `N of M`: `text-xs text-muted-foreground` |
| Icon | Keep `CalendarClock`; `text-primary` on **icon only** is allowed (accent, not body copy) |
| Actions | Row navigates via existing `item.href`; dismiss X via `dismissDashboardAttentionAction` (unchanged) |
| Critical row | `priority === "critical"` (or `rightSeverity === "critical"`): background wash `#F7E9EB`; keep explicit severity label (`Overdue` or readiness label) using existing destructive/warning text color for the **label word only** |
| Warning / ordinary row | `needs_attention_today`: **no** blush wash; keep warning label styling (`Follow up` / `Today`) |
| Default dated-today | Neutral white row; muted right label if any |
| Desktop | Full content width; divider list; highest visual weight on page |
| Mobile | Same; title/detail `truncate` as today; ensure dismiss control remains reachable (existing absolute right control — verify no overflow clip). Label may sit under title if needed; **no horizontal page overflow** |
| Loading | No dedicated skeleton today — out of scope unless route loading already exists |
| Empty | Keep copy: “Nothing urgent today — you're all caught up.” Eucalyptus header band **still shown** so section identity remains |
| Populated | Up to 10 items; headerRight overflow counter when truncated |
| Error | Dismiss failure: leave row visible (existing) |

**Classification mapping (engine — do not change):**

| Engine priority | Sources | Row chrome |
|-----------------|---------|------------|
| `critical` | Overdue `lead_tasks`; `briefing.needsAttentionNow` | Blush wash + severity label |
| `needs_attention_today` | Follow-ups overdue/today; tours today | Neutral row + warning label |
| today-dated folded into Focus | From `classifyBriefingItems` | Neutral unless severity set |

---

### 4.5 Luv entry card

| Field | Spec |
|-------|------|
| Component | `DashboardLuvEntryCard` |
| File | `components/dashboard/luv-dashboard-entry.tsx` |
| Reuse | Same component; **visual-only** restyle |
| Surface | Soft blush `#F7E9EB` (`bg-[var(--htc-soft-blush)]` / `--panel-blush` / equivalent existing token — **no new hex**) |
| Border | Warm `#E6E3DC` — **remove** `border-rose-200/40` and destructive `color-mix` inline style |
| Radius / elevation | Match hospitality elevated white cards (`0.75rem`, soft shadow) so Luv feels intentional, not an alert banner |
| Typography | Title: keep `💗` + “Luv”, `text-sm` charcoal; message: `text-sm text-foreground`; suggestion: `text-sm text-muted-foreground` |
| Actions | Existing action `Link` + chevron; change from `text-primary` to charcoal / muted medium weight (no green body link). Dismiss X unchanged behavior |
| Desktop | Full width between Focus and Coming up |
| Mobile | Full width; CTA below copy (existing stack); dismiss top-right |
| Empty | Not rendered when no entry |
| Error | Persist dismiss failure: keep card (existing) |

---

### 4.6 Coming up

| Field | Spec |
|-------|------|
| Components | `AttentionList` + page-local `ClassifiedRow` |
| Files | `attention-list.tsx`; `dashboard-card-shell.tsx`; `ClassifiedRow` in `page.tsx` |
| Reuse / refine | Same list primitive as Focus with **plain** shell (`headerBand` none / tone white) |
| Surface | Quiet white entire card — **no** eucalyptus header |
| Border / radius / elevation | Warm border; hospitality elevated; quieter than Focus (no colored header is the primary quieter signal) |
| Typography | Title `text-base` charcoal; description muted; icon **muted** (`text-muted-foreground`) — keep existing difference from Focus icon |
| Actions | Row `Link` to event href; dates as muted/severity right labels; **no** dismiss |
| Desktop | Below Luv; secondary density — same row padding as today is fine |
| Mobile | Keep date on the right when space allows; if narrow, allow label truncate; list must remain vertically scannable (one event per row) |
| Empty | “Nothing on the horizon yet.” |
| Populated | Events only, ≤10, existing horizon |
| Must preserve | `classifyUpcomingItems` + cross-section exclusion |

---

### 4.7 Business Snapshot section

| Field | Spec |
|-------|------|
| Components | `BusinessSnapshotSection`, private `SnapshotCard`, `ComparisonCardGrid` |
| Files | `components/dashboard/business-snapshot.tsx`; `components/dashboard-system/comparison-card.tsx`; models from `lib/dashboard/business-snapshot.ts` |
| Reuse | Keep section + grid + equal-height contract; refine `SnapshotCard` surface by `card.key` / `card.empty` |
| Section title | `h2 text-sm font-semibold text-heading`; description `text-xs text-muted-foreground` — charcoal, not green |
| Grid | Existing: `grid-cols-1` → `sm:grid-cols-2` → `lg:grid-cols-4`, `gap-3`, `auto-rows-fr` |
| Equal geometry | Keep `min-h-[11.5rem]` and reserved secondary/tertiary/action slots |
| Action links | Replace `text-primary` with charcoal/muted `font-medium` + chevron (no ordinary green body text) |
| Hover | Subtle wash that respects tinted surfaces (do not bleach blush/eucalyptus into generic muted gray incorrectly — prefer slight darken/warm hover or existing muted at low opacity) |

#### 4.7.1 Lead Flow (`key: "lead_flow"`)

| Field | Spec |
|-------|------|
| Header/band | Eucalyptus `#DCE8E0` top band containing the small label “Lead Flow” (or band behind label row) |
| Metric area | White remainder for primary / secondary / tertiary / action |
| Not | Full-card eucalyptus fill (locked: header/band + white metric area) |
| Data / href / actionLabel | Unchanged (`View open leads`, etc.) |

#### 4.7.2 Booked Business (`key: "booked_business"`)

| Field | Spec |
|-------|------|
| Surface | Neutral white entire card |
| Rationale | Booked state is positive/neutral; no attention semantics requiring blush; no structural grouping requiring eucalyptus beyond Lead Flow |

#### 4.7.3 Cash Collected (`key: "cash_collected"`)

| Field | Spec |
|-------|------|
| Surface | Neutral white entire card |
| Rationale | Money received is informational; color would be decorative |

#### 4.7.4 Outstanding (`key: "outstanding"`)

| Field | Spec |
|-------|------|
| Surface when `!card.empty` (balance > 0) | Soft blush `#F7E9EB` on card (full soft wash acceptable — communicates “still owed,” not overdue error) |
| Surface when `card.empty` | White; primary “Accounts current” muted treatment already in model |
| Semantics | Still-owed booked balance only; **not** overdue filter; **not** destructive styling |
| Data / href / actionLabel | Unchanged (`View balances` → `/payments`) |

#### Snapshot states

| State | Behavior |
|-------|----------|
| Section null | `getBusinessSnapshot()` null → section omitted (existing) |
| Card empty | Existing empty strings; Outstanding empty → white |
| Populated | Four cards always when section renders |
| Loading | No section-level skeleton today |

---

### 4.8 View Reports

| Field | Spec |
|-------|------|
| Component | Inline `Link` in `page.tsx` (not a shared named export today) |
| File | `app/(app)/dashboard/page.tsx` |
| Reuse | Keep inline link; optionally apply `.htc-hospitality-elevated` or equivalent white quiet row classes |
| Surface | Neutral white |
| Border / radius | Warm border; `rounded-xl` may become `0.75rem` for hospitality consistency |
| Typography | `text-sm font-medium text-foreground`; chevron muted |
| Hover | Subtle muted wash (existing pattern) |
| Placement | Last section |
| Desktop / mobile | Full content width; secondary visual weight — thinner presence than Focus (no colored header, no large type) |
| Must not | Botanical fill, blush, or eucalyptus band |

---

### 4.9 Shared primitives (refinement contracts)

#### `DashboardCardShell` — `components/dashboard-system/dashboard-card-shell.tsx`

**Proposed refinement (not a new parallel list):**

- Add optional `headerBand?: "eucalyptus" | "none"` (or `tone`) and/or `className` / `headerClassName` sufficient to:
  - Paint CardHeader background `#DCE8E0` for Focus
  - Leave Coming up plain white
- Keep Card > Header > Content structure and empty-state swap

#### `AttentionList` — `components/dashboard-system/attention-list.tsx`

- Pass shell tone/headerBand through from page call sites
- Focus call site: eucalyptus band  
- Coming up call site: none  

#### `FocusAttentionRow` — `components/dashboard-system/focus-attention-row.tsx`

- When severity critical: apply blush row wash class
- Do not apply wash for warning
- Preserve dismiss + link behavior
- **Proposed:** no new component; refine this file

#### `ComparisonCardGrid` — `components/dashboard-system/comparison-card.tsx`

- **Do not change breakpoints** unless mobile QA proves overflow; locked grid is already correct for this blueprint

#### Optional new reusable helper (only if needed)

| Proposal | Rationale | Prefer first |
|----------|-----------|--------------|
| CSS utility e.g. `.htc-dashboard-card-header-eucalyptus` under `.htc-staff` | Shared eucalyptus header band for Focus + Snapshot Lead Flow without duplicating hex | Extend shell/Snapshot with token classes (`bg-[var(--htc-eucalyptus-surface)]`) before adding utilities |
| New `DashboardHospitalityCard` | **Not preferred** — duplicates `DashboardCardShell` / Card | Refine shell |

Do **not** invent new Dashboard metrics, sections, or Luv product surfaces.

---

## 5. Design system consistency (vs Clients / Offerings)

Reference: `docs/design/htc-visual-system.md`.

### 5.1 Shared across hospitality pages

- Warm canvas `.htc-hospitality-page` `#F8F7F3`
- White heading card `.htc-hospitality-heading`
- Botanical primary buttons + white label
- Eucalyptus `#DCE8E0` for structural / supporting chrome
- Soft blush `#F7E9EB` only for meaningful attention or guidance / brand (Luv)
- Dark charcoal typography; muted secondary
- Warm borders `#E6E3DC`; restrained elevation; `0.75rem` hospitality radii
- No ordinary green body copy on light surfaces
- White sidebar / shell language unchanged

### 5.2 Intentionally different on Dashboard

| Clients / Offerings | Dashboard |
|---------------------|-----------|
| Table / catalog density; mostly white operational surfaces | Briefing command center with **coordinated multi-tone cards** |
| Eucalyptus on table headers / parent majors with children | Eucalyptus on Focus **section header** and Lead Flow **card band** |
| Blush rows gated to Needs Attention client records | Blush on **critical Focus rows**, **Luv brand card**, **Outstanding > 0** |
| One primary heading + tools + table/catalog | Multiple peer briefing modules with explicit weight order |

### 5.3 Why Dashboard may use more varied card surfaces

Visual system §2 already allows: Dashboard “may use a richer set of coordinated card tones … still within this palette.” Operational pages stay restrained so tables remain scannable; the Dashboard’s job is **prioritized daily awareness**, so surface variety encodes **job type** (act now / partner note / plan ahead / money health / exit).

### 5.4 Color = operational meaning (not decoration)

| Color | Meaning on Dashboard |
|-------|----------------------|
| Eucalyptus header | Structural “this module matters / grouping” — Focus section; Lead Flow band |
| Blush row | Genuine critical attention inside Focus |
| Blush card (Luv) | Brand identity of the venue owner’s intelligent partner |
| Blush Outstanding | Money still to collect (balance > 0) |
| White | Default operational / quiet awareness / neutral money / Reports |
| Botanical fill | Primary CTA only (+ New Lead) |

---

## 6. Implementation mapping (proposed — do not execute yet)

### 6.1 Files likely to change (when authorized)

| File | Change type |
|------|-------------|
| `app/(app)/dashboard/page.tsx` | Hospitality wrapper; heading card; spacing; pass Focus/Coming up shell tones; Reports quiet styling |
| `components/dashboard-system/dashboard-card-shell.tsx` | Eucalyptus header band support |
| `components/dashboard-system/attention-list.tsx` | Pass-through props |
| `components/dashboard-system/focus-attention-row.tsx` | Critical blush row wash |
| `components/dashboard/luv-dashboard-entry.tsx` | Soft blush; remove rose/destructive; charcoal action link |
| `components/dashboard/business-snapshot.tsx` | Lead Flow band; Outstanding conditional blush; white others; charcoal actions |
| `app/globals.css` | **Only if** a small `.htc-staff` hospitality helper is required for shared eucalyptus header bands — **no token hex edits** |
| `components/dashboard/luv-intro.tsx` | Only if destructive/rose styling is present and conflicts |

### 6.2 Shared components to reuse

- `.htc-hospitality-page`, `.htc-hospitality-heading`, `.htc-hospitality-elevated`
- `AttentionList`, `DashboardCardShell`, `FocusAttentionRow`
- `ComparisonCardGrid`, `BusinessSnapshotSection` / `SnapshotCard`
- `Greeting`, `Button`, `Card` primitives
- `MilestoneToast`, `DashboardLuvIntro`

### 6.3 Tokens / utilities to use (existing)

- `--htc-canvas`, `--htc-eucalyptus-surface`, `--htc-soft-blush` / `--panel-blush`, `--htc-border-warm`, `--htc-botanical` / `--primary`, `--heading`, `--muted-foreground`, `--card`
- Do **not** change token values
- Do **not** introduce parallel theme

### 6.4 Proposed new reusable piece (optional)

- Prefer prop/class refinements on `DashboardCardShell` + `SnapshotCard`
- Optional shared CSS utility for eucalyptus header band **only if** duplication across Focus + Lead Flow is messy — document in PR if added

### 6.5 Must not change

| Area | Reason |
|------|--------|
| `lib/dashboard-system/decision-engine.ts` classification rules | Locked semantics |
| `lib/dashboard/business-snapshot.ts` metric math / card models (except pure presentational flags already present like `empty`) | Outstanding definition locked |
| `lib/metrics/revenue.ts` RPCs | No data changes |
| Dismissal APIs / actions | Behavior preserve |
| `selectLuvDashboardEntry` / observation enablement | Behavior preserve |
| Shell sidebar / `workspace-shell.tsx` layout | Out of scope |
| Dark-mode remap blocks | No dark implementation in this pass |
| Production / DB / migrations | Forbidden |
| Unrelated Clients/Offerings catalog rules | Do not regress |

Altering `card.empty` semantics or inventing an “overdue outstanding” field is **out of scope**.

### 6.6 Tests — update or add (when authorized)

| Test | Expectation |
|------|-------------|
| `lib/dashboard-system/dashboard-page.test.ts` | Keep IA assertions; extend to assert hospitality wrapper / heading class strings if page markup gains them |
| `lib/dashboard/business-snapshot.test.ts` | Keep model/IA; add UI source assertions for Outstanding blush gated on `empty`, Lead Flow band, no `text-primary` action if that becomes the rule |
| `lib/dashboard-system/attention-dismiss.test.ts` / follow-up contrast tests | Must still pass; critical wash must not break warning-foreground usage |
| `lib/theme/htc-visual-system.test.ts` / clients-offerings hospitality tests | Unchanged unless new shared utility is added — then assert utility exists **without** changing palette hex |
| **New** `lib/theme/dashboard-hospitality.test.ts` (proposed) | Source-level lock: page uses `htc-hospitality-page` + heading; Luv has soft blush not rose/destructive mix; Focus shell band; Snapshot key treatments |
| Browser / Playwright capture (proposed) | Mirror baseline paths under `docs/qa/staff-light-canvas/.../dashboard-hospitality/` with `01-top`…`05-reports` desktop+mobile; assert computed RGB for canvas, Focus header, Luv, Outstanding |

Do not weaken existing IA tests to pass visuals.

### 6.7 Browser verification plan (when authorized)

1. Sandbox, Jen's Fancy Venue (or documented staff venue), light theme.  
2. Capture section shots `01`–`05` at 1440 and 390 (same scroller-aware method as baseline — do not claim unbroken fullPage).  
3. Verify computed styles:  
   - `[data-workspace-main]` content canvas / hospitality page `#F8F7F3`  
   - Focus header `#DCE8E0`  
   - Critical Focus row background `#F7E9EB`  
   - Warning Focus row **not** blush  
   - Luv background `#F7E9EB`, no destructive mix  
   - Outstanding > 0 blush; force or find empty Outstanding → white  
   - Snapshot action links not green body text  
4. Interaction: dismiss Focus item; open Luv action; open each Snapshot card href; View Reports.  
5. Confirm no horizontal overflow at 390; CTA full width in heading card.  
6. Dark mode: **smoke only / do not claim visual QA complete** (system doc outstanding).  

---

## 7. Responsive behavior and breakpoints

| Breakpoint | Behavior |
|------------|----------|
| Default (&lt;640px) | Heading stacks; CTA full width; Snapshot **1 column**; Focus/Coming up/Luv/Reports full width; page `space-y-4` |
| `sm` (≥640px) | Heading row: greeting + CTA side-by-side; Snapshot **2×2**; `space-y-6` |
| `lg` (≥1024px) | Snapshot **4-up**; shell sidebar visible (unchanged) |
| Desktop target | ~1440 verification |
| Mobile target | ~390 verification |

**Focus rows on mobile:** keep single-row layout with truncate; severity label and dismiss stay in the row; if collision, prefer truncating title before dropping dismiss. No horizontal page scroll.

**Coming up:** one event per row; date right-aligned meta; scannable vertical list.

**Luv:** full-width ivory card with thin blush accent; action link block under copy; no competing primary botanical button on Luv.

**Reports:** full-width quiet white row at end.

---

## 8. Remaining qualifications (not blockers for light-mode visual closure)

1. Warning-only Focus: fixture-verified; live Sandbox instance not present in approval session.  
2. Outstanding = 0: fixture-verified; live Sandbox balance remained positive.  
3. No continuous full-page PNG due to inner workspace scroller — section captures `01`–`05` are the approval evidence.  
4. Dark-mode visual QA remains **outstanding** (separate workstream).  
5. Unrelated pre-existing test failures remain separately classified: Payments `scheduleStatus`; `getClientListFilterCounts`.

---

## 9. Workstream closure

**Dashboard Light-Mode Palette Refinement: GREEN / VISUALLY APPROVED / CLOSED**

Visual approval applies to the current light-mode implementation and the approved treatments in §0.

It does **not** mean dark-mode QA is complete, all data states were live-verified, the overall HTC release is approved, or Production deployment is authorized.

Do not begin dark-mode QA or another design workstream without a separate instruction.

---

## 10. Explicit non-goals (closure documentation task)

- No application code or CSS changes  
- No token or color value changes  
- No business logic or data changes  
- No database changes or migrations  
- No dark-mode implementation changes  
- No Clients / Offerings changes  
- No commit, push, or deployment  
- Production untouched
