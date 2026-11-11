# Phase 11 Addendum — Record Lists, Links & Interaction Consistency

**Mode:** Read-only discovery — **no implementation**  
**Companion to:** `REPORT.md`  
**Date:** 2026-11-03  

---

## 1. Problem

Clients, Leads, and Contracts (and neighboring lists) already share `.htc-hospitality-table` chrome in several places, but **record-name interaction** diverges:

| Pattern | Where | Effect |
|---|---|---|
| Charcoal name + **underline on hover** | Clients | Clear, readable “this is a link” without botanical text |
| Charcoal name + **botanical text on hover** | Leads, Contracts, Vendors, Payments, Events | Color-only cue; no underline; feels like a different product |
| Always underlined native `<a>` | Requests | Strong affordance, but outside hospitality table + different stack |
| Plain text name; chevron button only | Tours | Correct for action-dense rows; name itself is not navigable |
| Title button + `hover:underline` | Documents | Good name affordance; card hover separate |
| Entire card is the link | Invoices | Valid when no nested controls |

Staff cannot form a single mental model for “how do I open a record?”

---

## 2. Comparison matrix (current state)

Source inspection of dirty local tree (Phase 10 present). Hover/focus verified from classnames; keyboard focus for plain `Link`/`<a>` generally inherits browser/outline defaults — **no shared record-link focus class exists today**.

| List | Primary nav target | Default name appearance | Hover | Keyboard focus (name) | Whole row clickable? | Independent row controls | Default / hover row bg | Semantic row bg? | Mobile / touch | A11y notes |
|---|---|---|---|---|---|---|---|---|---|---|
| **Clients** | `/clients/:id` | `font-medium text-foreground`; Link inherits charcoal | `hover:underline` (stays dark) | Default link focus (no shared ring class) | **No** | `View →`; portal mode: `PortalActivationRowActions` | Hospitality: white → canvas mix | **Yes** — `data-attention="true"` soft-rose **left inset** (not full blush wash) | Desktop table; horizontal scroll | Dual targets (name + View) OK; portal actions must stay separate from name link |
| **Leads** | `/leads/:id` | Same charcoal inherit | `hover:text-primary` (**botanical**), no underline | Default | **No** | `View →`; unseen + message-attention indicators | Hospitality canvas hover | No row-level attention wash (indicators only) | Table | Color-only hover weaker for color-vision / consistency |
| **Contracts** | `/contracts/:id?returnTo=` | Charcoal | `hover:text-primary` | Default | **No** | `View →` | Hospitality | No | **Mobile card list** + desktop table; both use botanical hover | Same as Leads |
| **Vendors** | `/vendors/:id` | Charcoal | `hover:text-primary` | Default | **No** | `View →` | Hospitality | No (preference badges are semantic, not row bg) | Table | Same |
| **Payments** | `/payments/:id` | Charcoal | `hover:text-primary` | Default | **No** | `View →` | Hospitality | Attention as **destructive text** under title (not row bg); paid/balance use success/foreground | Table | Preserve financial text semantics |
| **Events** | `/events/:id` | Charcoal | `hover:text-primary` | Default | **No** | `View →` | Plain bordered table; `TableRow` muted hover (**not** hospitality-table) | Countdown “soon” = destructive **text** | Table | Should adopt hospitality table + shared link |
| **Requests** | `/requests/:id` | Native `<a class="font-medium underline">` — **always underlined** | Underline remains | Default browser | **No** | **Status + assignee `<select>`s in-row** | Plain HTML table; **no** row hover wash | No | Plain table | **Must not** make whole row clickable (nested controls) |
| **Tours** | Lead: `/leads/:id` via ghost chevron only | Name is `<p>` — **not a link** | N/A on name | Focus on buttons/selects/menu | **No** | Confirm CTAs, status select, overflow archive/delete, outcome buttons | Custom `.htc-tours-row` | Status via badges (`data-tours-status`) | Action stack | Correct: action-dense → non-clickable row |
| **Documents** | Opens viewer (`handleView` button) | `text-heading` title button | `hover:underline` + card `hover:bg-muted/20` | Native `<button>` focus | **No** | Pin, open external, download, version, delete menu | Card hover muted | Pin uses warning color | Dense mobile actions (Phase 10) | Correct multi-control pattern |
| **Invoices** | `/invoices/:id?returnTo=` | Heading text inside **card Link** | Whole card `hover:bg-muted/30` | Focus on card link | **Yes** (entire card) | None nested (badge only) | Card | Balance-due destructive text | Card stack | OK pattern when no nested interactive children |
| **Messaging history** | Lead/client/conversation when known | `text-heading` in Link wrapper | Wrapper `hover:text-primary` | Default | Name block only | Status / timeline popover **outside** link | No row bg hover | Status labels/emoji | Flex list | Good separation of link vs status control |

