# Product Capability Inventory

**⚠️ Superseded 2026-07-20 by `docs/release-candidate-roadmap.md`** — that document reconciles this one against RC1 (Venue Brand Experience), Lead Acquisition & Intake, and RC2 (Messaging & Conversations), all shipped after this snapshot (this doc predates all three — see its own "Update, 2026-07-19" note, written before RC2 even started). Kept here for history, not being re-verified line by line.

**Status:** Release planning artifact. Governs the remainder of Product Completion.
**Method:** Built from institutional knowledge — the Trust Risk Register, Release Readiness Status, Commitment Alignment Sprint, Timeline Implementation, Engineering Cleanup, and Luv Experience Completion reports, plus every architecture/assessment doc produced across this engagement — per explicit instruction, not from a fresh code inspection. Where a capability's exact current state depends on something no session has touched or re-verified recently, that's marked **Unverified** rather than assumed either way.
**Framing:** The platform architecture is now stable. Everything below is scored as a release-candidate capability review — completeness, UX, consistency, polish — not an architecture question. Nothing here proposes a new architectural concept.

**Update, 2026-07-19 — official Release Candidate sequencing approved.** Supersedes this document's own "Grouped for Release Planning" ordering with a definitive sequence:

| RC | Capability | Status |
|---|---|---|
| RC1 | Venue Brand Experience (baseline wiring) | In progress |
| RC2 | Messaging & Conversations | Next — not to be deferred further; the largest remaining release-blocking capability |
| RC3 | Automation Experience | Queued |
| RC4 | Venue Onboarding | Queued |
| RC5 | Operational Dashboards / Reporting | Queued |
| Final | End-to-End Launch Readiness & Dogfooding | Queued |

**Governing design principle for Venue Brand Experience, stated once, to decide every white-label call:** *A couple should remember the venue — not the software.* Scoped to baseline wiring only (render the venue's existing colors/logo everywhere a customer-facing surface currently hardcodes Wevenu's own look) — explicitly not advanced branding controls or a custom design system, which remain Future Product Evolution.

---

## How to read each entry

- **Status** — what fraction of the capability is actually built and working today.
- **Classification** — Release Ready / Needs Completion / Future Evolution.
- **Remaining work** — what's actually left, named specifically.
- **Dependencies** — what this needs from another capability or from outside the platform (e.g., external credentials).
- **User impact** — who feels the gap, and how directly.
- **Effort** — rough sizing: XS (hours), S (a day or two), M (a focused week), L (a multi-week initiative), XL (a program).
- **Blocks launch?** — yes / no / partial, against the existing Release Gate's 5 questions.

---

## 1. Lead Capture & Pipeline (CRM)

- **Status:** Core loop works well. Real-time inquiry capture, lead scoring (commitment/responsiveness/interest, decay-aware), a genuine Lead Funnel report. Import (CSV/paste) recently hardened against real-world files missing header rows.
- **Classification:** Needs Completion (external integrations), otherwise Release Ready for the one channel it owns.
- **Remaining work:** Zero external lead-source integrations exist (Facebook/Instagram Lead Ads, WeddingWire, The Knot are static "Future integrations" copy, not code). Pipeline stages are fixed (7, no customization). No lead-to-team-member assignment — every team member sees every lead.
- **Dependencies:** External integrations depend on each partner's own API/OAuth program — not buildable in isolation.
- **User impact:** A venue running leads through more than one channel today has to check each source separately — a real daily friction, but an *honestly absent* one (clearly not implied to exist).
- **Effort:** External integrations — XL (one per partner, ongoing). Pipeline customization — M. Lead assignment — S.
- **Blocks launch?** No — already classified platform-wide as an Honest V1 Limitation with a reasonable stopgap (a forwarding email), not a trust risk.

## 2. Booking & Client Workspace (Event/Client model, Event Readiness)

