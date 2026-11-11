# DEFECT J4-D1 — Lead Overview tour time used browser clock

**FIRST OBSERVED:** Journey 4 — Schedule Tour / Overview row after save  
**RUNTIME:** `htc-sandbox-venue-app:348` / image `a39d37f8…`

**EXPECTED:** Staff Lead Overview and Tours list show the venue timezone wall clock (America/New_York for Jen's Fancy), matching emails and `/confirm`.

**ACTUAL:** Overview showed `3:45 PM` after selecting `02:45 PM`, then `11:45 AM` after rescheduling to `10:45 AM`. Emails and public confirm page correctly showed venue-local times.

**ROOT CAUSE:** `AppointmentRow` / `TourRow` called `toLocaleTimeString` / `toLocaleDateString` without `timeZone`, so the browser (UTC-3) shifted the display by +1 hour.

**DATABASE:** Correct — `scheduled_at` stored as venue-local→UTC (`2026-09-27T18:45:00Z` = 2:45 PM EDT; later `2026-09-28T14:45:00Z` = 10:45 AM EDT). Single appointment row; no duplicates.

**PROVIDER:** N/A for display; tour emails were Resend-accepted with correct body times.

**FIX:** Route Lead Overview + Tours list through `formatVenueLocalTourDisplay` / `utcToVenueLocalParts`; pass `venue.timezone` from pages.

**TESTS:** `lib/venue/timezone.test.ts` source guards for tour-panel + tour-list.

**DEPLOY / RUNTIME AFTER FIX:** pending  
**BROWSER PROOF:** pending against post-deploy image  
**STATUS:** FIXED_AWAITING_SANDBOX_DEPLOY_PROOF
