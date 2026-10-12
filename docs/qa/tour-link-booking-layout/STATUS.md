# Tour-link copy + Booking Details layout

**Tip (this change):** `dc1bda28c53b27c292cae52afbf1b708981498d6`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/38200308443  
**Production:** untouched  

## Copy changes (exact)

### Calendar → Tour availability
> Already working with someone? Use the personalized scheduling link that resides in their lead record, under 'Follow-up'. That will preserve any preferred date holds and other previously gathered information.

### Lead → Follow-up
> Use this personalized scheduling link for this lead. The Calendar page's **Copy tour link** is a general link for new prospects only.

## Booking Details root cause

Package facts sat in `min-w-0` beside a `shrink-0 flex-wrap` action column that also contained a long `basis-full` tax/discount locked hint. That helper claimed horizontal space and crushed the package column into a few characters per line.

**Fix:** facts use `flex-1 min-w-0`; actions stay `shrink-0` with a modest max width; locked hint renders as a full-width sibling under the row (not inside the action flex).

## Files

- `components/calendar/share-tour-availability.tsx`
- `components/leads/tour-panel.tsx`
- `components/booking-journey/commercial-facts.tsx`
- `lib/tours/existing-lead-tour-context.test.ts`
- `lib/booking-journey/booking-details-layout.test.ts`
- `scripts/qa/tour-link-copy-and-booking-layout-browser.mts`

## Tests

Unit: 14/14 related suites PASS (tour context + booking layout + tax discoverability).
