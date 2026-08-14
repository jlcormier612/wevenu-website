# Product Completion — Current Release-Readiness Master Inventory

**Type:** Research / reconciliation only. Nothing in this document was built to produce it.
**Date:** 2026-08-13
**Method:** Reconciled `docs/product-completion-roadmap.md` (2026-07-07, self-superseded), `docs/release-readiness-status.md` (2026-07-17, self-superseded), `docs/platform-status-snapshot.md` (2026-07-22, "single current answer," self-corrected once since), and `docs/release-readiness-reconciliation.md` (2026-08-11, most recent full reconciliation, verdict **READY WITH NAMED CAVEATS**) against the current working tree and every implementation/verification report for the 11 workstreams completed since 2026-08-11, plus five targeted research passes covering Luv, Seating, Key Dates, Manager Permissions, Wedding Website, and four smaller named items. No code, database, migrations, UI, Help content, or documentation was modified to produce this document.

**Reading order:** the 2026-08-11 reconciliation is treated as the settled baseline for Trust Risk Register / Engineering gates — its "Certified Complete" section is not re-litigated item by item here. This document's job is (a) fold in everything that happened *after* 2026-08-11, and (b) resolve four product areas (Seating, Key Dates, Manager Permissions, Wedding Website, Luv) the 08-11 pass cited from older docs without re-checking them.

---

## 1. COMPLETE / VERIFIED

