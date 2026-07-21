# Release Readiness Status

**⚠️ Superseded 2026-07-20 by `docs/release-candidate-roadmap.md`** — that document reconciles this one against RC1 (Venue Brand Experience), Lead Acquisition & Intake, and RC2 (Messaging & Conversations), all shipped after this snapshot. Kept here for history, not being re-verified line by line.

**Date:** 2026-07-17
**Status:** Current working roadmap, superseding the Gap Analysis / Scorecard sections of `docs/product-completion-roadmap.md` (kept for history, not being re-verified line by line). This document is the baseline for the refinement phase that follows.
**Supersedes as source of truth for "where do we actually stand":** `docs/product-completion-roadmap.md` (2026-07-07 baseline), `docs/trust-risk-register.md` (2026-07-07 baseline, individual items updated since but its own summary table/count is stale — see Engineering Cleanup below).

**Context for this document:** The Commitment Alignment Sprint and Timeline Implementation are both complete. Per explicit direction, the platform architecture — Workspace Sovereignty, Commitment Lifecycle, Publication, Copy at Commitment, One Canonical Owner, Visibility-follows-Ownership — is now considered **stable**. Nothing below proposes new architecture. This is a status snapshot: what's done, what's left, what's cleanup, what's launch-blocking, and what's intentionally deferred.

---

## 1. Completed Platform Capabilities

### Architecture (stable as of 2026-07-17)
- **Commitment Lifecycle Architecture** (`docs/commitment-lifecycle-architecture.md`) — the universal Draft → Submitted → Committed → Superseded → Archived pattern, Ownership triad, Copy at Commitment, Publication axis, Delegation, Notification discipline. Now the governing pattern for every domain below, not just a design document.
- **Commitment Alignment Sprint — all 5 items shipped and live-validated** (`docs/commitment-alignment-sprint-final-report.md`, retrospective in `docs/commitment-alignment-sprint-retrospective.md`):
  1. Guest List Submission
  2. Seating Delegation & Submission
  3. Vendor Selection Submission
  4. Booking Financial Alignment
  5. Documents Private-Until-Shared (contracts/invoices default `is_couple_visible = false`; only an explicit send makes them visible; reverting to draft symmetrically un-shares)
- **Timeline Implementation** (`docs/timeline-implementation-report.md`) — Owner (`venue`/`client`) / Lock State (`editable`/`locked`) / Visibility (`wedding_party`/`guests`/`vendors`, owner-gated) / Submission (Copy-at-Commitment snapshot via `timeline_submissions`, append-only) / a shared merged read (`get_event_timeline_merged`) serving both the coordinator editor and Wedding Day Ops. 26/26 live-validation checks passed. This was the last domain the Commitment Lifecycle's own Domain Mapping Matrix named as unbuilt — the matrix is now fully compliant.
- **Venue Branding Architecture Audit** (`docs/venue-branding-architecture-audit.md`) — current-state audit approved; established Venue Style as the sole canonical input for a future brand recommendation engine (see Deferred Initiatives below — not built yet).

