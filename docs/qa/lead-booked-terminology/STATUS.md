# Lead → Booked terminology + invoice back-nav — STATUS

**STATUS:** OPEN — invoice back-nav implemented locally; awaiting Sandbox deploy + browser proof of the three invoice origins. Terminology Mark as Booked already GREEN on `04d5df4b`.

## Audit
`docs/qa/lead-booked-terminology/AUDIT.md`

## UX decisions
- Lead booking decision: **Mark as Booked** (not Return to Booked)
- Confirm → existing `bookClient` → Client workspace
- **Open booking file** removed (not a distinct destination)
- **Start booking file** left (workspace-prep without Booked)
- Event-detail **Return to Booked** left (cancelled-event restore)
- Invoice detail back:
  - Unbooked Lead origin / fallback → Lead (`#booking-journey-payments`)
  - Booked Client origin / fallback → Client
  - Global Invoices `returnTo=/invoices` → Invoices
  - Label uses couple name when present, else **Lead** / **Client** / **Invoices**

## Files
- `lib/invoices/return-path.ts` + test
- `components/invoices/invoice-detail.tsx`
- `app/(app)/invoices/[id]/page.tsx`
- `components/booking-journey/setup-payments-sheet.tsx`
- `components/booking-journey/commercial-facts.tsx`
- `components/booking-journey/booking-journey-panel.tsx`
- `components/leads/lead-detail.tsx`
- `app/(app)/clients/[id]/page.tsx`
- `components/events/event-detail.tsx`

## Automated tests
- `lib/invoices/return-path.test.ts` PASS
- `lib/contracts/return-path.test.ts` PASS (payment nav)
- `lib/leads/booking-lifecycle.test.ts` PASS

Production untouched. Overall HTC release not GREEN.