- **Status:** Fully built. Event Readiness (10-section rollup: Planning, Timeline, Guests, Seating, Floor Plans, Requests, Contracts, Payments, Documents, Communication) gives one coherent per-booking status view. Booking Financial Architecture Phases 0–4 shipped and verified.
- **Classification:** Release Ready.
- **Remaining work:** None identified.
- **Dependencies:** None outstanding.
- **User impact:** This is the coordinator's daily home screen for a booking — already the load-bearing capability the rest of the platform hangs off of.
- **Effort:** N/A.
- **Blocks launch?** No — already clear.

## 3. Contracts

- **Status:** Fully built and hardened. Immutability once signed, real audit trail (IP/user-agent/consent), correct signature-triggered (not send-triggered) automation, no re-open-after-signing path, token-based anonymous access closed to direct table reads.
- **Classification:** Release Ready.
- **Remaining work:** The contract-signing page itself carries no venue branding (see White Labeling, below) — a presentation gap, not a legal-integrity one. No automated "please sign" reminder email.
- **Dependencies:** None for the legal-integrity work (done). Branding depends on White Labeling.
- **User impact:** Every couple who signs a contract sees an unbranded page — small but real, given this audience's brand-sensitivity.
- **Effort:** Reminder email — S. Branding — folded into White Labeling.
- **Blocks launch?** No, on its own legal-integrity merits (already resolved). Contributes to White Labeling's case for being launch-relevant.

## 4. Payments & Invoicing

- **Status:** Mature data model and UI. Balance-reset bug fixed, hard-delete guards on paid records, refund/void capability shipped (Owner-only, RLS-backed). Stripe Connect is honestly relabeled "coming soon" rather than implying it processes real charges.
- **Classification:** Needs Completion (one small item, one externally-blocked item).
- **Remaining work:** Payments can still be marked paid twice with no guard (small, no data-loss risk, just an audit-log mismatch). Real Stripe payment collection (the actual charge-processing feature) is fully designed (`docs/stripe-payment-architecture.md`) but cannot be built without a live Stripe test-mode account this environment doesn't have. Invoice emails are plain-text; the payments list page has no responsive styling.
- **Dependencies:** Real Stripe collection depends on external credentials (`STRIPE_SECRET_KEY` etc.) — a business/ops dependency, not an engineering one.
- **User impact:** The double-mark-paid gap is low-visibility (an internal reconciliation nuisance). The missing real payment collection is the single biggest gap between what this platform *could* promise a venue ("collect deposits through us") and what it does today (manual, off-platform collection, honestly labeled as such).
- **Effort:** Double-mark-paid guard — XS. Real Stripe collection — L, once credentials exist. Email/responsive polish — S.
- **Blocks launch?** No for the small guard fix (bounded, worth doing anyway). Real Stripe collection: **partial** — doesn't block an honestly-labeled beta launch, but is a real gap for any venue expecting to actually collect money through the platform, and should be sequenced as the first major post-beta build once credentials exist.

## 5. Timeline

- **Status:** Fully built and live-validated. Owner/Lock-State/Visibility/Submission model, Copy at Commitment, one merged read serving both the coordinator editor and Wedding Day Ops.
- **Classification:** Release Ready.
- **Remaining work:** Two named, low-severity items: `reorderEntry`/`shiftEntriesAfter` guard gap (closed in Engineering Cleanup), Hosted Experience's change-notification nudge (also closed, in Luv Experience Completion). Both already resolved.
- **Dependencies:** None outstanding.
- **User impact:** None negative remaining.
- **Effort:** N/A.
- **Blocks launch?** No.

## 6. Guest List / RSVP

- **Status:** Invitation lifecycle, meals/dietary/accessibility tracking, households, plus-ones, and a real Guest Count Submission commitment flow are all built.
- **Classification:** Release Ready.
- **Remaining work:** None identified against current scope. Aggregate meal/accessibility observations for the coordinator remain a deliberately unresolved product decision (not an engineering gap) — see Luv, below.
- **Dependencies:** None outstanding.
- **User impact:** None negative remaining.
- **Effort:** N/A.
- **Blocks launch?** No.

## 7. Seating