### Shared CSS already in play

- `.htc-hospitality-table` body row hover → warm canvas mix; attention → soft-rose inset (`app/globals.css`).
- Global staff `[data-slot="table-row"]:hover` → muted mix — **competes** when lists skip hospitality wrapper (Events).
- `TableRow` includes `data-[state=selected]:bg-muted` but staff record lists rarely set selected state.

**No reusable `RecordNameLink` / `.htc-record-link` component exists today.**

---

## 3. Proposed shared interaction system

### 3.1 Record-name link (primary navigation target)

**Class / component (recommended):** `.htc-record-link` or thin `RecordNameLink` wrapping Next `Link`.

| State | Treatment |
|---|---|
| Default | Charcoal / `text-foreground` (or `text-heading` where already used for titles). **No botanical body text.** Medium weight. No underline **or** very subtle decoration only if product prefers always-visible affordance — **default recommendation: no underline at rest** (Clients model). |
| Hover | **Underline** (`underline-offset-2` / `underline-offset-4`). Text stays charcoal. Optional tiny opacity nudge only if needed — **not** `text-primary`. |
| Focus-visible | Shared staff ring: `outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-sm` (align with button/input rings). |
| Active/visited | No purple browser visited styling — keep charcoal. |

**Do not** use botanical-colored text alone to signal “this navigates.” Botanical remains for primary actions, selected chrome, and accents.

### 3.2 Hover underline vs botanical hover

| Allowed | Forbidden for primary record names |
|---|---|
| Charcoal + underline on hover (Clients) | `hover:text-primary` as the only cue |
| Explicit `View →` ghost button as secondary | Recoloring the name green “because links are brand” |

Secondary / inline help links elsewhere may keep `text-primary hover:underline` (pipeline chips, guidance) — those are **not** record titles.

### 3.3 Keyboard focus

Every record-name control (Link or button-as-title) must show a **visible focus-visible ring**. Ghost `View →` already gets Button focus styles — keep that.

### 3.4 Clickable rows vs non-clickable rows

| Row type | Rule | Examples |
|---|---|---|
| **A. Link cell + optional View** | Row **not** clickable. Name is `.htc-record-link`. Optional trailing `View →`. Row hover wash is decorative only. | Clients, Leads, Contracts, Vendors, Payments, Events (target) |
| **B. Action-dense** | Row **not** clickable. Name may be plain **or** a record link **if** destination is unambiguous and does not fight controls. Prefer explicit link/button for destination. | Tours, Requests, Documents, Clients portal mode |
| **C. Simple card** | Entire card **may** be one link **only if** no nested buttons/menus/selects. Card hover wash OK. | Invoices (current) |

**Do not** make every table row clickable indiscriminately — especially Requests (selects) and Tours (status/confirm/overflow).

### 3.5 Rows with dropdowns, buttons, or selects

- Stop row-level `onClick` / wrapping `<Link>`.
- Hit targets stay on their own controls.
- Name link (if present) must not cover action columns.
- Mobile: preserve Contracts-style name link + View; do not convert action-dense lists into full-row tap targets.

### 3.6 Selected rows

If multi-select appears later: eucalyptus wash + charcoal text (`data-state=selected` remapped under hospitality), not muted gray. **Out of scope** unless a list already selects — do not invent selection UX in Phase 11.

