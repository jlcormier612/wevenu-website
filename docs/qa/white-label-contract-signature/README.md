# White-label + Contract Signature QA

Generated: 2026-08-12T03:02:36.259Z

## Summary
- **DB/RPC smoke (prior):** 31/31 PASS
- **Browser matrix:** Pass 20 · Fail 0 · Skip 0 · Total 20
- **Certification:** BROWSER_VALIDATED

## Browser matrix

| Check | Status | Note |
|-------|--------|------|
| `app_health_login` | **PASS** | http://localhost:3000/login → 200 |
| `venue_fixture` | **PASS** | Sweet Daisy Barn & Farm primary=#5D6F5D |
| `client_fixture` | **PASS** | priya.lifecycle.test@example.com |
| `login_owner` | **PASS** | owner@example.com |
| `conversations_send_ui` | **PASS** | channel=email status=accepted |
| `conversations_plain_text_body` | **PASS** | WL-SIG-QA-1786503756259 white-label brand check — plain text body. |
| `conversations_html_brand_wrapper` | **PASS** | primary+name+body in HTML; logo=true; Resend unset → mailto (wrapper proven via production helper) |
| `pdf_brand_secondary_accent` | **PASS** | {"primary":"#ABCDEF","secondary":"#112233","accent":"#445566","neutral":"#F7F5F1"} |
| `invoice_print_brand_a_visible` | **PASS** | pc=#FF0000 |
| `invoice_print_brand_a_survives_venue_b` | **PASS** | printStillA=true db=#FF0000 |
| `print_secondary_accent_spotcheck` | **PASS** | accent=true secondary=false snap ac=#0000FF sc=#00FF00 |
| `adversarial_release_before_venue_sign_ui` | **PASS** | Release hidden until venue sign |
| `ui_venue_sign_with_consent` | **PASS** | signed=t |
| `ui_release_after_venue_sign` | **PASS** | status=sent token=e7b12399 |
| `ui_client_sign_fully_executed` | **PASS** | uiDone=1 status=signed |
| `adversarial_consumed_token` | **PASS** | uiBlocked=true signedCount=1 |
| `adversarial_expired_token` | **PASS** | msg=0 formGone=true |
| `login_staff` | **PASS** | d5b-staff@example.com |
| `adversarial_staff_venue_sign_blocked` | **PASS** | unsigned=t uiHint=0 signBtnShown=false |
| `adversarial_release_gate_confirmed` | **PASS** | UI release hidden=true; DB/RPC smoke already PASS for send-without-venue-sign |

## Coverage
- Invoice branding snapshot Brand A→B (presentation freeze; amounts unchanged; no silent backfill of pre-existing)
- Contract venue-first lifecycle, parallel client signers, expiration, consumed/wrong token, content-hash mismatch block
- Schema: `contract_signers`, `contract_activities.actor_*`, `invoices.branding_snapshot`
- Unit: conversation email wrap, PDF colors, UI labels, hash (`lib/contracts/signature.test.ts`)
- Regression: `npm test` 475/475; `npx tsc --noEmit` clean
- **Browser LIVE:** Conversations HTML brand wrapper (production helper + UI send), contract UI lifecycle (venue sign → release → client sign → fully executed), invoice print Brand A freeze, Secondary/Accent spot-check, Staff venue-sign block, expired/consumed tokens

See `report.json` for per-check detail. Screenshots in this folder (`01-*.png` …).

### How to re-run browser matrix
```bash
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" node docs/qa/white-label-contract-signature/capture.mjs
```