| Item | Why A | Evidence | Source |
|---|---|---|---|
| **Trust Risk Register** (24/25 Resolved, 1 substantially built) | Independently reconciled and, for 3 blockers + 1 upgrade, live-remediated on 2026-08-11 | Real per-role DB sessions, real `next build`/`tsc`, 30+ live checks across R1–R4/F1–F4 | `docs/release-readiness-reconciliation.md` |
| **Engineering gate** (build, staff-invite routing, delete-safety on Contracts/Payments/Team/Invoices, Timeline/Floor-Plan/Inventory-Template delete-safety, `/api/notifications`+`/api/tours` PUBLIC_PATHS narrowing) | Same reconciliation; all fixes live-validated with real per-role sessions, not source-only | 60+ live checks, `next build` clean twice, `tsc` clean, 465/465 tests | `docs/release-readiness-reconciliation.md` §R1–R4, F1–F4 |
| **`STARTER-LIBRARY.md` doc drift** | Corrected against real shipped starter files | Direct file comparison | `docs/release-readiness-reconciliation.md` §F5 |
| **Vendor RLS remediation — the two approved policies** (`venues_manage_relationships`, `venues_see_vendor_team`) | Independently re-verified twice by me this engagement, live + DB, both passes | Live Owner/Manager browser sessions, rolled-back DB predicate simulation, `tsc`/565-565 test | `docs/vendor-lifecycle-status-remediation-verification.md`, `docs/vendor-and-help-content-independent-verification.md` |
| **Help content — Event Day / After the Event / Reports (8 articles)** | Independently verified live by me this session: published, correct category, taxonomy unchanged, every procedural UI claim checked against the live product with no discrepancies | Live browser (8/8 articles opened, back-nav, taxonomy), DB query, source diff, `tsc`/565-565 test | `docs/vendor-and-help-content-independent-verification.md` |
| **Help content — P0 set (18 articles)** | Same live session incidentally rendered all 18 titles/categories correctly on `/help` while verifying the taxonomy for the 8-article set above; content itself is low-risk (documentation, not code) | Live `/help` page text capture (this session) + the doc's own `tsc`/538-538 test + 57/57 browser smoke | `docs/help-guides-p0-content-implementation.md` |
| **Left Navigation restructure** | The exact 8-group sidebar structure this doc claims (Overview/Sales/Clients/Communication/Tasks/Financials/Library/Your Venue) was independently, incidentally confirmed live by me today, in an unrelated session, reading the same sidebar while verifying Help content | Live sidebar text capture (this session) matches the doc's claimed structure exactly; doc's own browser check (destinations all 200) + `tsc`/484-484 test | `docs/left-navigation-implementation.md` |
| **Brand Promise copy remediation** | Single-string Settings copy fix, self-evidently low-risk, before/after text confirmed | Browser check confirming old false claim gone, new copy present | `docs/brand-promise-and-contract-branding-remediation.md` |
| **Contract Branding Snapshot** | Real before/after reproduction test (Brand A → send → change to Brand B → already-sent contract still shows Brand A), not just a static check | DB + browser evidence at `docs/qa/brand-promise-contract-branding-evidence/`, `tsc`/506-506 test | `docs/brand-promise-and-contract-branding-remediation.md` §2 |
| **Lead/Client duplicate-on-import fix** (`findActiveDuplicate` dedup check + `clients_lead_id_unique` index) | Narrow, DB-level reproduction test (constraint mechanically blocks a second insert) | Direct DB reproduction, `tsc` clean | `docs/lead-pipeline-release-readiness.md` |
| **Manager Permissions** (refund RLS backstop, 40-table delete role gate, invite-identity check) | Three sequential docs ending in live re-validation with real second/third accounts against explicit pass/fail criteria, verdict "formally closed" | Real invite flow, real cross-role delete/refund attempts, before/after | `docs/manager-permissions-final-release-readiness-report.md` |
| **Event Order minimum-safe-release implementation** (as distinct from the controlled-release verification below) | HQ enable control, $0-total warning, focused tests, D7A duplicate cleanup all built and self-tested; **0 of 8 venues currently have the flag enabled**, independently re-confirmed by direct query this pass | `tsc`/549-549 test, 17/17 browser smoke, live DB query this pass | `docs/event-order-minimum-safe-release-implementation.md` |
| **Automation P1 — Tour Completed trigger, per-enrollment pause/resume, confirm-dialog message preview** | Real migration, real trigger wiring, strong self-reported evidence | `tsc`/538-538 test, 31/31 browser QA | `docs/automation-sequence-p1-implementation.md` |
| **Platform terminology pass (2026-07-21)** | This is a *completed*, already-shipped implementation report (nav labels, page titles, component copy), not a future plan — confirmed by direct read this pass | `tsc`/`next build` clean, file-by-file change log | `docs/terminology-standardization-report.md` |
| **Booking Financial Architecture, Phases 0–4** | Shipped and verified per the roadmap and final release assessment; not independently re-verified this pass, but no later doc or research pass this round contradicts it | `docs/booking-financial-architecture-final-release-assessment.md`, `docs/booking-financial-architecture-roadmap.md` |
| **Luv — stateless observation engine + opt-out** | Computes fresh from live tables every load, no persistence dependency; the `luv_settings.observations_enabled` toggle is a real data-layer gate (`lib/luv/observations.ts:55`), not cosmetic | Direct source read this pass, confirmed live-load pattern unchanged since original audits | `docs/new-venue-morning-ux-audit.md`; source-verified this pass |
| **Luv — learned layer core** (memories/insights/recommendations/celebrations) | The original "`venue_users` never created" diagnosis was factually wrong (confirmed: it's a real view, present since early migration history) — the real, narrower bug (Story Mode's `get_venue_trends()`, three unrelated column/table-name errors) was fixed and is now populated with real dev data | DB query: 8/4/1/12 real rows across memories/insights/recommendations/celebrations; migration `20260829000000_luv_infrastructure_repair.sql` | `docs/luv-experience-completion-report.md` (2026-07-17), independently re-confirmed this pass |
| **Wedding Website / Hosted Experience — RC1 human visual acceptance** | The only open question against this item was whether the human visual acceptance required by the Coastal/4A/4B reports had actually been obtained before the RC1 certification declared readiness — the certification chain itself never recorded an explicit answer either way. That uncertainty is now resolved. **Human visual acceptance: COMPLETE — confirmed by Jennifer on 2026-08-13.** No new code-level test or automated certification was created; this is a human acceptance/sign-off closure, recorded here because the prior chain of reports failed to record it themselves. | Direct human confirmation, 2026-08-13 | `docs/wedding-website-coastal-art-direction-completion-report.md`, `docs/hosted-experience-release-certification.md`; closure recorded in this document |

---

## 2. IMPLEMENTED — FINAL VERIFICATION REMAINING

