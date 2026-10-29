# Event Order Template Builder UX — acceptance STATUS

**Verdict: OPEN / NOT ACCEPTED**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

---

## Product decision (locked)

Replace the question/answer/follow-up authoring model with a two-section Offering-based package builder:

1. **Always on the package** — catalog (or template-only) items that belong without a couple choice. Not labeled “Included.”
2. **Couple's choices** — select existing Offerings from dropdowns; parent Offerings show catalog children to opt into the package; instructions + min/max rules in one place.

Prior question-builder GREEN evidence is **not** acceptance for this decision. See `REDESIGN-AUDIT.md`.

---

## Implementation progress

| Step | Status |
|---|---|
| Redesign audit (`REDESIGN-AUDIT.md`) | Done |
| Offering-package builder helpers + unit tests | Done |
| `PackageChoicesPanel` (Offering-first Couple's choices) | Done |
| Guided wizard uses panel; Ceremony suggested category | Done |
| Browser harness rewritten for Offering-first E2E | Done |
| Commit | `2f0da53ec8af3f642bb5d5ba068cda69d5e9d51a` |
| Sandbox deploy | [40790796245](https://github.com/jlcormier612/wevenu-website/actions/runs/40790796245) — **queued/in flight** |
| Serving SHA verification | Pending deploy completion |
| Browser acceptance on serving tip | Pending |

Focused unit tests: `offering-package-builder.test.ts` + `builder-ux.test.ts` — 15/15 pass.

---

## Remaining for GREEN

1. Wait for deploy `40790796245` to succeed (do not start a competing deploy).
2. Confirm ECS image contains `2f0da53e`.
3. Run `EXPECTED_SHA=2f0da53e… npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts`.
4. Capture screenshots + persisted-state evidence for Catering Buffet/Plated and Ceremony standalones.
5. Mark GREEN only when the venue-owner Offering-dropdown workflow works end-to-end.

Production remains untouched. Unrelated dirty/untracked work preserved.
