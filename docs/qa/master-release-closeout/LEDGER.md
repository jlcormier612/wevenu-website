# HTC Master Release Closeout Ledger

**Status of this document:** working ledger for the current execution. Production untouched.

Exact Sandbox runtime (latest sole RUNNING at last verification):

- Commit / image tag: `60937777cd56197156b4b9ae1c518e7b74281d25` (occupancy Event Space)
- Digest: `sha256:bee8e77d44024bb63facafa100726eca03677983f7efe8e229b40fd86c9cdc8d`
- Task definition: `htc-sandbox-venue-app:517`
- Task ID: `e8ae971b93f6411c89850e8a8c861fea`
- Desired / running / pending: 1 / 1 / 0
- Health: `/api/health` HTTP 200
- Typography commit `0a24f026` + Smart Fields lifecycle `2e1a5b79` — Sandbox deploy `36944945498` queued/pending (not yet sole RUNNING)
- Cluster: `htc-sandbox` only
- Production: untouched

## Already GREEN/CLOSED (not reopened)

| ITEM | STATUS | IMPLEMENTATION COMMIT(S) | RUNNING IMAGE/TAG | DIGEST | TASK DEFINITION | TASK ID | AUTOMATED TEST EVIDENCE | BROWSER EVIDENCE | DB/PERSISTENCE EVIDENCE | REGRESSION EVIDENCE | REMAINING WORK |
|------|--------|--------------------------|-------------------|--------|-----------------|---------|-------------------------|------------------|-------------------------|---------------------|----------------|
| Dashboard Phase 3B L1 | GREEN/CLOSED | prior Phase 3B closeout | `b2952b29` | `sha256:ce110254…` | `:511` | prior | L1 allowlist tests | prior | n/a | no reopen | None |
| Dashboard capacity | GREEN/CLOSED | `831cb575` | Phase 3B runtime | prior | `:511` | prior | capacity gate | prior | n/a | 512/1024 retained | None |
| Performance Program overall | GREEN/CLOSED | see `docs/qa/performance-program-closeout/LEDGER.md` | `c59adf5b` for 3C closeout | `sha256:7a72422b…` | `:513` | `82153d37…` | per-slice tests | CDP TTFB | n/a | no new regression | None |
| Tours Phase 1 | GREEN/CLOSED | prior | prior | prior | prior | prior | tour two-clock tests | prior | prior | do not reopen | None |
| Tours Phase 2 core behavior | GREEN/CLOSED | prior | prior | prior | prior | prior | relationship-tour tests | prior | prior | do not reopen | None |
| Contract lifecycle | GREEN/CLOSED | prior | prior | prior | prior | prior | contract tests | prior | prior | do not reopen | None |
| Invoice/customer-facing financial flow | GREEN/CLOSED | prior | prior | prior | prior | prior | invoice tests | prior | prior | do not reopen | None |
| Documents simplification | GREEN/CLOSED | prior | prior | prior | prior | prior | prior | prior | prior | do not reopen | None |
| Luv performance scope | GREEN/CLOSED | `0b5a34e4` | prior Luv-scope runtime | prior | prior | prior | CW Luv tests | TTFB 2078 ms | n/a | do not reopen | None |
| Luv contextual-intelligence S1–S4 / Phase 5 / Phase 6 | GREEN/CLOSED | prior formal close | prior | prior | prior | prior | phase STATUS files | prior | prior | do not reopen | None |
| Dashboard greeting | GREEN/CLOSED | prior | prior | prior | prior | prior | prior | prior | prior | do not reopen | None |
| Global deleted-record visibility | GREEN/CLOSED | prior | prior | prior | prior | prior | `docs/qa/global-deleted-record-visibility/STATUS.md` | prior | prior | do not reopen | None |
| Library collection consistency | GREEN/CLOSED | prior | prior | prior | prior | prior | prior STATUS | prior | prior | do not reopen | None |
| Deploy-skew recovery | GREEN/CLOSED | prior | prior | prior | prior | prior | `lib/deploy/client-skew-recovery.test.ts` | prior | n/a | do not reopen | None |
| Tour email semantics | GREEN/CLOSED | prior | prior | prior | prior | prior | prior STATUS | prior | prior | do not reopen | None |
| Slice 1 performance | GREEN/CLOSED | `b5a5ce39` | prior | prior | prior | prior | slice1 tests | TTFB | n/a | do not reopen | None |
| Slice 2 performance | CLOSED — measured/no-action | `de3a1116` | prior | prior | prior | prior | slice2 tests | TTFB flat | n/a | do not reopen | None |
| Slice 3A Contracts | GREEN/CLOSED | `646aafae` | prior | prior | prior | prior | slice3a tests | TTFB | n/a | do not reopen | None |
| Slice 3B Invoices | CLOSED — measured/no-action | `31db159a` | prior | prior | prior | prior | slice3b tests | TTFB no win | n/a | do not reopen | None |
| Slice 3C Payment Schedules | CLOSED — measured/no-action | none (measurement only) | `c59adf5b` | `sha256:7a72422b…` | `:513` | `82153d37…` | n/a | Colby CW median 1882 ms | n/a | no regression | None |
| Remaining CW Promise.all waterfall | CLOSED — measured/no-action | none | prior | prior | prior | prior | platform forensic | TTFB | n/a | diminishing return | None |
| Client Workspace Luv | GREEN/CLOSED | `0b5a34e4` | prior | prior | prior | prior | luv-scope tests | TTFB | n/a | do not reopen | None |
| Platform 12-workflow forensic | GREEN/CLOSED | prior | `0b5a34e4` | prior | prior | prior | forensic | CW 2185 ms | n/a | do not reopen | None |

