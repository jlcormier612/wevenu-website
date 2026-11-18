# ONB-FINAL — Easy Onboarding acceptance (Sandbox)

**Verdict: GREEN** — ready for founder visual approval.  
**Date:** 2026-11-17  
**Base:** `https://app.sandbox.hellotocheers.com`  
**Serving SHA:** `9901d0b40ea7db060e06b4cc6be9be13e9e25b0c` (merge of PR #82)  
**Deploy:** [Deploy Sandbox `44201177566`](https://github.com/jlcormier612/wevenu-website/actions/runs/44201177566)  
**Disposable venue:** Garden Practice Venue `e458f434-ec00-472c-a12f-e53c10219e16`  
**Harness:** `scripts/onb-final-acceptance-capture.mjs` → `acceptance.json` **16/16 PASS**  
**Desktop copy:** `~/Desktop/HTC-ONB-FINAL/`

Production was not deployed. TS-001 remains open separately.

## A. Final polish

| Item | Result |
|---|---|
| Maya & Jordan couple photo | Seeded as same-origin `/practice/maya-jordan-couple.png` (approved Hayes asset copy under `public/practice/`). Service-role write bypasses `trg_guard_relationship_client_photo`. Seeded after sample attach; re-seeded on reset. |
| Copy spacing `business.Use` | Fixed in Practice Run shell reassurance / nav hint split (PR #80). |
| Go-live CTA | Intentionally disabled until `readyToInviteCouples`; hint explains next step (`phase-a-finish-hint`). |
| Desktop/mobile | Screenshots below; mobile Practice + Client show couple photo, no horizontal overflow. |

## B. Commit / deployment

| Step | Detail |
|---|---|
| Practice Mode ship | PR [#80](https://github.com/jlcormier612/wevenu-website/pull/80) → `8bd7f2c5` |
| Relative photo URL | PR [#81](https://github.com/jlcormier612/wevenu-website/pull/81) → `4b058319` |
| Service-role seed | PR [#82](https://github.com/jlcormier612/wevenu-website/pull/82) → `9901d0b4` |
| CI | Venue-app build + hospitality smoke required; no bypass |
| Sandbox serving | `9901d0b4…` confirmed by Deploy Sandbox `44201177566` |

## C–F. Journey results (from `acceptance.json`)

| Area | Status |
|---|---|
| Setup Hub overview | PASS |
| Bring Your Business entry | PASS (surface reachability; deep import fixtures not re-exercised this pass) |
| Guided setup presence | PASS |
| Practice enter + planning prepare/share | PASS (5 tasks seeded; practice-booked) |
| Client couple photo (loaded) | PASS (`naturalWidth` 572) |
| Client task complete | PASS |
| Client ↔ Venue messages | PASS |
| Finish → resume → reset | PASS |
| Photo after reset | PASS |
| Go-live control honesty | PASS (disabled + hint) |
| Isolation | PASS (no `booked_at`, reporting-excluded, Willow 80→80, QBO 0, real clients 0) |
| Mobile UX | PASS |

## G. Screenshots

Repo: `docs/qa/onboarding/onb-final/`  
Desktop: `~/Desktop/HTC-ONB-FINAL/`

1. `01-setup-hub-overview.png`
2. `02-bring-your-business.png`
3. `03-guided-setup.png`
4. `04-practice-welcome.png`
5. `05-venue-planning.png`
6. `06-client-portal-photo.png`
7. `07-client-planning.png`
8. `08-conversation.png`
9. `09-practice-completion.png`
10. `10-reset-restart.png` / `10b-reset-client-photo.png`
11. `11-final-readiness.png`
12. `12a-mobile-practice.png` / `12b-mobile-client.png`

## H. Final verdict

**GREEN**

Genuine remaining items (not ONB blockers):

- TS-001 typecheck baseline (separate).
- `Finish setup & go to Dashboard` stays disabled until readiness is declared — intentional.
- BYB deep import end-to-end fixtures were not re-run in this pass (entry surface verified).
- Production work not started.