### 3.7 Status-based / attention row treatments

| Treatment | Keep? | Notes |
|---|---|---|
| Clients `data-attention` soft-rose **left inset** | **Yes** | Documented; matches Focus critical pattern |
| Payments destructive attention **copy** | **Yes** | Semantic, not decorative |
| Payments/Invoices financial success/destructive **text** | **Yes** | Not row fills |
| Full-row blush / pastel washes | **No** | Already rejected on Clients |
| Tour/Automations status **badges** | **Yes** | Status ≠ row background |

Decorative hospitality row hover (canvas mix) is **not** semantic.

### 3.8 Mobile / touch

- Same record-link visual language as desktop.
- Prefer ≥44px tap targets on trailing actions where already Button-sized.
- Contracts mobile cards: migrate name link to `.htc-record-link` (underline hover / focus ring).
- Invoices cards: keep whole-card link; ensure focus ring on card is visible.

### 3.9 Accessibility summary

- Underline-on-hover + focus ring > color-only botanical hover.
- Do not remove text labels from status badges.
- Nested interactive content must not sit inside a parent link (Invoices already compliant; do not “improve” Requests by wrapping `<tr>`).

---

## 4. Migration map (implementation guidance — not authorized yet)

| Surface | Change |
|---|---|
| **Shared** | Add `.htc-record-link` in `app/globals.css` and/or `components/ui/record-name-link.tsx` |
| Clients | Already closest — swap to shared class; keep attention inset; keep portal actions |
| Leads | Replace `hover:text-primary` with `.htc-record-link` |
| Contracts | Desktop + mobile name links → shared |
| Vendors | Shared |
| Payments | Shared; keep destructive attention lines |
| Events | Wrap with `.htc-hospitality-table` + shared link (fixes muted vs canvas hover split) |
| Requests | Adopt hospitality table; title → `.htc-record-link` (drop perpetual underline **or** keep underline-at-rest only if product prefers stronger cue — recommendation: match Clients). **Keep** in-row selects; no row click |
| Tours | Optional: make couple name a record link to lead when `leadId` present **in addition to** chevron — or leave name plain and rely on chevron. Prefer **one** clear lead affordance, not three. Do not row-click |
| Documents | Title already `hover:underline` — align class name/tokens only |
| Invoices | Keep card-link pattern; optional shared card-hover token |
| Messaging | Prefer underline hover over `hover:text-primary` for name wrapper |

**Preserve:** all `href` destinations, `returnTo` query params, permissions, portal activation actions, payment/contract status logic.

---

## 5. Likely files & risks

**Files**  
`app/globals.css`; new small link helper;  
`components/clients/client-list.tsx`, `leads/lead-list.tsx`, `contracts/contract-list.tsx`, `vendors/vendor-list.tsx`, `payments/payment-schedule-list.tsx`, `events/event-list.tsx`, `requests/request-manager.tsx`, optionally `tours/tour-list.tsx`, `document-workspace/document-card.tsx`, `messaging/message-history-list.tsx`, `app/(app)/invoices/page.tsx`.

**Risks**  
- Wrapping rows in links → broken selects/menus (Requests, Tours, Documents).  
- Changing Clients underline behavior accidentally.  
- Losing `data-attention` / financial destructive copy while “cleaning” classes.  
- Events adopting hospitality table may shift header/ typography — visual QA required.  
- Test selectors that assert `hover:text-primary` on names.

**Regression tests (when implementing)**  
- Structural: primary name uses shared class; no `hover:text-primary` on record titles in listed files.  
- Clients attention inset still present.  
- Requests selects still outside any parent link.  
- Contract `returnTo` preserved.

---

## 6. Placement in Phase 11 sequence

See `REPORT.md` §F — recommended as **Wave 11E (or 11A foundation)** because it is cross-cutting and low logic risk, and it makes Requests/Tours visual work land on a consistent interaction base.

**Suggested order:** ship shared `.htc-record-link` **before or with** Requests hospitality framing (11D), and apply to Clients/Leads/Contracts/Vendors/Payments/Events in the same wave so the three named offenders are fixed together.