---

## Open master-release streams

### STREAM 1 — Tours + Spaces + Booking-E1 + Smart Fields

- **STATUS:** OPEN — Smart Fields lifecycle fix `2e1a5b79` awaiting sole RUNNING + A–F proofs
- **IMPLEMENTATION COMMIT(S):** two-clock `5a711fdc`; provenance `b9aa6a59`; CTR-01 `09c72980`; occupancy `60937777`; Smart Fields lifecycle `2e1a5b79`
- **RUNNING IMAGE/TAG:** `60937777…` (sole RUNNING); target for SF proofs: `2e1a5b79…`
- **DIGEST:** `sha256:bee8e77d44024bb63facafa100726eca03677983f7efe8e229b40fd86c9cdc8d`
- **TASK DEFINITION:** `htc-sandbox-venue-app:517`
- **TASK ID:** `e8ae971b…` (1/1/0, health 200)
- **AUTOMATED TEST EVIDENCE:** ceremony-reception-merge 14/14; Booking-E1 + space-preferences 16/16; commercial-facts provenance; CTR-01 suite
- **BROWSER EVIDENCE:**
  - Package provenance PASS on `09c72980`: Miss Piggy couple / Cinde internal
  - Occupancy Event Space visible on multi Fancy on `60937777`
  - Conflict disposable `0c535b2d-…`: ConflictWarning capacity + Save hard-block; soft-path follow-up survives (`Soft-path follow-up after conflict` / `2026-10-13`); no tour row; Stream1Closeout tour intact
  - Walk-in + actual_only: tour `6ef68250-…` origin=walk_in, actual 11:30 AM; Calendar Oct 1 shows Walk-in · Completed; Luv non-negative
  - Spaces visibility: single mode hides Ceremony/Reception prefs, keeps Event Space; reception-only hides Ceremony, shows Reception; Fancy restored to multi
  - Booking file started for Stream1Conflict → client `2d91df8b-…` (not Booked yet at that step)
- **DB/PERSISTENCE EVIDENCE (Booking-E1 seed on Stream1Conflict):**
  - `book_relationship` → event `db6c8a9f-…` `booked_at=2026-10-01`, `space_id=Barn`, `external_reception_location=Harbor Dock`
  - `event_space_assignments`: ceremony → Garden Lawn
  - lead preferences unchanged (historical intent)
- **PACKAGE PROVENANCE / OCT4 / CTR-01:** CLOSED — do not reopen without new regression
- **SMART FIELDS PRODUCT LOCK (new):** pre-booking → lead_event_space_preferences; post-booking (`events.booked_at`) → event assignments/external; sent body frozen. Implemented `2e1a5b79`.
- **REMAINING WORK:**
  1. Exact-runtime prove `2e1a5b79` sole RUNNING
  2. Smart Fields A–F proofs (disposable Stream1SF) on that image
  3. Undecided + inactive skip browser/DB edges if not covered by A–F
  4. Confirm/reschedule already proven on Stream1Closeout — keep closed

