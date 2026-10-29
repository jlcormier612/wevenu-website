# Event Order Template Builder UX — acceptance STATUS

**Verdict: ACCEPTED / GREEN**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

---

## Product decision (locked)

Two-section Offering-based package builder:

1. **Always on the package** — not labeled “Included.”
2. **Couple's choices** — select catalog Offerings (parents expose children); no question-first authoring.

---

## Exact serving commit (this acceptance)

| Item | Value |
|---|---|
| **Serving SHA** | `89fd85e9587138825cf4212fea9f4119fc794385` |
| ECS image | `htc-sandbox-venue-app:89fd85e9587138825cf4212fea9f4119fc794385` · PRIMARY `COMPLETED` |
| Deploy of serving tip | [40795606499](https://github.com/jlcormier612/wevenu-website/actions/runs/40795606499) — success |
| Optimistic child checkboxes tip | `bc21e105` via [40793467681](https://github.com/jlcormier612/wevenu-website/actions/runs/40793467681) |
| Follow-up tip incl. Ceremony preview harness | `018770c6` via [40794600935](https://github.com/jlcormier612/wevenu-website/actions/runs/40794600935) — success (superseded by `89fd85e9`) |
| Ceremony `SuggestedCategoryKey` | Present on tip; venue-app build green |

Prior STATUS GREEN on `bc21e105` alone is superseded — acceptance below is against the **exact current serving** SHA.

---

## Focused tests

```bash
npx tsx --test lib/event-order-templates/guided-setup.test.ts \
  lib/event-order-templates/builder-ux.test.ts \
  lib/offerings/category-identity.test.ts
→ 42 pass / 0 fail
```

---

## 1) Builder browser acceptance (Offering workflow)

```bash
EXPECTED_SHA=89fd85e9587138825cf4212fea9f4119fc794385 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
→ GREEN — 32 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run-89fd85e9.log`, `persisted-state.json`, `shots/01`–`08b`.

| Area | Result |
|---|---|
| Ceremony + Catering categories | PASS |
| Always on the package / Couple's choices (no “Included” heading) | PASS |
| No question-first CTA | PASS |
| Catalog always-on covered + template-only $150 additional | PASS |
| Buffet/Plated from Offerings; child checklists under parents | PASS |
| Ceremony Arbor/Arch + Runner/Petals | PASS |
| Save / reopen persistence | PASS |
| Preview Buffet vs Plated paths; incomplete rejected; complete accepted | PASS |
| Lower-level resolve/validate + snapshot immutability helpers | PASS (not a substitute for portal UI) |
| **390px builder workflow** (headings, interact, overflow≤8) | PASS (`mobile_390_builder_workflow_usable`) |

---

## 2) Client-facing finalization (real portal + staff UI)

Closes the gap where builder harness used validators + direct EO line inserts for “finalize.”

```bash
EXPECTED_SHA=89fd85e9587138825cf4212fea9f4119fc794385 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts
→ GREEN — 21 pass / 0 fail
```

Evidence: `portal-finalize-results.json`, `portal-finalize-run-89fd85e9.log`, `portal-finalize-persisted.json`, `shots/portal-*`, `shots/venue-*`.

| Area | Result |
|---|---|
| Portal UI incomplete submit → clear validation; no EO mutation | PASS |
| Portal UI over-max sides blocked | PASS |
| Portal UI valid Plated + Chicken submit → `submitted` | PASS |
| Staff UI `choices-create-event-order` finalize → EO lines | PASS |
| Plated path lines; Buffet/sides excluded; pricing/inclusion | PASS |
| Unrelated marker line preserved | PASS |
| Definition edit after finalize does not rewrite EO snapshot | PASS |
| Duplicate finalize / amend path — no duplicate lines | PASS |
| Incomplete finalize rejected — no partial mutation | PASS |
| Portal choices usable at 390px | PASS |

Fixture note: Choices **definition** is seeded via DB for an isolated event (same Buffet/Plated/dependent shape as the builder). **Submit and finalize are real UI** on the deployed app — not DB substitutes for those actions.

---

## Human usability (screens + interaction)

- Always-on vs Couple's choices are separate sections with clear headings.
- Covered vs additional charge is distinct on always-on / option pricing.
- Couple's choices use Offering dropdowns (no question builder).
- Parent Offerings show child checklists for package membership.
- Ceremony standalones work without a parent Offering.
- Preview and portal show path-dependent choices and validation copy.
- At 390px, builder and portal controls remain usable without horizontal overflow.

---

## Remaining limitations

- Portal finalize does not re-author the template through the library UI in the same run; it uses an equivalent ChoicesDefinition fixture, then proves the customer-facing submit/finalize path.
- Specialist selection rules remain available for rare cross-group cases (collapsed).

Production untouched.
