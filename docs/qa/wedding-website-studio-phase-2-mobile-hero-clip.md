# Phase 2 — WW-AUDIT-02 Mobile / Inset Hero Clip

**Date:** 2026-08-09  
**Scope:** Studio phone frame + inset hero name clipping only. Phase 1 story centering and Phase 3 galleries untouched.

## What changed

Stacked minimal fix so couple names are readable at `scrollY=0` in Studio mobile and on published inset heroes (worst: Rustic / Estate):

| Surface | Change |
| --- | --- |
| Studio / Wizard phone chrome | `PhonePreviewFrame` — bezel no longer uses `overflow:hidden` on the whole device; scrollport owns bottom-corner clip. Explicit screen height + `container-type: size` so heroes can use frame-relative `cqh`. |
| Studio phone hero height | `.ww-phone-frame-scroll .ww-hero-min-box { min-height: min(var(--ww-hero-min-height), 78cqh) }` — caps browser-`vh` DNA inside the phone only. Desktop Live Preview and published pages unchanged. |
| Inset hero (`wedding-website.tsx`) | Photo + overlay clipped on their own absolute layers; type shell uses `overflow: visible` so tall `justify-end` titles / serif ink are not amputated by the rounded mat. |
| Left title clamp | `clamp(3rem, …)` → `clamp(2.15rem, 8cqw, 6rem)` so narrow ~359cqw frames can fit multi-line names. |

## Acceptance

| Criterion | Status |
| --- | --- |
| Studio mobile Rustic/Estate: at default scroll, couple names fully visible (no clipped first line) | **Pass** (code + unit coverage; live portal matrix = Phase 4) |
| Desktop Live Preview art direction unchanged | **Pass** (vh DNA preserved; cqh cap scoped to phone frame) |
| Published mobile inset heroes: names not cut by `overflow:hidden` mat | **Pass** (inset type layer `overflow: visible`; lower left clamp) |
| Phone bezel still reads as a phone | **Pass** (8px dark border, notch, 40px radius, scroll screen) |

## Tests

`lib/wedding-website/collection-composition.test.ts` — `describe("WW-AUDIT-02 inset / mobile hero clip")`.

## Residual (explicitly out of Phase 2)

- **Phase 3:** Magazine / Editorial / Minimal narrow gallery geometry (WW-AUDIT-03).
- **Phase 4:** Live portal Playwright matrix across Collections × surfaces.
- **WW-AUDIT-01b:** Hero type mass left vs centered welcome (intentional Collection DNA).
