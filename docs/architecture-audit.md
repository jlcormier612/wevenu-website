# Architecture Audit — Every Subsystem Against the Product Promise and Engineering Standards

**Status:** One-time architectural audit, 2026-07-07. Not a Trust Risk Register in itself — a survey to find the *next* register before it becomes customer-facing. Where a finding looks register-worthy by the register's own severity bar, it's flagged explicitly; nothing below has been added to `docs/trust-risk-register.md` yet without a separate decision.
**Method:** Four parallel research passes, each auditing 3 subsystems against `docs/product-promise.md` (six promises) and `docs/engineering-standards.md` (eight standards), answering the same five questions per subsystem: single source of truth, promise violations, standard violations, hidden technical debt, and what would make it feel like infrastructure rather than software. Every claim below is grounded in a specific file:line citation from the actual codebase, not inferred from a feature list.

---

## Executive summary

Twelve subsystems, ranked most → least architecturally mature:

1. **Contracts** — clean source of truth, genuinely good append-only design chosen independently of the trust audit. Two narrow gaps found (below), not structural.
2. **Wevenu HQ** — consistent RLS discipline, no service-role shortcuts, honest labeling of unbuilt features. Only minor audit-trail gaps.
3. **Calendar** — thin, well-scoped aggregator over mostly-correct sources; its flaws are one well-understood pattern (TR-B4 and its echoes), not several unrelated ones.
4. **Payments/Invoices** — the core ledger is the most standard-compliant money code in the app; its gaps are in peripheral display surfaces that weren't revisited when refunds shipped.
5. **Leads** — solid single-writer discipline; carries the tour-staleness echo and the already-triaged cross-entry-point dedup gap (Program 2 work, not a trust risk).
6. **Floor Plans** — small and internally clean; its debt is external (isolated from Seating, invisible to data export).
7. **Automation (Playbooks)** — clean layering undermined by a live, currently-shipping instance of the exact bug class TR-L4 was supposed to be a one-off example of.
8. **Messaging** — the email-thread half is well-built; the couple-chat half is thin, unlayered, and has real, currently-broken code paths.
9. **Vendor Portal** — sound patterns, but a late migration silently broke the primary vendor-facing RPC, and a second surface is structurally unreachable by construction.
10. **Documents** — not a coherent subsystem at all; three tables, three RLS lineages, one of them (`venue_users`) silently stale across a dozen features.
11. **Client Portal** — the most feature-complete surface in the product, and the most consequential access-control gap found in this whole audit: restricted portal links don't actually restrict anything outside the original two sprints.
12. **Luv** — the subsystem marketed as the product's moat is, by this audit, the least structurally sound: most of its "learned intelligence" layer references a table that doesn't exist and has apparently never run successfully.

**Five findings cut across multiple subsystems and are worth naming once, up front, rather than only inside their subsystem section:**

