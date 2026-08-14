# Help & Guides — Event Day / After the Event / Reports — Implementation

**Status:** Implemented  
**Date:** 2026-08-13  
**Sources:** Approved implementation prompt (Event Day / After the Event / Reports); `docs/help-guides-remaining-content-research.md`

---

## Exact articles published

### Preserved (unchanged) — 24

All previously published articles remain present and unmodified, including Getting Started: Your First Morning and the five original Best Practice articles.

### New (8)

| Slug | Title | Category |
|---|---|---|
| `event-day-sheet` | What is the Day Sheet, and how do I get one? | Event Day |
| `wedding-day-dashboard` | What is the Wedding Day Dashboard, and when do I use it? | Event Day |
| `event-day-tasks` | Where do I see my event-day tasks? | Event Day |
| `mark-event-complete` | How do I mark an event complete, and what happens when I do? | After the Event |
| `post-event-feedback` | How do I collect feedback from a couple after their event? | After the Event |
| `what-can-i-see-in-reports` | What can I see in Reports? | Reports |
| `which-report-should-i-use` | Which report should I use for a specific question? | Reports |
| `save-a-report` | How do I save a report and find it again later? | Reports |

**Published total:** 32 articles (24 pre-existing + 8 new).

**Status:** all 8 new articles `published`.

---

## Categories used

Existing 12-area taxonomy only (`lib/help-guides/areas.ts` unchanged).

| Category | New articles |
|---|---|
| Event Day | +3 |
| After the Event | +2 |
| Reports | +3 |
| Guided Journeys | **0** (intentionally empty) |

---

## Content source / publishing mechanism

- Store: `success_library_articles`
- Mechanism: SQL migration seed (`on conflict (slug) do nothing`)
- Rendering: existing `/help` + `/help/[slug]` Best Practice sections (`why_it_matters`, `when_to_use`, `best_practices`, `common_mistakes`, `related_features`)
- Approved prose mapped into those fields with mechanical formatting only (markdown `###` / `**` stripped for plain-text renderer; user Question lines placed in `why_it_matters`; Tip/Important lines in `common_mistakes`)
- No Guided Journeys content
- No public-review / star-rating / `couple_venue_feedback` content
- No report scheduling/export promises

---

## Files / migrations changed

| File | Why |
|---|---|
| `supabase/migrations/20261291000000_help_guides_event_day_after_reports.sql` | Publish 8 approved articles |
| `docs/qa/help-guides-event-day-after-reports/smoke.mjs` | Browser validation |
| `docs/qa/help-guides-event-day-after-reports/results.json` | Smoke results |
| `docs/qa/help-guides-event-day-after-reports/*.png` | Screenshots |
| `docs/help-guides-event-day-after-reports-implementation.md` | This report |

No application code, taxonomy, Help UI, navigation, Reports, Event Day, After-the-Event, or Library product changes.

---

## Duplicate / idempotency check

- Before insert: 0 of the 8 recommended slugs existed
- After insert: `INSERT 0 8`
- Re-run migration: `INSERT 0 0`; published total stayed **32**
- Duplicate slug groups: **0**
- Original 24 slugs still present: **24 / 24**

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm test` | **565 / 565** pass |
| DB: 8 new published, correct categories | Pass |
| DB: no duplicates | Pass |
| DB: original 24 unchanged/present | Pass |
| Help home still 12 categories | Pass |
| Event Day +3 / After the Event +2 / Reports +3 / Guided Journeys 0 | Pass |
| Browser smoke | **66 / 66** pass (`docs/qa/help-guides-event-day-after-reports/`) |

Browser confirmed:

- `/help` shows all 12 areas
- Event Day, After the Event, and Reports sections list the new titles
- Guided Journeys remains empty (“Guides for this area are coming soon.”)
- All 8 article pages open with correct titles + category + back link to Help & Guides
- Preserved 24 titles still appear on Help home

---

## Explicit confirmation — out of scope unchanged

Did **not** change: `lib/help-guides/areas.ts`, Help UI/search/relatedness, Guided Journeys content, left navigation, Library IA, Reports product behavior, Event Day product behavior, After-the-Event product behavior, Pipeline, Automations, Event Order, Luv, Vendor work.

---

## Commit / push

**No commit. No push.**
