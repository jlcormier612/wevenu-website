# Phase 11C — Reports corrections + Calendar design proposal

## Verdicts

| Workstream | Verdict |
|---|---|
| Reports corrections (Saved breadcrumb + Sales hierarchy) | **GREEN / CLOSED LOCALLY** |
| Phase 11C Calendar | **DESIGN PROPOSAL READY — AWAITING PRODUCT APPROVAL** |

No commit, push, deploy, migration, or database writes.

---

## A. Reports corrections

### A1. Saved Reports “Templates” breadcrumb

**Root cause:** `components/reporting/reports-layout-shell.tsx` intentionally rendered `CollectionBackLink` with `href="/library"` and `label="Templates"` when `pathname === "/reporting/saved"`, treating Saved Reports as a Library collection peer of Brochures. Destination was `/library` (Templates hub), not Reports.

**Correction:** Removed the back link entirely. Report tabs already provide navigation among Overview / Sales / Bookings / Revenue / Events / Saved. Library → Saved Reports still works via the Templates toolbox card; sidebar “Templates” remains the Library destination.

**Verified destination:** Live probe — Reports shell starts with eucalyptus intro; no `← Templates` / `CollectionBackLink` inside `[data-htc-phase10=reporting]`. Sidebar still has Templates → `/library` (correct).

### A2. Sales mobile hierarchy

Within **Leads from this period**:

1. Short intro: “N leads created during {range} — M later booked.”
2. KPI tiles immediately (`data-sales-leads-kpis`)
3. Source-coverage one-liner retained
4. Long methodology moved into accessible `<details>` labeled **How these numbers are calculated** (cohort timing, lost leads, Bookings this period distinction, conversion denominators)

Desktop uses the same shared markup (acceptable shared improvement).

### Files changed (Reports)

- `components/reporting/reports-layout-shell.tsx`
- `app/(app)/reporting/layout.tsx` (comment)
- `app/(app)/reporting/sales/page.tsx`
- `lib/reporting/saved-reports-back-nav.test.ts`
- `lib/reporting/phase11c-sales-hierarchy.test.ts` (new)

---

## B. Reports verification

**Tests:** Focused Phase 10 polish + 11A + 11B + 11C Reports → **50/50 pass**.

**Screenshots:**

- Repo: `evidence/reports/`
- Desktop: `~/Desktop/htc-phase11c-reports-corrections/`
- Includes Saved/Sales/Overview × desktop/390/375 + Sales method-open + `saved-desktop-nav-verify.png`

**Checks:** No page overflow; Saved tab active without Templates breadcrumb; Sales KPIs precede methodology; Phase 11B tones/chrome unchanged on Overview/Sales.

---

## C. Calendar current-state audit

See `CALENDAR-CURRENT-STATE.md`.

Highlights:

- Routes: Month/Week/Day/Agenda + print confirmed live
- Taxonomy tokens verified purple/blue/orange/yellow/blocked
- Already has substantial hospitality chrome; missing eucalyptus intro + linen toolbar parity vs Reports
- Legend + month filters are **Month-view only** in current code
- Evidence: `evidence/calendar-current/` + `~/Desktop/htc-phase11c-calendar-current/`

---

## D. Calendar design proposal

See:

- `CALENDAR-DESIGN-SPECIFICATION.md`
- `COMPONENT-IMPACT-MAP.md`
- `IMPLEMENTATION-PLAN.md`
- Mockups: `mockups/*` → screenshots in `evidence/calendar-proposal/` + `~/Desktop/htc-phase11c-calendar-design-proposal/`

**Proposal in one line:** Eucalyptus intro + linen nav/filter chrome + keep white grid and locked `--cal-*` taxonomy.

**Calendar was not implemented.**

---

## E. Scope integrity

- Phase 11B Reports colors/KPI/nav/calculations untouched (aside from Sales copy hierarchy and Saved breadcrumb removal)
- Phase 1–10 / 11A dirty work preserved
- No Calendar live CSS/behavior changes
- No commit / push / deploy / migration / DB writes / Production

---

## F. Verdicts (repeat)

- **Reports corrections:** `GREEN / CLOSED LOCALLY`
- **Phase 11C Calendar:** `DESIGN PROPOSAL READY — AWAITING PRODUCT APPROVAL`
