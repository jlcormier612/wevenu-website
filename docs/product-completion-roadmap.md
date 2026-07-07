# Product Completion Roadmap — Trust Rebuilding, Not MVP Validation

**Status:** v4 — reorganized around Programs, not sprints/phases. See `docs/product-promise.md` for the standing principles this roadmap exists to satisfy, and `docs/trust-risk-register.md` for the detailed, trackable risk list.
**Date:** 2026-07-07
**Context:** Strategic pivot — the first external beta cohort is former Weven customers (a competitor product shut down by The Knot), sophisticated venue operators who already know what great venue software feels like and were burned once by a platform disappearing on them. This is not an MVP-validation beta. It's a trust-rebuilding exercise. Every recommendation below is scoped against that bar, not a generic "polish list."

**Structure (this revision):** work is organized into 5 Programs, not sprints — a Program is a durable theme you invest in over time, not a fixed-length iteration. **Programs are worked in order: nothing in Program 2 gets sustained attention until Program 1 (Trust Foundation) is done.** Within Program 1, work is further split into two parallel tracks — Track 1 ("Never Harm a Customer," non-negotiable, fixed immediately) and Track 2 ("Earn Long-Term Trust," promises that need to inspire confidence, not bugs). Private Alpha and Trust Beta are gates that sit after Program 1 closes, not Programs themselves.

| Program | Theme | Contains |
|---|---|---|
| **1 — Trust Foundation** | *(current focus — see below)* | Trust Risk Register, Permissions, Financial integrity, Contract integrity, Audit logging, Data export |
| 2 — Venue Operations | Running the day-to-day | Calendar, Messaging, Floor plans, Documents, Workflows |
| 3 — Customer Experience | What couples/vendors feel | Couple Portal, White labeling, Onboarding, Mobile polish, Notifications |
| 4 — Intelligence | The differentiated moat | Luv, Analytics, Recommendations, Wevenu HQ |
| 5 — Ecosystem | Beyond a single venue | Marketplace, Vendor network, Ecosystem Luv |

Programs 2–5 absorb the old Bucket 2/3/4 gap-analysis findings below (Operational Completeness, Expectation Exceeders, Honest V1 Limitations) — that detail doesn't need to be redone, just re-homed under a Program instead of a numbered Phase when its turn comes.

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

**These operating principles are now formalized as `docs/product-promise.md`** — six standing promises (Financial Integrity, Legal Integrity, Operational Integrity, Transparency, Data Ownership, Auditability) that apply to every feature, not just Phase 1. The question "does this violate one of our promises?" is meant to outlive this specific beta push and become how features get proposed and reviewed going forward.

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

## Program 1 — Trust Foundation

*(the entire Trust Risk Register, plus Permissions/Financial/Legal/Audit/Data-export integrity work — see `docs/trust-risk-register.md` for IDs. Nothing in Program 2 gets sustained attention until this Program is done.)*

Split into two parallel tracks, per your framing: Track 1 is bugs — the software claims something true that isn't, or allows something that should never be allowed — and those are non-negotiable, fixed immediately. Track 2 is promises — not bugs, but the answers a sophisticated venue owner will demand during a demo ("what happens if I leave," "how do I issue a refund," "how defensible is this contract"), and those answers need to inspire confidence before Trust Beta.

### Track 1 — Never Harm a Customer *(non-negotiable, fixed immediately)*

| ID | Item | Status |
|---|---|---|
| TR-M2 | Invoice balance silently resets after partial payment | ✅ Resolved (2026-07-07) |
| TR-L1/TR-L2 | Signed contracts editable/deletable with no guard or audit trail | ✅ Resolved (2026-07-07) |
| TR-B1 | Double-booking not server-enforced on manual event create/update | ✅ Resolved (2026-07-07) |
| TR-M1 | Stripe Connect links an account but never charges a card | 🟡 Mitigated (relabeled honestly; real charging is Track 2 — see below) |
| TR-G1 | Permissions are entirely cosmetic | ✅ Resolved (2026-07-07) — migration, RLS, server guards, and team-roster UI all shipped per `docs/permissions-model-proposal.md` |
| TR-L4 | "Contract signed" automation fires on send, not on signature | ✅ Resolved (2026-07-07) |
| TR-M5 | Hard-delete of paid financial records, no guard | ✅ Resolved (2026-07-07) — folded in Owner/Manager-only delete gating from TR-G1 in the same pass |
| TR-M4 | Payments markable paid twice | Queued, same shape as TR-M5, small |
| TR-B2/TR-B3 | Silent email-failure on tour-confirmation and questionnaire sends | Queued |

