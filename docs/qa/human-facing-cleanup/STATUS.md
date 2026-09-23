# RCJ Human-Facing Cleanup Workstream

**Status:** PARTIAL — code + Sandbox migration GREEN; deploy `0d545ff3` in progress; browser RCJ NOT GREEN  
**Production:** untouched  
**Updated:** 2026-09-23

## This pass (`0d545ff3`)

| Layer | Result |
|---|---|
| Commit | `0d545ff31749304804cc25fa7202a5c13b6aafcb` |
| Migration `20261406000000` | Applied — [35902237823](https://github.com/jlcormier612/wevenu-website/actions/runs/35902237823) success |
| Deploy | [35902241069](https://github.com/jlcormier612/wevenu-website/actions/runs/35902241069) **in progress** at report time |
| ECS (at report) | Still `:358` / `7dc63d6f…` — not yet `0d545ff3` |
| Focused tests | 30 pass |

### Implemented
- **Email SMS consent:** Request permission by email → token page affirmative opt-in → `communication_permissions` (`email_sms_consent`). Opening email is not consent. Unsolicited SMS remains fail-closed.
- **Multi-space assignment UI:** Event create/edit use→space editor when `multi` + configured `permitted_uses`. Booking overview shows formatted lines.
- **Jen Fancy fixture:** `space_operating_mode=multi`; Barn/Garden/Bridge permitted uses set for Ceremony/Reception/Cocktail/Getting Ready.

### Browser RCJ — NOT GREEN
- Deploy image not live yet.
- Session was on **Sweet Daisy** (single Garden) — calendar correctly had **no** space filter.
- Need Jen Fancy login + post-deploy proof for SMS UI, tour times, assignment editor, multi calendar filter.

### Out of this OPEN pass
Invoice-name edit UI, named deposit mailbox, payment re-proof.

## Prior proven (payment path)
See earlier evidence under same folder (`0086371c` / pre-portal pay PNGs). Production untouched.
