# HTC Master Release Closeout Ledger

**Status of this document:** working ledger for the current execution. Production untouched.

Exact Sandbox runtime (latest sole RUNNING at last verification):

- Commit / image tag: `1d6c96c24347161656175f3eb4b7a432b5769d26` (contains Smart Fields `2e1a5b79` + Archive `1d6c96c2`)
- Digest: `sha256:c4962eace876d12638af0ee012ebee7ead43a415ccaf6a4186f6657941116fa0`
- Task definition: `htc-sandbox-venue-app:519`
- Task ID: `288fd1d5c7a1410695c0bbe1e73378c0`
- Desired / running / pending: 1 / 1 / 0
- Rollout: PRIMARY COMPLETED
- Live `dpl`: `1d6c96c24347161656175f3eb4b7a432b5769d26`
- Health: `/api/health` HTTP 200
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/36945340507
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

- **STATUS:** GREEN/CLOSED on `1d6c96c2` sole RUNNING (SF lifecycle `2e1a5b79` ancestor)
- **IMPLEMENTATION COMMIT(S):** two-clock `5a711fdc`; provenance `b9aa6a59`; CTR-01 `09c72980`; occupancy `60937777`; Smart Fields lifecycle `2e1a5b79`
- **RUNNING IMAGE/TAG:** `1d6c96c24347161656175f3eb4b7a432b5769d26`
- **DIGEST:** `sha256:c4962eace876d12638af0ee012ebee7ead43a415ccaf6a4186f6657941116fa0`
- **TASK DEFINITION:** `htc-sandbox-venue-app:519`
- **TASK ID:** `288fd1d5c7a1410695c0bbe1e73378c0` (1/1/0, rollout COMPLETED, health 200)
- **AUTOMATED TEST EVIDENCE:** ceremony-reception-merge 14/14; Booking-E1 + space-preferences; commercial-facts provenance; CTR-01 suite; `/tmp/sf-lifecycle-af-proof.json` ALL_OK=true
- **BROWSER EVIDENCE:**
  - Package provenance PASS on `09c72980`: Miss Piggy couple / Cinde internal
  - Occupancy Event Space visible on multi Fancy on `60937777`
  - Conflict / walk-in / calendar / spaces visibility: prior sole-RUNNING proofs retained
  - **Smart Fields A–F on Stream1SF `8b037405-…` / client `8097c52d-…` on `1d6c96c2`:**
    - **A PRE-BOOK:** draft `741ee62c-…` tokens `{{ceremony_space}}`/`{{reception_space}}` preserved; Preview = `Ceremony: Garden Lawn` / `Reception: Barn` (from `lead_event_space_preferences`)
    - **B BOOK:** `book_relationship` → event `dd95d281-…` `booked_at` set; assignments ceremony→Garden Lawn, reception→Barn; prefs remain historical
    - **C POST-BOOK:** prefs mutated to Covered Bridge; booked resolve still Garden Lawn/Barn from assignments (pref ignored)
    - **D SENT IMMUTABLE:** sent `fcba043f-…` body frozen `Ceremony: Garden Lawn\nReception: Barn` after ceremony assignment → Covered Bridge
    - **E NEW DRAFT:** browser Preview after change = `Ceremony: Covered Bridge` / `Reception: Barn`
    - **F EXTERNAL/UNDECIDED:** locked outside-venue copy + Harbor Dock reception pref + unlisted undecided (unit+script)
- **DB/PERSISTENCE EVIDENCE (Booking-E1 seed on Stream1Conflict + Stream1SF):** retained prior Conflict seed; Stream1SF event `dd95d281-…` as above
- **PACKAGE PROVENANCE / OCT4 / CTR-01:** CLOSED — do not reopen without new regression
- **SMART FIELDS PRODUCT LOCK:** pre-booking → lead_event_space_preferences; post-booking (`events.booked_at`) → event assignments/external; sent body frozen. Proven on exact sole RUNNING.
- **REMAINING WORK:** None

### STREAM 1 ADD-ON — `{{additional_event_spaces}}` starter correction

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `88213c34` (`htc-sandbox-venue-app:520`, digest `sha256:459e896e366f…`)
- **IMPLEMENTATION COMMIT(S):** `88213c34`
- **MIGRATION:** `20261410800000_contract_starter_ctr01_additional_event_spaces.sql` — Apply SUCCESS https://github.com/jlcormier612/wevenu-website/actions/runs/36947742763
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36947740647
- **TASK ID:** `956a18370109488b92403fb795477c3a` (1/1/0, health 200 at proof)
- **AUTOMATED TEST EVIDENCE:** A–J unit suites PASS
- **BROWSER EVIDENCE:**
  - Stream1SF Preview: Venue/Ceremony/Reception only — no Additional section
  - Jane draft `7d3a1b5d-…` Preview: Additional = Covered Bridge only; Ceremony/Reception not duplicated
  - Bar Agreement authored template untouched (Updated 2d ago; still `{{event_spaces}}` ×2)
  - Fancy CTR-01 has `{{additional_event_spaces}}`, no starter `{{event_spaces}}`