- **A stale compatibility view (`venue_users`) silently ignores staff deactivation across roughly a dozen features** (couple documents, budget, RSVP, seating, feedback, Luv, venue operational info) — a removed team member keeps full access to all of them indefinitely. This is the single most consequential finding in the audit: it's a Governance-shaped failure of the same kind TR-G1 fixed, just reached through a different, forgotten door.
- **The exact "old field, new source of truth, nobody updated every reader" shape (Engineering Standard #7 / TR-B4) recurs at least five more times independently**: lead commitment scoring, playbook auto-complete triggers, the couple portal's payment totals, Luv's venue-resolution logic (four different patterns coexist in Luv's own SQL), and the vendor portal's RLS-vs-RPC split. This isn't twelve unrelated bugs — it's one architectural failure mode the codebase keeps reproducing because nothing structurally prevents it.
- **"Looks live, silently does nothing" shows up as a genuine pattern**, not an occasional accident: the couple-chat webhooks, the token-based vendor portal, and the majority of Luv's database-backed layer all read as fully built, fully wired into the UI, and non-functional — each invisible because every caller treats an error the same as "no data yet."
- **Contracts' own hardening (TR-L1/TR-L2/TR-L3) didn't reach every path to the same effect** — `sendContract`/`cancelContract` can silently re-arm a signed contract for a second signature, and a separate RLS policy lets an unauthenticated request read any venue's sent/signed contract by guessing its ID rather than its secret token. This is Engineering Standard #5 (close every alternate path) not fully applied to the very work that standard was extracted from.
- **A second, independent instance of TR-G1** ("permissions are cosmetic") exists on the couple-facing side: a contact explicitly restricted to `portal_role: "financial"` or `"view_only"` can still read the full guest list, seating chart, and RSVP/dietary detail through every RPC added after the original two sprints that built the restriction.

---

## MESSAGING

**1. Single source of truth?** No — two entirely separate, non-overlapping systems. `message_threads`/`messages` (`lib/messaging/repository.ts`) is an outbound-email log surfaced only on Lead/Client/Event detail pages. `couple_threads`/`couple_messages` (`supabase/migrations/20260702950000_sprint95_couple_messaging.sql:17-49`) is real bidirectional chat, surfaced via the main-nav inbox and the couple portal. Both key to the same `client_id`; nothing joins them. A coordinator on a client's detail page cannot see the couple's actual replies.

**2. Product Promise violations.** Transparency (#4), twice. (a) The couple-messaging RPCs (`get_couple_inbox`, `send_couple_message`, etc.) resolve the venue via `venues.owner_user_id = auth.uid()` only — never updated to `current_user_venue_id()` after Sprint 107 added it for exactly this case. Any invited Manager/Coordinator/Staff sees a clean "No conversations yet" — indistinguishable from actually having none — when the real problem is they're locked out. (b) The inbound-email-reply and delivery-tracking webhooks (`app/api/messaging/inbound/route.ts`, `app/api/messaging/webhook/route.ts`) call the cookie/anon client instead of `createAdminClient()` (the documented pattern for exactly this case, used correctly in `lib/contracts/service.ts`). Every write these routes attempt is rejected by RLS with no error check, and both routes still return `{ok:true}`.

**3. Engineering Standard violations.** #7 (update every reader when a new source of truth replaces an old one) — same failure shape as TR-B4, here on the couple-messaging RPCs. #6 (verify against real data) — the webhook routes read as having never been executed against a real signed webhook payload under real RLS.

**4. Hidden technical debt.** The owner-vs-`current_user_venue_id()` gap is a clean example: correct on day one (solo-owner venues, all this was tested against), silently wrong the moment a real venue invites staff — the exact scenario Sprint 107 shipped to support.

**5. Infrastructure vs. one-off.** The email-thread half matches Contracts/Invoices layering. The couple-chat half skips repository/service almost entirely — routes call `supabase.rpc()` directly and hand raw jsonb to the client, where an error response and a valid-but-empty response look identical.

---

## CONTRACTS

**1. Single source of truth?** Yes, cleanly. `contracts` is the one record for identity/status/signed text; content is a resolved snapshot at creation (`supabase/migrations/20260626300000_contracts_foundation.sql:47`) — editing a template never retroactively changes an issued contract. Good design, chosen independently of this trust push.

**2. Product Promise violations — new, unresolved.** Legal Integrity (#2). TR-L1/TR-L2 hardened `updateContractContent` and `deleteContract` with status guards, but `sendContract`/`cancelContract` → `updateContractStatus` (`lib/contracts/repository.ts:165-171`) has **no status guard at all**. Calling send on an already-`signed` contract silently flips status back to `sent`, overwrites `sent_at`, and — because `sign_contract()`'s own guard is `where status = 'sent'` — re-arms the still-valid sign token for a second signature, overwriting the original signer name, timestamp, IP, and consent record. The UI only hides the button for `draft` contracts (`components/contracts/contract-detail.tsx:118`) — the exact "UI hides it, server doesn't check" shape TR-L1's own writeup warned against, on a path that fix didn't cover.

**3. Engineering Standard violations.** #2/#5 (close every alternate path) — the hardening pass stopped short of the status-transition endpoint. #3 (RLS as backstop) violated at the database layer specifically: `contracts_sign_read` grants SELECT to any unauthenticated request where `status in ('sent','signed')`, with **no sign_token check** — the token is enforced only in application code. Because this is a separate, permissive policy from the role-gated `contracts_select`, Postgres ORs them: anyone who knows or guesses a contract's `id` (not its secret token) can read the full text and signer name of any venue's sent-or-signed contract. RLS here is a bypass of the token check, not a backstop for it.

**4. Hidden technical debt.** Both gaps work today purely because the app never exercises the alternate path. Either breaks the moment a contract `id` leaks outside the app, or a bug/race calls send on an already-signed record.

**5. Infrastructure vs. one-off.** The most mature subsystem in the audit — matches invoices/payments layering, consistent activity logging except at the one gap, independent good judgment in the content-snapshot design.

---

## DOCUMENTS

**1. Single source of truth?** No — "Documents" is three unrelated stores that all get called "documents": the generic venue-side `documents` table (category enum including `'contract'`), `couple_documents`, and the couple portal's Documents tab, which is a hand-written UNION of `contracts` + `invoices` + `couple_documents` (`get_couple_documents`) that **never queries the venue-side `documents` table at all**. A coordinator who uploads a scanned contract and tags it `category='contract'` gets no error and no indication the couple will never see it.

**2. Product Promise violations.** Transparency (#4) — the misleading `'contract'` category above. Data Ownership (#5), likely — `get_venue_export` (TR-G2) doesn't include the `documents` table; a venue's actual uploaded files appear absent from "your data."

**3. Engineering Standard violations — the standout finding of the whole audit.** #7. `venue_users` (a compatibility VIEW over `venue_staff`, hardcoding `true as is_active` for every row) is the RLS gate for `couple_documents`, `venue_operational_info`, and roughly a dozen other subsystems (budget, RSVP, seating, feedback, Luv) — never updated after Sprint 107 added the real `venue_staff.is_active` flag and taught `current_user_venue_id()` to check it. `removeStaffMember` performs the correct soft-delete, but **any table still gated through `venue_users` doesn't honor that flag at all: a removed team member keeps full access indefinitely.** TR-G1's own verification exercised `current_user_venue_id()`-gated tables, not this one — "removing a team member fully revokes access" was never actually tested against this still-live code path.

**4. Hidden technical debt.** The `venue_users` gap above. The three-way document fragmentation is the second: harmless until a coordinator does the entirely plausible thing of uploading a paper-contract scan and expecting the couple to see it.

**5. Infrastructure vs. one-off.** Mixed. The venue-side library itself is clean. "Documents" as a couple-facing concept is an ad hoc aggregation from three different sprints, each with its own RLS pattern — the most accreted-rather-than-designed subsystem found.

---

## CALENDAR

**1. Single source of truth?** Mostly, with one already-known exception and one new one. TR-B4 (registered) covers the "tour" source reading stale `leads.tour_date` instead of `tour_appointments`. New: **`date_holds.expires_at` is set at insert and never read or enforced anywhere in the codebase** — no cron/worker checks it — so the calendar's hold query (`status = 'active'`) shows a hold as active forever past its intended expiry unless a human manually releases it. Events, payment-due dates, key dates, and calendar blocks are each clean single-table reads with no drift risk.

**2. Product Promise violations.** Transparency (#4) via the already-registered TR-B4 mechanism; no new violation among the other 6 sources.

**3. Engineering Standard violations.** #7, same root cause as TR-B4 — and it has a second live consequence beyond calendar display: `checkAvailability()` (`lib/availability/repository.ts:187-195`) independently reads `leads.tour_date`/`tour_completed` rather than `tour_appointments`, meaning the same stale source also silently **undercounts real tour capacity**, not just visibility.

**4. Hidden technical debt.** The unenforced `date_holds.expires_at` works today only because coordinators apparently convert or manually release holds before anyone notices a stale one. The day a venue relies on auto-expiring holds, the calendar (and `checkAvailability`'s hold warning) will keep blocking past the hold's intended lifetime.

**5. Infrastructure vs. one-off.** A clean, well-documented aggregator that composes existing repositories rather than owning new state — the debt is entirely in what it reads from, not how it's built.

---

## LEADS

**1. Single source of truth?** `leads` (plus notes/tasks/activities) is the clear system of record — `lib/leads/repository.ts` explicitly documents itself as the only writer. But "has this lead had a tour" is read from three places that can disagree: manually-set `leads.tour_date`/`tour_completed`; the real `tour_appointments` table written by public booking; and lead commitment scoring (`lib/leads/scores.ts:104-105`), which reads only the manual fields — so a lead who booked a real tour through the public widget is systematically under-scored versus one a coordinator hand-entered. One path gets this right: `updateLeadStatus`'s "won" handler correctly queries `tour_appointments`.

**2. Product Promise violations.** None of the six map cleanly onto pre-booking Leads; the under-scoring above is a data-quality bug, not a promise breach as defined.

**3. Engineering Standard violations.** #7 again, a second independent location beyond the registered TR-B4 instance. #1 is actually followed well here — `computeLeadCommitmentScore` recomputes fully from source on every call rather than patching a stored value; it's just fed a stale input.

**4. Hidden technical debt — the un-registered dedup gap** (by product decision, Program 2 architecture work, not a trust risk, per prior conversation). Confirmed at the code level: `create_public_lead()` and `book_tour()` each do an unconditional insert with zero lookup against existing leads by email/phone. This means "lead" is not a stable identity today — it's a per-submission record — which will complicate any future feature assuming one couple maps to one lead.

**5. Infrastructure vs. one-off.** Follows the same repository/service/validation layering as the rest of the app; RLS correctly uses the shared `current_user_venue_id()` helper. Missing the operation-split, role-aware RLS TR-G1 gave contracts/payments (any team member can delete a lead) — a minor consistency gap, out of TR-G1's stated scope.

---

## AUTOMATION (Playbooks)

**1. Single source of truth?** Yes, cleanly — `event_tasks` is the one record of task state; no competing table represents completion.

**2. Product Promise violations — new, beyond the resolved TR-L4 case.** Transparency (#4). `AUTO_COMPLETE_TRIGGERS` exposes 7 selectable trigger values in the UI (`lib/playbooks/constants.ts:28-36`), including `payment_received`, `document_uploaded_insurance`, `floor_plan_created`. Only 3 of the 7 (`contract_signed`, `questionnaire_submitted`, `timeline_created`) are ever actually fired anywhere in the codebase. **The other 4 are structurally dead — including `payment_received`, which two of the 12 default template tasks use** ("Deposit received," "Final payment due"). `lib/payments/service.ts` writes a similarly-named `payment_activities` log row, but it's a different string in a different table that never reaches the trigger function. A coordinator on the default Wedding template sees these tasks sit pending/overdue forever, even after the payment is actually collected.

**3. Engineering Standard violations.** #2, directly, and this answers the audit's specific question: TR-L4 was not a one-off. The trigger *menu* (what the dropdown promises) and the actual firing logic (what code calls `triggerAutoComplete`) are maintained in two unconnected places with nothing enforcing they stay in sync — the same bug shape can and does recur.

**4. Hidden technical debt.** `task_reminders` rows are explicitly built as inert — a code comment says "pending until Sprint 44 delivery engine" — honestly scaffolded, not hidden, but a coordinator could reasonably assume a populated reminders table means reminders are firing.

**5. Infrastructure vs. one-off.** Layering (repository/service, auth guard, dependency-chain unblocking) is as mature as Leads/Calendar. The gap isn't cohesion — it's that nothing (a lint rule, a registry, a test) enforces every declared trigger has a live caller.

---

## PAYMENTS (incl. Invoices)

**1. Single source of truth?** `payment_line_items` is the real ledger; `invoices.balance_due` and `payment_schedules.total_amount` are both denormalized caches. Post-TR-M2/TR-M3, the two invoice/payment total computations deliberately share identical logic — good. But **`payment_schedules.total_amount` is never recomputed from its own line items** — the one function that could (`updateScheduleTotalAmount`) has zero callers. The coordinator UI itself proves this drifts: `payment-schedule-detail.tsx` computes a separate `allocated` sum and shows an "Over-allocated" warning when it disagrees with `schedule.totalAmount` — two representations of the same fact, only a cosmetic warning, no reconciliation.

**2. Product Promise violations.** Financial Integrity/Transparency: the couple-facing payment view (`components/portal/payment-section.tsx`) computes its own totals independently rather than calling the shared, refund-aware `computeTotalPaid` — its local status type doesn't even know `partially_refunded`/`refunded` exist. A refunded line item renders as a plain "Upcoming" pill, and the couple's own displayed total-paid figure is wrong the first time a refund happens.

**3. Engineering Standard violations.** #7 — refund statuses were propagated into the coordinator view and shared constants but not into the couple portal or `lib/luv/portal-observations.ts`'s payment observations (same stale filter). #1 — the `payment_schedules.total_amount` non-recomputation is the same defect class TR-M2 fixed for invoices, left open on the sibling table.

**4. Hidden technical debt.** No revenue/analytics roll-up exists yet, so refund-unawareness hasn't hit a dashboard — but it's already hit two live readers: lead commitment scoring (`hasPayment` checks `status='paid'` only, so a score silently drops after a full refund) and Luv's event-readiness "deposit received" checklist (a refunded item still reads as complete).

**5. Infrastructure vs. one-off.** The core ledger is genuinely solid post-fixes. What keeps it from full infrastructure status: the couple-portal read path was built once, early, and never revisited when refunds shipped.

---

## FLOOR PLANS

**1. Single source of truth?** `floor_plans`/`floor_plan_objects` is clean for the venue's physical layout, but "table layout for this event" is *also* independently represented by the entirely separate seating system (`couple_seating_arrangements`/`seating_tables`/`guest_seat_assignments` — different canvas size, different table records) with zero cross-references either direction. A coordinator's floor plan and the couple's seating tool can diverge with nothing to flag it.

**2. Product Promise violations.** Data Ownership — floor plan data is absent from `get_venue_export` (TR-G2).

**3. Engineering Standard violations.** None on permissions/enforcement — RLS and service layering are correct and consistent. The seating/floor-plan non-unification is closer to Standard #7's spirit than a literal violation, since neither table replaced the other.

**4. Hidden technical debt.** `getFloorPlanByEvent` fetches every floor-plan object across the venue's *entire history* and filters client-side — harmless today, silently worse every year as history accumulates. Also: no role restriction on `clearFloorPlan`/`deleteObject_` — any staff role can wipe an entire floor plan, unaddressed the way TR-M5 was before its fix (lower severity, no money/legal exposure, same shape).

**5. Infrastructure vs. one-off.** Internally clean, no bugs within its own files — the gap is external isolation from Seating and invisibility to data export.

---

## CLIENT PORTAL

**1. Single source of truth?** `client_portal_sessions.access_level` plus `client_contacts.portal_role` are supposed to jointly answer "what can this person see," per a documented "four-question access model." In practice this is computed two different ways depending which RPC you call: `get_portal_tasks`/`get_couple_guests` correctly gate on effective role, but `get_portal_payments`, `get_portal_budget`, `get_seating_data`, and `get_portal_export` (TR-G2) validate only that the token is unexpired — **none check `access_level` or `portal_role` at all.**

**2. Product Promise violations — a second, independent TR-G1.** Transparency. A coordinator can assign a contact a restrictive `portal_role` ("financial" = invoices/payments only; "view_only" = read-only, no completions) and the UI shows a badge implying that's real. But `createContactPortalSession` hardcodes `access_level: "couple"` on the session row (comment: "overridden by contact.portal_role at runtime") — and since half the RPCs never perform that override-check, **a contact explicitly scoped to "financial" or "view_only" can still pull the full guest list (with RSVP/dietary detail), seating chart, and budget breakdown.** Architecturally identical to TR-G1, on the couple-portal side, not previously logged.

**3. Engineering Standard violations.** #2, directly: the invariant is enforced at the original entry points (Sprint 42/49) and silently absent at every one added afterward (payments: sprint 79; seating: sprint 74; budget: sprint 72/113; export: TR-G2). The UI never even surfaces the concept — `portal-shell.tsx` (4,285 lines) has zero references to `context.accessLevel`.

**4. Hidden technical debt.** Entirely latent today: the one exposed "create portal link" UI always creates a full `'couple'`-level link; the gap is only reachable via a secondary, less-obvious per-contact flow, which is exactly why nobody has noticed a "Dad — financial only" contact seeing the full guest list.

**5. Infrastructure vs. one-off.** The highest feature ambition in the codebase — real capability-token design, a documented access model — but the one property that most needed to be infrastructure-grade (permissions on a multi-actor surface) was built with real discipline once and not carried forward as later sprints bolted on new sections. Each new RPC reads like it was written in isolation from the access-control contract the earlier ones established.

---

## VENDOR PORTAL

**1. Single source of truth?** Core split (`vendors` global + `venue_vendor_relationships` per-venue) is clean, but `vendors.is_claimed`/`claim_token` and `vendor_invitations.status` are both "has this vendor accepted?" signals that never sync — `claim_vendor_profile()` updates `vendors` but never `vendor_invitations`, so HQ/activation code permanently misreports claimed vendors as stuck-pending.

**2. Product Promise violations.** Auditability, inconsistently honored: the token-portal RPC stamps `completed_by='vendor'`, but the authenticated-portal equivalent discards the vendor-id parameter and records no actor. Transparency, for the entire token-link portal and event drill-downs, which look live but silently fail (below) rather than being labeled incomplete. Operational Integrity: `vendor_availability` was designed so venues check it before booking, but `assignVendor` never reads it — a vendor can block a date and still get assigned to it.

**3. Engineering Standard violations — headline finding.** #8 (migration/schema hygiene): a later migration recreates `get_vendor_portal_context()` referencing a column (`v_vendor.name`) an earlier migration had already renamed to `business_name` — **this RPC, the backbone of the entire token-based vendor portal, throws on every call today.** #5: the RLS-recursion fix only patched three vendor tables, leaving `vendor_packages`/`vendor_availability`/`vendor_reviews` on the old pattern. #3: `vendor_packages` service functions rely solely on RLS with silent `{ok:true}` on failure; `vendor_health_scores` has no RLS/grants at all.

**4. Hidden technical debt.** The token-based `/v/[token]` portal is fully broken in production right now — the error is swallowed and just renders `notFound()`. Separately, the authenticated portal's event views are structurally unreachable: their RLS gates on `current_user_venue_id()`, which resolves to `NULL` for vendor sessions — silently empty for every real vendor login, unnoticed because profile/packages/availability/inquiries/tasks (correctly RLS'd) work fine and create false confidence.

**5. Infrastructure vs. one-off.** Mostly genuine, consistent infrastructure — the vendor-side helper mirrors the venue-side one, RLS+grants are the norm on all but one table. The problem is sequencing: two vendor-facing access strategies were built for two different surfaces and never reconciled, and a late migration broke the older one.

---

## LUV

**1. Single source of truth?** Two architecturally different halves: a genuinely stateless pure-TS layer (no staleness risk) and a Postgres-cached "learned" layer. More seriously, **"Luv" is reimplemented four separate times with no shared engine**: the real dashboard engine, HQ's separate rules pass (explicitly not wired to the real engine per its own code comment), the vendor portal's hand-rolled inline computation (zero imports from `lib/luv/*`), and the couple portal's standalone Claude route. Same branding, four unrelated codebases that can trivially disagree.

**2. Product Promise violations.** Transparency, concretely: "Story Mode" is fully built and styled but its backing RPC has never worked (below), so it renders nothing — indistinguishable from "no news," a shipped-looking feature that silently never fires. Auditability: `luv-ask` answers couple questions but persists no record of the exchange.

**3. Engineering Standard violations — the most severe finding in the entire audit.** #8: nearly every Luv compute/get RPC across six-plus migrations selects from `venue_users` — **a table never created in any migration** (a later migration's own comment admits it: "joined through a venue_users table that no longer exists"). Sprint 107 fixed the *RLS policies* to use `current_user_venue_id()` but never touched these RPC *bodies* — so the core memory/insights/health-score/recommendations functions **throw on every invocation today**, silently swallowed by every caller (`if (error || !data) return null`). A second, independent instance: `get_venue_trends()` queries a nonexistent table and a nonexistent column — never worked. At least four inconsistent "resolve the caller's venue" patterns coexist within Luv's own SQL alone.

**4. Hidden technical debt.** The entire DB-backed half of Luv — memory, insights, health scoring, recommendations — is likely non-functional for every venue right now, invisible because every consumer treats "no data" as an expected new-venue state rather than an error.

**5. Infrastructure vs. one-off — does the "moat" framing hold up? No.** The pure-TS observation layer is genuinely solid. But the marketed differentiator — persistent memory, confidence-scored insights, health scoring, recommendations, outcome tracking — has shipped across seven-plus migrations referencing a table that doesn't exist, never exercised against live data, with venue-resolution implemented four inconsistent ways within Luv's own SQL, and reimplemented independently three more times elsewhere in the app. This reads as scaffolding with the appearance of infrastructure, not a moat.

---

## WEVENU HQ (audited as "can our own team trust this," not "can a customer")

**1. Single source of truth?** Clean — HQ never independently recomputes activation figures, both HQ and the venue's own dashboard read the same underlying function. The real gap is staleness: activation scores only recompute when a venue owner loads their own dashboard — no platform-wide cron — so a fully churned venue (exactly HQ's at-risk triage target) shows a frozen score indefinitely.

**2. Product Promise violations.** Largely clean — unbuilt nav items are honestly labeled "Soon," and the Support page explicitly states what's not instrumented rather than faking an empty state. Auditability is the one soft spot: the "View As" audit write is fire-and-forget, and more substantively, the *ordinary* venue detail page — visited far more often than the separate "View As" button — reads identical cross-venue PII via the same admin RLS policies and logs **no audit event at all**. The promise is enforced on the less-used entry point, not the more-used one.

**3. Engineering Standard violations.** #3 is respected — the service-role client is used only in three narrow, documented, non-HQ contexts; every HQ path goes through the regular RLS-bound client. One real gap: a regression fix narrowed an engagement-event guard's actor-type check but never revoked PUBLIC execute on the underlying function — any authenticated user can still call it directly with an arbitrary actor type and venue_id, fabricating engagement events for a venue they don't own.

**4. Hidden technical debt.** No self-service HQ-admin management UI (manual SQL bootstrap) — fine for a 1-2 person team, not durable at scale. The "read-only" View As boundary is enforced by page-level component omission, not a data-layer distinction — a future shared-service field could leak into the read-only view unnoticed.

**5. Infrastructure vs. one-off.** Built consistently with the rest of the app; migration numbering is currently collision-free (confirmed by direct check), meaning the historical timestamp-collision issue is resolved for now — though the resolution method (rename rather than remove) is the same fragile pattern Standard #8 warns about and is worth re-checking periodically rather than assumed permanently fixed.

---

## What this audit is for

This isn't a new to-do list to work through top to bottom — it's a map of where the codebase's actual guarantees diverge from its apparent ones, organized so the next prioritization conversation starts from evidence instead of guesswork. Several findings above meet the Trust Risk Register's own bar (misleading rather than honestly-absent, or a live security/access-control gap) — those are called out separately rather than added unilaterally, the same way TR-B4 was proposed before being added.