### Trust Risk Register (`docs/trust-risk-register.md`) — 25 items tracked
- **20 Resolved:** TR-M2, TR-M3, TR-M5, TR-L1, TR-L2, TR-L3, TR-L4, TR-L5, TR-L6, TR-B1, TR-B4, TR-B5, TR-G1, TR-G2, TR-G3, TR-G4, TR-G5, TR-G6, TR-G7, TR-C2 — covering invoice-balance integrity, contract immutability/audit trail/e-signature evidence, double-booking prevention, tour-calendar accuracy, hold expiry, real role-based permissions (server + RLS, all 45 core tables), staff-revocation correctness, client-portal access-level enforcement, refund RLS backstop, invite identity verification, and multi-staff messaging reliability.
- **1 Mitigated:** TR-M1 (Stripe Connect honestly relabeled "coming soon"; permanent fix — real payment collection — is designed in `docs/stripe-payment-architecture.md` but blocked on a live Stripe test-mode account this environment doesn't have).
- **4 Identified, open by size not oversight:** TR-M4 (double-marking-paid guard, small), TR-B2 (silent tour-confirmation email failure), TR-B3 (questionnaire "send" reports false success), TR-C1 (messaging fragmentation — a real Program 2 architecture project, not a same-day patch).

*(Note: the register's own Summary Table and closing count — "24 items tracked, 20 Resolved, 1 Mitigated, 3 Identified" — are stale relative to their own per-item detail; TR-M5's detailed entry shows ✅ Resolved with full shipped/test evidence but its summary row still reads "Identified," and the total row count is 25, not 24. Flagged under Engineering Cleanup below; the counts above use each item's detailed record, which is the authoritative one.)*

### Point fixes (this working session, outside the two initiatives above)
- Contract-send `22P02` crash fixed (`__default__` placeholder template id no longer flows into the real `uuid` FK column).
- "Workspace ready" checklist white-on-white contrast bug fixed (explicit inline colors, theme-aware).
- Redundant event-name/type subtitle removed from the booked-client page.
- Venue Style dropdown: added Inn/B&B, Estate, Camp/Retreat.
- Event Type dropdown: added Retreat, Celebration of Life, Quinceañera.
- Inventory item images now render correctly inside their frame.
- Lead import now correctly recovers every row from a real-world spreadsheet missing an explicit header row (`looksLikeHeaderRow` heuristic + manual override toggle) — re-verified against the exact files that originally failed, not synthetic data.

---

## 2. Remaining Product Completion Work

Organized by the roadmap's existing Programs — nothing here is new scope, this is what Programs 1–3's own Gap Analysis already named as open, current as of today.

**Program 1 (Trust Foundation) — residual, small:**
- TR-M1 permanent fix (real Stripe payment collection) — blocked on external credentials, not effort.
- TR-M4, TR-B2, TR-B3 — bounded, well-understood patches, queued.
- TR-C1 (messaging fragmentation: Conversation/Channel unification) — the one large item left in Program 1's scope; a real architecture project (Program 2 Principle #3), not a guard/check fix.

**Program 2 (Venue Operations):**
- Messaging & Texting — 🔴 Red, unchanged (no SMS provider, no vendor channel, TR-C1 above).
- Lead Capture & Consolidation — 🔴 Red, unchanged (zero external lead-source integrations; `source='website_form'` vs `'website'` reporting mismatch).
- Pipeline & Lead Management — 🟡 leaning 🔴, unchanged (fixed 7 pipeline stages, no lead-to-team-member assignment; `proposal_sent` stage has no artifact behind it — see Commercial Proposal Architecture under Deferred Initiatives).
- Workflow Automation — 🟡 leaning 🔴, unchanged (no combined "at a glance" event-readiness view; the `"payment_received"` trigger this section previously flagged as dead was corrected 2026-07-10, confirmed working during Engineering Cleanup — see §3 item 7).
- Calendar week/day views, calendar sync — Honest V1 Limitation, not scheduled.

**Program 3 (Customer Experience):**
- White Labeling — 🔴 Red, unchanged. Not scheduled until Venue Brand Experience (Deferred Initiatives below) is built.
- Seating-chart mobile responsiveness (couple-facing, 951 lines, zero responsive classes) — still open.
- Setup & Onboarding — 🟡 Yellow: real wizard + checklist, but no in-app help/tooltips/guided tour, only an async ticket form.
- `wedding_party` Timeline visibility tag is real and settable server-side but has no consuming surface anywhere in the product yet (no Wedding Party portal/view exists) — see Deferred Initiatives.

**Programs 4–5 (Intelligence, Ecosystem):** unchanged, ongoing/not-yet-started per the original roadmap's explicit sequencing (last, per original call).

---

## 3. Engineering Cleanup Scope

**Status: Complete, 2026-07-17.** All 7 items below closed — 5 by a bounded code/migration fix, 1 by correcting stale documentation (no code was broken), 1 confirmed as a standing environment limitation, not a deferred fix. Full detail, live-test evidence, and verification (`tsc`/`build` clean) in `docs/engineering-cleanup-report.md`. No architecture changed; nothing here extended the Commitment Lifecycle, Timeline, or any other completed initiative — items 3 and 7 touch files inside those initiatives but are narrow correctness fixes inside the already-approved model.

1. ✅ **RLS enabled on `public.luv_rollups` and `public.vendor_health_scores`** — both previously anon-exposed (RLS disabled), flagged repeatedly by `supabase db query --local`'s own security advisory. Fixed via `20261101020000_engineering_cleanup_rls_luv_rollups_vendor_health.sql`, live-tested with real authenticated sessions (8/8 checks passed), zero behavior change to the app's real access paths.
2. ✅ **Trust Risk Register's stale bookkeeping corrected** — TR-M5's summary-table row and the closing item count now match its own detailed, evidenced entry (25 tracked, 20 Resolved, 1 Mitigated, 4 Identified).
3. ✅ **Timeline's two named residual gaps closed:**
   - `reorderEntry`/`shiftEntriesAfter` (`lib/timeline/repository.ts`) now carry the same `owner='venue'` ownership guard as `updateEntry`/`deleteEntry`/`reorderEntries`.
   - The Hosted Experience Phase 5 change-notification nudge's real defect, found on investigation, was more specific than originally scoped here: it wasn't watching the wrong signal, it was watching *no* audience filter at all, producing false-positive nudges for non-guest-visible edits. Gating on Timeline Submission (as this item was originally worded) would have been architecturally wrong per Commitment Lifecycle §6 (publication is independent of submission) — the correct fix, applied via `20261101000000_engineering_cleanup_change_nudge_audience_filter.sql`, filters on `'guests' = any(audiences)`, the same condition the Schedule section itself already reads by.
4. ✅ **Refund button now hidden client-side for non-Owner roles** — `currentUserRole` threaded from `app/(app)/payments/[id]/page.tsx` through to the button's render condition; fails closed by default. Server + RLS enforcement (TR-M3/TR-G5) unchanged, this closes the cosmetic gap only.
5. **Live end-to-end browser QA — confirmed still open, by environment limitation, not oversight.** TR-L1/TR-L2/TR-L4 and the TR-B2-adjacent fixes remain verified by code review, `tsc`/`build`, and rolled-back live-database tests only; this environment has no way to drive an authenticated browser flow. Stays a named manual pre-launch QA item.
6. ✅ **Lead-source mismatch fixed** — `create_public_lead`'s hardcoded `'website_form'` corrected to `'website'` (matching `LEAD_SOURCES`), with existing rows backfilled. `source_data`'s informational sub-field, used for UTM/referrer tracking, is untouched.
7. ✅ **Dead `"payment_received"` trigger — verified not a bug.** Investigation found `markLineItemPaid` already wires `triggerAutoComplete(..., "payment_received", ...)`, fixed 2026-07-10 (three days after the audit that flagged it dead) and confirmed still working correctly today. This was a documentation-staleness finding, not a code defect — no code changed; this list and the Workflow Automation scorecard row below were corrected instead.

---

## 4. Launch Readiness Checklist

Re-scored against the Release Gate's original 5 yes/no questions (`docs/product-completion-roadmap.md`), current as of today:

| # | Gate | Status | Basis |
|---|---|:---:|---|
| 1 | Can a venue run their business? | 🟡 Nearly — not yet a clean "yes" | Trust Risk Register: 20/25 Resolved, 1 Mitigated, 4 small/queued Identified items open (TR-M4/B2/B3/C1). The gate requires *all* Phase 1 items shipped and verified, not "mostly" — TR-C1 in particular is a real open architecture project, not a checklist item. |
| 2 | Can a couple plan their event? | 🟢 Yes, materially strengthened this session | Couple Portal already Green; Commitment Alignment Sprint + Timeline Implementation directly hardened this gate (private-until-submitted guest list/seating/vendor/timeline, real data export). Remaining named gap: seating-chart mobile responsiveness. |
| 3 | Can a vendor collaborate effectively? | 🔴 Not yet | Real two-way vendor messaging still doesn't exist (TR-C1); vendor payment visibility and floor-plan visibility remain open Program 2/3 items. |
| 4 | Would I proudly demo this to a former customer? | ⬜ Not yet run | The fixed demo script (5 mobile scenarios, one real invoice, one real contract through signing, one real export, refund/void) has not been executed live end-to-end as its own dedicated pass. |
| 5 | Would I trust my own business on it? | ⬜ Not yet started | Dogfooding (running Wevenu's own vendor relationships/contracts/invoices inside Wevenu for a real stretch) hasn't begun. |

**Trust Beta Readiness Scorecard, re-scored (10 categories, unchanged from the 2026-07-07 baseline except where noted):**

| # | Category | Rating | Change since 2026-07-07 |
|---|---|:---:|---|
| 1 | Messaging & Texting | 🔴 Red | Unchanged |
| 2 | Lead Capture & Consolidation | 🔴 Red | Unchanged |
| 3 | Money | 🟡 Yellow | Unchanged (TR-M1 permanent fix + TR-M4 still open) |
| 4 | Setup & Onboarding | 🟡 Yellow | Unchanged |
| 5 | Client Experience (Couple Portal) | 🟢 Green | **Strengthened** — Commitment Alignment Sprint + Timeline give this category a materially deeper trust story (private-until-submitted across guest list/seating/vendors/timeline/documents), though the rating was already Green |
| 6 | End-to-End Workflow Automation | 🟡→🔴 | Unchanged (no combined "at a glance" event-readiness view; the `payment_received` trigger was already fixed 2026-07-10, not open — see Engineering Cleanup #7) |
| 7 | White Labeling | 🔴 Red | Unchanged — Venue Brand Experience approved as a future initiative but not built |
| 8 | Calendar | 🟢 Green | Unchanged |
| 9 | Pipeline & Lead Management | 🟡→🔴 | Unchanged — Commercial Proposal Architecture approved as a future initiative but not built |
| 10 | Notifications, Permissions & Reporting | 🟡 Yellow | Unchanged ("My Tasks" mislabeling still open) |

**Net read:** the two initiatives completed since the 2026-07-07 baseline (Commitment Alignment Sprint, Timeline) closed real architectural risk in the Client Workspace — a dimension the original 10-category scorecard doesn't have its own row for, since it predates Commitment Lifecycle. Nothing on the original scorecard moved color this session; the work done was orthogonal to it (workspace-sovereignty/commitment integrity) rather than duplicative of it. Programs 2–3's Red categories are the actual gate to Trust Beta from here, not further Trust Risk Register or Commitment Lifecycle work.

---

## 5. Deferred Product Evolution Initiatives

Approved, scoped, and explicitly not scheduled — direction is settled, implementation is future work:

- **Venue Brand Experience** (`docs/venue-branding-architecture-audit.md`, "Future Initiative" section) — brand recommendation engine driven by the venue's existing Venue Style (no second self-classification field), feeding Hosted Experience defaults, Client Portal defaults, email branding, PDF branding, guest-facing branding, and venue identity refinement. Directly unblocks the White Labeling Red rating (Category 7) when built.
- **Commercial Proposal Architecture** (`docs/future-initiative-commercial-proposal-architecture.md`) — a formal Proposal artifact bridging Sales CRM and Booking, deliberately kept outside the Commitment Lifecycle (a pre-commitment commercial artifact, not a Commitment Lifecycle one). Gives the `proposal_sent` pipeline stage a real artifact behind it (Category 9).
- **Wedding Party portal/view** — Timeline's `wedding_party` Visibility tag is real, stored, and settable today; no audience-facing surface exists yet to read it. The projection mechanism is ready (same pattern as the guest/vendor reads); building the actual surface is separate, future scope, not a defect.
- **Real Stripe payment collection** (TR-M1 permanent fix, `docs/stripe-payment-architecture.md`) — design complete, Direct Charges on the venue's own Connect account, implementation blocked on a live Stripe test-mode account this environment doesn't have. Kept here rather than in Engineering Cleanup because it's a genuine feature build, not a patch.
- **Messaging/Conversation unification** (TR-C1, Program 2 Principle #3) — the single largest architectural project identified in the 2026-07-07 audit: one Conversation object with pluggable Channels (email, SMS, portal, internal note, phone log, future WhatsApp/push), replacing today's two disconnected systems. Scoped, not designed in detail yet.