| Item | Why B, not A | Evidence gap | Next action | Source |
|---|---|---|---|---|
| **Library IA** (Inventory moved to Planning group, 2 copy-string changes) | Self-report only; unlike its Left Nav sibling, no browser-QA evidence artifacts cited, and I found no incidental live corroboration this pass | No live/independent check | 10-minute live click-through of the moved Inventory entries + the 2 changed copy strings | `docs/library-ia-implementation.md` |
| **Vendor Manager access to `vendors` table — same-day live UI edit path** | The approved RLS *predicate* is independently DB-verified correct; the actual Manager end-to-end UI edit still cannot be reached (blocked by the separate `vendors` table gap in §3) | No live UI path exists to test | Resolve the C-item in §3 first, then re-run a live Manager edit | `docs/vendor-and-help-content-independent-verification.md` |
| **Event Order — controlled release / final verification checklist** | Base implementation is done and self-tested (see §1), but the specific pre-rollout checklist the user named has not been run as its own dedicated pass: HQ enablement live-click for a real venue, starter-behavior live click, $0-warning dialog live click, finalization live click, client-sharing E2E, couple-facing experience E2E, a full reversible enable→use→disable→re-enable live cycle | Every doc's own smoke evidence covers venue-side flows; none includes a live couple-portal render of a shared Event Order, and the enable/disable reversibility claim rests on source inspection ("no cascade in the update statement"), not a live cycle | Run the 7-point checklist live against one real venue+event; restore the flag to `false` afterward | `docs/event-order-product-readiness-recommendation.md`, `docs/event-order-minimum-safe-release-implementation.md` |
| **Automation P1** (Tour Completed trigger, pause/resume, message preview) | Strong self-reported evidence (31/31 browser QA), but touches live messaging behavior — new trigger-firing conditions and pause-state logic that could send or withhold a real message to a real couple — a higher-consequence class than copy/nav changes, worth one more pass by someone other than the implementer | No independent re-verification | Spot-check: trigger a real `tour_completed` event, confirm exactly one enrollment fires; pause one enrollment mid-sequence, confirm no message sends while paused | `docs/automation-sequence-p1-implementation.md` |
| **Luv — actions/outcomes/rollups pipeline** (`luv_actions`, `luv_action_outcomes`, `luv_rollups`) | All three tables have **0 rows** in dev data, unlike memories/insights/recommendations/celebrations which are populated. Could mean either "correctly unused so far in this dev environment" or "no code path ever writes to them." This pass could not resolve which. | No grep was run this pass for whether any live code path ever inserts into these three tables | Grep `lib/luv/` and any cron/webhook handlers for writes to `luv_actions`/`luv_action_outcomes`/`luv_rollups`; if none exists, this is a C-item (dead capability), not a B-item | `docs/dashboard-luv-experience-architecture.md` (2026-08-07) — this doc itself still lists "repair the `venue_users` mismatch" as open, which is now known to be based on the already-refuted diagnosis above; worth correcting in the doc, not re-investigating |

---

## 3. REAL REMAINING RELEASE WORK

Ranked P0 (blocks a normal, everyday action) → P1 (real, customer-visible, bounded) → P2 (real, lower-stakes, non-blocking).

### P0

**Key Dates — completely inaccessible in the product**
- Status: **C**
- Why: `KeyDatesSection`, the only add/view/delete UI for key dates, is imported by zero pages — confirmed by repo-wide grep and direct read of the client detail page. Backend (RLS, validation, service layer) is correct; there is simply no door into it.
- Evidence: `docs/key-dates-release-readiness-assessment.md` (2026-07-15, verdict "Not Ready"), independently corroborated this pass by the research agent re-reading the same grep.
- Blocker: Yes — the Dashboard widget and Calendar both actively surface and link to Key Dates today, so a venue owner clicking through hits a dead end for a feature the product itself advertises. Same failure shape as the `/join` bug the 08-11 pass already treated as P0.
- Next action: Wire `KeyDatesSection` into the client/event detail page it was clearly built for (a mounting fix, not new design).
- Dependencies: none.
- Source: `docs/key-dates-release-readiness-assessment.md`.

