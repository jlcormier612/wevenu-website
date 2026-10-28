# Offerings multi-parent catalog display — STATUS

**Verdict: OPEN (NOT GREEN)** — fix committed; awaiting Sandbox deploy + browser acceptance.

## Root cause
Persisted `offering_major_links` for Whiskey already had both parents (Guest Paid Bar Offering + Premium open bar). The catalog list helper `orderOfferingsHierarchically` nested multi-parent items **once** under the first parent by name, so Whiskey only appeared under Guest Paid Bar Offering.

## Fix
Emit one list placement under **each** associated major (same Offering record; unique React keys via `offeringId::parentId`).

## Commit
Pending — see git tip after commit of this change set.

## Next
1. Deploy Sandbox tip SHA
2. `EXPECTED_SHA=<sha> npx tsx docs/qa/offerings-multi-parent/verify-browser.mts`
3. Confirm Whiskey (Meadowbrook) appears under both majors after reload

## Production
Untouched. Unrelated dirty work preserved.