- **Status:** Floor-Plan-backed tables, delegation, submission, `needsReassignment` detection when a table vanishes under an already-made seating decision.
- **Classification:** Needs Completion (one polish item).
- **Remaining work:** The seating-chart component itself has zero responsive/mobile classes — the one concretely-named gap keeping the otherwise-Green Couple Portal from being unreservedly mobile-safe.
- **Dependencies:** None.
- **User impact:** Direct hit on the Trust Bar's own named bar: "wedding day cannot fail on my phone." A couple or a coordinator trying to check seating from a phone (the single most likely device on the actual wedding day) gets a broken experience.
- **Effort:** M (a real responsive pass on a substantial canvas-like component, not a quick CSS fix).
- **Blocks launch?** **Yes** — this is one of the most concretely-named, still-open items tied directly to the platform's own stated trust bar.

## 8. Floor Plans

- **Status:** Editor, templates, inventory usage, sharing controls all built.
- **Classification:** Release Ready.
- **Remaining work:** None beyond the already-reviewed, deliberately-kept-deterministic paste-import (Luv Experience Completion confirmed this is correct as-is, not a gap).
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 9. Inventory

- **Status:** Per-booking usage/over-allocation tracking is real and correct.
- **Classification:** Future Evolution (for anything beyond current scope).
- **Remaining work:** No venue-wide, cross-booking stock ledger exists — confirmed absent, not a bug. Would need a genuinely new aggregation if ever wanted.
- **Dependencies:** None for current scope.
- **User impact:** A venue managing shared inventory across multiple simultaneous bookings has no cross-event visibility — real, but not something the product currently implies exists.
- **Effort:** M, whenever prioritized.
- **Blocks launch?** No.

## 10. Vendor Management (venue-side directory)

- **Status:** Directory, recommendations, day-of assignments with real check-in/setup timestamps.
- **Classification:** Release Ready.
- **Remaining work:** None identified.
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 11. Vendor Portal (vendor-facing app)

- **Status:** Dashboard, events, inquiries, packages, tasks, availability, a real business health score, and (as of Luv Experience Completion) a consolidated, tone-appropriate Luv briefing.
- **Classification:** Needs Completion (communication gap).
- **Remaining work:** The only "communication" a vendor has with a venue is a one-way portal link — no real two-way vendor messaging exists (see Messaging, below, which is the actual owner of this gap).
- **Dependencies:** Messaging unification.
- **User impact:** A vendor who wants to ask the venue a quick question about an assignment has no in-product way to do it.
- **Effort:** Owned by Messaging's own effort estimate below.
- **Blocks launch?** Partial — this is the concrete, felt symptom of the Messaging gap; see that entry for the real sizing.

## 12. Requests Framework

- **Status:** Fully built, and — per the Luv Experience Completion audit — already the platform's cleanest cross-capability commitment mechanism (a single status enum naturally produces every one of Luv's six observation kinds).
- **Classification:** Release Ready.
- **Remaining work:** None identified.
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 13. Calendar

- **Status:** 7-source aggregation (events, tours, follow-ups, payments due, key dates, holds, admin blocks). Double-booking is server-enforced (space + full setup-through-teardown window, not just ceremony time). Tours are canonically sourced from `tour_appointments`, not a stale legacy field.
- **Classification:** Release Ready (for trust-risk purposes); Future Evolution for completeness.
- **Remaining work:** No team-member visibility on the grid itself. Month-only view — no week/day. No calendar sync (iCal/webcal).
- **Dependencies:** None.
- **User impact:** A multi-staff venue can't see who's covering what on the calendar itself; a coordinator who prefers a week view has none. Real, but not a trust risk — nothing implies these exist today.
- **Effort:** Week/day views — M. Team visibility — S. Sync — M.
- **Blocks launch?** No.

## 14. Communication / Messaging