- **DB/PERSISTENCE:** Jane `event_spaces` full set unchanged; sent freeze `5617b310-…` sha `bd0c5e4771f281f4`
- **REMAINING WORK:** None
- **STATUS FILE:** `docs/qa/additional-event-spaces-starter/STATUS.md`

### CONTRACT UX — signing first-name + Lead payment nav

- **STATUS:** GREEN on exact sole RUNNING `38e3d753` / TD `:521` / task `308fccbb…`
- **IMPLEMENTATION COMMIT(S):** `38e3d753`
- **RUNNING IMAGE/TAG:** `38e3d753b4fe33277aff54306d3bce2ca3c5900d`
- **DIGEST:** `sha256:f67fb6faefaad32f789964f938c874659112f12ec571cdb4e1e80b0614b5e649`
- **TASK DEFINITION:** `htc-sandbox-venue-app:521`
- **TASK ID:** `308fccbbbe6b4be0a66a434828befbca`
- **AUTOMATED TEST EVIDENCE:** `lib/contracts/return-path.test.ts` 18/18 PASS
- **BROWSER EVIDENCE:**
  - Sign `0916c45a-…`: confirmation **Thank you, Kermit.**; DB `signer_name=Kermit Frog`
  - FE not-booked `107fcc2c-…` → `/leads/20e470d8-…?setupPayments=1#booking-journey-payments` (sheet open; not `/clients/`)
  - Booked Ivy `e8485a5d-…` → `/clients/3c9ecc54-…?setupPayments=1`
- **REMAINING WORK:** None
- **STATUS FILE:** `docs/qa/contract-ux-signing-payment-nav/STATUS.md`

### STREAM 1 — Lead Space Preferences UX (presentation)

- **STATUS:** OPEN — forensic audit complete; compact UI implemented locally; not yet on sole RUNNING
- **AUDIT:** `docs/qa/lead-space-preferences-ux/AUDIT.md`
- **IMPLEMENTATION COMMIT(S):** pending
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** still `38e3d753` / `f67fb6fa…` / `:521` / `308fccbb…` (pre-change)
- **AUTOMATED TEST EVIDENCE:** `lib/leads/space-preferences.test.ts` occupancy anchor + multi/single UI coupling PASS locally
- **BROWSER EVIDENCE:** pending post-deploy
- **REMAINING WORK:** commit → deploy → sole RUNNING → browser Cases A–E (+ booked Additional) → ledger GREEN for this sub-gate only
- **STATUS FILE:** `docs/qa/lead-space-preferences-ux/STATUS.md`

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

- **STATUS:** OPEN — Archive browser+DB proven on `1d6c96c2`; Restore UI added locally (needs deploy); PA4 cleanup remaining
- **IMPLEMENTATION COMMIT(S):** `1d6c96c2` (+ pending Restore button on lead detail / page)
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** `1d6c96c2` / `sha256:c4962eac…` / `:519` / `288fd1d5…`
- **AUTOMATED TEST EVIDENCE:** `lib/relationships/archive.test.ts`
- **BROWSER EVIDENCE:**
  - Archive button next to Delete on lead detail
  - ArchiveProof disposable `143e826b-…` / rel `68bc3374-…`: Archive → redirect `/leads`; **not** in Leads list (`ArchiveProof` absent from page text)
- **DB/PERSISTENCE EVIDENCE:** `archived_at=2026-10-02T00:28:16Z`, `archived_by` set; lead row retained (not deleted); DB restore clears `archived_at` and direct URL loads again
- **REGRESSION EVIDENCE:** Delete remains hard-delete; Archive ≠ Delete
- **REMAINING WORK:** deploy Restore UI; browser Restore click; Dashboard/Payments/Clients exclusion matrix; PA4 three-root cleanup after Archive GREEN

### STREAM 4 — Follow-up Completion

- **STATUS:** OPEN — paths 1–2 proven; path 3 interrupted by mid-deploy skew + Stream1Closeout becoming Booked
- **IMPLEMENTATION COMMIT(S):** `d92ab44103fcdb6552abf5c6ca49b73a76d24b43` (do not rewrite); ancestor of current `1d6c96c2`
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** proofs started on `0a24f026`; continue on `1d6c96c2` / `:519` / `288fd1d5…`
- **AUTOMATED TEST EVIDENCE:** not re-run this session
- **BROWSER EVIDENCE (Stream1Closeout `45d7f034-…`):**
  - Path 1 Another follow-up → `Follow up: Follow up after tour` / `Due: Oct 15, 2026` (Activity 7)
  - Path 2 Other next action → UI `Next action: Confirm event details` / `Follow-up: —`; DB `follow_up_date=null`, `next_action_text=Confirm event details`
  - Path 3 No further — save in flight when deploy cutover caused lead load failure; lead later `sales_stage=booked` with client `975b703b-…` / event `45a523d3-…` booked
- **DB/PERSISTENCE EVIDENCE:** path 2 confirmed; path 3 incomplete
- **REGRESSION EVIDENCE:** tour completion / Last Contacted must not complete follow-up — not yet proven
- **REMAINING WORK:** finish path 3 (+ Cancel-as-fourth if required) on a disposable non-booked lead; prove tour completion and Last Contacted do not complete follow-up

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
