# Phase 11 — Cohesive Workspace Redesign  
## Discovery & Design Specification (READ-ONLY)

**Date:** 2026-11-03  
**Mode:** Documentation + screenshots only — **no implementation**  
**Local source:** dirty `feat/spaces-booking-e1-smart-fields` @ `69cacab8` (includes Phase 10)  
**Sandbox serving:** Phases 1–9 @ `1b7eca0d` (Phase 10 **not** deployed)  
**Release worktree:** `/Users/jensmac/Developer/htc-visual-p1-9-release` left untouched  

**Verdict:** `DESIGN PROPOSAL READY — AWAITING PRODUCT APPROVAL`

---

## A. Executive assessment

Phases 1–10 successfully introduced hospitality **tokens** and **component-level** surfaces (calm guidance, eucalyptus intros, linen filters, Dashboard snapshot color). Reviewing six operational workspaces shows the remaining gap is **page composition**: many screens still read as white SaaS administration — identical white cards, weak section framing, gray status chrome, and little intentional rhythm between introduction → controls → work content.

**Goal of Phase 11:** apply the *locked* palette as a coherent page language so Calendar, Reports, Tours, Requests, Automations, and Setup Hub feel like one premium hospitality product — warm, readable, hierarchical — without inventing new colors or changing business logic.

**Addendum — record interaction:** Clients, Leads, and Contracts (plus Vendors, Payments, Events, Requests, Tours, Documents, Invoices) currently disagree on how a record name looks and behaves on hover. Phase 11 also defines one **charcoal record-name + underline-on-hover** interaction language so navigation feels as cohesive as the surfaces. Full matrix: [`RECORD-LIST-INTERACTION.md`](./RECORD-LIST-INTERACTION.md).

**Reference of success already in product:**  
1. Dashboard Business Snapshot (`components/dashboard/business-snapshot.tsx`) — category-meaningful surface washes with charcoal text and equal geometry. Reports KPI cards should follow that *role model*.  
2. Clients list record name — charcoal link with `hover:underline` (not botanical text hover). Other lists should follow that *interaction* role model.

---

## B. Six workspace reviews

### 1. Calendar (highest priority)

**Current-state assessment**  
- Works: warm canvas workspace; botanical primary “Add Schedule Item”; Month view switcher botanical selected; today eucalyptus cell + botanical day numeral; taxonomy dots preserved; linen filter chips exist in CSS.  
- Weak: large pale grid; white schedule sidebar with muted empty state; legend/filter strip reads as thin SaaS chrome; controls and content lack a strong hospitality “frame.”  
- Must not touch: `--cal-*` taxonomy; scheduling/availability/filter/booking logic; print routes.

**Proposed design**  
1. Keep white heading card; optionally wrap the **control stack** (view switcher + month nav + legend + taxonomy filters) in a **linen filter shell** (reuse `.htc-hospitality-filter` pattern from Phase 10 Reports).  
2. Month grid: keep white working cells; strengthen weekday header with eucalyptus band; keep today/selected eucalyptus treatments (already present — refine density only).  
3. Schedule panel: elevate to white elevated card with eucalyptus **section header** (“Schedule · Mon Nov 2”); empty state uses calm-blue tip (informational), not gray wash.  
4. When items exist: list rows white with taxonomy-colored left indicators (existing `--cal-*`), not botanical recolor of event types.  
5. Mobile: stack schedule below grid; same control shell; preserve list-first density.

**Color map**  
| Element | Color | Why |
|---|---|---|
| Page | Warm canvas | Workspace frame |
| Heading | White | Title + primary actions |
| Control shell | Linen | Filters/controls ≠ content |
| View selected | Botanical + white text | Selected control |
| Today / selected day | Eucalyptus surface | Hospitality selection (not taxonomy) |
| Grid body | White | Operational calendar |
| Schedule header | Eucalyptus band | Sibling to Tours section headers |
| Empty tip | Calm blue | Guidance only |
| Event dots/rows | Protected taxonomy | Meaning preserved |

**Before → after**  
Before: white heading + scattered controls + pale grid + gray empty schedule.  
After: linen control band → eucalyptus weekday/schedule headers → white grid/list → taxonomy color only on events.

**Risks**  
Over-tinting grid cells could fight taxonomy dots — keep cells white. Do not put botanical fills on event chips.

**Footprint**  
`components/calendar/calendar-page-client.tsx`, `calendar-view.tsx`, `calendar-shared.tsx`, `day-view.tsx`, `week-view.tsx`, `agenda-view.tsx`; CSS `.htc-calendar-*` in `app/globals.css`.