- **Status:** Two structurally disconnected systems — legacy `message_threads`/`messages` (an outbound-email log on Lead/Client/Event pages) and the newer Conversation experience (main-nav inbox, couple portal). Both key to the same client but nothing joins them. Multi-staff reliability bugs already fixed (TR-C2). No vendor-facing channel beyond a one-way link.
- **Classification:** Needs Completion — the single largest remaining architecture-execution item on the platform (architecture already decided, per Program 2 Principle #3 and `docs/program-2-implementation-plan.md`; this is executing it, not designing it).
- **Remaining work:** Unify onto one Conversation object with pluggable Channels (email, SMS, portal, internal note, phone log, future vendor channel). This is the fix for both the coordinator-side fragmentation and the vendor-collaboration gap named in Vendor Portal, above.
- **Dependencies:** None external — architecture is settled, this is implementation.
- **User impact:** A coordinator today cannot trust they're seeing a couple's complete conversation from one place — directly cuts against "everything lives in one place." A vendor has no way to message a venue at all. This is the one item that shows up as a real gap against a *named Release Gate question* ("can a vendor collaborate effectively?").
- **Effort:** L — the largest single item in this inventory. Real, but bounded (architecture, not invention).
- **Blocks launch?** **Yes**, in the sense that it's the concrete reason Release Gate #3 ("can a vendor collaborate effectively?") isn't yet a clean "yes." Whether it blocks a *specific* beta cohort's launch date is a business call, not a technical one — see the recommendation below for how to sequence it.

## 15. Couple Portal

- **Status:** The platform's most mature surface — 12 sections, real data export, essentially no stub content. Strengthened materially by the Commitment Alignment Sprint (private-until-submitted guest list/seating/vendor selection/timeline/documents) and by Timeline's Owner/Lock/Visibility model.
- **Classification:** Release Ready, with one named polish gap.
- **Remaining work:** Seating-chart mobile responsiveness (see Seating, above — the same gap, felt here).
- **Dependencies:** None beyond Seating's own fix.
- **User impact:** Already the standout of the whole platform for the audience that matters most (the couple).
- **Effort:** N/A beyond the Seating fix already counted.
- **Blocks launch?** No, beyond the Seating item already counted there.

## 16. Wedding Website (Hosted Experience Platform)

- **Status:** Phases 1–5 shipped and live-validated — Catalog Foundation, Section Model, Publishing/Version History, Guest Personalization, Luv Integration (guest concierge, change-notification nudge — now correctly audience-filtered per Luv Experience Completion).
- **Classification:** Release Ready for shipped phases; Future Evolution for Phase 6.
- **Remaining work:** Phase 6 remains specification-only, not built — no work has been scoped against it yet in this inventory.
- **Dependencies:** None for current scope.
- **User impact:** None negative for what's shipped.
- **Effort:** Phase 6 — unscoped, TBD when prioritized.
- **Blocks launch?** No.

## 17. Documents

- **Status:** Private Until Shared resolved (contracts/invoices default unshared until explicit send). Expiry tracking, category/tagging, venue and client document flows both work.
- **Classification:** Release Ready.
- **Remaining work:** None beyond what's already counted under Contracts (branding, reminder email).
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 18. Playbooks / Tasks / Planning

- **Status:** Task templates, dependency blocking/unblocking, Client/Venue split readiness (deliberately never merged), auto-complete triggers including the recently-verified `payment_received` trigger (found already working, not dead as an earlier audit believed).
- **Classification:** Release Ready.
- **Remaining work:** No combined "at a glance" cross-booking readiness view exists yet outside the per-booking Event Readiness card — a completeness nicety, not a gap in what's promised.
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 19. Team & Permissions

- **Status:** Fully resolved. Real server + RLS enforcement across Owner/Manager/Coordinator/Staff, invite-identity verification, no duplicate-role states possible.
- **Classification:** Release Ready.
- **Remaining work:** None identified.
- **Dependencies:** None.
- **User impact:** None negative.
- **Effort:** N/A.
- **Blocks launch?** No.

## 20. Setup & Onboarding

- **Status:** Fast, real 7-step wizard; a genuine (non-decorative) Getting Started checklist; Luv now introduces herself once, contextually, per audience.
- **Classification:** Needs Completion (support surface only).
- **Remaining work:** No help center, tooltips, guided tour, or live-chat widget anywhere — the only support channel is an async ticket form.
- **Dependencies:** A live-chat/help-center capability is a build-or-buy decision (e.g., Intercom-style), not purely internal engineering.
- **User impact:** A new venue owner stuck mid-setup has no faster path to help than filing a ticket and waiting.
- **Effort:** M–L depending on build-vs-buy.
- **Blocks launch?** No — the wizard itself is real and unblocked; this is a Trust Bar #5 ("support is a real, fast, human safety net") concern, not a Program 1 trust risk.

## 21. Analytics & Reporting

- **Status:** Real, DB-backed reporting across lead funnel, events, payments, couple engagement, feature adoption, health scores, and the Luv roll-up. Repeatedly named a genuine strength even inside otherwise-Red categories.
- **Classification:** Release Ready.
- **Remaining work:** None identified.
- **Dependencies:** None.
- **User impact:** None negative — already a differentiator.
- **Effort:** N/A.
- **Blocks launch?** No.

## 22. Luv (Platform Intelligence)

- **Status:** Just completed its own Experience Completion pass — fork consolidation (HQ, Vendor App), Event Readiness wiring extended, a real celebration framework (5 milestones), vendor tone, one-time onboarding intros, empty-state consistency, and a closing Private Until Committed audit that found and fixed two real violations.
- **Classification:** Release Ready for what was scoped; Future Evolution for the rest.
- **Remaining work (named, deferred, not gaps):** Daily Briefing (a net-new venue-wide feed), the six-kind Observation Model's full narration convergence across the 4 separate Claude integrations, extending Luv into Floor Plans and aggregate venue-facing Guests/Seating, progressive-disclosure controls for the couple/vendor audience (a "hide Luv" toggle equivalent to the coordinator's own Settings).
- **Dependencies:** None blocking.
- **User impact:** None negative for what's shipped; the deferred items are genuine future differentiation, not missing table stakes.
- **Effort:** Daily Briefing — L. Narration convergence — M. Further capability extension — M. Progressive disclosure controls — S.
- **Blocks launch?** No.