Track 1's three non-negotiable items are now all closed. TR-M4/B2/B3 remain as smaller items of the same character (misleading or unguarded) — next up, not urgent enough to have blocked the three above.

### Track 2 — Earn Long-Term Trust *(promises, not bugs — need to inspire confidence, not just close a gap)*

| ID | Item | Status |
|---|---|---|
| TR-G2 | Data export — venue and couple side | Identified — highest-priority Track 2 item given this cohort's history |
| TR-M3 | Refund/void capability | Identified |
| TR-L3 | Enhanced e-signature evidence (IP/user-agent/consent capture) | Identified |
| TR-M1 (permanent fix) | Real Stripe payment collection | Identified — genuine feature build, not a patch |

Track 2 doesn't block Track 1 and can be scoped/built in parallel once Track 1's active three items land — but per Program 1's own rule, none of Program 2 starts until both tracks are closed.

**After Program 1 closes:** re-run the full Trust Beta Readiness Scorecard (below) category by category and update `docs/trust-risk-register.md`'s Status column for every item to Resolved. Comparing the before/after scorecard — how many of the 6 Red categories move to Yellow or Green — is the actual measure of whether Program 1 worked, not a feature count.

## Program 2 — Venue Operations *(Bucket 2 findings below, once Program 1 closes)*

## Program 3 — Customer Experience *(Bucket 3 findings below, alongside Program 2)*

## Program 4 — Intelligence *(Luv, Analytics, HQ — ongoing investment, not blocked by Programs 2/3)*

## Program 5 — Ecosystem *(Marketplace, vendor network — explicitly last, per your original call)*

## Gates after Program 1: Private Alpha → Trust Beta

**Private Alpha** (5–10 trusted non-former-customers; break workflows, uncover gaps, validate assumptions) → **Trust Beta** (former Weven customers; the reintroduction) → Public Beta once Trust Beta feedback is incorporated. Bucket 4 / Honest-V1-Limitation items get built opportunistically alongside Programs 2-3 or communicated as roadmap by Trust Beta — never silently absent, always named per the Transparency promise.

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
| 10 | Notifications, Permissions & Reporting | 🟡 Yellow *(moved from Red 2026-07-07)* | Reporting is a real strength. Permissions are now real — role enforced server-side and at the RLS layer, not cosmetic (TR-G1 Resolved). Stays Yellow, not Green: "My Tasks" is still mislabeled (shows every open lead-task venue-wide) and SMS/push remain honestly "Planned" |

**Original baseline: 6 of 10 Red, two of the three "Yellow" ratings leaning Red.** After Track 1 of Program 1 closed (2026-07-07): **Calendar moved Red → Green, Notifications/Permissions/Reporting moved Red → Yellow**, and Money's most dangerous findings closed (still Red overall — see Gap Analysis below — but the Stripe facade, the silent-erasure bug, and the last unguarded financial hard-delete are all gone). 4 of 10 remain Red. This is exactly the exercise to keep re-running as Program 1 continues — category movement, not ticket count, is the real measure.

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

### 3. Money — 🔴 Red *(2026-07-07: invoice balance-reset bug and hard-delete guard Resolved, Stripe facade Mitigated — see register)*
- See the Trust Risk Register above for the full, verified detail (Stripe facade, invoice balance-reset bug — both closed/mitigated — plus no refund capability and payment double-marking, still open).
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
- ~~The "contract signed" trigger actually fired on send, not on signature~~ — **fixed:** it now only fires from the real signing flow. See `docs/trust-risk-register.md` TR-L4.
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

### 10. Notifications, Permissions & Reporting — 🟡 Yellow *(moved from Red 2026-07-07 — see register, TR-G1 Resolved)*
- Reporting is real and substantial (`/analytics`: lead funnel, events, payments, couple engagement, feature adoption, health scores, Luv roll-up) — a genuine strength, called out on its own merits.
- ~~Permissions are entirely cosmetic~~ — **fixed:** real server-side + RLS enforcement across four roles (Owner/Manager/Coordinator/Staff), including delete-gating on contracts/payments and role/invite management. See `docs/trust-risk-register.md` TR-G1 and `docs/permissions-model-proposal.md`.
- Remaining gap, not a trust risk: "My Tasks" is confirmed mislabeled — shows every open lead-task venue-wide, not filtered to the current user; `event_tasks.assigned_to_staff_id` is populated but never displayed or filtered anywhere in the UI.
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
