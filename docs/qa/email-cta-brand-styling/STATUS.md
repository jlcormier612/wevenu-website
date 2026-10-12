# HTC email CTA brand styling — STATUS

**Environment:** Sandbox only  
**Production:** Untouched  
**Status:** GREEN  
**Commit:** `fe50bcabed548a5b4b361c41abe48de6f24468ed`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38315013435  
**Serving tip:** `dpl=fe50bcabed548a5b4b361c41abe48de6f24468ed`

## Root cause

HTC-owned transactional HTML used a hardcoded solid black CTA (`background:#1a1a1a`) in `buildVenueNotificationEmail` and duplicated the same inline style in team/vendor invite templates. The public tour-booked coordinator side-effect previously sent **text-only** and bypassed the shared shell (see `docs/qa/tour-booking-email-branding/AUDIT.md`).

## Scoped fix

- Shared `lib/email/htc-cta.ts` — Heritage Sage `#5D6F5D` (`DEFAULT_PRIMARY_COLOR`).
- Venue notification builder + team/vendor invite/assignment CTAs use the helper.
- Tour-booked coordinator mail uses `buildVenueNotificationEmail` (HTML + text); date-based subjects keep CTA as “View this lead”.

## Verification

| Check | Result |
|-------|--------|
| Unit/boundary tests | PASS |
| Inquiry + tour HTML render | Sage CTA `rgb(93, 111, 93)`; no `#1a1a1a` |
| Screenshots 1280/390 | `*-preview-*.png` |
| Deployed Sandbox tip | `fe50bcab` |
| Production | Untouched |
| Unrelated work | Preserved |

Evidence: `render-proof.json`, HTML previews, screenshots.
