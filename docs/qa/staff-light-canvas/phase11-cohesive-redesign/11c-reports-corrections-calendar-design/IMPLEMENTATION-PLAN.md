# Phase 11C Calendar — implementation plan (after approval)

**Do not execute until product approves the design proposal.**

## Principles

- Smallest reversible CSS/class changes
- No `--cal-*` edits
- No behavior/data changes
- Preserve unrelated dirty tree

## Steps

1. **Intro chrome** — In `calendar-page-client.tsx`, apply `htc-hospitality-intro htc-hospitality-intro-accent` around `PageHeader` (keep actions). Verify contrast of title/description.
2. **Toolbar shell** — Add a linen wrapper around Month date nav + shared view switcher where they co-appear; for Week/Day/Agenda, apply the same linen treatment to each view’s existing nav group via shared class.
3. **Filters** — Set `.htc-calendar-filters` background to `--htc-linen` (keep chip styles; dots unchanged).
4. **Legend** — Leave white; optionally show a compact legend on Week/Day/Agenda if product wants parity (separate approval — currently Month-only in code).
5. **Regression** — Taxonomy token tests; focused CSS assertions; browser captures Month/Week/Day/Agenda × desktop/390/375; overflow checks.
6. **Stop** — No print/public/share redesign unless explicitly approved.

## Rollback

Revert the three files above; no migrations/data involved.
