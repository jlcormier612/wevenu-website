# Hello to Cheers — Master Readiness Tracker

**Owner:** Founder, ChatGPT, Cursor  
**Created:** 2026-11-17  
**Last updated:** 2026-11-17  
**Environment:** Sandbox application exists. **No Production customers. The product is not launched.**

This is the shared source of truth for outstanding migration work, deferred issues, launch blockers, and milestone approvals. Consult it before starting a new milestone. Update it when a milestone is accepted or a genuine issue is discovered. Never silently remove unresolved issues. Never treat an uncommitted local change as deployed or production-ready.

Older documents (`docs/release-readiness-status.md`, `docs/trust-risk-register.md`, `docs/launch-confidence-matrix.md`, `docs/stripe-launch-plan.md`) are historical. Several of their claims are contradicted by later evidence (see §10). Do not copy those verdicts forward as current fact.

---

## 1. Executive summary

**Overall:** Phase B, MS-RPT, Phase C, and Phase D are merged to `main` and deployed to Sandbox (`deffb7d6`, deploy run `44153035245`). Easy Onboarding Practice Mode: **PM-01 and PM-02 COMPLETE — VERIFIED ON SANDBOX**; **PM-03 / PM-04 / PM-05 COMPLETE — VERIFIED** (local app + Sandbox DB; not deployed). Production launch remains unauthorized. TS-001 remains open.

| Track | Status |
|---|---|
| Phase B — Bring Your Business | **COMPLETE — VERIFIED** and on Sandbox (`deffb7d6`) |
| Reporting integrity | **COMPLETE — VERIFIED** and on Sandbox (`deffb7d6`) |
| Phase C — Contracts & Money | **COMPLETE — VERIFIED** and on Sandbox (`deffb7d6`) |
| Phase D — Planning Materials | **COMPLETE — VERIFIED** and on Sandbox (`deffb7d6`) |
| Final integrated migration release | **ON SANDBOX** — PR #78, deploy run `44153035245`. Production is not authorized. |
| Easy Onboarding — Practice Mode | **PM-01 / PM-02 COMPLETE — VERIFIED ON SANDBOX**; **PM-03 / PM-04 / PM-05 COMPLETE — VERIFIED** (undeployed) |
| Production launch | **OPEN** — no Production customers; env/legal/ops items remain |

**Migration blockers:** none.  
**Production launch blockers:** no Production deploy approval; Production marketing env gaps; Gather / Launch Yourself human proof incomplete; final launch approval not given.

---

## 2. Operating rules

1. Consult this tracker before starting a new milestone.
2. Update it when a milestone is accepted or a genuine issue is discovered.
3. Never silently remove unresolved issues.
4. Keep verified work closed unless new evidence justifies reopening it.
5. Distinguish product defects from test-harness problems.
6. Keep documentation concise; link evidence instead of reproducing QA reports.
7. Record founder approvals separately from implementation claims.
8. Do not expand a milestone’s scope without identifying and approving the change.
9. Keep **Next Up** to no more than three priorities.
10. Never treat an uncommitted local change as deployed or production-ready.

### Status vocabulary

| Status | Meaning |
|---|---|
| **COMPLETE — VERIFIED** | Implemented and supported by acceptance evidence |
| **IMPLEMENTED — AWAITING APPROVAL** | Work completed but not yet accepted |
| **IN PROGRESS** | Actively being implemented |
| **NEEDS VERIFICATION** | Behavior or impact not established |
| **OPEN** | Confirmed work remaining |
| **DEFERRED** | Intentionally postponed |
| **BLOCKED** | Cannot proceed until a dependency is resolved |

---

## 3. Next Up

1. **ONB-FINAL** — Complete Easy Onboarding experience (**IN PROGRESS**). Practice Mode polish committed on PR #80; merge/deploy gated on required CI.
2. **TS-001** — pre-existing typecheck baseline remains **OPEN**. Separate from Practice Mode.
3. **Production** remains unauthorized.

---

## 4. Milestone tracker