### STREAM 2 — Typography / JSX interstitial whitespace

- **STATUS:** GREEN/CLOSED on `0a24f026` sole RUNNING (`htc-sandbox-venue-app:518`, digest `sha256:683f1ad768a2…`)
- **IMPLEMENTATION COMMIT(S):** `0a24f026ae1ef2a91da95820bd020c3783d528e6`
- **RUNNING IMAGE/TAG:** `0a24f026ae1ef2a91da95820bd020c3783d528e6`
- **DIGEST:** `sha256:683f1ad768a209d3296ecf10580c75813f82a2cb998da58682324ec5d21b31be`
- **TASK DEFINITION:** `htc-sandbox-venue-app:518`
- **TASK ID:** `60e9415948174a34b981b2f8c92d454c`
- **AUTOMATED TEST EVIDENCE:** `lib/ui/jsx-interstitial-whitespace.test.ts` 2/2 PASS
- **BROWSER EVIDENCE:** Task Center shows `3 items need attention on your team's list` (correct spacing; no `itemsneed`)
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** walker forbids known-bad JSX interstitial patterns across app/components
- **REMAINING WORK:** None

### STREAM 3 — Archive / Delete / Restore

- **STATUS:** OPEN — forensic started; implementation not begun
- **IMPLEMENTATION COMMIT(S):** none for Archive
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** existing delete contract tests (`lib/records/delete-record.test.ts`, `lib/records/deletion-contract.ts`) lock **hard delete, no soft-delete**
- **BROWSER EVIDENCE:** not started
- **DB/PERSISTENCE EVIDENCE:** current Lead hard-delete cascades lead-scoped rows, SET NULL `clients.lead_id`; client/events/payments can survive; PA4 leftovers still surface on Dashboard/Payments
- **REGRESSION EVIDENCE:** none yet
- **REMAINING WORK:** finish relationship-tree forensic; lock Archive Contract (relationship-level ACTIVE→ARCHIVED, distinct from hard Delete); implement against that contract (not a single-table flag); tests; Sandbox migration if required; exact runtime; archive/restore browser+DB; active-surface exclusion; historical/financial preservation.

Proposed resolution against locked architecture (not yet implemented):
- **Delete** remains the existing hard-delete path (`deletion-contract.ts`).
- **Archive** is a new relationship-level authority on `venue_customer_relationships` (not a per-row `is_archived` on one table) that excludes the relationship from active Leads/Clients/pipeline/Dashboard/Focus/Coming Up/Tasks/Payments/Calendar-as-active while retaining contracts/documents/financials historically.
- **Restore** clears that relationship archive authority.
- Hard-delete of a Lead continues to leave booked-side history unless that history is also archived with the relationship — that is the PA4 defect Archive must close.

If Jennifer rejects relationship-level archive on `venue_customer_relationships`, STOP — that is a product decision.

