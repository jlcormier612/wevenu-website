# Product Completion Roadmap — Trust Rebuilding, Not MVP Validation

**Status:** Phase A planning document — v3, reorganized around the Trust Risk Register
**Date:** 2026-07-07
**Context:** Strategic pivot — the first external beta cohort is former Weven customers (a competitor product shut down by The Knot), sophisticated venue operators who already know what great venue software feels like and were burned once by a platform disappearing on them. This is not an MVP-validation beta. It's a trust-rebuilding exercise. Every recommendation below is scoped against that bar, not a generic "polish list."

**Phases (this revision):** 1 Trust & Safety → 2 Operational Completeness → 3 Delight & Polish → 4 Private Alpha (5–10 trusted non-former-customers) → 5 Trust Beta (former Weven customers) → Public Beta. Marketplace and Ecosystem Luv move behind all of these.

**Method:** Every claim below is grounded in code-level audits across this session — the Mobile & Trust Audit (5 named scenarios), a pass on Calendar/Floor Plans/Couple Portal/Email templates, a pass on Lead Capture/Pipeline/White Labeling/Automation/Permissions/Onboarding/SMS, and a final targeted pass hunting specifically for money-loss, booking-loss, and legal-exposure risks (contract immutability, staff-removal access revocation, payment reconciliation, silently-swallowed errors on financial/booking paths). Two of the highest-stakes findings — that Stripe Connect never actually charges a card, and that e-signatures capture no IP/consent trail — were verified hands-on, not just read. Nothing here is guessed; file paths and line numbers are in the session history if you want to verify a specific claim yourself.

---

## The Trust Bar

If I were a former Weven customer, burned once already, evaluating Wevenu:

1. **I can leave whenever I want, with all my data, and nothing feels held together with tape.** Portability isn't a nice-to-have for this audience — it's the whole psychological premise of trusting a platform again. Doesn't exist at all today (venue or couple side).
2. **Every document my clients and vendors see is polished.** Right now several aren't — see the Trust Risk Register and Gap Analysis below.
3. **Wedding day cannot fail on my phone.** The 5 named mobile scenarios need to all pass, not 2 of 5.
4. **My couples' planning data is portable too**, not just the venue's.
5. **Support is a real, fast, human safety net**, not a form into a void.

If all five are true, "I'm ready to trust this platform with my business again" becomes a reasonable thing for that person to say. This audience will forgive a rough edge, but not a structural gap that echoes exactly why they got hurt before.

---

## Three Operating Principles (adopted, not just noted)

**We are optimizing for exceeding expectations, not reaching an MVP.** The bar for the first external release is *"would I feel proud asking a former Weven customer to run their business on this today?"* — not *"does it technically work."*

**We are not optimizing for the earliest possible launch date. We're optimizing for the first customers becoming the biggest advocates.** If taking longer materially raises the odds someone says *"this is everything I hoped Weven would become"* instead of *"this is fine, I guess,"* that's the better trade, every time, for this cohort.

**The Trust Risk Register supersedes all other roadmap work, and features we'd like to improve are not the same category as things that could actively hurt a customer.** A feature that can cause a customer to lose money, lose a booking, create legal exposure, or lose trust takes priority over every other Product Completion item, full stop. Corollary: **honestly absent is acceptable; appears-to-work-but-doesn't is not.** Where something is misleading, the response is always one of fix it, disable it, or clearly label it — never leave it as-is.

---

## The Trust Risk Register

**→ See `docs/trust-risk-register.md` for the full, formal, trackable register** — 14 individually verified risks (Risk / Customer Impact / Severity / Temporary Mitigation / Permanent Fix / Status / Test Plan for each), organized by Money / Legal / Booking / Governance, each with a stable ID (TR-M1, TR-L1, etc.) for referencing in commits and future status updates. That document is now the source of truth for Phase 1 tracking; this section is a summary.

**8 Critical, 4 High, 2 Moderate severity items.** As of the Phase 1 same-day batch (2026-07-07): **4 Resolved, 1 Mitigated, 9 still Identified.** Closed: invoice balances silently resetting after partial payment (TR-M2); signed contracts editable/deletable with no guard or trail (TR-L1/TR-L2); double-booking with no server-side enforcement (TR-B1). Mitigated (permanent fix still open): Stripe Connect linking an account but never charging a card (TR-M1). Still open: e-signatures capturing no IP/consent evidence (TR-L3); the "contract signed" trigger firing on send not signature (TR-L4); no refund/void capability, payment double-marking, hard-delete guards (TR-M3/M4/M5); silent email failures on tour/questionnaire sends (TR-B2/B3); permissions being entirely cosmetic, which also widens the blast radius of the contract/payment deletion risks (TR-G1); no data export anywhere (TR-G2).

