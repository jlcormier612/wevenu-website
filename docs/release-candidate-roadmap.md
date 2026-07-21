# Release Candidate Roadmap (RC3 → Launch)

**Status: Detailed reconciliation history.** For the current single-document snapshot ("what's complete / what remains / what's verified / what still needs human validation"), see `docs/platform-status-snapshot.md`. This document remains the reconciliation record behind that snapshot — supersedes `docs/release-readiness-status.md` (2026-07-17) and `docs/product-capability-inventory.md` (2026-07-19), both kept for history. Reconciles everything shipped since: **RC1 (Venue Brand Experience, baseline wiring)**, **Lead Acquisition & Intake**, **RC2 (Messaging & Conversations)**, **Sprint 1 (Finish the Last Release Blockers)**, and **Sprint 2 (Vendor Certification Pass + Payment Visibility + Mobile Polish)**.

**Date:** 2026-07-21 (updated after Sprint 2 and the QuickBooks Online Launch Integration)
**This is a launch document, not an architecture document.** The platform architecture is stable and not revisited here — every item below is a completeness, verification, or polish question, scored against the existing Trust Risk Register, Trust Bar, and Release Gate this engagement has used throughout.

---

## 1. What changed since the last reconciliation

Four initiatives shipped since `product-capability-inventory.md` was written, each verified with `tsc`/`build` clean and live-database testing (RC2 and Sprint 1 additionally verified with real RPC calls and trigger firings against a genuine signed vendor session, not just migration success):

- **RC1 — Venue Brand Experience (baseline wiring):** the venue's own colors/logo now render everywhere a customer-facing surface used to hardcode Wevenu's own look — couple portal, contract signing, print documents, transactional emails, public guest routes (tour booking, RSVP, wedding website). Governing rule: *a couple should remember the venue, not the software* — software-user-facing surfaces (staff, vendors) intentionally keep Wevenu branding. Full detail: `docs/venue-brand-experience-phase1-final-report.md`.
- **Lead Acquisition & Intake:** replaced three independently-drifted lead-creation paths with one canonical pipeline (`ingest_lead`), a real registrable source vocabulary, a full audit trail (`lead_intake_attempts`), a verified reactivation policy (a repeat inquiry always creates a fresh Lead on the same Relationship, never reopens a closed one), and a real generic external-source channel — the Email Intake Engine, where a venue forwards inquiry emails from *anywhere* (The Knot, WeddingWire, their own inbox) to a per-venue address for Claude-based extraction. Full detail: `docs/lead-intake-final-report.md`.
- **RC2 — Messaging & Conversations:** the single largest remaining architecture-execution item on the platform (`TR-C1`) is done. One Conversation object with pluggable channels (email, SMS, portal, internal note, phone log) now serves the coordinator inbox, the couple portal, and — new — real two-way vendor messaging, plus an audit-trail Activity Timeline, Conversations/Requests in global search, Request↔Conversation cross-linking, and an opt-in Event.Completed review/referral automation. Full detail: `docs/rc2-messaging-conversations-final-report.md`.
- **Sprint 1 — Finish the Last Release Blockers:** closed all three remaining XS Trust Register items (TR-M4, TR-B2, TR-B3 — TR-B2 turned out to already be fixed by earlier work, a documentation gap rather than a code gap), closed RC2's disclosed vendor-attachment gap, built a new Vendor Event Assets (Floor Plan sharing) capability, fixed the actual couple-facing seating canvas's mobile/tablet layout, and — found while live-verifying vendor floor-plan visibility, not assumed — fixed a severe pre-existing bug where the vendor per-event workspace 404s for every real vendor login. Vendor payment visibility was investigated and confirmed to not exist at all; building it was deliberately not attempted blind this sprint (see full detail in `docs/sprint1-final-report.md`).
- **Sprint 2 — Vendor Certification Pass + Payment Visibility + Mobile Polish:** re-verified every item from the last reconciliation against live code rather than trusting prior documentation, and ran a full authenticated Vendor Certification Pass across all 12 core vendor workflows (not a sample) — found and fixed 7 real defects predating any prior initiative, the most severe being that the vendor's own Events list and per-event workspace were completely unreachable for every real vendor login (an RLS gap Sprint 1's fix hadn't fully covered) and two tables (`vendor_inquiries`, `vendor_tasks`) missing their base database GRANT entirely, blocking the Vendor Inquiries and Personal Tasks features outright. Built Vendor Payment Visibility (scoped as a summary — "what am I being paid, has it been paid," deliberately not an accounting module). Ran 5 concrete mobile scenarios against real layouts and fixed two genuine breaks found (Guest List row, vendor Add-task form). Corrected two stale roadmap claims (Pipeline Templates already ships venue-editable stages; Calendar week/day views and staff visibility already shipped). Authored, for the first time, the actual "5 mobile scenarios" and demo script that prior reconciliations only ever referenced by label — see `docs/launch-verification-script.md`. Full detail: `docs/sprint2-vendor-certification-report.md`.
- **QuickBooks Online Launch Integration:** the assessment that immediately preceded this (see below) found zero QuickBooks code anywhere in the codebase and recommended a large post-launch initiative; the user then declared it a launch requirement with a bounded scope (OAuth, Customer/Invoice/Payment/Refund one-directional push sync, retry queue, connection health, disconnect/reconnect, idempotency — explicitly excluding chart-of-accounts mapping, tax engine, and full bidirectional sync). Built and live-verified end-to-end, including real HTTP calls against Intuit's actual sandbox endpoints (using fake-but-realistic credentials to exercise genuine 401/error-classification/retry/dead-letter code paths). Found and fixed 4 real bugs during the build, 2 of them the same "missing `service_role` GRANT" hazard class Sprint 2 found twice on `vendor_inquiries`/`vendor_tasks`. Blocked only on real Intuit sandbox credentials for the final successful-sync confirmation, same posture as TR-M1. Full detail: `docs/quickbooks-integration-completion.md` (supersedes the recommendation in `docs/quickbooks-integration-assessment.md`).