## 23. Notifications (Digest, Sequences, SMS/Push)

- **Status:** Daily digest email (now genuinely populated with a real Luv observation, not a dead block), message sequences with real enrollment/exit states, notification log.
- **Classification:** Needs Completion (two small silent-failure bugs) / Future Evolution (SMS/push).
- **Remaining work:** Tour-confirmation emails and questionnaire "send" both fail silently with no logging or user-facing failure surface — small, well-understood, already-scoped Trust Risk items (TR-B2/TR-B3) never closed. `NotificationLogEntry` has no open/click tracking — confirmed absent, correctly not implied to exist. SMS/push remain honestly "Planned."
- **Dependencies:** SMS needs a provider (e.g., Twilio) and opt-in/compliance work — genuine new infrastructure.
- **User impact:** A coordinator who sends a tour confirmation or a questionnaire has no way to know it silently failed — the exact "appears to work but doesn't" shape this platform's own doctrine treats as unacceptable regardless of size.
- **Effort:** Both silent-failure fixes — XS each. SMS infrastructure — L, whenever prioritized.
- **Blocks launch?** **Yes** for the two silent-failure bugs — small, bounded, and squarely inside the Trust Risk Register's own "not mostly, all of them" bar for Release Gate #1. No for SMS/push (honestly labeled).

## 24. White Labeling / Venue Branding

- **Status:** The venue's own color/logo data model already exists (4-color system + logo field) — this is substantially a "wire it through," not a new-data-model problem. Currently unbranded: couple portal (hardcoded palette, "Powered by Wevenu" footer), all client-facing emails (generic gray, single global FROM_EMAIL), the contract-signing page. PDFs (invoices, day-sheets, floor-plan prints) are the one bright spot — already correctly branded.
- **Classification:** Needs Completion.
- **Remaining work:** Wire the venue's existing colors/logo through the couple portal, transactional emails, and the contract page. No custom domain/subdomain support. (The AI-driven brand-recommendation layer on top of this — Venue Brand Experience — is separately and correctly scoped as Future Evolution, below; this entry is only the baseline wiring.)
- **Dependencies:** None architectural — the data already exists.
- **User impact:** Direct hit on this specific audience's core expectation: a former Weven customer evaluating whether this is *their* professional tool or a generic vendor's. Every unbranded touchpoint reinforces "this is Wevenu's product," not "this is my business, powered by software I trust."
- **Effort:** M — real but bounded; no new architecture, no new data model, several template/UI wiring passes.
- **Blocks launch?** **Yes** — high trust-perception impact, moderate bounded effort, squarely a completeness gap rather than a new initiative.

