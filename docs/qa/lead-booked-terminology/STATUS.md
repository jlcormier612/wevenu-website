# Lead → Booked terminology + invoice back-nav — STATUS

**STATUS:** GREEN on exact Sandbox sole RUNNING `876c9d51` / TD `:526` / task `af8590f4…`

## Audit
`docs/qa/lead-booked-terminology/AUDIT.md`

## UX decisions
- Lead booking decision: **Mark as Booked** (not Return to Booked)
- Confirm → existing `bookClient` → Client workspace
- **Open booking file** removed
- **Start booking file** left (workspace-prep without Booked)
- Event-detail **Return to Booked** left (cancelled-event restore)
- Invoice detail back:
  - Unbooked Lead → Lead (`#booking-journey-payments`)
  - Booked Client → Client
  - Global Invoices `returnTo=/invoices` → Invoices

## Implementation commits
- `51bbd4c6` `d0da47d2` `f583cd7d` `04d5df4b` — Mark as Booked + Client land
- `876c9d51` — invoice origin back-nav

## Exact sole RUNNING
- Image: `htc-sandbox-venue-app:876c9d519b63a01c0e73702a71d428a448e7767c`
- Digest: `sha256:2e5e408c5cbac21ff1c22a751c0e1ecb01ebd2654787e328cf8055ee8f89369d`
- TD: `htc-sandbox-venue-app:526`
- Task: `af8590f4d29943508b0da570f9277a5e`
- Desired/running: 1/1 PRIMARY COMPLETED
- Health: `/api/health` HTTP 200
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/36954707812 (completed/success)
- Production: untouched

## Automated tests
- `lib/invoices/return-path.test.ts` + `lib/contracts/return-path.test.ts` + `lib/leads/booking-lifecycle.test.ts` PASS

## Browser proof on `876c9d51`

1. **Unbooked Lead** Miss Piggy `20e470d8…` → Preview and send href  
   `/invoices/14e4cb27…?returnTo=%2Fleads%2F20e470d8…%23booking-journey-payments`  
   Invoice back = couple name → `/leads/20e470d8…#booking-journey-payments`  
   Not Invoices, not `/clients/`. Landed Lead workspace. Mark as Booked still present. FE, not Booked.

2. **Booked Client** Jane `b2a45f9f…` → Preview and send href  
   `/invoices/60d264f4…?returnTo=%2Fclients%2Fb2a45f9f…`  
   Invoice back = Jane name (not Invoices).

3. **Global Invoices** `/invoices` → Jane `60d264f4…?returnTo=%2Finvoices`  
   Back label **Invoices** href `/invoices`.

4. **Payment regression**
   - FE not booked Miss Piggy contract `107fcc2c…` Set up payments → `/leads/20e470d8…?setupPayments=1#booking-journey-payments`
   - Booked Ivy contract `e8485a5d…` Set up payments → `/clients/3c9ecc54…?setupPayments=1`

Overall HTC release **not** GREEN.