**Vendor Manager access — `vendors` table still owner-scoped**
- Status: **C** (kept separate from the completed Vendor RLS remediation per explicit instruction — do not collapse these)
- Why: `venues_select_related_vendors`, `venues_update_unclaimed_vendors`, and (found this pass, not previously named) `venues_insert_vendors` still gate on `v.owner_user_id = auth.uid()` instead of `current_user_venue_id()`. A Manager can log in, but the Vendor Library list renders "No vendors yet" — independently reproduced live and at the DB layer (`select count(*) from vendors` returns 0 under a simulated Manager session).
- Evidence: VERIFIED LIVE + VERIFIED FROM DATABASE, both independently, this engagement.
- Blocker: Yes — blocks an entire role from using a core, everyday feature (viewing/managing the venue's own vendor network), the same class of gap Manager Permissions was built to close for other domains.
- Next action: Apply the same `current_user_venue_id()` pattern to these three policies (identical shape to the fix already shipped for `venues_manage_relationships`/`venues_see_vendor_team`).
- Dependencies: none — same migration pattern, different table.
- Source: `docs/vendor-lifecycle-status-remediation.md` §10, independently confirmed in `docs/vendor-and-help-content-independent-verification.md`.
- **Note, not a defect:** the absence of a live Claimed+Preferred vendor in current seed data (making the B-vs-C badge distinction impossible to demonstrate live) is a QA data limitation, not a product defect — the code and unit tests already prove the distinction works.

**Launch Verification Script (human/device pass) and dogfooding**
- Status: **C**
- Why: named as the top two remaining gates in `docs/platform-status-snapshot.md` and restated as still not executed in the 2026-08-11 reconciliation. Nothing in any workstream since then closes this — it cannot be closed by a codebase read at all.
- Evidence: absence confirmed by both the 07-22 snapshot and the 08-11 reconciliation; no later doc claims it happened.
- Blocker: Yes, structurally — every other item in this document can be verified by source/DB/live-browser evidence; this is the one gate that specifically requires real phones, real people, and real elapsed time running Wevenu's own business inside itself.
- Next action: schedule and run the fixed demo script (5 mobile scenarios + one real invoice/contract/export) and begin dogfooding for a real stretch of time.
- Dependencies: none technical; calendar time.
- Source: `docs/platform-status-snapshot.md`, `docs/release-readiness-reconciliation.md` §D.

### P1

**Seating — no coordinator-side seat-assignment tool**
- Status: **C**
- Why: only the couple's own portal canvas can assign seats; the venue-side "wedding-day-seating.tsx" view is deliberately read-only. A coordinator cannot do, on the venue's own behalf, the thing the product's whole seating feature is for.
- Evidence: `docs/seating-release-readiness-final-assessment.md` (2026-07-15, verdict "Almost Ready" — the later, authoritative doc; an earlier same-topic doc's "Ready" verdict is superseded by this one, confirmed via file dates and the subsequent Key Dates doc's own cross-reference).
- Blocker: Called "blocker-adjacent" in its own source doc; not P0 because a workaround exists (the couple can still do it themselves) but it's a real, high-severity gap for any coordinator trying to help a couple who hasn't.
- Next action: scope and build a coordinator-side seat-assignment surface (same data model, second UI).
- Dependencies: none architectural.
- Source: `docs/seating-release-readiness-final-assessment.md`.

**Seating — silent floor-plan switch shown to the couple**
- Status: **C**
- Why: which floor plan the couple sees flips to whichever plan was most recently edited, with zero couple-facing warning.
- Evidence: same doc, Finding 2 [High].
- Blocker: P1 — a real trust/confusion risk for a couple mid-planning, but not a total feature failure.
- Next action: either pin an explicit "active" floor plan per event, or surface a visible notice when the shown plan changes.
- Dependencies: none.
- Source: `docs/seating-release-readiness-final-assessment.md`.

**White Labeling — Conversations emails fully unbranded (regression vs RC1)**
- Status: **C**
- Why: a prior certification found Conversations emails carry zero venue branding, a regression against what RC1 (Venue Brand Experience Phase 1) had already established elsewhere. No workstream in this round touches email branding.
- Evidence: prior read-only audit (this engagement, 2026-08-11 pass, distinct from and not covered by the reconciliation document read for this pass).
- Blocker: P1 — every other client-facing surface (portal, PDFs, contracts) is now branded; email is the one remaining hole.
- Next action: apply the existing venue-brand email pattern (already used elsewhere) to the Conversations send path.
- Dependencies: none — the pattern already exists, just not wired to this one path.
- Source: prior venue white-label certification (this engagement).

**Contract — no venue-first signing path**
- Status: **C**
- Why: a prior audit confirmed venue-first signing doesn't exist at all — the schema is single-signer, client-only.
- Blocker: P1 — real for venues that want to countersign before a client, a common real-world workflow; not release-blocking since the current client-first flow works correctly for its own case.
- Next action: prior audit already produced an implementation plan flagging 3 product decisions for this — those decisions need to be made before building, not re-derived here.
- Dependencies: product decisions on signer order/model.
- Source: prior contract lifecycle audit (this engagement).

**Contract — no content hash/snapshot at the moment of signing**
- Status: **C**
- Why: only a behavioral edit-guard exists, not an independent tamper-evident artifact of what was actually signed; sign links also never expire despite an `expires_at` field existing.
- Blocker: P1 — legal-defensibility gap, same trust-risk category as the already-closed e-signature IP/UA/consent work (TR-L3), but a distinct, still-open gap.
- Next action: prior audit recommends a `contract_signers` table reusing the existing `client_contacts` model — a scoped, already-designed next step, not a fresh design.
- Dependencies: none blocking.
- Source: prior contract e-signature readiness audit (this engagement).

### P2

**Delete-safety long tail** (Event Orders, Timeline non-primary paths, Floor Plans, Questionnaire Templates already resolved; remaining: message attachments, lead/client/event notes and tasks, event↔vendor assignment "unassign")
- Status: **C**, non-blocking
- Why: real "silent false success" pattern on child/secondary records, not primary legal/financial/access-control ones (which are already fixed).
- Blocker: No.
- Next action: one bounded sweep pass, `event_vendor_assignments` first (a silently-failed "unassign" could cause real day-of confusion).
- Source: `docs/release-readiness-reconciliation.md` §F2.

**4 remaining migration-timestamp collision groups** (`20261175`, `20261176`, `20261177`, `20261222`)
- Status: **C**, non-blocking
- Why: can't be safely resolved without content-forensic work to determine which side is already tracked.
- Blocker: Not today (local dev doesn't go through the CLI apply path); would be a real `supabase db push` failure if used.
- Next action: forensic pass before the first real CLI-based deploy.
- Source: `docs/release-readiness-reconciliation.md` §F4.

**Booking Financial Architecture — Phase 5 (Client Portal "What's Included" + Reporting)**
- Status: **C**, non-blocking
- Why: confirmed genuinely unbuilt — no reporting queries, no `is_couple_visible` wiring for Event Order exist anywhere in `lib/` or migrations. A simpler, gated portal Event Order view already exists (D5E) and covers the core "couple can see what they're getting" need; Phase 5 would add reporting depth on top, not close a hole in current functionality.
- Blocker: No — the simpler mechanism already ships the load-bearing part of this promise.
- Next action: scope reporting queries (add-on popularity, per-line margin, section rollups) when Reporting work resumes.
- Source: `docs/booking-financial-architecture-roadmap.md`, `docs/reporting-analytics-architecture-certification.md`.

---

## 4. EXPLICITLY DEFERRED

| Item | Deferred by | Reasoning |
|---|---|---|
| Real Stripe / QuickBooks live-credential round-trip confirmation | Product decision (external precondition) | Both fully built and verified short of live credentials this environment doesn't have. |
| Pipeline stage colors | Explicit product decision (per this task's brief) | Colors are currently venue-customizable via a picker on the Pipeline Template settings page (confirmed this pass — `components/settings/pipeline-template-form.tsx`) — the decision is that this should eventually be *removed* as part of a bounded Pipeline-customization cleanup, not built out further. Not implemented in this pass, per instruction. |
| Final platform-wide terminology pass | Explicit product decision (per this task's brief) | A first terminology pass already shipped 2026-07-21 (see §1). The *final* platform-wide pass is intentionally reserved for the end of release-readiness work and is not being pulled forward here. |
| RSVP password stored in plaintext | Accepted as a known limitation in the Hosted Experience RC1 certification | Named explicitly, not silently missing; low-severity (a shared wedding-guest gate, not a real account credential). |
| Wedding Party-facing portal/view | Product decision (scoped, not built) | The audience-filtering mechanism has a real consumer today; a distinct Wedding Party login/identity surface is separate future scope. |
| Commercial Proposal Architecture, iCal/webcal sync, lead-to-team-member assignment routing, Messaging/Conversation-engine tour-reminder bypass | Prior explicit decisions, restated by the 08-11 reconciliation, unchanged since | See `docs/release-readiness-reconciliation.md` §D for the full list; nothing this pass found changes any of these. |

---

## 5. OUT OF SCOPE / NOT DEFECTS

| Item | Why it's not a defect |
|---|---|
| **Guided Journeys empty Help category** | Confirmed this session: the category exists in the taxonomy and correctly shows "Guides for this area are coming soon." There is no underlying Guided Journeys product capability to document — this is honest absence, not a documentation gap. Per explicit instruction, do not classify as unfinished Help work. |
| **Couple public review / star-rating (`couple_venue_feedback`)** | The table is real (schema confirmed this pass) but has zero UI anywhere — no venue-facing or couple-facing surface reads or writes it. Per explicit instruction, this is a real, undecided *future product opportunity*, not a Help documentation gap and not something to invent Help content around. |
| **Undocumented internal capabilities with no user impact** | Not itemized individually here — none surfaced this pass that would qualify; everything found either has a live UI surface or is explicitly named above. |

---

## 6. OBSOLETE / SUPERSEDED

| Old claim | Why it's now wrong | Correct current state |
|---|---|---|
| Help & Guides / Success Library "has ZERO nav entry point anywhere in the app" | This was true as of a 2026-08-12 audit, but is now resolved — confirmed live this session, "Help & Guides" is a real item in the Overview section of the left nav. | Almost certainly closed by the Left Navigation restructure (also 2026-08-12), which added a proper nav entry as part of its restructure. Worth correcting the standing Help & Guides architecture doc. |
| `docs/dashboard-luv-experience-architecture.md`'s (2026-08-07) claim that Luv's DB-backed layer fails because "`venue_users` was never created" | Directly refuted by an earlier, more careful investigation (`docs/luv-experience-completion-assessment.md`, 2026-07-17): `venue_users` is a real view, present since early in the migration history. The actual bug was three narrow, unrelated errors in one function (`get_venue_trends`), already fixed. | The Aug 7 doc repeats a claim two prior docs (same month, three weeks earlier) had already investigated and corrected — it should be updated to reflect the actual, narrower, already-fixed finding rather than re-asserting the original wrong diagnosis. |
| Seating's earlier `docs/seating-release-readiness.md` verdict of "Ready" | Superseded by the later, more thorough `docs/seating-release-readiness-final-assessment.md` (2026-07-15), which found two new High-severity gaps on top of what the earlier doc closed. | "Almost Ready" is the standing verdict — see §3. |
| Original Product Completion Roadmap's Principle 4 (unified Asset model, "not a Program 2 build item yet" as of 2026-07-07) | Substantially realized under a different name — the Document Domain initiative (Canonical Architecture, Business Object Boundary, Producer Readiness, Phase 2B/2C) plus D6/D7/D8 is exactly this unification. | Already corrected in `docs/release-readiness-reconciliation.md` §E4; restated here only for completeness. |

---

## 7. PROPOSED EXECUTION ORDER

Smallest sequential path from current state to Release Ready. Each step names only what's necessary to close it, not a redesign.

1. **Vendor Manager RLS gap** (§3, P0) — apply the same `current_user_venue_id()` pattern already used twice this engagement to the three remaining owner-scoped `vendors` policies. Small, mechanical, same shape as work already shipped.
2. **Key Dates mounting fix** (§3, P0) — wire `KeyDatesSection` into the page it was built for. Small, mechanical.
3. **Event Order controlled-release checklist** (§2) — run the 7-point live checklist against one real venue before HQ enables it for anyone else.
4. **Library IA + Automation P1 spot-checks** (§2) — two short, low-effort verification passes; can run in parallel with 1–3.
5. **Seating gaps** (§3, P1) — coordinator seat-assignment tool and the silent-floor-plan-switch warning. Largest single item in this list; scope before starting.
6. **White Labeling email gap, Contract venue-first signing, Contract signing snapshot** (§3, P1) — three independent, already-audited gaps; can be sequenced in any order relative to each other.
7. **Delete-safety tail + migration-collision forensics** (§3, P2) — one bounded engineering sweep, do last since nothing depends on it and it's not customer-visible.
8. **Launch Verification Script + dogfooding** (§3, P0, but operational not technical) — should start in parallel with step 1, not wait for everything else, since it's the one gate measured in elapsed real-world time rather than engineering effort.

---

## If Jennifer stopped doing new audits today, what would the team still need to finish before release?

Five concrete things, nothing else: **(1)** fix the Vendor Manager RLS gap on the `vendors` table — a few hours, same pattern already used twice. **(2)** wire the Key Dates UI into a page — it's built, just not mounted. **(3)** run the Event Order controlled-release checklist once, live, before turning it on for a real venue. **(4)** build the missing coordinator-side seating tool, the single largest remaining build item. **(5)** actually run the mobile demo script and start dogfooding — the one gate that isn't a code change at all, and the one most likely to keep quietly sliding if nobody puts a date on it.

Wedding Website's human visual acceptance — the sixth item as of the prior version of this document — is now closed (confirmed by Jennifer, 2026-08-13; see §1).

Everything else in this document is either already done, small polish, or a deliberate, already-made decision to wait.
