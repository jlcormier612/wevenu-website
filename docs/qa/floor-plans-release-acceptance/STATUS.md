# Floor Plans — Full product re-acceptance

**Verdict: GREEN / RELEASE ACCEPTED**

Serving tip: `38b2d591f2ee7a0cad3a96a8124424dbe6837549`  
Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/40633517702 (`conclusion=success`)  
ECS: `htc-sandbox-venue-app:38b2d591f2ee7a0cad3a96a8124424dbe6837549`  
Health: ok  
Production: Untouched

## Honest answer

A venue owner and couple can complete Phase 1–5 Floor Plans on Sandbox at `38b2d591` without developer assistance: first-use layouts, Event setup multi-offer chooser, Additional+Share collaboration (FP-RA-1), setup-member attach via UI, furniture unlock via Lock Position, flips, review flags, and seating handoff boundaries.

## P1 fixed on this tip

| Item | Detail |
|------|--------|
| Defect | **Change for this event** gated on Setup Profile → zero-offer events only saw Open Floor Plans; offer editor unreachable |
| Fix | Ungate Change for `SETUP_EDITOR_STEPS`; zero-offer outstanding CTA opens Change |
| Commit | `38b2d591` |

## Fresh evidence on serving tip

### Gap-closure reacceptance (multi-offer / attach / unlock / FP-RA-1)

```bash
EXPECTED_SHA=38b2d591f2ee7a0cad3a96a8124424dbe6837549 \
  npx tsx docs/qa/floor-plans-release-acceptance/verify-reacceptance.mts
# → 13/13 PASS · UX blockers/p2=0
```

### Full release journey harness

```bash
EXPECTED_SHA=38b2d591f2ee7a0cad3a96a8124424dbe6837549 \
  npx tsx docs/qa/floor-plans-release-acceptance/verify-release.mts
# → 27/27 PASS · UX blockers=0 · confusing=0
```

### Units

```bash
npx tsx --test lib/floor-plans/*.test.ts lib/event-setup/floor-plans-setup-editor.test.ts
# → included in 149/149 combined Phase + Choices unit run
```

## Setup-member & furniture-unlock findings

| Concern | Finding |
|---------|---------|
| Setup attach DB assist | **Fixture/harness only.** Customer path: Organize wedding setups → Attach layout select. Proven UI-only on tip (`setup_members_attached_via_ui_only`). |
| Furniture unlock DB fixture | **Intentional template lock.** Customer unlock: select object → uncheck Lock Position (persists). Proven on tip (`furniture_unlocked_via_venue_editor_ui`). |

## Evidence paths

- `reacceptance/` — multi-offer, attach, unlock, FP-RA-1
- `browser-results.json`, `browser-run.log`, `shots/` — full release
- `CAPABILITY-INVENTORY.md`

## Boundaries

- Sandbox only; Production untouched  
- Unrelated dirty/untracked work preserved  
- No Phase 6/7; EO/QBO separate  
