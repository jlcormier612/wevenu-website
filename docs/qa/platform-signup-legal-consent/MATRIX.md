# Consent matrix (pre-fix → post-fix)

Columns: UI presentation · Server enforcement · Persisted evidence · Bypass resistance · Status

| Path | Before | After | Status |
|---|---|---|---|
| Venue activate (`/activate`) | UI ✅ server ✅ persist ✅ | Unchanged + enrollment API now requires `legalAccepted` | Compliant |
| Venue enrollment activate API | Server ❌ (Bearer could skip UI) | Server ✅ requires `legalAccepted` | Fixed |
| Venue team `/join` | N/A (no create) — welcome after login | Unchanged | Compliant (no create) |
| Client `/client/accept` | UI ❌ server ❌ persist post-welcome only | UI ✅ server ✅ persist at signup + welcome remains | **Fixed** |
| Client `/client/accept-participant` | Same gap | Same fix as couple | **Fixed** |
| Client `/client/login` | Correctly no signup consent | Unchanged | Compliant |
| Vendor `/vendor/accept` signup | UI ❌ server ❌ | UI ✅ server ✅ persist at signup | **Fixed** |
| Vendor authed claim | No create; welcome gate | Unchanged | Compliant (no create) |
| Vendor `/vendor/login` | Correctly no signup consent | Unchanged | Compliant |

## Document sets (approved)

| Audience | Terms | Privacy |
|---|---|---|
| Venue activate | `venue_terms_of_service` | `privacy_policy` |
| Couple invite | `couple_end_user_terms` | `privacy_policy` |
| Vendor invite | `vendor_end_user_terms` | `privacy_policy` |

Venue Owner **full** Welcome set still includes VSA (`terms_of_service`) + Cookie + AUP via Legal Acceptance Engine for workspace sessions — separate from activate checkbox pair. Not changed here.

## Unresolved product/legal notes

None blocking this fix. Activate continues to use Venue ToS + Privacy (not the full venue_owner engine set) — pre-existing approved activate design.