---

### 2. Reports (highest priority) — preserve Phase 10 chrome

**Current-state assessment**  
- Works (Phase 10 local): accented eucalyptus intro, linen date toolbar, mobile tab edges; Overview structure clear.  
- Weak: “How the business moved” and cohort tiles + `ComparisonCard` grid are **identical white cards** — Dashboard Snapshot already solved category color without implying P&L goodness.  
- Must not touch: metric math, polarity/accessible comparison copy, date presets, Phase 10 intro/filter/tabs.

**Proposed design — KPI color-distribution system**  
Apply **category surfaces** (not “up = green”):

| Category | Metrics | Surface treatment |
|---|---|---|
| Sales / demand | Leads, Tours | Eucalyptus header band + white body *(Lead Flow model)* |
| Bookings | Bookings, Leads who booked, funnel tour→book rates | Green mist or botanical-pale wash *(Booked Business model)* |
| Money in | Contracted, Collected | Botanical-pale / soft-sage wash *(Cash Collected model)* |
| Money owed | Outstanding | Ivory + soft-blush **header band only when balance > 0**; white when 0 *(Outstanding model)* |
| Neutral clocks | Funnel stage tiles that are definitional | Linen quiet tile **or** white with eucalyptus top rule — never success green |

Rules:  
- Decorative card color ≠ polarity. Comparison arrows keep existing `success`/`destructive` text classes from `polarity`.  
- Equal card geometry retained (`ComparisonCardGrid`).  
- Funnel strip tiles get the same category mapping as Overview cards for coherence across Overview / Sales / Bookings / Revenue.

**Before → after**  
Before: Phase 10 header beauty + white KPI wall.  
After: same Phase 10 chrome + Snapshot-like KPI family.

**Risks**  
Misreading blush Outstanding as “bad decoration” — keep blush only as attention header when owed > 0; document in UI copy already present. Do not color Contracted green solely because money is “good.”

**Footprint**  
`app/(app)/reporting/page.tsx` (+ sales/bookings/revenue/events pages using ComparisonCard); `components/dashboard-system/comparison-card.tsx` (optional `tone` prop); `components/reporting/business-funnel.tsx`; reuse Snapshot tokens; **do not** regress `reports-layout-shell.tsx` / `date-range-control.tsx` / `report-tabs.tsx`.

---

### 3. Tours

**Current-state assessment**  
- Works (local dirty hospitality): canvas page, white heading, eucalyptus “Upcoming” section header, botanical primary actions, status badge variants in CSS.  
- Weak: long white list body still feels like one undifferentiated slab; date chips muted; Past/Cancelled headers exist but hierarchy between name / time / meta is flat; mobile action stacking competes.  
- Must not touch: status/outcome/follow-up/booking/scheduling logic; protection follow-up semantics.

**Proposed design**  
1. Promote page intro to **plain eucalyptus intro** (Phase 8 style — **no** Phase 10 accent required) containing title + Booking Settings.  
2. Keep section bands (upcoming eucalyptus; past linen; cancelled soft-blush-pale or oatmeal — **status meaning via badges**, not whole-section alarm).  
3. Date block: eucalyptus-tinted date well (dark charcoal numerals) — not taxonomy blue.  
4. Row: white body; clearer type scale — name heading, time secondary, meta muted; badges use existing `.htc-tours-status-badge*` tokens with contrast audit.  
5. Primary actions remain botanical; secondary outline on warm border.

**Color map**  
Intro eucalyptus; upcoming header eucalyptus; past header linen; row white; date well eucalyptus/pale; badges semantic per existing CSS; actions botanical.

**Before → after**  
Before: white heading + one green band + endless white rows.  
After: eucalyptus intro + distinct section shells + richer date/name hierarchy inside white rows.

**Risks**  
Do not recolor Tour appointments with calendar Tour blue in list chrome (taxonomy is for calendar items). Keep list scannable — no card-per-tour.

**Footprint**  
`app/(app)/tours/page.tsx`, `components/tours/tour-list.tsx`, CSS `.htc-tours-*` (already substantial in dirty `globals.css`).

---

### 4. Requests

**Current-state assessment**  
- Works: clear create + list IA; white form fields readable.  
- Weak: **no hospitality page frame**; white form panel ≈ white table; gray native selects; disabled Create looks dead gray; zero eucalyptus/linen; stark SaaS.  
- Must not touch: create/assign/status/due/permissions.