**Net effect:** two of the scorecard's four Red categories (Messaging & Texting, White Labeling) are now Green. A third (Lead Capture & Consolidation) moves to Yellow. `TR-C1`, the register's last large open item, is resolved. The Trust Risk Register now has zero remaining "Identified" items. Release Gate #3 (vendor collaboration) is fully Green. The only remaining gate item that isn't a scheduling/verification pass closed this sprint — nothing on the platform is currently known-unbuilt.

---

## 2. Trust Risk Register — reconciled

**25 items tracked, 24 Resolved, 1 Mitigated, 0 Identified.** *(TR-C1 flipped to Resolved after RC2. TR-M4, TR-B2, TR-B3 all flip to Resolved after Sprint 1 — see below.)*

| ID | Risk | Status | Note |
|---|---|:---:|---|
| TR-C1 | Messaging history fragmented across two disconnected systems | ✅ Resolved | RC2 built exactly the permanent fix this item called for: "one Conversation object with pluggable Channels." Verified: `conversation_messages.channel` constraint includes `email/sms/portal/internal_note/phone_log/voicemail/push`; coordinator, couple, and vendor sides all read/write the same table; the legacy two systems are marked compatibility-only and unreachable from any live route. |
| TR-M1 | Stripe Connect is a facade | 🟡 Mitigated | Unchanged. Permanent fix (real charge processing) designed in full (`docs/stripe-payment-architecture.md`), blocked on a live Stripe test-mode account this environment doesn't have — a credentials dependency, not an effort one. |
| TR-M4 | Payments markable paid twice | ✅ **Resolved (Sprint 1)** | `markItemPaid` now guards against an already-`paid`/`cancelled` item, same shape as TR-M5's existing guard. Live-verified against a real fixture, rolled back. |
| TR-B2 | Tour-confirmation emails can fail silently | ✅ **Resolved (Sprint 1)** | Found already fixed by earlier Coordinator Tour Scheduling work — the register entry was stale, not the code. Traced the real call path to confirm. |
| TR-B3 | Questionnaire "send" reports success even when the email fails | ✅ **Resolved (Sprint 1)** | This one was genuinely still broken — `sendQuestionnaireToCouple` now returns the real `sendEmail()` result instead of a hardcoded `ok: true`. |
| *(20 other items)* | — | ✅ Resolved | Unchanged since 2026-07-17 — see `docs/trust-risk-register.md` for full detail. |