## 25. Wevenu HQ (internal admin)

- **Status:** Beta command center, venue detail (now showing real Luv observations instead of a placeholder), activation scoring, support notes/tasks, communication diagnostics.
- **Classification:** Release Ready.
- **Remaining work:** None blocking — this is internal tooling, not a customer-facing capability.
- **Dependencies:** None.
- **User impact:** Internal only.
- **Effort:** N/A.
- **Blocks launch?** No.

## 26. Client Identity / Portal Access Control

- **Status:** Access levels (full/planning/financial/view-only) and contact portal roles are real and enforced (TR-G4 resolved) — a contact restricted to "financial only" genuinely can't pull the guest list anymore.
- **Classification:** Release Ready.
- **Remaining work:** The three permission vocabularies across Client Identity, Portal Access, and Support Access Grants don't yet reconcile perfectly cleanly with each other at the conceptual level (a documentation/clarity nuance, not an enforcement gap — enforcement is real and tested).
- **Dependencies:** None urgent.
- **User impact:** None negative in practice; a future maintainer could find the three vocabularies confusing.
- **Effort:** S, whenever picked up — a naming/documentation reconciliation, not new enforcement work.
- **Blocks launch?** No.

## 27. Commercial Proposal Architecture

- **Status:** Fully designed (`docs/future-initiative-commercial-proposal-architecture.md`), zero implementation. The `proposal_sent` pipeline stage exists today as a status value with no artifact behind it.
- **Classification:** Future Evolution (explicitly, by prior approval).
- **Remaining work:** Full build — a formal Proposal artifact bridging Sales CRM and Booking, deliberately kept outside the Commitment Lifecycle.
- **Dependencies:** None blocking; ready to build whenever prioritized.
- **User impact:** A venue's `proposal_sent` stage today doesn't do anything beyond label a lead — a completeness gap for pipeline maturity, not a trust risk.
- **Effort:** L.
- **Blocks launch?** No — explicitly deferred by prior decision, not by omission.

## 28. Venue Brand Experience

