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
| Sandbox deploy + serving SHA verification | Pending |
| Browser acceptance on serving tip | Pending |

---

## Remaining for GREEN

1. Commit scoped changes and deploy to Sandbox only.
2. Confirm ECS image SHA.
3. Run `verify-browser.mts` (and portal finalize if still applicable) against that SHA.
4. Capture screenshots + persisted-state evidence for Catering Buffet/Plated and Ceremony standalones.
5. Mark GREEN only when the venue-owner Offering-dropdown workflow works end-to-end.

Production remains untouched.
