# Dashboard Light Mode — Discovery (read-only)

**Status:** Superseded by implementation + palette refinement. Final status: **Dashboard light-mode GREEN / VISUALLY APPROVED / CLOSED** — see `docs/design/htc-dashboard-light-specification.md` §0 and `docs/design/htc-visual-system.md`.  
**Date context:** After Clients / Offerings light-mode visual approval.  
**Inspiration:** Nexora-style card confidence and hierarchy; HTC hospitality palette only.

---

## 1. What was inspected

| Area | Paths |
|------|--------|
| Page | `app/(app)/dashboard/page.tsx`, `app/(app)/dashboard/actions.ts` |
| Data | `lib/dashboard/service.ts`, `lib/dashboard/business-snapshot.ts`, `lib/dashboard-system/decision-engine.ts`, Luv entry / dismiss helpers |
| UI | `components/dashboard/greeting.tsx`, `business-snapshot.tsx`, `luv-dashboard-entry.tsx`, `luv-intro.tsx`, `milestone-toast.tsx` |
| Shared dashboard system | `components/dashboard-system/dashboard-card-shell.tsx`, `attention-list.tsx`, `focus-attention-row.tsx`, `comparison-card.tsx`, `stat-tile.tsx`, etc. |
| Shell | `components/shell/workspace-shell.tsx`, `workspace-shell-header.tsx`, `sidebar-nav.tsx` |
| Tokens | `.htc-staff` in `app/globals.css` (Dashboard does **not** yet use `.htc-hospitality-page`) |
| Tests | `lib/dashboard-system/dashboard-page.test.ts` (+ many `lib/dashboard/*.test.ts` for data/IA, not visual) |
| Prior docs | `docs/dashboard-component-system-architecture.md`, venue dashboard reconstruction notes |

**Not inspected live in a browser for this discovery** (no new screenshots taken in this task). Findings below are from code and architecture review.

---

## 2. Current composition (as implemented)

Vertical stack (`space-y-8`), no hospitality canvas wrapper:

1. Milestone toast (conditional)  
2. Greeting (serif h1) + **+ New Lead** primary button  
3. Luv intro (conditional onboarding)  
4. **Today's Focus** — `AttentionList` / `FocusAttentionRow` (actionable now; dismissible)  
5. **Luv entry card** (conditional; rose/destructive-tinted card today)  
6. **Coming up** — events next 30 days (awareness; cross-section deduped vs Focus)  
7. **Business Snapshot** — four equal cards: Lead Flow · Booked Business · Cash Collected · Outstanding  
8. **View Reports** link row  

Owning surfaces (Leads, Inbox, Contracts, etc.) do the work; Dashboard is briefing/awareness.

---

## 3. Strengths

- Clear product IA: Focus vs Coming up vs Snapshot is already documented in page comments and locked by tests.
- Shared `DashboardCardShell` / `AttentionList` avoid one-off chrome.
- Snapshot cards use equal geometry (min-height, reserved lines) — good for polish.
- Greeting already uses serif heading + venue-aware copy.
- Severity labels on focus rows map to critical/warning — meaning already exists for color.
- Empty states exist for Focus and Coming up.

## 4. Weaknesses (visual / hierarchy)

- Page sits on default staff `#FAFCFA` background — not the approved warm canvas; less separation from white shell.
- Almost every block is the same white `Card` — Nexora-like “confident varied cards” are underused; little botanical/eucalyptus/blush structure.
- Luv uses `border-rose-200` + destructive mix — off-palette relative to approved blush `#F7E9EB`.
- Snapshot `actionLabel` uses `text-primary` (green text on light) — conflicts with “no ordinary green text.”
- Today's Focus and Coming up are visually twin lists; Focus (action) does not read stronger than Coming up (awareness).
- No hospitality heading card; greeting + CTA float without the Clients/Offerings heading surface language.
- Dark-mode visual QA outstanding (same as system doc).
- Legacy widgets under `components/dashboard/*` still exist; page path above is the live composition — do not assume unused widgets are on-page without checking imports.

---

## 5. Operational reading (venue owner)

| Priority | Content | Why |
|----------|---------|-----|
| Strongest | Today's Focus | Requires action today |
| High | Critical/warning row signals | Time-sensitive money / readiness / response |
| Medium | Luv (single interpretive note) | Guidance, not a second queue |
| Medium | Coming up | Planning awareness (30-day events) |
| Secondary | Business Snapshot | State of funnel / booked / cash — not today's todo |
| Tertiary | View Reports | Exit to deep analytics |

