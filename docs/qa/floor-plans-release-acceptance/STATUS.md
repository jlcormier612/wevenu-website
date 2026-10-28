# Floor Plans — Full product re-acceptance

**Verdict: OPEN / NOT GREEN**

Prior tip GREEN (`5959df8c`) is **superseded** for release closure. Re-acceptance found a customer-facing P1 that blocks the multi-offer Event setup path for events without a Setup Profile.

## Serving (current Sandbox)

- Still serving until redeploy completes: `5959df8c9da2d6e798c25db1b9b921e1fc4a5e4a`
- Fix commit: `38b2d591f2ee7a0cad3a96a8124424dbe6837549` (Change without Setup Profile)
- Harness tip: `69f0bf7f` (local script only; product fix is `38b2d591`)
- Deploy in progress: https://github.com/jlcormier612/wevenu-website/actions/runs/40633517702

## P1 found (blocks Journey 2)

| Item | Detail |
|------|--------|
| Screen | Event Setup → Floor plans (Needs action, zero offers) |
| Observed | Only **Open Floor Plans**; no **Change for this event**. Outstanding CTA also said Open Floor Plans. |
| Consequence | Venue owner cannot reach the offer editor; multi-offer chooser cannot be set up through the natural UI. Harness failed waiting for `floor-plans-setup-template-select`. |
| Root cause | `Change for this event` was gated behind `state.usesProfile`. Manual Set up events only got Open (management). |
| Fix | Show Change for all `SETUP_EDITOR_STEPS` when Included; zero-offer readiness `nextAction` = Change for this event; outstanding button opens Change. |
| Evidence | `reacceptance/j2-offer-editor-1280.png`, `reacceptance/browser-run.log` |

## Re-acceptance progress

| Gate | Status |
|------|--------|
| Capability inventory | Written — `CAPABILITY-INVENTORY.md` |
| Unit Phase 1–5 + FP-RA | 108/108 pass (local) |
| Floor Plans setup editor unit | 14/14 pass (includes no-profile Change regression) |
| Journey 2 multi-offer on tip | **Blocked** until fix serves |
| Setup attach via UI only | Pending after tip refresh |
| Unlock via Lock Position UI | Pending after tip refresh |
| Full journey matrix + release harness | Pending on final SHA |
| Usability P0–P2 | P1 above in progress; others pending live pass |

## Commands

```bash
npx tsx --test lib/event-setup/floor-plans-setup-editor.test.ts
EXPECTED_SHA=<serving> npx tsx docs/qa/floor-plans-release-acceptance/verify-reacceptance.mts
EXPECTED_SHA=<serving> npx tsx docs/qa/floor-plans-release-acceptance/verify-release.mts
```

## Boundaries

- Sandbox only; Production untouched
- Unrelated dirty/untracked work preserved
- No Phase 6/7; EO/QBO separate