**Proposed design**  
1. Wrap page in `.htc-hospitality-page`.  
2. Eucalyptus intro (plain) for title + description.  
3. “New Request” in white elevated card with eucalyptus mini section label “Create”; primary Create button botanical (enabled) / muted outline when invalid — not anonymous gray.  
4. List section: linen toolbar for filters; white `.htc-hospitality-table` (or table wrapper) with eucalyptus header row; status via Badge (draft muted, submitted calm/info, completed success eucalyptus-accessible).  
5. Mobile: stack create above list; full-width filters.

**Color map**  
Canvas page; eucalyptus intro; white form; linen filter bar; eucalyptus table header; white rows; botanical CTA.

**Before → after**  
Before: floating white form + white table on canvas.  
After: hospitality page with intro → create card → linen filters → hospitality table.

**Risks**  
Native `<select>`/`<button>` restyle must keep a11y; don’t break RequestClientPicker.

**Footprint**  
`app/(app)/requests/page.tsx`, `components/requests/request-manager.tsx` (+ detail later out of scope unless shared).

---

### 5. Automations

**Current-state assessment**  
- Works: calm-blue “How automations work” (keep); botanical New Automation; Sales/Client grouping.  
- Weak: white LibraryAssetCards; **Active/Paused badges render as gray** (`Badge variant="success"` → `bg-success/15` reads washed); section titles plain text; weak card hierarchy.  
- Must not touch: triggers, enrollment, delivery, pause/resume logic — only presentation of real status.

**Proposed design**  
1. Optional plain eucalyptus page intro for title + New Automation (keep help below as calm blue — do not recolor help).  
2. Section labels: `.htc-hospitality-section-label` / setup-stage twin for Sales / Client / Manual.  
3. Status badges (accessible):  
   - Active → eucalyptus surface + botanical text/border (or solid botanical + white if contrast requires) — **only when `status==="active"`**  
   - Paused → linen / muted oatmeal + charcoal  
   - Error (if any) → existing destructive  
4. Cards: white elevated; left botanical hairline only when Active; title stronger; trigger meta muted; participant count secondary.  
5. Mobile: same; preserve overflow menus.

**Before → after**  
Before: blue help + gray badges + white cards.  
After: blue help retained + eucalyptus section bands + true active green/eucalyptus badges + clearer card hierarchy.

**Risks**  
Do not paint Paused as Active green. Audit `success` token vs eucalyptus — prefer explicit hospitality classes over relying on washed `success/15`.

**Footprint**  
`components/communication/series-list.tsx`, `series-view.tsx`, `automations-help.tsx` (no class change required if already calm); `app/(app)/communication/series/page.tsx`; Badge usage / new utility classes in `globals.css`.

---

### 6. Setup Hub — Bring Your Business selected state

**Current-state assessment**  
- Works: Phase 9 eucalyptus stage bands; white stage cards; completion badges.  
- Weak: intake selected source uses `border-primary/30 bg-primary/5` — reads as **washed gray/green indeterminate**, not “chosen.” On Jen’s Fancy Venue live capture, BYB stage was already complete (“All set”), so HoneyBook panel was not on screen; **source inspection** confirms the selected-panel treatment.  
- Must not touch: stage order, readiness, white-glove welcome gate, import/migration paths, copy unless clarity requires.

**Proposed design**  
1. Selected intake panel: eucalyptus surface + botanical **left accent** (5px) + charcoal title “You told us you use HoneyBook” + short calm reassurance; CTA “Continue with that source” botanical text link.  
2. Alternate choices remain white bordered cards (not selected).  
3. Do **not** mark the panel as stage-complete unless `done` — selected ≠ finished.  
4. When stage `done`, keep current completed card; optional linen note summarizing chosen path without reopening selection chrome.

**Color map**  
Selected: eucalyptus + botanical edge; alternatives: white; completed stage: existing Set up badge + eucalyptus section band.

**Before → after**  
Before: grayish primary/5 slab looks disabled.  
After: clear selected hospitality state, alternatives remain available.

**Risks**  
Confusing selected with complete — copy must stay “you chose… you can still pick differently.”

**Footprint**  
`components/setup-hub/bring-your-business-choices.tsx`; light CSS utility e.g. `.htc-setup-choice-selected`; leave `setup-hub-overview.tsx` stage runner intact.

---

## C. Unified design language (cross-screen patterns)