Color should encode **action vs awareness vs money health**, not paint every card the same.

---

## 6. Proposed visual direction (for approval — not implemented)

### Principles

- Same HTC palette as Clients/Offerings.
- **Richer card variety than operational tables** is appropriate here.
- Do not invent metrics or sections; restyle and regroup existing ones.
- Related to Clients/Offerings via canvas, typography, buttons, borders — not by cloning the catalog/table look.

### Structural wireframe (desktop)

```
┌ Sidebar (white) ┐┌── warm canvas #F8F7F3 ──────────────────────────┐
│                 ││ [white heading card]                             │
│                 ││  Serif greeting · date · venue line              │
│                 ││                         [Botanical + New Lead]   │
│                 │├──────────────────────────────────────────────────┤
│                 ││ [BLUSH or eucalyptus-header FOCUS card]          │
│                 ││  Today's Focus · rows with severity accents      │
│                 │├──────────────────────────────────────────────────┤
│                 ││ [optional BLUSH Luv card — single note]          │
│                 │├──────────────────────────────────────────────────┤
│                 ││ [WHITE Coming up card]  awareness, quieter        │
│                 │├──────────────────────────────────────────────────┤
│                 ││ Business Snapshot                                │
│                 ││ ┌ eucalyptus ┐┌ white ┐┌ white ┐┌ blush? ┐     │
│                 ││ │ Lead Flow  ││ Booked││ Cash  ││ Outstd │     │
│                 ││ └────────────┘└───────┘└───────┘└────────┘     │
│                 ││ [white Reports link]                             │
└─────────────────┴───────────────────────────────────────────────────┘
```

### Suggested surface assignment (existing content only)

| Block | Proposed surface | Emphasis |
|-------|------------------|----------|
| Page | Warm canvas | Shared with Clients/Offerings |
| Greeting cluster | White heading card | Same language as other hospitality pages |
| Today's Focus | White body + **eucalyptus header band**, or soft blush wash if “attention theater” is desired — prefer eucalyptus header + blush only on critical rows | Strongest |
| Focus row critical | Blush row wash or blush pill (not green text) | Action |
| Focus row warning | Restrained eucalyptus/warning chip already mapped | Action |
| Luv | Blush `#F7E9EB` card (replace rose/destructive tint) | Soft feature |
| Coming up | White card, muted icon, no eucalyptus header | Quieter than Focus |
| Snapshot · Lead Flow | Eucalyptus card or eucalyptus top band | Funnel health |
| Snapshot · Booked | White | Neutral positive |
| Snapshot · Cash collected | White or light eucalyptus | Neutral |
| Snapshot · Outstanding | Blush-tint card or blush accent if amount > 0; white when empty | Money attention |
| View Reports | White secondary row | Exit |

### Desktop / mobile

- **Desktop:** single column is fine (matches current IA); Snapshot stays 2×2 / 4-up grid via `ComparisonCardGrid`.
- **Mobile:** stack Focus → Luv → Coming up → Snapshot; tighten `space-y`; heading card wraps CTA under title; Snapshot 1-col or 2-col without equal-height strain breaking.

### Relation to Clients / Offerings

| Shared | Different |
|--------|-----------|
| Warm canvas, white heading, botanical primary, serif/sans, warm borders | Dashboard uses **multiple coordinated card tones** |
| Dark text on light; blush = attention | No catalog parent/category rules |
| Eucalyptus = structure / supporting | Focus list may use header band + severity; Snapshot may tint by meaning |

---

## 7. Tests / verification notes

- IA locked by `lib/dashboard-system/dashboard-page.test.ts` (section order, no Quick Actions, Snapshot cards, Coming up = events only, etc.).
- Visual hospitality tests do **not** yet cover Dashboard.
- Any implementation must preserve dismissal, Luv entry selection, cross-section subject exclusion, and Snapshot models — visual only unless product expands scope.

## 8. Open questions for product

1. Today's Focus: eucalyptus header + white body, or blush-tinted whole card?  
2. Outstanding snapshot: always blush-capable, or only when balance > 0?  
3. Keep Luv emoji / “Luv” title treatment, or quieter hospitality label on blush?  
4. Should Dashboard adopt `.htc-hospitality-page` wrapper for canvas consistency?

---

**Stop:** await product design decisions before any Dashboard implementation.