One item checked and cleared, not a risk: removed staff members are correctly and immediately locked out (`is_active` is enforced live, per request, not just on future logins) — see the register for the one residual, unconfirmed follow-up (auditing `service_role` call sites for accidental cross-venue access).

---

## The Stripe / E-Signature Question — my recommendation

You asked directly: fix immediately (A), or disable/relabel until production-ready (B)? My answer isn't the same for both, because they're different in kind:

**Stripe Connect → B, immediately.** Real payment collection (a Stripe payment element in the couple portal, webhook-confirmed charge status, proper handling of partials/failures) is a genuine feature build, not a patch — rushing it risks introducing new bugs in code that handles real money, which is worse than the current gap. The UI *today* actively invites a venue to connect Stripe with copy like "accept deposits and payments directly through Wevenu" — that's a false promise for every day it stays as-is. Relabel or gate it behind a "coming soon" this week (cheap, fast, safe), then build the real thing properly on its own timeline as a Phase 1 project. This is exactly your own instinct, and I agree with it without reservation.

**E-signature audit trail + contract immutability → A, immediately.** These are different in character from Stripe: the fixes are narrow, well-understood, and fast — add a `status != 'signed'` guard to the update/delete actions, log activity on every edit, capture IP/user-agent/a consent checkbox at signing. This is closing a gap in existing, working code, not building a new subsystem. Disabling contract sending/signing entirely while this gets fixed would be a much bigger disruption than the fix itself warrants, and there's no misleading affordance to hide in the meantime — signing genuinely does produce a signed record today, it's just thinner and less tamper-evident than it should be. Fix it fast rather than take the feature away.

**The invoice balance-reset bug, double-booking, and permissions → also A, immediately**, for the same reason as e-signatures: each is a bounded, well-understood patch to an existing code path (make invoice-total recompute payment-aware; add a server-side date+time conflict check; replicate the vendor-side role-gating pattern for venue staff), not a rebuild. No reason to disable invoicing, event creation, or team invites over any of these.

