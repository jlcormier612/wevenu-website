# Reporting chart colors & scalability

**Branch:** `fix/reporting-chart-colors-scalability`  
**Base:** `origin/main` @ `cb06cf16` (accepted PR #33 tip)  
**Status:** Ready for review — **not merged / not deployed**  
**Production / Stripe / Sandbox data / #34 / C1:** untouched

---

## A. Current behavior (audit)

| Topic | Finding |
| --- | --- |
| Components | Shared `SourceCompositionChart` (SVG doughnut). Used by Overview + Sales **Lead Sources**, **Bookings by Source**, Events composition. |
| Palette | 5 CSS `--chart-*` tokens + 5 `color-mix` variants (10 slots). Heavily sage / rose / taupe — Website vs Instagram could land on near-identical dark greens (`--chart-1` / `--chart-2`). |
| Assignment | FNV hash of slice **key** → preferred slot; only resolved vs **adjacent** slice (and adjacent dark-green pair). **Same color could appear twice** in one chart (non-adjacent). |
| Stability | Same key → same preferred slot. Sibling set / order changes could still nudge via adjacent conflict resolution. |
| Many sources | **No grouping** — every source got an arc; colors **wrapped** after 10. Tiny slices + long legends. |
| Not recorded | Key `unknown`, label “Not recorded”; sorted last. No reserved neutral color. |
| Semantics | Aggregation unchanged in `lib/attribution/*` + metrics; chart is presentation-only. |

---

## B. Proposed improvement (implemented)

1. **24 unique hospitality hues** (eucalyptus, muted blue, dusty rose, terracotta, soft gold, lavender-gray, taupe/olive mixes). No neon rainbow.  
2. **No color reused within a chart** — walk from hash-preferred index until an unused palette slot is found.  
3. **Reserved neutrals:** Not recorded + Other (never assigned to real sources).  
4. **Other grouping** at **7** individual known sources; remainder folded into **Other** with expandable legend listing members. Not recorded never folds into Other.  
5. Totals recomputed with existing largest-remainder percents → still sum to **100**; underlying member counts preserved.  
6. No hardcoded source-name allowlist — custom venue keys work.

---

## C. Implementation

| Path | Change |
| --- | --- |
| `lib/reporting/composition-display.ts` | Palette, unique assign, Other grouping |
| `lib/reporting/composition-display.test.ts` | Fixtures 1–30+, uniqueness, totals |
| `components/reporting/source-composition-chart.tsx` | Use display helpers; expandable Other |
| `components/reporting/source-composition-colors.test.ts` | Updated uniqueness / Website–Instagram |
| `docs/design/reporting-chart-colors/*` | This report + preview screenshots |

Backend metrics / attribution / permissions / financial math: **unchanged**.

---

## D. Accuracy

- Display total count = input total (proven for 1, 2, 5, 8, 12, 20, 30).  
- Percents sum to 100 after grouping.  
- Other.count = sum(members).  
- Attribution tests (`bookings-by-source.test.ts`) still **PASS** (no aggregation change).

---

## E. Scalability

| Categories | Behavior |
| --- | ---: |
| 1–7 known | All individual; unique colors |
| 8+ | Top 7 + Other (+ Not recorded if present) |
| 12 / 20 / 30 | Totals preserved; Other expandable |
| Not recorded largest | Stays own slice + reserved neutral |

---

## F. Visual acceptance

Preview fixtures (deterministic HTML/SVG using brand CSS variables) — **not** overwriting approved hospitality baselines:

- `screenshots/01-two-sources-website-instagram-{desktop,mobile}.png`
- `screenshots/02-five-sources-*`
- `screenshots/03-twelve-sources-other-*`
- `screenshots/04-twenty-sources-other-*`

Card structure / typography / spacing of the live chart shell unchanged; only fill colors + Other legend affordance.

---

## G. Regression tests

```
npx tsx --test \
  lib/reporting/composition-display.test.ts \
  components/reporting/source-composition-colors.test.ts \
  lib/attribution/bookings-by-source.test.ts
→ 29 pass / 0 fail
```

Navigation, filters, permissions, Stripe: not modified.

---

## H. Final verdict

**GREEN** for this presentation-only change on the dedicated branch.

Residuals (non-blocking for review):

- Live Sandbox screenshot compare awaits deploy approval (baselines not auto-updated).  
- If a single chart ever exceeds 24 non-Other/non-unknown arcs (after grouping max ~9), palette would need extension — Other grouping prevents that in normal use.