- **Status:** Fully designed (`docs/venue-branding-architecture-audit.md`'s Future Initiative section), zero implementation. Would generate recommended Collections/Color Stories/Typography/Gallery Style/Motion from the venue's existing Venue Style field.
- **Classification:** Future Evolution (explicitly, by prior approval).
- **Remaining work:** Full build — the brand recommendation engine itself, once the baseline White Labeling wiring (above) exists to recommend *into*.
- **Dependencies:** Sequenced after the baseline White Labeling item, above — recommending brand defaults is pointless before the platform actually renders the venue's own brand anywhere.
- **User impact:** None yet — future differentiation, not current gap.
- **Effort:** L.
- **Blocks launch?** No.

## 29. Marketplace / Ecosystem

- **Status:** Not started, by explicit, repeated prior decision ("last, per your original call").
- **Classification:** Future Evolution.
- **Remaining work:** Everything — full program scope.
- **Dependencies:** Depends on Programs 2–4 maturing first, by design.
- **User impact:** None yet.
- **Effort:** XL — its own program.
- **Blocks launch?** No.

---

## Unverified — flagged, not assumed

Two items from the platform's own historical Trust Bar and Release Gate predate this session's work and haven't been re-touched by anything in the Commitment Alignment Sprint, Timeline, Engineering Cleanup, or Luv Experience Completion. Rather than guess, they're named here as needing a direct check before this inventory's launch-blocking calls are treated as final:

- **The 5 named mobile scenarios** (Trust Bar #3: "wedding day cannot fail on my phone — the 5 named mobile scenarios need to all pass, not 2 of 5"). No completion record exists in anything reviewed for this inventory.
- **Dogfooding** (Release Gate #5: running Wevenu's own vendor relationships/contracts/invoices inside Wevenu for a real stretch of time). No record of this having started.

---

## Grouped for Release Planning

### Release Blocking
*(Should be completed before launch — bounded, high-trust-impact, or directly named against an existing Release Gate question.)*

1. **Seating-chart mobile responsiveness** — M effort, direct hit on Trust Bar #3.
2. **White Labeling baseline wiring** (couple portal, emails, contract page) — M effort, direct hit on this audience's core trust expectation.
3. **Two silent-failure notification bugs** (tour-confirmation email, questionnaire send) — XS effort each, closes the Trust Risk Register's last "appears to work but doesn't" gaps.
4. **Double-mark-paid guard** — XS effort, closes the Trust Risk Register's last small Money gap.
5. **Messaging / Conversation unification** — L effort, the concrete reason Release Gate #3 ("can a vendor collaborate effectively?") isn't a clean yes yet. Largest item on this list; see recommendation below for sequencing, not skipping.
6. **Re-verify the 5 named mobile scenarios and confirm dogfooding status** — not a build item, a verification item; treat as blocking until actually checked.

### Release Candidate Polish
*(Improves the launch experience; not a launch blocker.)*

- Real Stripe payment collection (externally blocked on credentials — sequence as the first major post-beta build once available).
- Setup & Onboarding help/support surface (live chat or help center).
- Calendar week/day views, team-member visibility on the grid, calendar sync.
- Contract "please sign" reminder email; invoice email HTML polish; payments-list responsive styling.
- Lead-to-team-member assignment; pipeline stage customization.
- Client Identity's three-vocabulary documentation reconciliation.

### Future Product Evolution
*(Intentionally deferred — new growth, not completion.)*

- Venue Brand Experience (brand recommendation engine).
- Commercial Proposal Architecture.
- External lead-source integrations (Facebook/WeddingWire/The Knot).
- Real SMS/push infrastructure.
- Luv's Daily Briefing, full narration convergence, extension into Floor Plans/aggregate Guests-Seating, couple/vendor progressive-disclosure controls.
- Venue-wide cross-booking Inventory ledger.
- Custom domains for wedding websites/portal.
- Marketplace / Ecosystem.

---

## Recommendation: Highest-Priority Capability to Complete Next

**White Labeling (baseline wiring) — couple portal, transactional emails, and the contract-signing page.**

Reasoning:

1. **It's the best ratio of trust impact to effort on this entire list.** The data model already exists (venue colors, logo) — this is wiring, not invention, unlike Messaging (a genuine multi-week architecture execution) or real Stripe collection (blocked on external credentials this environment doesn't control either way).
2. **It hits this specific audience's most basic expectation, not an edge case.** Every document produced across this engagement frames the target cohort as sophisticated former Weven customers deciding whether to trust a platform with their business again. An unbranded couple portal and a "Powered by Wevenu" contract page tell that exact person "this is someone else's software," working directly against the trust-rebuilding premise the whole roadmap is built on — more directly than any Red category except Messaging.
3. **It's genuinely finishable, now, without new architecture or external dependencies.** Real Stripe collection can't move without credentials. Messaging unification is real but large — worth doing, wrong thing to reach for as the very next item when a smaller, equally trust-critical item is sitting right there, already mostly built.
4. **It clears cleanly, unlike Messaging, which has real sequencing dependencies** (Vendor Portal's own communication gap is a symptom of Messaging, not the other way around — fixing White Labeling doesn't require deciding Messaging's implementation order first).

**Sequencing note, not a delay:** Messaging/Conversation unification remains the single largest true gap on this inventory and should be the *next* initiative after White Labeling — not deferred indefinitely. The two silent-failure notification bugs and the double-mark-paid guard are small enough to fold in as a same-week cleanup alongside whichever of these two is picked up first, rather than their own initiative.
