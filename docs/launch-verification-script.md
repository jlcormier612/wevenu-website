# Launch Verification Script

Two documents in one, per their different audiences and purposes:

- **Demo Flow** — the polished customer-facing presentation. Run this to show someone what Wevenu does.
- **Verification Flow** — the QA checklist. Run this to confirm Wevenu actually works. Every box gets checked, on real devices, by a real person — nothing in this environment can execute either flow, only author it.

Neither has ever existed as a literal, runnable document before this sprint — prior reconciliations referenced "the 5 mobile scenarios" and "the fixed demo script" only as one-line category labels (confirmed by a full-repo search, Sprint 2). This is the first time either has been written down step by step.

---

## Demo Flow

The narrative a coordinator would walk a prospective venue through, start to finish. Each step should feel inevitable — the next obvious thing to do, not a feature tour.

1. **Create a lead.** Submit a real inquiry through the venue's own public tour-booking widget (not the coordinator app) — this is the actual path a couple uses. Show the Lead landing in the pipeline with its real source attribution.
2. **Book a tour.** From the Lead, schedule a tour. Show the couple's confirmation email (real send, not a mock) and the venue's own calendar reflecting it.
3. **Send a proposal.** Move the Lead through the pipeline to Proposal. (If no formal Proposal artifact exists yet — see `docs/platform-status-snapshot.md`, this is deferred product evolution — substitute: share pricing/packages directly in a Conversation message.)
4. **Send a contract.** Generate and send a contract for signature. Open the couple-facing sign link in a separate browser/incognito session and actually sign it — show the resulting audit trail (signer, timestamp, IP, consent).
5. **Collect a payment.** Record a real deposit against the booking's payment schedule. Show the invoice balance update live.
6. **Show planning.** Open the Couple Portal as the couple would see it — Guest List, Seating, Timeline, Documents — branded in the venue's own colors and logo (RC1).
7. **Show vendor collaboration.** From the Booking Workspace, assign a real vendor to the event, set their arrival time and an agreed fee, and send them a message. Switch to the Vendor Portal (a second login) and show the vendor's own event workspace: the same conversation, the shared floor plan, their payment summary ("what am I being paid, has it been paid").
8. **Show the event itself.** Open the Event view — Timeline, Floor Plan, Guest List — as the operational source of truth for wedding day.
9. **Show a review/referral request.** Trigger (or show the disabled-by-default toggle for) the Event.Completed automation that sends a post-event review/referral nudge.

Total runtime target: under 20 minutes, uninterrupted. If any step requires an apology ("this part's still a little rough"), that step isn't ready for this flow — pull it and note it in `docs/platform-status-snapshot.md` instead of demoing around it.

---

## Verification Flow

The QA checklist. Every box below needs a real device, a real authenticated session of the stated type, and a real pass/fail — not "looked fine at a glance."

### Devices
- [ ] **Mobile** (real phone, ~375–428px width, not a resized desktop browser)
- [ ] **Tablet** (real tablet, ~768–1024px width)

### The 5 mobile scenarios (defined this sprint — see `docs/sprint2-vendor-certification-report.md` for why these five)
- [ ] **Scenario 1 — Couple manages the guest list and RSVPs from a phone.** Open Guest List in the Couple Portal on a real phone. Add a guest, change an RSVP status, mark an invitation ready/sent, edit a guest's details, delete a guest. Confirm the row's action menu (Sprint 2: Copy Link / Edit / Delete collapsed behind a "⋯" button) is actually reachable and tappable.
- [ ] **Scenario 2 — Vendor checks in on wedding day, views a shared floor plan, and messages the venue from a phone.** Log in as a vendor on a real phone. Open an assigned event, open the Floor Plans tab, open a shared plan (confirm the SVG canvas renders and Print/Save-as-PDF works), send a message to the venue.
- [ ] **Scenario 3 — Coordinator checks the calendar and today's payments from a phone/tablet on-site.** Open the Calendar month view and a Payment Schedule detail on a tablet. Confirm both are legible and usable, not just "technically not broken."
- [ ] **Scenario 4 — Couple submits their seating chart from a phone.** Open Seating in the Couple Portal on a real phone (regression check on Sprint 1's fix). Drag or tap-select a guest, assign them to a table, submit the plan.
- [ ] **Scenario 5 — Vendor uploads an attachment and completes a task from a phone.** Log in as a vendor on a real phone. Attach a file (e.g. a certificate of insurance) to a message. Open the Tasks tab, add a personal task with a due date (Sprint 2: confirm the date field no longer crushes the title field), complete a venue-assigned task.

### Logins (one real session per role, not assumed from code review)
- [ ] **Vendor login** — receive a real invitation email, claim the profile, land on the dashboard with real data (Sprint 2: this previously 404'd/returned empty for every vendor; confirm it doesn't anymore)
- [ ] **Couple login** — real portal token, real session
- [ ] **Coordinator login** — real venue_staff session, confirm role-based UI (Owner vs. Manager vs. Coordinator) matches expectations

### Features
- [ ] **Attachments** — upload/download on venue, couple, and vendor sides
- [ ] **Messaging** — send/receive across email, SMS, portal, and internal-note channels; confirm delivery status (sent/failed) is honest, not assumed
- [ ] **Invoices** — generate, view, mark paid, confirm balance recalculates correctly
- [ ] **Exports** — run a real data export and confirm the file opens and contains real data
- [ ] **Floor plans** — create, edit, share with vendors, print/download
- [ ] **Search** — global search returns Conversations, Requests, Documents, Payments, Couples, Vendors, Guests, Event Orders — not just one category
- [ ] **Notifications** — a real email/SMS actually arrives (check an inbox/phone, not just a "sent" log line)
- [ ] **Automations** — trigger the Event.Completed review/referral nudge and confirm it fires only when explicitly enabled (disabled-by-default, per the approved design)

### Sign-off

This script is complete when every box above is checked by a real person, on real devices, with the date and checker's name recorded here:

- Checked by: _____________
- Date: _____________
- Notes / follow-ups: _____________