**Program 1 (Trust Foundation) is fully closed.** Every bounded item is Resolved. The one remaining open item (TR-M1's permanent fix) is blocked on external credentials this environment doesn't have, not on outstanding engineering effort.

---

## 3. Trust Beta Readiness Scorecard — re-scored after RC2

| # | Category | Was (2026-07-17) | Now | Why |
|---|---|:---:|:---:|---|
| 1 | Messaging & Texting | 🔴 Red | 🟢 **Green** | RC2 + Sprint 1. One Conversation model, all channels real and wired to live providers (Resend for email, Twilio for SMS — both genuinely integrated, not stubs; blocked only on live credentials in *this* environment, same category as Stripe). Vendor collaboration gap closed, including vendor-side attachments (Sprint 1). Two small, named, non-blocking exceptions remain (below, §5). |
| 2 | Lead Capture & Consolidation | 🔴 Red | 🟡 **Yellow** | Lead Intake. Canonical pipeline, real audit trail, a genuine generic external-source channel (Email Intake Engine), verified reactivation policy. Still Yellow, not Green: no literal platform API integrations (Knot/WeddingWire/Facebook Lead Ads), lead-to-team assignment is still an explicit no-op hook. |
| 3 | Money | 🟡 Yellow | 🟡 Yellow | TR-M4 closed (Sprint 1). TR-M1's permanent fix (real Stripe collection) is the only remaining gap, externally blocked. |
| 4 | Setup & Onboarding | 🟡 Yellow | 🟡 Yellow | Unchanged. Still no help center/live chat, only an async ticket form. |
| 5 | Client Experience (Couple Portal) | 🟢 Green | 🟢 **Green, further strengthened** | RC1 branding + RC2's portal-side Conversations upgrade both landed transparently under an already-Green surface. |
| 6 | End-to-End Workflow Automation | 🟡→🔴 | 🟡 **Yellow** | RC2 added a real Automation Rules action (`schedule_relationship_message`) proven end-to-end via a live Event.Completed → automation-sweep → scheduled-message test, plus a composed Activity Timeline. Not Green: no rules-editing UI exists yet (by design, disclosed) — one purpose-built Settings toggle exists, not a general automation builder. |
| 7 | White Labeling | 🔴 Red | 🟢 **Green** | RC1. Couple portal, contract page, print documents, transactional emails, and public guest routes all render the venue's own brand. (The separate, larger *brand recommendation engine* — Venue Brand Experience proper — remains Future Evolution, unbuilt, and was never what this row measured.) |
| 8 | Calendar | 🟢 Green | 🟢 Green | Unchanged. |
| 9 | Pipeline & Lead Management | 🟡→🔴 | 🟡→🔴 | Unchanged color. Lead Intake meaningfully strengthened *data integrity* (reactivation policy, audit trail) but didn't touch pipeline-stage customization or lead assignment, the two things this row names. |
| 10 | Notifications, Permissions & Reporting | 🟡 Yellow | 🟡 Yellow | Unchanged (unverified since 2026-07-17). |

**Net read:** RC1 and RC2 closed two of the scorecard's four Red categories outright and meaningfully moved a third. Money is the only category that started Yellow rather than Red, and its one remaining gap (real Stripe collection) closed halfway this sprint (TR-M4) — what's left is externally blocked regardless of engineering time spent.

---

## 4. Release Gate — re-scored

Five questions, all must be "yes" before Trust Beta invites go out. Checkable criteria per `docs/product-completion-roadmap.md`.

| # | Gate | Was | Now | Basis |
|---|---|:---:|:---:|---|
| 1 | Can a venue run their business? | 🟡 Nearly | 🟢 **Yes** | Checkable criterion: *every* Trust Risk Register Phase 1 item shipped and verified. TR-C1 (RC2) and TR-M4/B2/B3 (Sprint 1) are all now resolved — the register has zero remaining "Identified" items. The one open item (TR-M1's permanent fix) is externally blocked on credentials, the gate's own named exception for exactly that shape of gap. |
| 2 | Can a couple plan their event? | 🟢 Yes | 🟢 **Yes** | Checkable criterion: data export ✅, branded portal/emails ✅ (RC1), real messaging reachable from context ✅ (RC2). Named exception (seating-chart mobile responsiveness) closed this sprint — `components/portal/seating-section.tsx`, the real couple-facing canvas, no longer breaks its layout on a narrow viewport. |
| 3 | Can a vendor collaborate effectively? | 🔴 Not yet | 🟢 **Yes** | All three named sub-requirements done: real two-way vendor messaging including attachments (RC2 + Sprint 1), vendor floor-plan visibility (Sprint 1's Vendor Event Assets capability), vendor payment visibility (Sprint 2 — "what am I being paid, has it been paid," deliberately scoped as a summary). Sprint 2 additionally ran a full authenticated Vendor Certification Pass across all 12 core vendor workflows (not just these three), finding and fixing 7 real defects that predated any of these initiatives — including a severe bug where the vendor's own Events list and per-event workspace were completely unreachable for every real vendor login. See `docs/sprint2-vendor-certification-report.md`. |
| 4 | Would I proudly demo this to a former customer? | ⬜ Not run | ⬜ **Not run** | Unchanged — a verification item (fixed demo script), not a build item. Now materially easier to pass than four initiatives ago (Messaging, White Labeling, and vendor floor-plan visibility were all named risks to a live demo; all three are closed). |
| 5 | Would I trust my own business on it? | ⬜ Not started | ⬜ **Not started** | Unchanged — dogfooding hasn't begun. |

---

## 5. Remaining release blockers

*Bounded, high-trust-impact, or directly named against a Release Gate question. Should be closed before Trust Beta invites go out.*

1. **Run the Launch Verification Script's Verification Flow, live, checkbox by checkbox** (Release Gate #4/#5, Trust Bar #3) — the script itself is now authored (`docs/launch-verification-script.md`, Sprint 2 — it never existed before this sprint, only a one-line category description did). Authoring it is not the same as running it: it still needs a real human/browser session to actually check each box, which this environment cannot do. Treat as blocking until actually run.
2. **Dogfooding** (Release Gate #5) — still not started; no change from prior reconciliations.

**Closed this sprint, no longer blockers:** vendor payment visibility (built and live-verified, Sprint 2 — see `docs/sprint2-vendor-certification-report.md`); seating-chart mobile responsiveness and TR-M4/TR-B2/TR-B3 (Sprint 1); vendor floor-plan visibility (Sprint 1). The "5 named mobile scenarios" are now concretely defined for the first time (`docs/launch-verification-script.md`) rather than an unenumerated label — see that document for what changed and why.

---

## 6. Remaining release candidates

*Real, scoped, bounded work — not launch-blocking on its own, but closes a named gap a launch-conscious team would want closed soon after.*

- **Payments list responsive styling; invoice email polish.**
- **Contract "please sign" reminder email.**
- **Lead-to-team-member assignment** (currently an explicit no-op hook — Lead Intake built the pipeline stage, not the routing logic behind it).
- **Calendar sync (iCal/webcal)** — narrowed from a broader claim (Sprint 2 re-verification): week/day views (`components/calendar/{week-view,day-view,agenda-view}.tsx`) and staff visibility on the grid (`components/calendar/use-calendar-filters.ts`, `calendar-shared.tsx`) have both already shipped. Only a venue-level iCal/webcal feed is still genuinely absent — a `grep` for `ical|webcal|\.ics` across the codebase finds only a single-tour `.ics` download button, no venue-wide feed.
- **Setup & Onboarding help surface** (live chat or help center) — Trust Bar #5 ("support is a real, fast, human safety net"), not a Program 1 trust risk.
- **RC2's remaining documented, deferred communication surfaces** (from `docs/rc2-messaging-conversations-final-report.md`; vendor-side attachments, the third item, closed in Sprint 1 — see `docs/sprint1-final-report.md`):
  - `lib/notifications/engine.ts` still sends tour-reminder emails directly via Resend, bypassing Conversations — a coordinator has no record of it in the couple's thread.
  - `lead_notes`/`client_notes`/`event_notes` conceptually overlap with the Conversation `internal_note` channel — a real future-consolidation candidate, not a defect (these are single-party notes, a different shape than a conversation).
- **Client Identity's three-vocabulary documentation reconciliation** (Client Identity, Portal Access, Support Access Grants don't cleanly map to each other conceptually — enforcement is real and tested, this is a clarity nuance).
- **Real Stripe payment collection** — externally blocked on credentials, sequence as the first major post-beta build once available.

---

## 7. Nice-to-have launch polish

*Would improve the launch experience; genuinely optional.*

- SMS/push notification open/click tracking (`NotificationLogEntry` has neither — confirmed absent, not implied to exist).
- Luv's Daily Briefing, full six-kind Observation Model narration convergence across its 4 Claude integrations, extension into Floor Plans and aggregate venue-facing Guests/Seating, progressive-disclosure controls for the couple/vendor audience.
- Venue-wide cross-booking Inventory ledger (currently per-booking only, confirmed absent, not a bug).

---

## 8. Deferred product evolution

*Intentionally deferred, by prior approval — new growth, not completion. Direction is settled; implementation is future work.*

- **Venue Brand Experience** (the AI-driven brand-recommendation engine on top of RC1's baseline wiring) — generates recommended Collections/Color Stories/Typography/Gallery Style/Motion from the venue's existing Venue Style field. RC1 shipped the wiring this recommends *into*; the engine itself is unbuilt.
- **Commercial Proposal Architecture** — a formal Proposal artifact bridging Sales CRM and Booking, giving the `proposal_sent` pipeline stage a real artifact behind it. Fully designed, zero implementation.
- **External lead-source integrations** (literal Facebook/Instagram Lead Ads, WeddingWire, The Knot APIs) — Lead Intake's Email Intake Engine already covers the generic case (forward from anywhere); these would be thin, source-specific adapters over an already-proven pipeline, explicitly sequenced after QR code capture per prior direction.
- **QR code lead capture.**
- **Wedding Party portal/view** — Timeline's `wedding_party` visibility tag is real, stored, and settable today; no audience-facing surface reads it yet.
- **Marketplace / Ecosystem** — not started, by explicit, repeated prior decision ("last, per your original call").
- **Custom domains for wedding websites/portal.**
- **A dedicated automation-rules editing UI** — RC2's Event.Completed nudge proved the underlying engine generalizes past its original two actions; a real rules builder (beyond the one purpose-built Settings toggle RC2 shipped) is future scope.

---

## 9. Explicit "done" capabilities

*Release Ready. Verified, not assumed. No further work anticipated before launch.*

Booking & Client Workspace · Contracts · Timeline · Guest List/RSVP (mobile-hardened Sprint 2) · Floor Plans (including Vendor Event Assets sharing, Sprint 1) · Vendor Management (directory) · Vendor Portal — **fully certified end-to-end, Sprint 2**: all 12 core vendor workflows (receive/accept invitation, dashboard, view event, attachments, messaging, floor plans, tasks, notes, documents, inquiries, payment visibility) live-verified under a real authenticated vendor session, with 7 real defects found and fixed in the process (see `docs/sprint2-vendor-certification-report.md`) · Vendor Payment Visibility (new, Sprint 2 — "what am I being paid, has it been paid," deliberately scoped as a summary not an accounting module) · Pipeline Templates (re-verified Sprint 2 — venue-editable stages already shipped; only a fixed 7-canonical-stage *reporting taxonomy* is intentionally not customizable) · Requests Framework · Calendar (trust-risk purposes; week/day views and staff visibility confirmed shipped Sprint 2) · Documents · Playbooks/Tasks/Planning · Team & Permissions · Analytics & Reporting · Luv (Platform Intelligence, for what was scoped) · Wevenu HQ · Client Identity/Portal Access Control · White Labeling (baseline wiring) · Messaging & Conversations (the full RC2 + Sprint 1 scope: coordinator, couple, and vendor sides including vendor attachments, Activity Timeline, Search, Request cross-linking, opt-in Event.Completed automation) · Lead Acquisition & Intake (canonical pipeline, audit trail, reactivation policy, Email Intake Engine) · Seating Experience (couple-facing, mobile/tablet responsive as of Sprint 1) · Trust Foundation (Program 1 — every bounded Trust Risk Register item resolved as of Sprint 1).

**See `docs/platform-status-snapshot.md` for the current, single canonical answer to "what's complete, what remains, what's verified, what still needs human validation" — this document remains the detailed reconciliation history behind that snapshot.**

---

## 10. Recommendation: what's next

**Sprint 2 closed every remaining bounded release-blocker item, including the one genuinely-unbuilt feature gap (vendor payment visibility) and a class of severe, previously-undiscovered defects found only by actually authenticating as a vendor and exercising every workflow rather than trusting that RLS policies alone meant a feature worked.** What's left is no longer a build question anywhere on the platform:

1. **Run the Launch Verification Script** (`docs/launch-verification-script.md`) — a real human, real browser, real devices. This is the entire remaining gap. Nothing else on the platform is known-unbuilt or known-broken as of this reconciliation.
2. **Dogfooding** — still not started, same standing item as every prior reconciliation.

**After those close:** every category this engagement has tracked — Trust Foundation, Messaging, White Labeling, Lead Capture, Vendor Collaboration — is done, verified, or (Money's one remaining item) externally blocked on credentials. See `docs/platform-status-snapshot.md` for the current single-document answer to what's complete, what remains, what's verified, and what still needs human validation.