| ID | Milestone | Status | Evidence | Next action |
|---|---|---|---|---|
| **MS-B1** | Unified migration foundation | **COMPLETE — VERIFIED** | Local commit `2013b1df`. Leads, Clients+Events (one category), Vendors, SS/HQ parity, preview/mapping/review, quiet-import. Founder proceeded to B.2/B.3 on this foundation. | Keep closed. |
| **MS-B2** | Venue-controlled Lead matching | **COMPLETE — VERIFIED** | Fresh browser run `mwk68qi7-fresh` **61/61**. Commit `9fdecf3f59159e45a7204699677a6b124434b008`. Founder accepted. | Keep closed. Do not reopen without a genuine defect. |
| **MS-B3** | Client/Event + Vendor matching; multi-event navigation | **COMPLETE — VERIFIED** | SS + HQ disposable-venue UI and persist. Selective local commit `f92960af4d373475e93cf0745c27de52be05e932` (HEAD of `feat/bring-your-business-unified`). Founder approved the commit. One HQ vendor harness yellow: Bloom & Co already existed globally; venue confirmation + persist were correct (harness, not product). | Keep closed. Do not reopen without a genuine defect. |
| **MS-RPT** | Reporting integrity correction | **COMPLETE — VERIFIED** | Founder accepted the implementation and the final evidence on 2026-11-17. Migration `575239c` applied by run `44035385279` to `wvpsldwwjqdannqasrdf`. Final persisted record: `~/Desktop/HTC-MS-RPT-acceptance/final-acceptance.json`. Jordan Book is `sales_stage` booked, provenance `htc`, lifecycle origin `pipeline` on that lead. 2028 qualifying count is 5 after that booking. The 2028 Events report headline is 5 and Casey remains listed as Cancelled. Earlier machine failures are preserved in that file. TS-001 stays open. Not merged or deployed. | Keep closed. Do not start Phase C from this closeout. |
| **MS-C** | Phase C — Contracts & Money | **COMPLETE — VERIFIED** | Founder approved on 2026-11-17. Sandbox migration `20270126120000_phase_c_financial_history.sql` applied (commit `42ca8023305a81a501bdf93fd7aa9e400f38af6c`, run `44040915601`). Historical contracts, invoices, and individual financial movements imported and reconciled on disposable venue `Phase C Disposable mwkeg1c2` (`5ab864ac-5f47-4e63-a487-3772fa6c330f`). Self-service and HQ import paths verified. Actual UI Import interaction verified. Import retries did not duplicate transactions. Historical financial Activity History is available to venue staff. Native partial-payment reporting verified (NATIVE-100, `paid_amount` $40 on 2026-11-02, balance $60, no second movement). Date-window Revenue reporting, dashboard totals, and the July saved-report export reconciled (April $10,525 / $1,025 / $9,000; July $1,200 / $350 / $700; November $100 / $40 / $60; December $10 / $6 / $4; dashboard cash collected $1,721 and outstanding $9,789). No unintended Stripe, QuickBooks, communication, or booking side effects. Focused tests passed: original 43 plus final 11. Protected Fancy and Willow Grove data remained unchanged in the original migration verification. Evidence: `~/Desktop/HTC-Phase-C-acceptance/`. Known limitations: partially paid installments count as unpaid in the fully-paid installment counter while showing their received and remaining amounts; source IDs are visible to authorized venue staff; final acceptance relied on existing tenant-scoped controls rather than repeating a cross-venue login; application code is not yet committed, merged, or deployed. TS-001 stays open separately. | Keep closed. Do not reopen. Do not start Phase D from this closeout. |
| **MS-D** | Phase D — Planning Materials | **COMPLETE — VERIFIED** | Founder approved the Phase D implementation on 2026-11-17, subject to the client Timeline visibility acceptance. That acceptance passed. Disposable venue `Phase C Disposable mwkeg1c2` (`5ab864ac-5f47-4e63-a487-3772fa6c330f`). Vocabulary migration `20270127120000_phase_d_planning_material.sql` applied (commit `7cf7401fee397ca9e5fdefea3b3206d66b655ceb`, run `44137654693`). "Phase D client first look" (`8ff601ee-ffe6-4ae2-b048-b062578bb478`) is visible to venue staff in a labeled Imported client timeline section, remains owner `client`, lock `locked`, audiences `[]`, and has no schedule source key. The shared Timeline still lists the two venue entries only. No submission was created. A retry returned the same row. Schedule reconciliation did not write the client row. Bloom Floral assignment `c6f200ad-bc16-40a2-9fef-91ed97e14750` had 0 `assigned_to_event` alerts before a retry and 0 after. Evidence: `~/Desktop/HTC-Phase-D-acceptance/`. Application code is not committed, merged, or deployed. TS-001 stays open. | Keep closed. Do not reopen Phases B, C, or D. |
| **MS-INT** | Final integrated migration acceptance | **ON SANDBOX** | PR #78 / `deffb7d6` / deploy `44153035245`. Focused Willow Grove smoke passed. | Keep closed unless a genuine regression appears. |
| **MS-LAUNCH** | Production launch approval | **OPEN** | Sandbox only. Marketing Production preflight 2026-11-10: **CONDITIONAL GO**, Production deploy **not done**. | Separate from migration. Founder authorization required. |
| **PM-01** | Practice Mode architecture and safe isolation | **COMPLETE — VERIFIED ON SANDBOX** | Migration `20270128120000_practice_runs.sql` applied by run `44169939559`, commit `a02636b7491db59810848148b777dab57b04af5f`. Disposable venue `PM-01 Practice mwl5fcut` (`e458f434-ec00-472c-a12f-e53c10219e16`). Practice Run `6195979a-3a60-4646-b919-25dde7c99078` with sample lead `497dc128-4704-406f-990b-b69f50a48427`, client `53cc9572-0176-4092-ba3b-77e7f8c575e4`, event `16ba977c-15da-4546-83b6-c0aec3b6f7ea` (draft, no booked_at, no space, reporting-excluded). Start/Continue/reload reused one run. Cross-venue RLS returned 0 rows for other venue. Fancy/Willow counts unchanged. QBO queue and vendor alerts stayed 0. Evidence: `~/Desktop/HTC-PM01-acceptance/`. Application code remains uncommitted/undeployed on `feat/practice-mode-pm01`. | Keep closed. |
| **PM-02** | Interactive venue-side Practice Run | **COMPLETE — VERIFIED ON SANDBOX** | Journey migration `20270129120000_practice_run_journey.sql` applied by run `44174988039`, commit `34cd4862d4b94c66b67c9046b8818d8db7b788f6` (SQL-only branch `chore/pm02-practice-run-journey`). Disposable venue renamed customer-facing to `Garden Practice Venue` (`e458f434-…`); run `6195979a-…`. All 20 acceptance criteria PASS including previously blocked progress/proposal/contract/practice-booked. Customer UI: venue-only perspective, no unfinished placeholders, simplified nav. Focused tests 17/17. Evidence: `~/Desktop/HTC-PM02-acceptance/`. Application code remains uncommitted/undeployed on `feat/practice-mode-pm01`. | Keep closed. |
| **PM-03** | Real client portal and perspective switching | **COMPLETE — VERIFIED** | Garden Practice Venue / Maya & Jordan run `6195979a-…`. Venue\|Client switcher; staff-authorized Practice Run client route renders real `PortalShell` with venue branding; practice portal session (no invite email); bidirectional Practice Run conversation (in-app only; email fan-out blocked); client todo persist; proposal/agreement snapshots from PM-02; no booking/QBO side effects. Acceptance **16/16 PASS**. Focused tests 4/4. Evidence: `~/Desktop/HTC-PM03-acceptance/` and `docs/qa/practice-mode/pm03-acceptance/`. No additive migration. Application code remains uncommitted/undeployed on `feat/practice-mode-pm01`. | Keep closed. |
| **PM-04** | Practice Run planning & client collaboration | **COMPLETE — VERIFIED** | Garden Practice Venue / Maya & Jordan run `6195979a-…`. Prepare → share → Client → review on real planning tools: tasks (5), timeline (13), questionnaire, documents (shared vs venue-only), draft wedding website (unpublished), Event Order/inventory shells, playbook release gate for client tasks. Client complete-task + portal message roundtrip persist; venue sees both. Isolation: no `booked_at`, reporting-excluded, QBO 0, no real clients. Acceptance **12/12 PASS**. Focused tests 15/15. Evidence: `~/Desktop/HTC-PM04-acceptance/` and `docs/qa/practice-mode/pm04-acceptance/`. No new migration. Application code remains uncommitted/undeployed on `feat/practice-mode-pm01`. | Keep closed. |
| **PM-05** | Reset, cleanup, and integrated acceptance | **COMPLETE — VERIFIED** | Garden Practice Venue disposable. Finish vs Start over lifecycle (`finishedAt` soft finish; archive + fresh sample on reset; unique practice emails; artifact cleanup). Integrated acceptance **17/17 PASS** including finish→resume, reset after completion, repeated reset, Venue↔Client messaging, isolation (QBO 0, real clients 0, Willow events unchanged 80). Focused Practice Mode tests **35/35**. First-time UX: clearer support copy, lifecycle panel, non-mandatory return to Setup. Evidence: `~/Desktop/HTC-PM05-acceptance/` and `docs/qa/practice-mode/pm05-acceptance/`. No new migration. Application code remains uncommitted/undeployed on `feat/practice-mode-pm01`. | Keep closed. Next: ONB-FINAL after founder auth to commit/deploy Practice Mode. |
| **ONB-FINAL** | Complete Easy Onboarding experience | **IN PROGRESS** | Final polish committed: Maya & Jordan couple photo (`public/practice/maya-jordan-couple.png`, seeded on sample create/resume), copy/spacing fix, go-live eligibility hint. PR [#80](https://github.com/jlcormier612/wevenu-website/pull/80) tip `597da308`. Merge blocked until required CI (venue-app build + hospitality smoke) completes. Sandbox deploy + deployed ONB-FINAL acceptance pending merge. | Wait for CI → merge to `main` → Deploy Sandbox → run `scripts/onb-final-acceptance-capture.mjs`. |
| **LUV-FINAL** | Luv functionality, boundaries, and privacy review | **PLANNED** | Separate from Practice Mode. | Independent track. |
| **JOURNEY-FINAL** | End-to-end new-venue journey | **PLANNED** | Full new-venue path through go-live. | After ONB-FINAL. |
| **LAUNCH-FINAL** | Remaining technical, billing, legal, and Production gates | **OPEN** | Includes TS-001 and Production gates. | Founder authorization required. |
| **TS-001** | Typecheck baseline | **OPEN** | Pre-existing; separate from Practice Mode. | Do not fold into PM-02. |

### B.1 — Unified migration foundation

Accepted scope: Leads; Clients with their Events as **one** import category; Vendors; self-service and HQ White-Glove parity; import preview, mapping, review; quiet-import (no invitations, SMS, contracts, Stripe charges, QBO enqueue, or portal publication).

### B.2 — Venue-controlled Lead matching

Approved and verified: multiple inquiries can belong to one person; shared email does not establish identity; venue choices are same record, separate inquiry, different person, don’t import; source-ID / fingerprint retry protection; changed records go to review.

### B.3 — Client/Event and Vendor matching

Approved and verified:

- Clients and Events remain one combined import category.
- Venue choices: Same Client/same Event; Same Client/additional Event; Different Client; Don’t import.
- No date-only automatic Event deduplication. Same-date Events still pass occupancy.
- Vendors: Same Vendor / Different Vendor / Don’t import. Global `vendors` + per-venue `venue_vendor_relationships`.
- Source IDs distinct for person vs Event vs Vendor. Changed source IDs review, not overwrite.
- Multi-event Client workspace honors valid `?eventId=`; Calendar Event opens the matching Event.
- SS/HQ persisted outcomes matched. Quiet-import safeguards held.

Worktree: `.worktrees/bring-your-business-unified` · branch `feat/bring-your-business-unified`. Not pushed, merged, or deployed.

---

## 5. Approved product and business rules

Recorded so later work cannot quietly rewrite them.

| Rule | Source |
|---|---|
| Three customer-facing migration categories: **Leads**, **Clients and their Events** (combined), **Vendors**. | Founder / Phase B |
| HTC flags potential duplicates. The venue confirms what they represent. Name, email, phone, website, and date are **signals**, not identity. | B.2 / B.3 |
| The only automatic skip is a verified exact retry (venue-scoped source ID or import fingerprint). Changed data with a matching source ID goes to review. | B.2 / B.3 |
| A matching Client does not prove a matching Event. A matching date does not prove a matching Event. Two people can share an email. One Client may have multiple Events, including same-date Events when occupancy allows. | B.3 |
| Existing Client / claimed Vendor / other-venue relationship details are never silently overwritten. | B.3 |
| Quiet import: no unsolicited invitations, email/SMS, contract execution, Stripe event charges, QBO enqueue, or portal publication. | Phase B |
| Event payments are processed by **Stripe**, not HTC. Importing financial history must not initiate charges or send communications. | Founder |
| Historical completed Events must not inherit inappropriate occupancy or Setup Profile behavior. | Phase B |
| Sandbox deploys from `main` only. Production stays untouched unless explicitly authorized. | Project rules |
| Protected demo venues (Fancy `a415ac52-…`, Willow Grove `31f38b79-…`) are not mutated for QA. Use disposable venues. | Project rules |
| HTC currently has a Sandbox application and **no real Production customers**. | Founder |

---

## 6. Outstanding issues register

Each item: ID, priority (P1 high / P2 / P3 low), status, description, business impact, next action, verification criteria.

### MIG-001 — Historical booking dates

| | |
|---|---|
| **Priority** | P1 |
| **Status** | **COMPLETE — VERIFIED** |
| **Description** | New imports no longer store the import day or the event day as the original booking date. A source date is stored on `events.original_booked_on` with provenance `source`. An unknown date stays null. `events.booked_at` remains the HTC payment-timing stamp and is left null on import. B.3 rows that already have `booked_at` = the import day were not rewritten. |
| **Business impact** | New imports no longer appear as bookings won on the import day. Older imported rows can still carry a fabricated `booked_at` until a separate, evidence-based repair is approved. |
| **Next action** | Closed with MS-RPT. Do not backfill old rows. |
| **Verification** | `lib/reporting/reporting-integrity.test.ts` scenarios D and E. Source lock: import insert does not call the native booking transaction. Migration does not update existing `booked_at`. Persisted on Sandbox venue `MS-RPT Disposable mwkcpyux`: source date `2025-03-01` with null `booked_at`; unknown date stayed null. |

### MIG-002 — Unattended Lead matching

| | |
|---|---|
| **Priority** | P1 |
| **Status** | **NEEDS VERIFICATION** |
| **Description** | Audit whether **non-migration** Lead creation can silently reuse a person on name/email. Manual `createLeadCore` currently calls `requireIdentityDecision` when `trustTier === "manual"` and not historical import. Public ingest / email intake / other trust tiers are not established here. |
| **Business impact** | Two different people sharing an email could be merged without venue confirmation outside Bring Your Business. |
| **Next action** | Code-level audit of every Lead create path (manual, public form, email intake, marketplace). |
| **Verification** | Each path either requires an identity decision or is documented as a distinct inquiry attached to a confirmed person. |

### MIG-003 — Invalid Event URL parameter

| | |
|---|---|
| **Priority** | P3 |
| **Status** | **OPEN** |
| **Description** | A foreign or invalid `?eventId=` may remain in the URL. B.3 showed Fancy’s ID in the query string while the workspace still displayed this Client’s Event. Unauthorized Event data was **not** exposed. |
| **Business impact** | Cosmetic / confusing URL. Not a data leak on observed evidence. |
| **Next action** | Optional: strip invalid `eventId` from the URL. Do not expand B.3. |
| **Verification** | Invalid ID is ignored **and** removed from the address bar; no other Client/venue data appears. |

### MIG-004 — Calendar month readability

| | |
|---|---|
| **Priority** | P3 |
| **Status** | **NEEDS VERIFICATION** |
| **Description** | Event counts may show on the month grid while Event names require opening the day. `docs/launch-confidence-matrix.md` called the month grid “cramped but standard”; that note is not a current visual pass. |
| **Business impact** | Staff scanning a busy month may not see who is booked without an extra click. |
| **Next action** | Confirm current Calendar month UI on Sandbox. Treat as polish unless names are actually missing. |
| **Verification** | Founder can identify Events from the month view at the density expected for launch, or explicitly accepts day-drill-in. |

### MIG-005 — HQ Setup Hub navigation

| | |
|---|---|
| **Priority** | P2 |
| **Status** | **NEEDS VERIFICATION** |
| **Description** | Previously observed: HQ administrators without venue membership hitting the venue app (including Setup Hub) may be routed to intake (`no_memberships` → `/onboarding/intake`). Tests in `app/(app)/layout.no-memberships-loop.test.ts` encode that redirect. HQ White-Glove import uses `/admin/onboarding/{venueId}` and was verified in B.2/B.3. |
| **Business impact** | HQ staff using the venue-app Setup Hub URL instead of the admin onboarding surface may appear “kicked out.” |
| **Next action** | Reproduce with an HQ admin that has no venue membership. Distinguish intended intake routing from a Setup Hub bug. |
| **Verification** | HQ can reach White-Glove import for a venue they are assigned to; no redirect loop; Setup Hub behavior is documented. |

### MIG-006 — Controlled updates to existing records

| | |
|---|---|
| **Priority** | P2 |
| **Status** | **DEFERRED** |
| **Description** | Same-record confirmation currently **preserves** existing details (no silent overwrite). A separate explicit “update this record from the file” workflow does not exist. |
| **Business impact** | Venues cannot refresh contact/event fields from a later export without manual edits. Safer than silent overwrite. |
| **Next action** | Founder decision before any implementation. Not in Phase C unless approved as scope. |
| **Verification** | If built: explicit venue action, preview of field-level changes, no overwrite without confirmation. |

### MIG-007 — Duplicate-review experience

| | |
|---|---|
| **Priority** | P3 |
| **Status** | **OPEN** |
| **Description** | Combined Client/Event and Vendor review works (B.3 screenshots). Remaining polish: shorter explanations, readability, and making held/skipped rows understandable and recoverable. |
| **Business impact** | Does not block migration correctness. Can slow a large import. |
| **Next action** | Defer until after Phase C unless founder prioritizes UX. |
| **Verification** | Venue can decide matches without reading internal classifier language; held/skipped rows remain findable. |

### MIG-008 — Source-system-neutral setup

| | |
|---|---|
| **Priority** | P2 |
| **Status** | **NEEDS VERIFICATION** |
| **Description** | B.3 confirmed Setup Hub / Bring Your Business and HQ import **do not** require choosing HoneyBook or Tripleseat (`SOURCE_SELECTION_LANES` is generic). Internal adapters may remain. White-Glove intake copy in the 2026-11-10 audit still **named** HoneyBook/Tripleseat in descriptions. |
| **Business impact** | Customer-facing competitor names on remaining intake surfaces would contradict the approved generic experience. |
| **Next action** | Scan remaining onboarding/intake/marketing copy. Do not change B.2/B.3 import. |
| **Verification** | No customer-facing setup/import **selector** names competitors. Named adapters stay internal. |

### MIG-009 — Imported-data reporting

| | |
|---|---|
| **Priority** | P1 |
| **Status** | **COMPLETE — VERIFIED** |
| **Description** | Date-filtered Sales bookings use lifecycle `occurred_at`. Imported bookings record that date only when the source booking date is known; otherwise it is null and excluded from the period. Inquiry reports use `performance_inquiry_on` (historical inquiry date, or the HTC creation date for native inquiries). Invoice-dated reporting uses `issued_at` per invoice and is labeled Invoiced. Collected revenue still uses `paid_at`. |
| **Business impact** | An import in November 2026 no longer creates a November Sales booking or assigns every invoice to the import month. Undated invoices stay in all-time totals and drop out of a date window. |
| **Next action** | Closed with MS-RPT. |
| **Verification** | Scenarios B, D, E, and I in `lib/reporting/reporting-integrity.test.ts`. |

### MIG-010 — Multi-event reporting

| | |
|---|---|
| **Priority** | P1 |
| **Status** | **COMPLETE — VERIFIED** |
| **Description** | Dashboard Booked Business counts future confirmed and in-progress Events, not Client ids. Additional imported Events do not create another lifecycle booking or another Lead. Conversion counts a Lead only when that Lead’s sales stage is booked. Invoices stay on their own `event_id`. |
| **Business impact** | One Client with three Events is three Events and one Client. It is not three Lead conversions. |
| **Next action** | Closed with MS-RPT. |
| **Verification** | Scenario A and I in `lib/reporting/reporting-integrity.test.ts`. Additional-event path does not call lifecycle recording. |

---

## 7. Launch blockers versus nonblocking work

### Confirmed Production launch blockers

These block **going live with real customers**. They do **not** block the reporting audit or Phase C.

| ID | Item | Status | Notes |
|---|---|---|---|
| **LAUNCH-001** | Production marketing environment | **BLOCKED** | 2026-11-10 preflight: missing/wrong Production Vercel vars (`NEXT_PUBLIC_SITE_URL` still vercel.app, Resend, Calendly, inquiry notify). Production deploy **not done**. Evidence: `docs/design/MARKETING-PRODUCTION-LAUNCH-PREFLIGHT.md`. |
| **LAUNCH-003** | Gather / Launch Yourself human proof | **OPEN** | Nov 10: White Glove Test checkout **PASS**; Gather founding and Launch Yourself E2E still open. `docs/design/legal-launch-consolidated-audit/NEW-OWNER-SIGNUP-VERIFICATION.md`. |
| **LAUNCH-009** | Final Production launch approval | **OPEN** | Founder has not authorized Production. No real Production customers. |

### Nonblocking / not assumed blockers

| ID | Item | Status | Notes |
|---|---|---|---|
| MIG-003 | Invalid `eventId` in URL | OPEN P3 | No data leak observed. |
| MIG-004 | Calendar month names | NEEDS VERIFICATION | Polish unless current UI is actually unusable. |
| MIG-006 | Explicit update-from-file | DEFERRED | Product decision. |
| MIG-007 | Review-copy polish | OPEN P3 | |
| **LAUNCH-002** | Persist legal acceptances at WG purchase | **DEFERRED** | Nov 10: checkbox + doc versions PASS; `legal_acceptances` rows deferred to Welcome Home / activate. Needs explicit legal/product approval to change. |
| **LAUNCH-004** | Ops purchase email (`INQUIRY_NOTIFY_EMAIL`) | **NEEDS VERIFICATION** | Nov 10: likely unset on marketing task; CRM queue still worked. |
| **LAUNCH-005** | Stripe Connect (venue↔couple payments) | **NEEDS VERIFICATION** | July 2026 register called Connect a facade. Current code has Connect, webhooks, `charges_enabled` verification (`lib/stripe/`). Do not treat “coming soon” as current. Re-verify launch readiness separately from SaaS checkout. |
| **LAUNCH-012** | SaaS subscription lifecycle | **NEEDS VERIFICATION** | WG Test checkout verified 2026-11-10. Gather/Launch Yourself open. Aug 2026 WG price-missing failure is **superseded** by the Nov 10 pass. |
| **TS-001** | Worktree TypeScript baseline | **OPEN** | Separate launch-readiness item. Prior `tsc --noEmit` on this worktree reported 115 errors in files outside the reporting-integrity change. None were in the new reporting symbols. Not closed by MS-RPT or MS-C. |

---

## 8. Broader launch-readiness (evidence-based, not all blockers)

HTC has a **Sandbox** app. Do not describe the application as launched.

| Area | Status | Evidence / gap |
|---|---|---|
| Subscription checkout & billing lifecycle | **NEEDS VERIFICATION** | WG human Test path verified Nov 10. Gather + Launch Yourself still open. Coupon vs list-price reporting noted historically. |
| Stripe Connect & venue financial connections | **NEEDS VERIFICATION** | Implementation exists (`lib/stripe/`). July “coming soon” docs are stale. Event payments remain Stripe, not HTC. |
| Setup Hub & new-venue starter | **NEEDS VERIFICATION** | Four-chapter Setup Hub + Bring Your Business in product. Full new-venue dogfood pass not recorded in this tracker. |
| White-Glove onboarding & handoff | **NEEDS VERIFICATION** | UX corrections existed locally on 2026-11-10 (commit/deploy not authorized in that pass). B.3 HQ import on disposable venues **did** work via `/admin/onboarding/{venueId}`. Gather + Launch Yourself proof still open. |
| Marketing website launch/deployment | **NEEDS VERIFICATION** | Sandbox marketing has been served. Production deploy hard-stopped; env gaps in LAUNCH-001. |
| Privacy, Terms, Vendor Services, cookies, AI disclosures | **NEEDS VERIFICATION** | Routes exist (`app/privacy`, `marketing/app/privacy`). Checkout legal checkbox + doc versions `2026-09-23.2` verified Nov 10. Persistence of acceptances deferred (LAUNCH-002). Cookie/AI disclosure completeness not re-audited here. |
| Email/SMS consent & communications | **NEEDS VERIFICATION** | Quiet-import rule verified for BYB. Live Twilio/consent production readiness is a separate track (do not rotate credentials; no live Twilio mutations from this worktree). |
| Vendor portal & client portal | **NEEDS VERIFICATION** | Historical certification exists (`docs/launch-confidence-matrix.md`) but is stale relative to later product work. Not re-run for this tracker. |
| Production infrastructure, security, monitoring, deploy | **NEEDS VERIFICATION** | Sandbox deploys from `main` only. Production untouched. No current Production go-live evidence. |
| Data export, suspension, retention, recovery | **NEEDS VERIFICATION** | Not assessed in this pass. |
| Final Production launch approval | **OPEN** | Founder gate. |

---

## 9. Deferred enhancements

| ID | Item | Why deferred |
|---|---|---|
| MIG-006 | Explicit update of existing records from a later file | Safer skip/preserve is shipped; update workflow needs founder approval. |
| LAUNCH-002 | Write `legal_acceptances` at WG purchase | Intentional deferral to Welcome Home / activate (Nov 10). |
| MIG-007 | Duplicate-review copy/layout polish | Correctness accepted in B.3; UX polish is not Phase C. |
| MS-INT | Full multi-phase migration E2E | Underlying phases C/D not started. |
| Historical July “Future Product Evolution” items | Advanced white-label, wedding-party portal, etc. | Outside current migration sequence. |

---

## 10. Decisions requiring founder approval

| Decision | Why |
|---|---|
| Start **Phase C** | Explicitly after reporting-integrity audit. |
| Whether imported `booked_at` may remain the import timestamp (MIG-001) | Reporting, pricing, conversion. |
| Whether to build an **update-from-file** path (MIG-006) | Changes accepted B.3 preserve-existing behavior. |
| Persist legal acceptances at purchase vs Welcome Home (LAUNCH-002) | Legal. |
| Any Production deploy or Production env change (LAUNCH-001 / LAUNCH-009) | Hard stop until authorized. |
| Expanding a milestone’s scope | Rule 8. |

---

## 11. Phase C and D

### Phase C — Contracts & Money

**COMPLETE — VERIFIED.** Founder approval granted 2026-11-17. Historical venue–client agreements, venue–vendor agreements, invoices, individual payments, refunds, reallocations, credits, adjustments, and write-offs import through the existing Money stage. Staff invoice and payment views show a read-only Activity History of those stored movements. Client–vendor agreements are out of scope. Import does not charge cards, write QuickBooks, send messages, or request signatures.

Accepted evidence:

- Sandbox migration `20270126120000_phase_c_financial_history.sql` successfully applied.
- Historical contracts, invoices, and individual financial movements imported and reconciled.
- Self-service and HQ import paths verified.
- Actual UI Import interaction verified.
- Historical financial Activity History available to venue staff.
- Native partial-payment reporting verified.
- Date-window Revenue reporting, dashboard totals, and saved-report export reconciled.
- Import retries did not duplicate transactions.
- No unintended Stripe, QuickBooks, communication, or booking side effects.
- Focused tests passed: original 43 plus final 11.
- Protected Fancy and Willow Grove data remained unchanged in the original migration verification.

Known limitations:

- Partially paid installments count as unpaid in the fully-paid installment counter, while showing their received and remaining amounts.
- Source IDs are visible to authorized venue staff.
- Final acceptance relied on existing tenant-scoped controls rather than repeating a cross-venue login.
- Application code is not yet committed, merged, or deployed.

TS-001 stays **OPEN** as a separate launch-readiness item. Phase D is COMPLETE — VERIFIED. No Production change.

Evidence: `~/Desktop/HTC-Phase-C-acceptance/`.

**Hard rule:** Event payments are processed by Stripe, not HTC. Import must not charge cards or send communications.

### Phase D — Planning Materials

**COMPLETE — VERIFIED.** Founder approved the Phase D implementation on 2026-11-17, subject to the client Timeline visibility acceptance. That acceptance passed on the same disposable venue.

Same Bring Your Business engine. Entity type `planning_material` on the planning stage and on HQ onboarding for the selected venue. Record kinds: task, timeline, questionnaire, document, floor_plan, event_order, vendor_assignment.

Acceptance on `Phase C Disposable mwkeg1c2`: completed historical task, upcoming unassigned task, client-owned task, venue and schedule timeline entries, private questionnaire document with its original submission date, floor-plan PDF stored as a file, event-order selection left unshared, vendor assignment with no alert, same-day event held then attached to the Wedding, duplicate task held, catalog row held, retry did not duplicate, HQ imported the Dinner task. Invoices stayed 11, contracts 2, movements 16, playbook applications 0, QuickBooks queue 0, `booked_at` null. Fancy and Willow Grove event counts stayed 156 and 78.

Known limitations:

- Guest lists, RSVPs, and seating charts are not imported. Individual guests remain client-owned.
- A historical questionnaire is kept as a private document, not forced into the native family questionnaire.
- A floor-plan file is kept as a document. It is not turned into an editable room layout.
- Imported client Timeline rows stay client-owned and unsubmitted. Venue staff see them in a labeled section on the Event Timeline. They are not added to the shared Timeline and they are not released to the client.
- Schedule synchronization keeps its existing audience behavior. The Wedding timeline still said it was not on the couple's shared timeline.
- An offerings catalog is held, not turned into a confirmed order. Import does not create an invoice.

TS-001 stays **OPEN**. Application code is not committed, merged, or deployed. No Production change.

---

## 12. Change log

| Date | Change |
|---|---|
| 2026-11-17 | Tracker created. B.1–B.3 recorded as founder-accepted local commits. MS-RPT named next. MIG-001–010 and launch items populated from existing evidence without declaring unaudited work complete. |
| 2026-11-17 | MS-RPT reporting-integrity correction implemented in the worktree. Status IMPLEMENTED — AWAITING APPROVAL. MIG-001, MIG-009, and MIG-010 updated. Not committed. Migration not applied to the hosted database. Legacy `booked_at` values were not rewritten. |
| 2026-11-17 | Acceptance follow-up: migration apply blocked. localhost:3040 points at shared Sandbox `wvpsldwwjqdannqasrdf`. Invoice-date reporting labels changed from Contracted to Invoiced. Persisted acceptance not run. |
| 2026-11-17 | Founder authorized the combined migration on shared Sandbox. Apply stopped before SQL ran: project confirmed, recovery connection not available. No backup, no acceptance venue, no commit or deploy. |
| 2026-11-17 | Applied `20270125120000_reporting_integrity_dates.sql` with Apply Sandbox Migration run `44035385279`, commit `575239c`. Disposable acceptance on `MS-RPT Disposable mwkcpyux` passed. Fancy and Willow Grove checksums unchanged. Not merged or deployed. MS-RPT remains awaiting founder approval. TS-001 recorded separately. |
| 2026-11-17 | Founder accepted MS-RPT. The three earlier failed checkpoints were rechecked against persisted rows and the 2028 Events report. Final record: `~/Desktop/HTC-MS-RPT-acceptance/final-acceptance.json`. Status COMPLETE — VERIFIED. TS-001 remains open. |
| 2026-11-17 | Phase C financial history implemented. Migration `42ca802` applied by run `44040915601`. Disposable acceptance reconciled. Status IMPLEMENTED — AWAITING APPROVAL. Not merged or deployed. TS-001 remains open. Phase D not started. |
| 2026-11-17 | Phase C final acceptance. Import button, native $40 partial, and staff Activity History verified on the same disposable venue. Reporting totals reconcile to invoice balances. Status remains IMPLEMENTED — AWAITING APPROVAL. Recommendation GREEN. No new migration, merge, or deploy. TS-001 remains open. Phase D not started. |
| 2026-11-17 | Founder approved MS-C. Status COMPLETE — VERIFIED. Known limitations preserved. TS-001 remains OPEN separately. Phase D not started. Application code not committed, merged, or deployed. |
| 2026-11-17 | Phase D planning import implemented on the existing migration engine. Vocabulary migration `7cf7401` applied by run `44137654693`. Disposable acceptance on `Phase C Disposable mwkeg1c2`. Status IMPLEMENTED — AWAITING APPROVAL. Not merged or deployed. TS-001 remains open. |
| 2026-11-17 | Founder approved MS-D subject to client Timeline visibility. Imported client entry is visible to venue staff, still client-owned, not submitted, and not shared. Bloom Floral retry added no vendor alert. Status COMPLETE — VERIFIED. TS-001 remains OPEN. Phases B and C were not reopened. Application code was not committed, merged, or deployed. |
| 2026-11-17 | Founder authorized the GREEN integration candidate `763bf33b`. PR #78 merged as `deffb7d6368a8f091071a0fe251de931824de754`. Deploy Sandbox run `44153035245` succeeded. Venue-app task definition `htc-sandbox-venue-app:1216` serves that SHA. Focused Willow Grove smoke passed: Dashboard shows 49 booked events and $996,300 invoiced, cash collected $316,459, outstanding $305,375; Contracts All 78; Payments All 78; Setup Hub and Bring Your Business entry are present; Avery & Jordan Cole Wedding opens with Timeline items 0, Floor Plans empty state, and Event Order not started. TS-001 remains OPEN. Production was not deployed. |
| 2026-11-17 | Easy Onboarding Practice Mode milestones established: PM-01 (IN PROGRESS), PM-02–PM-05, ONB-FINAL, LUV-FINAL, JOURNEY-FINAL, LAUNCH-FINAL. Completed migration milestones preserved. TS-001 unchanged. Production unchanged. |
| 2026-11-17 | PM-01 foundation implemented on `feat/practice-mode-pm01` (uncommitted). Setup Hub milestone 4 shows approved Practice Run copy and Start CTA. Durable `practice_runs` migration prepared as `20270128120000_practice_runs.sql` (not applied). Sample wedding creation is draft/no occupancy with `practice_run_id` + reporting exclusion. Focused tests 11/11. Desktop/mobile entry screenshots in `~/Desktop/HTC-PM01-practice-mode/`. Live start/resume acceptance blocked until migration apply is authorized. TS-001 unchanged. Production unchanged. Not committed, pushed, merged, or deployed. |
| 2026-11-17 | PM-01 Sandbox migration applied (`a02636b7`, run `44169939559`). Disposable-venue live acceptance passed Start/Continue/reload, duplicate prevention, cross-venue RLS isolation, Fancy/Willow unchanged, no QBO/vendor side effects. Status COMPLETE — VERIFIED ON SANDBOX. Application code still uncommitted/undeployed. TS-001 unchanged. Production unchanged. |
| 2026-11-17 | PM-02 venue-side guided journey implemented on `feat/practice-mode-pm01` (uncommitted). Five stages, Back to Practice Run banners, practice proposal/contract simulation layer, practice-booked via `practice_runs.practice_booked_at` (never `events.booked_at`), side-effect guards on email/bookClient/contract send-sign. Additive migration `20270129120000_practice_run_journey.sql` prepared, not applied. Focused tests 16/16. Disposable browser acceptance: 13 PASS / 7 BLOCKED (journey column). Accidental Willow practice start during harness mis-auth archived immediately; samples remain reporting-excluded. Fancy unchanged. Not committed/pushed/merged/deployed. PM-03 not started. TS-001 unchanged. Production unchanged. |
| 2026-11-17 | PM-02 finished: customer-facing copy/nav refined (venue-only perspective; no Coming next / PM labels; simplified Continue / View all stages). Sandbox journey migration applied (`34cd4862`, run `44174988039`). Full disposable acceptance 20/20 PASS. Status COMPLETE — VERIFIED ON SANDBOX. Application code still uncommitted/undeployed. Fancy unchanged; Willow archived practice remnant only. PM-03 not started. TS-001 unchanged. Production unchanged. |
| 2026-11-17 | PM-03 COMPLETE — VERIFIED (local app + Sandbox DB). Client perspective, branding inheritance, two-way practice messaging. Evidence `~/Desktop/HTC-PM03-acceptance/`. Application code uncommitted/undeployed. TS-001 unchanged. Production unchanged. |
| 2026-11-17 | PM-04 Practice Run planning collaboration COMPLETE — VERIFIED on disposable Garden Practice Venue. Prepare/share planning seed, client collaboration loop, isolation 12/12 PASS. Focused tests 15/15. Evidence `~/Desktop/HTC-PM04-acceptance/`. No new migration. Application code still uncommitted/undeployed on `feat/practice-mode-pm01`. PM-01–PM-03 preserved. PM-05 next. TS-001 OPEN. Production unchanged. |
| 2026-11-17 | PM-05 Practice Run reset/cleanup + integrated acceptance COMPLETE — VERIFIED. Finish vs Start over; repeated reset; 17/17 browser acceptance; 35/35 focused tests. Evidence `~/Desktop/HTC-PM05-acceptance/`. No new migration. PM-01–PM-04 preserved. Application code still uncommitted/undeployed. Next: ONB-FINAL after founder commit/deploy auth. TS-001 OPEN. Production unchanged. |
| 2026-11-17 | Practice Mode polish + couple photo: commits `baff338b` / `597da308` on `feat/practice-mode-pm01`, PR #80. Merge blocked by required CI (not bypassed). ONB-FINAL Sandbox acceptance harness added. Production unchanged. TS-001 OPEN. |

---

## 13. Contradictions (older reports vs current evidence)

Do not “fix” these by rewriting history. Use the later evidence; keep the older doc as historical.

1. **Stripe Connect “coming soon” / facade (July 2026 TR-M1, launch-confidence matrix)** vs current `lib/stripe/` Connect + webhooks + `charges_enabled` verification. **Current status: NEEDS VERIFICATION**, not “unbuilt.”
2. **White Glove Stripe price missing (2026-08-13 SaaS E2E FAIL)** vs **2026-11-10 human WG Test checkout PASS** ($598.20, active subscription). Later pass wins.
3. **White Glove intake still naming HoneyBook/Tripleseat (2026-11-10 UX audit “after” copy)** vs **B.3 BYB/Setup Hub generic “Import from another system”** (verified in browser). Surfaces differ; MIG-008 remains NEEDS VERIFICATION for intake/marketing leftovers.
4. **B.3 persist `booked_at` = import day** vs any assumption that original booking dates are already preserved. MIG-001. The correction stops new imports from doing this. Those existing B.3 rows were not rewritten.
5. **July “Lead Capture Red / no import” scorecard** vs shipped Bring Your Business (B.1–B.3). Scorecard is obsolete for migration.

---

## 14. Evidence index (do not duplicate)

| What | Where |
|---|---|
| B.2 Lead acceptance 61/61 | Commit `9fdecf3f`; founder-accepted in chat |
| B.3 implementation + tests | Commit `f92960af`; Desktop `~/Desktop/HTC-Phase-B3-Unified-Review` |
| B.3 persist (SS/HQ) | `docs/qa/phase-b3-unified-review/persist-*.json` (uncommitted local evidence) |
| WG checkout / legal checkbox | `docs/design/legal-launch-consolidated-audit/NEW-OWNER-SIGNUP-VERIFICATION.md` |
| Marketing Production preflight | `docs/design/MARKETING-PRODUCTION-LAUNCH-PREFLIGHT.md` |
| WG UX audit (local, 2026-11-10) | `docs/design/WHITE-GLOVE-ONBOARDING-LAUNCH-AUDIT.md` |