### STREAM 4 — Follow-up Completion

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** `d92ab44103fcdb6552abf5c6ca49b73a76d24b43` (do not rewrite)
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`. `git merge-base --is-ancestor d92ab441 c59adf5b` = yes. No new commit/deploy required unless proof fails.
- **AUTOMATED TEST EVIDENCE:** not re-run this session
- **BROWSER EVIDENCE:** Stream1Closeout Proof shows **Complete follow-up** on the lead (UI present). Not exercised to completion this session.
- **DB/PERSISTENCE EVIDENCE:** lead still has `follow_up_date=2026-10-08` / `next_action_text=Schedule a tour`
- **REGRESSION EVIDENCE:** tour completion must not complete follow-up (not yet proven this session)
- **REMAINING WORK:** browser E2E the four What’s-next paths + activity/DB on this same `c59adf5b` image; prove tour completion and Last Contacted do not complete follow-up.

### STREAM 5 — React hydration #418

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none this session
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none yet
- **BROWSER EVIDENCE:** not reproduced this session on Sandbox
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** historical notes point at Settings tour-booking URL server/client origin mismatch (`docs/new-venue-morning-p1-prioritization.md`, `docs/left-navigation-implementation.md`)
- **REMAINING WORK:** reproduce #418 on current runtime (console + Settings + customer-facing); if HTC code, fix+deploy+prove; if proven harmless/external, close with that evidence.

### STREAM 6 — Luv launch-boundary

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** existing Luv code (`lib/luv/drafts.ts` Discard=DELETE already implemented)
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** `lib/luv/draft-discard-delete.test.ts`, `lib/luv/draft-context-boundary.test.ts` exist; not re-run this session
- **BROWSER EVIDENCE:** Stream1Closeout has **Internal notes** tab; labeling/copy not audited this session
- **DB/PERSISTENCE EVIDENCE:** none this session
- **REGRESSION EVIDENCE:** none this session
- **REMAINING WORK:** browser-prove internal-note labeling; customer-facing source boundary; Proposal Sent = `commercial_proposals.status=sent AND offered_at IS NOT NULL`; Discard deletes `luv_drafts` with no Draft History; run the three regression suites on exact runtime.

### STREAM 7 — Twilio / A2P

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** current product (no redesign unless defect)
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** not gathered this session
- **BROWSER EVIDENCE:** Stream1Closeout shows “Hello to Cheers requires the person's permission before you can send them text messages” and “Texting isn't set up for this venue yet”
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** audit customer-facing opt-in (final consent language, Privacy, Terms, separate checkbox, phone ≠ consent, STOP/START) on a venue that has texting set up (Jen also owns Texting E2E Disposable `31ea4816-…`).

### STREAM 8 — Setup / Activation

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** current product
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none this session
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** first-run / Setup Hub / owner language audit on exact runtime; fix defects if found; prove.

### STREAM 9 — Automations

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** current product
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none this session
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** audit live automation triggers/timing/duplicates/archive interaction; fix only proven defects; prove.

### STREAM 10 — Help / Guides

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** customer-facing help audit vs current UI; fix stale Weven/removed-feature copy; browser-prove.

### STREAM 11 — Post-event / Feedback

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** current product
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none this session
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** audit event completion / feedback / next-action vs Follow-up Completion (do not merge unless architecture already does); prove.

### STREAM 12 — Branding / white-label / customer-facing polish

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** audit venue/customer branding, emails, hosted/public pages, documents for stale HTC/Wevenu identity; fix release defects only.

### STREAM 13 — Permissions / security / privacy

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** space-preference RLS tests exist (`space-preferences.db.test.ts`); not re-run this session against Sandbox
- **BROWSER EVIDENCE:** none this session
- **DB/PERSISTENCE EVIDENCE:** none this session
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** venue isolation, staff, portal, documents, financials, archive, Luv internal-note boundary — code/DB/browser proof.

### STREAM 14 — Release-relevant engineering cleanup

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** none
- **BROWSER EVIDENCE:** n/a
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** forensic for dead executable paths / duplicate engines / skew / broken migrations / unsafe compatibility only. No cosmetic refactors.

### STREAM 15 — Responsive / mobile

- **STATUS:** OPEN
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `c59adf5b` / `sha256:7a72422b…` / `:513` / `82153d37…`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** desktop only this session
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** supported-width browser audit of critical venue/customer flows; fix genuine clipped/unusable defects.

### STREAM 16 — Final cross-system regression

- **STATUS:** OPEN — blocked until Streams 1–15 are GREEN/CLOSED or formally blocked
- **IMPLEMENTATION COMMIT(S):** n/a
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** not yet
- **AUTOMATED TEST EVIDENCE:** none
- **BROWSER EVIDENCE:** none
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** after individual streams close, run Lead→Client→Event→Contract→Invoice/Payment + Tours/Spaces/Smart Fields/Luv/Tasks/Dashboard/Documents/Archive/portal interaction pass.

### PA4 QA cleanup

- **STATUS:** OPEN — not executed
- **IMPLEMENTATION COMMIT(S):** none required
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** n/a (data-only)
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** none
- **DB/PERSISTENCE EVIDENCE:** prior forensic named PA4 Near / Mid / Far as client→event→payment_schedule→payment_line_item fixtures
- **REGRESSION EVIDENCE:** n/a
- **REMAINING WORK:** re-confirm the three roots are still exactly those QA fixtures and unused by open proofs; delete line items → schedules → events → clients only. Do not delete Ivy/Nora/Maya/Leo/Jane/Ron/Goldi or Stream1Closeout Proof.

---

## Production

Untouched. Sole HTC cluster in use: `htc-sandbox`.