| # | Pattern | Purpose | Surface | Text | Accent | Use | Do **not** use |
|---|---|---|---|---|---|---|---|
| 1 | Page canvas | Workspace frame | Warm canvas | — | — | All six | Marketing/portal |
| 2 | White intro / heading | Title + primary actions | White elevated **or** plain eucalyptus intro | Charcoal | — | Calendar heading today; upgrade Tours/Requests/Automations to eucalyptus intro | Don’t put forms inside intro |
| 3 | Accented eucalyptus intro | Landmark reporting/docs | Eucalyptus + botanical left | Charcoal | Botanical 5px | **Reports/Documents Phase 10 only** | Calendar/Tours/Requests (plain intro) |
| 4 | Section label / band | Group operational blocks | Eucalyptus (or linen for secondary) | Charcoal uppercase small | Warm border | Tours sections, Automations groups, Requests list, Calendar schedule header | Don’t band every single row |
| 5 | Filter / control toolbar | Controls ≠ content | Linen | Charcoal | Warm border | Calendar controls; Requests filters; Reports dates (exists) | Table bodies |
| 6 | White toolbar | Search/filter on list pages | White | Charcoal | Warm border | Contracts/Payments (Phase 8) | Calendar taxonomy (linen preferred) |
| 7 | Operational table/list body | Editable work | White | Charcoal | Eucalyptus header row | Requests table; tour rows | Don’t pastel entire rows |
| 8 | Selected control | User choice | Botanical fill + white text **or** eucalyptus wash | White / charcoal | — | View switcher, nav, selected BYB | Event taxonomy chips |
| 9 | Status badge | True state | Active→eucalyptus/botanical; paused→linen; overdue→rose text/indicator | Dark on light | — | Automations, Tours, Requests | Decorative “Active” on everything |
| 10 | Metric / KPI card | Category meaning | Snapshot family (eucalyptus header / mist / pale / ivory+blush header) | Charcoal | — | Reports Overview (+ aligned subpages) | Don’t map decorative color to up/down |
| 11 | Guidance panel | Explanation | Calm blue + calm border/left | Charcoal | Calm deep | Automations help; Calendar empty tip; other how-to | Actionable errors/warnings |
| 12 | Attention indicator | Critical | Soft-rose left inset / blush header | Charcoal | Soft rose | Overdue, outstanding owed | Full-row blush washes |
| 13 | Record-name link | Open a record | Transparent (charcoal text) | Charcoal | Underline on hover; focus-visible ring | Clients/Leads/Contracts/Vendors/Payments/Events/Requests titles | Botanical text-as-link; whole-row click when nested controls exist |

**How they compose:** Canvas → Intro (2/3) → optional Guidance (11) → Filter shell (5) → Section bands (4) → White work (7) with Record-name links (13) → Badges/Selected (8/9) → KPI family (10) only on analytics → Attention (12) only when semantic.

Reuse existing classes first: `.htc-hospitality-page|intro|intro-accent|filter|toolbar|table|section-label`, `.htc-setup-stage-section-label`, calm helpers, Snapshot card patterns. Add thin shared `.htc-record-link` (or `RecordNameLink`) — see addendum.

---

## D. Proposed visual changes (summary)

| Screen | Key visual moves |
|---|---|
| Calendar | Linen control shell; eucalyptus schedule header; calm empty tip; protect taxonomy |
| Reports | Keep Phase 10; Snapshot-like KPI/funnel category surfaces |
| Tours | Eucalyptus intro; stronger section shells; richer date/name hierarchy; keep non-clickable action-dense rows |
| Requests | Full hospitality page; eucalyptus intro; linen filters; hospitality table; shared record-name link (not always-underline native `<a>`); keep in-row selects |
| Automations | Keep calm help; eucalyptus group labels; true Active badge; clearer cards |
| Setup BYB | Eucalyptus selected panel + botanical edge; not gray primary/5 |
| **Record lists (cross-app)** | Unify Clients/Leads/Contracts/Vendors/Payments/Events (+ align Requests/Documents/Invoices/Messaging) to charcoal + underline-hover record links; no indiscriminate row click |

---

## E. Implementation footprint (likely)

| Area | Files |
|---|---|
| Shared CSS | `app/globals.css` (extend; do not wholesale replace) |
| Record links | New `.htc-record-link` / optional `components/ui/record-name-link.tsx`; migrate list name `Link`s |
| Calendar | `components/calendar/*` |
| Reports | `comparison-card.tsx`, `business-funnel.tsx`, `app/(app)/reporting/**` |
| Tours | `app/(app)/tours/page.tsx`, `components/tours/tour-list.tsx` |
| Requests | `app/(app)/requests/page.tsx`, `components/requests/request-manager.tsx` |
| Automations | `components/communication/series-list.tsx`, series page |
| Setup | `components/setup-hub/bring-your-business-choices.tsx` |
| Record lists | `client-list`, `lead-list`, `contract-list`, `vendor-list`, `payment-schedule-list`, `event-list`; align `document-card`, invoices page, messaging history |
| Reference | `components/dashboard/business-snapshot.tsx`; Clients list as interaction reference |
| Tests | New Phase 11 structural/CSS seam tests; record-link class assertions; extend hospitality tests |