**Refund/void capability** sits in a different category from the rest of this section: it's a real Category-1-by-impact gap, but it's *honestly absent* rather than misleading — nothing in the product currently implies you can process a refund. Treat it like Stripe in terms of priority (build it, don't defer it to later phases) but there's nothing to disable in the meantime, since there's no false affordance to begin with.

**The general rule this produces:** disable/relabel only when the fix itself is a genuine rebuild (Stripe, eventually maybe refunds if scoped that large) — for everything else, the fastest path to trust is closing the gap in the existing code, not removing a working feature over a fixable flaw.

---

## Product Decision Framework — Four Buckets

This supersedes the earlier three-category (A/B/C) framing from the previous revision of this doc — same spirit, sharper cut, now organized around trust-risk severity rather than a generic trust/delight/defer split.

**Bucket 1 — Trust Risks.** Everything in the Trust Risk Register above. Could actively harm a customer, create legal exposure, lose money, or damage trust. Highest priority, full stop — this is Phase 1.

**Bucket 2 — Operational Completeness.** A venue *can* technically run their business without these, but the experience feels unfinished:
- Messaging fragmentation (two disconnected coordinator-facing systems) and no vendor messaging channel
- Workflow automation gaps: no unified "where does this customer stand" view on the event page; fully manual questionnaire send
- Contracts/documents not linked from the event or client detail pages (a real navigation dead end)
- White Labeling: couple portal, all client-facing emails, and the contract page carry Wevenu's brand, not the venue's
- Seating-chart mobile responsiveness (951 lines, zero responsive classes, couple-facing)
- Floor-plan visibility for couples/vendors (currently coordinator-only)
- Lead-to-team-member assignment ("my leads" doesn't exist; every team member sees everything)
- In-app help / support-access affordance (currently just an async ticket form)

**Bucket 3 — Expectation Exceeders.** Not required to earn trust, but where "wow, better than Weven" gets said out loud:
- Luv intelligence — already the deepest, most differentiated part of the product; worth continued investment specifically because it's a moat, not a checkbox
- Team collaboration UX polish (the mechanics were built this session; the delight pass comes later)
- Onboarding first-run-feel polish (the checklist is real and functional; hasn't been audited for *feel* yet)
- Floor-plan sharing, email experience, and other delight moments layered on top of the Bucket-2 completeness work above

**Bucket 4 — Honest V1 Limitations.** Real gaps, reasonable to launch without *if clearly communicated*:
- External lead-source integrations (Facebook/WeddingWire/TheKnot) — a multi-partner integration project; a forwarding-email stopgap is a reasonable interim answer
- Real SMS/texting — genuine new infrastructure (provider, opt-in/compliance), not a polish pass
- Custom domains for the wedding website/portal
- Pipeline stage customization — the fixed 7 stages are a real limitation but a defensible, well-known default
- Calendar week/day views and calendar sync (iCal/webcal)
- Marketplace, Ecosystem Luv (per your original call)

---

## The Five-Phase Roadmap

### Phase 1 — Trust & Safety *(Bucket 1, the entire Trust Risk Register — see `docs/trust-risk-register.md` for IDs)*

Your proposed ordering (Stripe relabel + contract-edit guard + invoice fix same-day; double-booking, permissions, audit trail, e-signature, data export next) is directionally right, and I agree with all of it. Two adjustments, since you asked me to challenge it:

**1. Promote double-booking into the same-day batch.** I'd initially sequenced it in "Next," but on reflection it belongs with the same-day fixes: the exact server-side conflict-check pattern it needs already exists in this codebase (the tour-booking migration solves the identical problem for a different entry point) — this is "replicate a proven pattern to a second code path," not new design work. It's not meaningfully bigger than the invoice fix. Given it's also one of the most business-destroying items on the list if it fires for real, there's no good reason to leave it in the second batch.

**2. Fold minimal activity-logging into the same-day contract-immutability fix, rather than treating "audit trail" as separate later work.** `updateContractContent` already needs a status-guard edit today (TR-L1) — restoring the `insertContractActivity` call on every edit is a few lines inside the same function, same file, same commit. Doing it now costs almost nothing extra and immediately closes the "no audit trail" half of TR-L1, not just the "no guard" half. The *deeper* e-signature evidence work (IP/user-agent/consent capture, TR-L3) is still real "Next" work — just don't let the cheap part of "audit trail" wait for it.

One structural note on "Next," not a resequencing: **permissions (TR-G1) is by far the largest single item in this phase** — it needs a scoping decision (exactly what should `staff` vs. `manager` be blocked from: deletion? financial visibility? both?) before implementation, not just a code patch. I'd start that scoping conversation immediately, in parallel with the same-day batch, so implementation isn't blocked waiting on a decision once its turn comes — otherwise it risks becoming the phase's long pole. E-signature evidence (TR-L3) is comparatively small and self-contained and can slot in before or alongside permissions' implementation without waiting for it.

**Same day — ✅ complete (2026-07-07):**
1. ✅ TR-M1 — Stripe Connect: relabeled/gated the Settings card and payments-page callout. *Mitigated — permanent fix (real payment collection) still tracked open.*
2. ✅ TR-L1/TR-L2 — Contract immutability: status guard on edit *and* delete of sent/signed contracts, `insertContractActivity` logging restored on every edit in the same commit. *Resolved.*
3. ✅ TR-M2 — Invoice balance-reset bug: invoice-total recompute is now payment-aware. *Resolved.*
4. ✅ TR-B1 — Double-booking: server-side date+time conflict enforcement on manual event create/update, reusing the tour-booking migration's pattern. *Resolved. (Promoted from "Next" — see above.)*

All four verified via `tsc`/`next build` (clean) plus targeted database tests in rolled-back transactions (see `docs/trust-risk-register.md` for the specific test performed on each). Full detail, including what shipped and scorecard impact, is in the register — this list just tracks phase-level status.

**Next** (roughly in this order, permissions' scoping decision started immediately/in parallel with the same-day batch, not after it):
5. TR-G1 — Permissions: real server + RLS enforcement, once scope is agreed.
6. TR-L3 — E-signature evidence: IP + user-agent + consent checkbox captured at signing.
7. TR-L4 — Contract-signed automation: fix the trigger to fire on actual signature, not on send.
8. TR-M4/TR-M5 — Payment double-marking guard; hard-delete guards on paid line items/schedules.
9. TR-B2/TR-B3 — Silent-failure fixes on tour-confirmation and questionnaire-send emails: real logging and honest status reporting.
10. TR-G2 — Data export, venue and couple side.
11. TR-M3 — Refund/void capability, scoped and built deliberately (not deferred to a later phase).
12. Security review pass; backup-policy confirmation; audit of `service_role` call sites for the residual RLS-bypass risk noted in the register.

**After Phase 1 closes:** re-run the full Trust Beta Readiness Scorecard (below) category by category and update `docs/trust-risk-register.md`'s Status column for every item to Resolved. Comparing the before/after scorecard — how many of the 6 Red categories move to Yellow or Green — is the actual measure of whether Phase 1 worked, not a feature count.

**Phase 2 — Operational Completeness** *(Bucket 2, in full)*

**Phase 3 — Delight & Polish** *(Bucket 3, in full)*

**Phase 4 — Private Alpha** (5–10 trusted non-former-customers; break workflows, uncover gaps, validate assumptions)

**Phase 5 — Trust Beta** (former Weven customers; the reintroduction)

Public Beta follows once Trust Beta feedback is incorporated. Bucket 4 items get built opportunistically alongside Phases 2-3 or communicated as roadmap by Phase 5 — never silently absent, always named.

---

## Trust Beta Readiness Scorecard

The original ten-category scorecard, kept as a reference view alongside the risk-based framing above. **Green = production ready. Yellow = usable but needs polish. Red = not ready.**

| # | Category | Rating | One-line why |
|---|---|:---:|---|
| 1 | Messaging & Texting | 🔴 Red | Texting doesn't exist at all; two disconnected coordinator-facing messaging systems; no vendor channel |
| 2 | Lead Capture & Consolidation | 🔴 Red | Zero external integrations exist (Facebook/WeddingWire/TheKnot are placeholder copy) |
| 3 | Money | 🔴 Red *(2 of 5 Trust Risk items closed 2026-07-07 — see below)* | Stripe Connect facade now honestly labeled (permanent fix pending); invoice balance-reset bug fixed; refund capability, double-marking guard, hard-delete guards, and document branding remain |
| 4 | Setup & Onboarding | 🟡 Yellow | Fast, real wizard + Getting Started checklist; "in-app help"/"easy support access" are just an async ticket form |
| 5 | Client Experience (Couple Portal) | 🟢 Green→🟡 | Most mature area in the product; seating chart has zero mobile styling and there's no couple data export |
| 6 | End-to-End Workflow Automation | 🟡 Yellow→🔴 | Real automation exists but the flagship "at a glance" promise isn't delivered; confirmed dead trigger; contract-signed trigger fires on send |
| 7 | White Labeling | 🔴 Red | Couple portal, all client-facing emails, and the contract-signing page all say "Wevenu," not the venue's name |
| 8 | Calendar | 🟢 Green *(moved from Red 2026-07-07)* | Double-booking is now server-enforced on manual event create/update, matching the public tour widget. Remaining gaps (no team visibility on the grid, month-only view) are Operational Completeness / Honest V1 Limitation, not Trust Risks |
| 9 | Pipeline & Lead Management | 🟡 Yellow→🔴 | Real, DB-backed reporting (a genuine strength); but pipeline stages are fixed and leads can't be assigned to a team member |
| 10 | Notifications, Permissions & Reporting | 🔴 Red | Reporting is a real strength; Permissions is 100% cosmetic — a "staff" role has full owner access everywhere |

**Original baseline: 6 of 10 Red, two of the three "Yellow" ratings leaning Red.** After the Phase 1 same-day batch (2026-07-07): **Calendar moved Red → Green**, and Money's two most dangerous findings closed (still Red overall — see Gap Analysis below — but the facade and the silent-erasure bug are gone). 5 of 10 remain Red. This is exactly the exercise to keep re-running as Phase 1 continues — category movement, not ticket count, is the real measure.

---

## Gap Analysis by Category

### 1. Messaging & Texting — 🔴 Red
- **Texting doesn't exist anywhere in the product.** `channel: "sms"` is a real column/type, but the send engine explicitly skips it (`lib/notifications/engine.ts:180`: *"SMS / in_app / push — not yet implemented, skip gracefully"*). Every settings surface renders SMS greyed-out and labeled "Future"/"Planned" — no toggle, no provider (no Twilio anywhere).
- **Two separate, non-overlapping systems both talk to the couple** — the couple's own "Messaging" inbox and the "Messages" tab on the lead/client detail page are different systems (`lib/messages/*` vs `lib/messaging/*`). A coordinator could end up with two disconnected threads for one relationship.
- **No vendor messaging at all.** The only vendor "communication" is a one-way portal link.
- **Deliverability data exists but isn't shown to the coordinator** — Resend webhooks log sent/delivered/bounced/opened/clicked, but only Wevenu's internal HQ tooling sees it.
- What's solid: conversation history, attachments, and a genuinely mobile-first couple-facing UI.

### 2. Lead Capture & Consolidation — 🔴 Red
- **Zero external lead-source integrations exist** — Facebook/Instagram Lead Ads, WeddingWire, The Knot are listed under an explicit "Future integrations" heading as static copy, not code.
- Direct consequence: *"if they need to check Facebook, email, The Knot, WeddingWire separately, Wevenu loses"* is exactly what happens today for any venue using more than one source.
- What's solid: the one built channel (embeddable form + manual entry) works well — real-time notifications, inline reply, real lead scoring/momentum language.
- Cheap bug: the automated form hardcodes `source = 'website_form'`, mismatching the `LEAD_SOURCES` dropdown's `'website'` — silently splits one channel into two in reporting.

### 3. Money — 🔴 Red *(2026-07-07: invoice balance-reset bug Resolved, Stripe facade Mitigated — see register)*
- See the Trust Risk Register above for the full, verified detail (Stripe facade, invoice balance-reset bug, no refund capability, double-marking, hard-delete gaps).
- Additionally: the contract-signing page carries zero venue branding; no automated "please sign" email exists; invoice emails are plain text with zero HTML despite the invoice *document* itself being properly branded; the `/payments` list page has zero responsive styling.
- What's solid: payment schedules/line items, invoice generation, and the underlying financial data model are mature and already power real reporting elsewhere.

### 4. Setup & Onboarding — 🟡 Yellow
- Fast, real 7-step setup wizard (only `name`/`timezone`/`ownerFullName` truly required); a real, non-decorative Getting Started checklist with working CTAs throughout.
- The wizard's own Payments step is a disabled "coming soon" placeholder — consistent with, and worth fixing alongside, the Money findings.
- No help center, tooltips, guided tour, or live-chat widget anywhere (checked for Intercom/Crisp/Zendesk/Drift/HelpScout — none present). The only support channel is an async ticket form.

### 5. Client Experience (Couple Portal) — 🟢 Green, leaning 🟡
- The most mature surface in the whole audit: 11,367 lines, 12 sections, 15 nav items, essentially no real "coming soon" stubs.
- Two concrete gaps: the seating-chart component has zero responsive classes, and there's no export of the couple's own data (guest list, budget, seating) — only import.

### 6. End-to-End Workflow Automation — 🟡 Yellow, leaning 🔴
- Real automation: playbook due dates computed relative to the event date, dependent-task blocking/unblocking, and 3 working auto-complete triggers, backed by a real cron-driven reminder engine.
- Confirmed dead trigger: `"payment_received"` is selectable and defaulted on two stock tasks, but nothing ever fires it — it will never auto-complete.
- The flagship "know where a customer stands, at a glance" promise isn't delivered — no combined progress view on the event page; the one `EventReadiness` score that exists is tucked into a different record's tab and can permanently under-report due to the dead trigger above.
- New this pass: the "contract signed" trigger actually fires on send, not on signature (see Trust Risk Register).
- The final-details questionnaire is fully manual-send with no scheduled trigger.

### 7. White Labeling — 🔴 Red
- The venue model already has a real 4-color system plus a logo field — mostly a "wire it through" problem, not a new-data-model problem.
- Couple portal: hardcoded Wevenu palette throughout, "Powered by Wevenu · {venue name}" footer.
- Emails: generic gray palette, single global `FROM_EMAIL`, several "Powered by Wevenu" footers, zero venue-color/logo usage anywhere.
- Contract-signing page: unbranded.
- PDFs are the bright spot — invoices, day-sheets, and floor-plan prints all correctly use the venue's real color and logo.
- No custom domain/subdomain support anywhere. No dedicated branding settings section (one card among ~ten on the general Settings page).

### 8. Calendar — 🟢 Green *(moved from Red 2026-07-07 — see register, TR-B1 Resolved)*
- A real, mature 7-source aggregation (events, tours, follow-ups, payments due, key dates, holds, admin blocks) in one month-grid view.
- ~~"No double booking" isn't true for the path that matters~~ — **fixed:** manual event creation/edit now hard-enforces space+time conflict checking server-side, matching the public tour widget. See `docs/trust-risk-register.md` TR-B1.
- Remaining gaps are completeness, not trust risk: no team-member visibility on the calendar grid itself; month-only view (no week/day).

### 9. Pipeline & Lead Management — 🟡 Yellow, leaning 🔴
- Reporting is a genuine strength: a real, DB-backed Lead Funnel report with conversion rate and by-source breakdown.
- Pipeline stages are completely fixed — 7 hardcoded statuses, no customization path anywhere. Directly contradicts "shouldn't have to change how they sell because of platform limitations."
- No lead-to-team-member assignment exists at all; every team member sees the same unfiltered list.
- Lead scoring/momentum language is real but purely informational — doesn't drive automation, and some of its own planned inputs are honestly marked "not yet wired" in the code.

### 10. Notifications, Permissions & Reporting — 🔴 Red
- Reporting is real and substantial (`/analytics`: lead funnel, events, payments, couple engagement, feature adoption, health scores, Luv roll-up) — a genuine strength, called out on its own merits.
- Permissions are entirely cosmetic — see the Trust Risk Register; this is the single most consequential completeness gap in this category, since it's also what enables several Trust Risk Register items (uncontrolled contract/payment deletion).
- "My Tasks" is confirmed mislabeled — shows every open lead-task venue-wide, not filtered to the current user; `event_tasks.assigned_to_staff_id` is populated but never displayed or filtered anywhere in the UI.
- Notification delivery (email + digest) itself is real and working; SMS/push are honestly labeled "Planned"/"Future" rather than silently broken.

---

## Release Gate — how we know it's time, without perfection becoming a moving target

Five questions, and all five have to be "yes" before Trust Beta invites go out:

1. Can a venue run their business?
2. Can a couple plan their event?
3. Can a vendor collaborate effectively?
4. Would I proudly demo this to a former customer?
5. Would I trust my own business on it?

Gates 4 and 5 are feelings, and feelings are elastic — you can always imagine one more polish pass that would make you *prouder*. So each gate below pairs the same five questions with a fixed, checkable answer:

1. **Can a venue run their business?** → Every Trust Risk Register item (Phase 1, in full) is shipped and verified. Not "mostly." All of them.
2. **Can a couple plan their event?** → Couple-side Phase 1/2 items shipped: data export, seating-chart mobile responsiveness, branded portal and emails, real messaging reachable from context.
3. **Can a vendor collaborate effectively?** → Vendor-side Phase 1/2 items shipped: real two-way vendor messaging, vendor payment visibility, floor-plan visibility.
4. **Would I proudly demo this to a former customer?** → One fixed demo script, run live, start to finish: all 5 named mobile scenarios, one real invoice, one real contract through signing, one real data export, one real refund/void if built by then. If any single step breaks on the day you run it, the answer is no — mechanically, not by feel. Same script every time.
5. **Would I trust my own business on it?** → Dogfood it: track Wevenu's own vendor relationships, contracts, and invoices inside Wevenu for a real stretch of time before Trust Beta opens. A lived fact, not a guess.

None of the five can quietly grow in scope after the fact — which is the whole point.

---

## What's already in better shape than you might expect

Worth naming explicitly, since a Register and Scorecard this Red-heavy could otherwise read as a general immaturity problem — it isn't:

- **The Couple Portal** is genuinely close to done — the standout of the whole audit.
- **Reporting** (`/analytics` and Wevenu HQ) is real, DB-backed, and substantial — a repeated strength even inside categories rated Red overall.
- **The underlying data models and daily-use mechanics** — playbook automation, the calendar's 7-source aggregation, the floor-plan editor, payment schedules — are consistently mature. Almost every Trust Risk Register item is a *specific missing or misleading piece sitting on top of a solid foundation* (a branding layer never wired through, a charge step never added on top of real account-linking, a status guard never added on top of a real update action) — not a feature built as a stub from scratch.
- **Wevenu HQ** already gives you the support/observability infrastructure this whole trust-rebuilding phase depends on.

That distinction matters for planning: most of what's flagged here is "finish the last mile on top of something real," which is more tractable than "build it from nothing" — and it's why Phase 1, while long, is mostly patches and guards rather than new subsystems.
