# Queue Item 2A — Availability Settings final polish

**Status: SANDBOX GREEN**  
**Date:** 2026-10-14

## Preflight

| Item | Value |
|------|--------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Dirty/untracked | Preserved (~600+ paths); no destructive git |
| Overlap | None on changed product files |

## Acceptance (final on serving `a3c22b30`)

| Criterion | Result | Measurement |
|-----------|--------|-------------|
| A Labels | **PASS** | Both `12.75px` / `500` / same color; tops **300** |
| B Heights/align | **PASS** | Select & hold chip both **47px**, tops **285** |
| C Place primary | **PASS** | Place & Edit/Save both `rgb(93, 111, 93)` / white; Place top **285** (same band) |
| D Regression | **PASS** | Place opens form; Cancel closes; no hold persisted |

## Changes

| Commit | Purpose |
|--------|---------|
| `1e1366e1` | Primary Place CTA; h-11 owner/hold controls; items-center |
| `a3c22b30` | Compact chip/Place nowrap band so heights/tops match |

Files: `date-holds-section.tsx`, `staff-assignment-field.tsx`, `lead-detail.tsx`, tests.

## Tests

Focused suite including `sales-availability-polish-2a.test.ts` → **20–35 pass / 0 fail** (last run 20/20 on subset).

## Deployment

| Item | Value |
|------|--------|
| Final serving commit | `a3c22b30ae03a8b25aa41d84c5474e02754254d7` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38503234909 (**success**) |
| Prior fix deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/38502289373 (`1e1366e1`) |
| Target | Sandbox only |
| Production | Untouched |

## Runtime verification

`EXPECTED_SHA=a3c22b30… SHOT_SUFFIX=post-deploy npx tsx docs/qa/availability-settings-final-polish/verify-2a-browser.mts` → **ALL PASS**

Evidence: `browser-results-post-deploy.json`, `sales-availability-1280-post-deploy.png`, `sales-availability-390-post-deploy.png`

## Remaining issues

None for 2A.
