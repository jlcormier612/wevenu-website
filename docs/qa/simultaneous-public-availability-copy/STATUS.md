# Simultaneous public availability Settings copy — STATUS

**Verdict: GREEN** on Sandbox tip `ce41253c`  
**Production:** untouched  

## What changed (copy only)

- Setting title → **Allow inquiries when another event is booked**
- Clear No / Yes options with venue-fit helper text
- Important note that inquiry availability is date-based
- **How date availability works** section aligned for single- and multi-space venues
- Capacity hint, setup guide, and help article cross-references updated

## Behavior unchanged

- Default remains `allow_simultaneous_public_availability = false`
- Persistence via existing `updateAllowSimultaneousPublicAvailabilityAction`
- Inquiry occupancy logic unchanged (`isInquiryEventDateAvailable`)

## Verification

- Unit: `simultaneous-public-availability.test.ts`, `venue-controlled-availability-copy.test.ts` — PASS
- Browser: desktop 1280 + narrow 390 — toggle persist/restore, copy visible — `browser-results.json` GREEN
- Fancy flag restored to `false` after harness
