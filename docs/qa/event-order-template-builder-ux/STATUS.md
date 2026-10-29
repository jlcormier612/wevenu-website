# Event Order Template Builder UX — acceptance STATUS

**Verdict: GREEN**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

---

## Product decision (locked)

Two-section Offering-based package builder:

1. **Always on the package** — not labeled “Included.”
2. **Couple's choices** — select catalog Offerings (parents expose children); no question-first authoring.

Prior question-builder GREEN is not acceptance for this decision. See `REDESIGN-AUDIT.md`.

---

## Ceremony build failure → fix

| Item | Value |
|---|---|
| Failed deploy | [40790796245](https://github.com/jlcormier612/wevenu-website/actions/runs/40790796245) |
| Failed commit | `2f0da53e` — `"ceremony"` in `SUGGESTED_CATEGORIES` omitted from `SuggestedCategoryKey` |
| Type + Ceremony category fix | landed in `efb7d9c7` (also inventory Select revalidation) |
| Exact-alias match + Ceremony regression tests | `e838dbe8` |
| Optimistic child checkboxes (usability) | `bc21e105` |
| Successful Sandbox deploy of product tip | [40793467681](https://github.com/jlcormier612/wevenu-website/actions/runs/40793467681) — **success** |
| **Serving SHA at acceptance** | `bc21e105c9091fc446954717e980afab4e0008be` |
| ECS | `htc-sandbox-venue-app:bc21e105c9091fc446954717e980afab4e0008be` · PRIMARY `COMPLETED` |

Follow-up harness-only commits (`7dd79243`…`018770c6`) were pushed after the product tip; a tip deploy was started at [40794600935](https://github.com/jlcormier612/wevenu-website/actions/runs/40794600935). Acceptance below was verified on the **serving** product SHA `bc21e105`.

---

## Focused tests / type

```bash
npx tsx --test lib/event-order-templates/guided-setup.test.ts \
  lib/event-order-templates/builder-ux.test.ts \
  lib/offerings/category-identity.test.ts
→ 42 pass / 0 fail
```

Ceremony covered: typed suggested key, aliases, `canonicalSectionNameForSuggested("ceremony")`, persisted section → `ceremony` key, wizard `eo-guided-category-${cat.key}` seam. Exact alias match preferred before substring includes (so “ceremony décor” does not collapse to Décor).

---

## Browser acceptance (serving SHA)

```bash
EXPECTED_SHA=bc21e105c9091fc446954717e980afab4e0008be \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
→ GREEN — 32 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run-bc21e105.log`, `persisted-state.json`, `shots/01`–`08`.

| Area | Result |
|---|---|
| Ceremony + Catering categories selectable | PASS |
| Always on the package vs Couple's choices headings (no “Included”) | PASS |
| No “Add a primary question” CTA | PASS |
| Catalog always-on covered + template-only $150 additional charge | PASS |
| Buffet/Plated from Offering dropdown; child checklists | PASS |
| Ceremony Arbor/Arch + Runner/Petals as two choice sets | PASS |
| Save / reopen preserves Offering structure | PASS |
| Preview: Buffet vs Plated child paths; incomplete rejected; complete accepted | PASS |
| Server validate / finalize integrity / snapshot immutability / no dupes | PASS |
| 390px readable | PASS |

### Human usability (screens)

- Always-on vs Couple's choices are separate sections with clear headings.
- Covered vs additional charge is distinct on always-on lines.
- Couple's choices use Offering dropdowns (no question builder).
- Parent Offerings show child checklists for package membership.
- Ceremony standalones work without a parent Offering.
- Preview shows path-dependent choices and validation copy couples see.

---

## Remaining limitations

- Specialist selection rules remain available for rare cross-group cases (collapsed).
- Tip deploy of harness-only follow-ups after `bc21e105` may still be completing; product acceptance is on the verified serving SHA above.

Production untouched.
