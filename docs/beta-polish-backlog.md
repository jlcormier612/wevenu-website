# Beta Polish Backlog

**Real findings, deliberately parked.** None of these block a venue from running their business, so none of them block Beta. This is the list to return to once Stripe (Sprint 4) ships. Source: the First-Week Experience Audit (2026-07-21).

Each item needs a product decision, not just a code fix — that's why it's parked here instead of already fixed.

## Onboarding / Setup

- **No visible signup path.** `/` → `/dashboard` → `/login` ("Welcome **back**," no "Create account" link anywhere). `signIn()` in `app/auth/actions.ts` has no `signUp` counterpart. `/join?token=` is staff-invitation-only. May be intentional (account creation via the marketing site/Stripe checkout) — needs confirmation either way.
- **Two-stage Payments UX.** The in-wizard "Payments" step is a disabled "coming soon" placeholder; immediately after venue creation, a second, fully-functional Stripe+QuickBooks screen appears. Could read as broken/duplicated rather than deliberate two-stage design.
- **Duplicate Packages surfaces.** `/packages` ("Packages & Inventory") and `/library/packages` ("Package Templates") render the same list/form with different headers implying a distinction that doesn't exist.
- **Duplicate Contracts surfaces.** `/contracts`, `/contracts/templates`, `/library/contracts` — three near-duplicate surfaces; the code has a comment acknowledging one as an "isolated-implementation duplicate."
- **Questionnaire has no discoverable venue-side surface.** Reachable only 3 levels deep (Events → open event → Booking Documents tab); no venue-side way to customize the question set.

## Client Journey / Operations

- **No "Proposal" feature exists.** "Proposal Sent" is only a pipeline-stage label. The "Send proposal" next-action preset routes straight to the Contract module — no pricing/quote step before the binding legal document.
- **Contract "Send for Signing" has no in-app email-send action** — only generates a link the coordinator must manually copy/send, unlike Invoices which do have a real in-app "Email" button.
- **"Mark as Sent" and "Email" are disconnected on a plain (non-Event-Order-linked) invoice.** Confirmed in code: Event-Order-linked invoices already auto-transition to "sent" on email (a deliberate Phase 3b decision); plain drafts explicitly don't, per an existing code comment. Worth revisiting whether that scoping should be widened — but it's a Booking Financial Architecture decision, not a copy fix.
- **Event "Complete" status doesn't trigger anything user-visible.** No Luv celebration exists for it (only `contract_signed`, `final_payment_received`, `guest_list_submitted`, `timeline_submitted`, `website_published`); the Feedback tab is gated on event date, not status. Marking an event "Complete" is currently a near-total dead end from the venue owner's perspective.

## Already fixed (2026-07-21), not part of this backlog

For reference — these First-Week Experience findings were low-risk enough to fix immediately rather than park: the "Brand colors" description mismatch, the Blocked Dates missing empty state, the unexplained "Client may add items" checkbox, the Invoice "Email" button's silent mailto fallback, and the Send Invite / Assign Vendor conflation. See `docs/terminology-standardization-report.md` for the parallel terminology fixes from the same pass.