**No migrations. No env changes. Visual/CSS/className only.** Full list interaction footprint: [`RECORD-LIST-INTERACTION.md`](./RECORD-LIST-INTERACTION.md) §4–5.

---

## F. Recommended implementation sequence

| Wave | Scope | Rationale |
|---|---|---|
| **11A** | Reports KPI/funnel color system | Highest leverage; Phase 10 chrome stable; Snapshot pattern reuse |
| **11B** | Calendar control shell + schedule panel | Highest visual priority; isolated CSS family; taxonomy risk managed |
| **11C** | Tours + Automations | Shared section-label + badge patterns; list density |
| **11D** | Requests hospitality frame + Setup BYB selected | Form/table hospitality + selected-state utility |
| **11E** | Record-list / link interaction consistency (Clients, Leads, Contracts, Vendors, Payments, Events; align Requests/Documents/Invoices/Messaging) | Cross-cutting; low logic risk; fixes the named Clients vs Leads/Contracts inconsistency; foundation for Requests table work |

Prefer shipping **11A+11B** as one product review if capacity allows (analytics + scheduling “hero” pair), then **11C+11D**.  
**11E** may ship **immediately before or with 11D** (shared `.htc-record-link` first, then Requests adopts it) so interaction language lands with the hospitality table migration — not as an endless micro-phase afterward.

Avoid micro-phases that leave the product half-cohesive.

---

## G. Risks and protected functionality

**Must not change**  
- Calendar taxonomy colors and scheduling/availability/booking behavior  
- Reporting calculations, date semantics, comparison polarity accessibility text  
- Tour status/outcome/follow-up/protection logic  
- Request create/assign/status permissions  
- Automation triggers/enrollment/delivery  
- Setup stage order, readiness, white-glove welcome gating, migration routes  
- Semantic success/warning/error/financial indicators  
- Dark readable text on light surfaces; white on botanical only  
- Record list destinations, `returnTo` params, portal activation row actions, nested selects/menus  
- Clients soft-rose attention inset and payment/invoice financial text semantics  

**Accessibility**  
- Audit Active badge contrast (botanical-on-eucalyptus or white-on-botanical)  
- Do not rely on color alone for status (keep text labels)  
- Preserve focus rings on filter chips and cards  
- Record names: underline + focus-visible > botanical-color-only hover  
- Never wrap rows that contain selects/menus in a parent link  

---

## H. Evidence

Current-state captures from **local dirty tree** (Phase 10 present on Reports):

| File | Viewport |
|---|---|
| `evidence/calendar-{desktop,mobile}.png` | 1440 / 390 |
| `evidence/reporting-{desktop,mobile}.png` | Phase 10 intro+linen toolbar + white KPIs |
| `evidence/tours-{desktop,mobile}.png` | |
| `evidence/requests-{desktop,mobile}.png` | |
| `evidence/automations-{desktop,mobile}.png` | Calm help + gray badges |
| `evidence/setup-hub-{desktop,mobile}.png` | Stage bands; BYB complete on this venue |
| `evidence/dashboard-{desktop,mobile}.png` | Snapshot reference |
| `browser-results.json` | Probes |
| `capture-current-state.mts` | Capture script |
| [`RECORD-LIST-INTERACTION.md`](./RECORD-LIST-INTERACTION.md) | Source audit matrix + proposed interaction system |

**Note:** First capture attempt hit a cold `.next` 404 window; recapture after cache rebuild succeeded (all HTTP 200). BYB HoneyBook selected panel not visible on this venue’s completed stage — specified from source (`bring-your-business-choices.tsx`).

Record-list interaction differences (Clients `hover:underline` vs Leads/Contracts `hover:text-primary`, Requests always-underline `<a>`, Tours non-linked name) confirmed by **source inspection** of list components; dedicated hover-state screenshots were not captured (would require interactive hover evidence). Do not treat source-only interaction notes as visual QA of the future shared class.

No static mock UI generated (would require design tooling / code). Specification is the approval artifact.

---

## I. Verdict

**DESIGN PROPOSAL READY — AWAITING PRODUCT APPROVAL**

Do not implement until product signs off on the unified visual language, record-interaction system, and wave sequence (including **11E**).
