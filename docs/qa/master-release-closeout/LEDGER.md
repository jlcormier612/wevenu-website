# HTC Master Release Closeout Ledger

**OVERALL HTC RELEASE:** NOT GREEN — Date Hold + Luv sub-gates GREEN/CLOSED. Payment lifecycle OPEN (financial scenario proven on sole RUNNING `d8ccf73c` / `:544`; UX defects found and fixed locally, not yet the sole running image). Venue Planning template + setup Overview OPEN (browser/DB proof pending). Production untouched.

**Status of this document:** authoritative master-release closeout. Production untouched.

Exact Sandbox runtime (sole RUNNING at Luv re-proof, 2026-10-02):

- Commit / image tag: `ed87d485fb459d19d767c74857136c01766b3ef0` (contains `501b5a05`, `ed87d485`, `9bfbf4d6`, `cfeff8ca`, `fd213041`, `df5e7bc2`)
- Digest: `sha256:a098c8ea50e5424d8d8fcf4c2db17fc32a0a0d64f1c04339954774137f5d28a2`
- Task definition: `htc-sandbox-venue-app:542`
- Task ID: `454c210a8bd74a45ac2ab1aa411f1de3`
- Desired / running / pending: 1 / 1 / 0
- Rollout: PRIMARY COMPLETED (sole RUNNING; `:541` drained)
- Health: `https://app.sandbox.hellotocheers.com/api/health` HTTP 200 `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/37079499238 SUCCESS
- Cluster: `htc-sandbox` only. Production untouched.

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
| Luv contextual-intelligence S1–S4 / Phase 5 / Phase 6 | GREEN/CLOSED on exact sole RUNNING `ed87d485` | `9bfbf4d6` `df5e7bc2` `501b5a05` `ed87d485` | `ed87d485` | `sha256:a098c8ea…` | `:542` | `454c210a…` | 82 Luv + 81 payment/Luv focused PASS this pass | FakeBooked/Miss Piggy/ACTION/CONTEXT/SILENCE/StageOnly drafting proven below | disposable fixtures below | no closed-stream reopen | None for Luv sub-gates |
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

- **STATUS:** GREEN/CLOSED on prior `1d6c96c2`; **closeout re-proof progressing on exact sole RUNNING `eeee6049` / `:527`**
- **IMPLEMENTATION COMMIT(S):** two-clock `5a711fdc`; provenance `b9aa6a59`; CTR-01 `09c72980`; occupancy `60937777`; Smart Fields lifecycle `2e1a5b79`
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372` (1/1/0, PRIMARY COMPLETED, health 200)
- **AUTOMATED TEST EVIDENCE:** ceremony-reception-merge 14/14; Booking-E1 seed suite 4/4 PASS (includes inactive/disallowed skip); commercial-facts provenance; CTR-01; `/tmp/sf-lifecycle-af-proof.json` ALL_OK=true
- **BROWSER EVIDENCE:**
  - Package provenance PASS on `09c72980`: Miss Piggy couple / Cinde internal
  - Occupancy Event Space visible on multi Fancy on `60937777`
  - Conflict / walk-in / calendar / spaces visibility: prior sole-RUNNING proofs retained
  - **Smart Fields A–F on Stream1SF `8b037405-…` / client `8097c52d-…` on `1d6c96c2`:** retained prior
  - **Closeout 1A occupancy (DB + Booked land on `876c9d51`, still valid under `eeee6049` hydration-only cutover):** disposable OccBook3 `9b46cb2d-…` / event `7eeae958-…` — reception occupancy anchor Barn; no generic Event Space UI required
  - **Closeout 1D Jasmine Oct4 (exact `eeee6049`):** lead `7e0ba76d-…` tour `034870b2-…`
    - DB: `scheduled_at=2026-10-04T17:00Z` preserved; `actual_occurred_at=2026-10-01T18:45Z`; `completed_at` set; status=completed; **1 row**
    - Browser card: “Thursday, October 1, 2026” / “2:45 PM”; Luv “completed their tour **8h ago**” (no `-66h ago`)
    - Calendar agenda places Jasmine Completed on **Oct 1** (actual), not as a future Oct 4 appointment
  - **Closeout 1G provenance (exact `eeee6049`):** Wilma `4e7c5ab7-…` → **Selected by the couple** (`proposal_id` set); Cinde `9ca3196f-…` → **Selected internally** (`proposal_id` null); Grace also Selected internally
  - **Closeout 1H AES presentation (exact `eeee6049`):** Jane `b7aa9216-…` shows Ceremony=Garden Lawn / Reception=Barn / Additional=Covered Bridge Cocktail Hour (cocktail_hour assignment; ceremony/reception/event_space filtered from Additional)
- **DB/PERSISTENCE EVIDENCE:** OccBook3; Jasmine two-clock; Jane assigns ceremony+reception+cocktail_hour(+legacy event_space); Wilma/Cinde commercial_selections.proposal_id
- **PACKAGE PROVENANCE / OCT4 / CTR-01 / AES ADD-ON:** CLOSED on current runtime proofs above + prior add-on GREEN
- **SMART FIELDS PRODUCT LOCK:** retained
- **REMAINING WORK:** None. Residuals B/C/E/F later GREEN/CLOSED on `204c885f` / `7dbece3f` (see Stream 1 residuals below). Do not reopen A/D/G/H/AES without regression.

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

- **STATUS:** GREEN on exact sole RUNNING `abf4e0f4` / TD `:522` / task `79b0568c…`
- **AUDIT:** `docs/qa/lead-space-preferences-ux/AUDIT.md`
- **IMPLEMENTATION COMMIT(S):** `abf4e0f4`
- **RUNNING IMAGE/TAG:** `abf4e0f45c1c2bd60343cbe5cd8be12f4d293d6a`
- **DIGEST:** `sha256:95e05e943ebc40b45c652381a5c84474ff6b325056fafdd93634d2ffd9b17e76`
- **TASK DEFINITION:** `htc-sandbox-venue-app:522`
- **TASK ID:** `79b0568c1c3148c6b4562e948006229c`
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36951012609
- **AUTOMATED TEST EVIDENCE:** `lib/leads/space-preferences.test.ts` occupancy anchor + multi/single UI coupling PASS
- **BROWSER EVIDENCE:**
  - Fancy multi Miss Piggy: Ceremony|Garden Lawn · Reception|Barn side-by-side; no Event Space / Venue space
  - Jane booked: + Additional Covered Bridge; no Ceremony/Reception duplicate
  - Temporary single: Event space|Garden Lawn only
  - Temporary reception-only: Reception|Barn only
  - Occupancy: UI preference save re-wrote null `planned_event_space_id` → Barn (reception anchor)
- **FIXTURE RESTORE:** Fancy multi + original permitted_uses; Miss Piggy prefs + planned restored
- **REMAINING WORK:** None for this sub-gate
- **STATUS FILE:** `docs/qa/lead-space-preferences-ux/STATUS.md`

### STREAM 1b — Lead → Booked terminology / navigation

- **STATUS:** GREEN on exact sole RUNNING `876c9d51` / TD `:526` / task `af8590f4…`
- **AUDIT:** `docs/qa/lead-booked-terminology/AUDIT.md`
- **IMPLEMENTATION COMMIT(S):** `51bbd4c6`, `d0da47d2`, `f583cd7d`, `04d5df4b`, `876c9d51`
- **RUNNING IMAGE/TAG:** `876c9d519b63a01c0e73702a71d428a448e7767c`
- **DIGEST:** `sha256:2e5e408c5cbac21ff1c22a751c0e1ecb01ebd2654787e328cf8055ee8f89369d`
- **TASK DEFINITION:** `htc-sandbox-venue-app:526`
- **TASK ID:** `af8590f4d29943508b0da570f9277a5e`
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36954707812
- **AUTOMATED TEST EVIDENCE:** `lib/leads/booking-lifecycle.test.ts` + `lib/invoices/return-path.test.ts` + `lib/contracts/return-path.test.ts` PASS
- **BROWSER EVIDENCE:**
  - Disposable `c696630b…`: Mark as Booked; Open booking file gone; land Client `/booked`
  - Unbooked Miss Piggy invoice `14e4cb27…` from Lead → back `/leads/20e470d8…#booking-journey-payments` (not Invoices, not `/clients/`)
  - Booked Jane invoice `60d264f4…` from Client → back `/clients/b2a45f9f…`
  - Global `/invoices` → Jane invoice → back **Invoices** `/invoices`
  - Payment: FE-not-booked → lead `#booking-journey-payments`; Booked Ivy → `/clients/…?setupPayments=1`
- **DB/PERSISTENCE EVIDENCE:** `sales_stage=booked`, `lifecycle_booked_at`, `events.booked_at`, contracts remain `signed`
- **REMAINING WORK:** None for this sub-gate
- **STATUS FILE:** `docs/qa/lead-booked-terminology/STATUS.md`

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

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `876c9d51` / TD `:526` / task `af8590f4…`
- **IMPLEMENTATION COMMIT(S):** `1d6c96c2` (Archive authority + active-list exclusion); Restore UI present in running `876c9d51` image
- **RUNNING IMAGE/TAG:** `876c9d519b63a01c0e73702a71d428a448e7767c`
- **DIGEST:** `sha256:2e5e408c5cbac21ff1c22a751c0e1ecb01ebd2654787e328cf8055ee8f89369d`
- **TASK DEFINITION:** `htc-sandbox-venue-app:526`
- **TASK ID:** `af8590f4d29943508b0da570f9277a5e`
- **AUTOMATED TEST EVIDENCE:** `lib/relationships/archive.test.ts` 5/5 PASS
- **BROWSER EVIDENCE (disposable ArchiveCloseout `5ad04202-…` / rel `0cbb0c2f-…` on `876c9d51`):**
  1. Archive click → redirect `/leads`; search `ArchiveCloseout` → **No leads match your filters**
  2. Direct URL still loads; **Restore** shown (not Archive); tour Mar 15 2028 retained; Internal notes shows historical note; Documents 1 retained
  3. Clients search `ArchiveCloseout` while archived → **No clients match your filters**
  4. Restore click → button returns to **Archive**; `archived_at` cleared
  5. Leads search returns `ArchiveCloseout 369-4ec05d & Proof Partner` again
  6. Delete remains separate hard-delete control beside Archive/Restore
- **DB/PERSISTENCE EVIDENCE:**
  - Archive: `archived_at=2026-10-02T02:33:07Z`, `archived_by=2fa73101-…`
  - Survived archive (no deletion): lead_notes `8b45eff8-…`, tour `ec03e2a2-…`, document `3b87a144-…`, invoice `a637a923-…` (`ARC-1790908374144`), payment_schedule `00ea8516-…`, event `eb3d51ca-…`, client `cac735d6-…`
  - Restore: `archived_at=null`, `archived_by=null`; same child counts retained (notes1/tours1/docs1/invoices1/schedules1)
- **REGRESSION EVIDENCE:** Archive ≠ Delete; authority sole `venue_customer_relationships.archived_at`; no second lifecycle model
- **REMAINING WORK:** None for Stream 3 (PA4 cleanup tracked separately)
- **FIXTURE LEFT:** ArchiveCloseout restored ACTIVE (safe disposable; not Goldi/Jane/Ron)

### STREAM 4 — Follow-up Completion

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `876c9d51` / TD `:526` / task `af8590f4…`
- **IMPLEMENTATION COMMIT(S):** `d92ab44103fcdb6552abf5c6ca49b73a76d24b43` (ancestor of running image)
- **RUNNING IMAGE/TAG:** `876c9d519b63a01c0e73702a71d428a448e7767c`
- **DIGEST:** `sha256:2e5e408c5cbac21ff1c22a751c0e1ecb01ebd2654787e328cf8055ee8f89369d`
- **TASK DEFINITION:** `htc-sandbox-venue-app:526`
- **TASK ID:** `af8590f4d29943508b0da570f9277a5e`
- **AUTOMATED TEST EVIDENCE:** `lib/leads/follow-up-completion.test.ts` 16/16 PASS
- **BROWSER EVIDENCE (disposable fixtures on `876c9d51`):**
  - **PATH 1** FUPath1 `16b31c96-…`: Complete → Another follow-up → `Follow up after tour` / `2026-10-20` → Save
  - **PATH 2** FUPath4 `d99e9f6a-…`: Complete → Other next action → `Confirm event details` / date blank → Save
  - **PATH 3** FUCloseout `4bcbfa58-…`: Complete → No further follow-up → Complete button gone; action/date cleared
  - **PATH 4** FUPath4: Last Contacted → `2026-10-01` leaves follow-up open; walk-in tour complete (`origin=walk_in`, `actual_occurred_at=2026-10-01T18:45Z`) leaves follow-up open (`Complete follow-up` still shown)
- **DB/PERSISTENCE EVIDENCE:**
  - Path 1: `next_action_text=Follow up after tour`, `follow_up_date=2026-10-20`; activities `follow_up_completed` then `follow_up_set`
  - Path 2: `next_action_text=Confirm event details`, `follow_up_date=null`; `follow_up_completed` only (no `follow_up_set`)
  - Path 3: `next_action_text=null`, `follow_up_date=null`; `follow_up_completed — Oct 10, 2026`; `last_contacted_at` preserved
  - Path 4: after last-contacted + tour complete, `follow_up_date=2026-10-12` / `next_action_text=Send venue brochure` still set; **no** `follow_up_completed` until Path 2 later
- **REGRESSION EVIDENCE:** Tasks remain separate path (unit wiring); Last Contacted and tour completion do not complete follow-up
- **REMAINING WORK:** None

### STREAM 5 — React hydration #418

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / TD `:527` / task `1659e4a4…`
- **IMPLEMENTATION COMMIT(S):** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372` (sole RUNNING 1/1/0, PRIMARY COMPLETED, health 200)
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36956772206 (completed success)
- **AUTOMATED TEST EVIDENCE:** `lib/settings/tour-settings-hydration.test.ts` 2/2 PASS
- **ROOT CAUSE:** `TourSettingsSection` branched booking URL on `typeof window` → server relative vs client absolute (React #418). Same class also in questionnaire URL display + portal RSVP copy helper.
- **FIX:** render relative paths only; absolutize in copy/open handlers (`absoluteBookingUrl` / questionnaire / RSVP).
- **BROWSER EVIDENCE (exact `eeee6049` runtime):** Settings → Leads & Booking shows Booking link as relative `/book/06d9570c05b77ccfe65b0a750363c5e5` (not absolute origin); no absolute `/book/` text in DOM; page renders cleanly on sole RUNNING image that contains the fix commit.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** image tag equals intended commit; sole RUNNING; Production untouched
- **REMAINING WORK:** None

### STREAM 6 — Luv launch-boundary

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / TD `:527` / task `1659e4a4…`
- **IMPLEMENTATION COMMIT(S):** existing Luv ancestry (`lib/luv/drafts.ts` Discard=DELETE; `isAuthoritativeProposalSent`; Gate1/Gate2 boundary)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** `draft-discard-delete` + `draft-context-boundary` + `draft-status` 39/39 PASS; `draft-proposal-factuality` + `follow-up-workflow-context` 24/24 PASS
- **BROWSER EVIDENCE (exact `eeee6049`):**
  - **Internal notes labeling:** FUCloseout `4bcbfa58-…` Internal notes tab shows “Private to your venue team — never visible to the client.”
  - **Internal note exclusion:** seeded note `ea805008-…` with `STREAM6_INTERNAL_SECRET_TOKEN_NEVER_IN_LUV_9f3a`; drafted follow-up `563b546b-…` subject/body contain **no** secret / budget concern
  - **Judgment-layer omission:** customer inquiry included withheld “rude and overpriced”; draft body contains **neither** that phrase nor sister commentary
  - **Customer-originated labeling:** Grace Van Pelt Notes show “This text is not verified as customer-authored.”
  - **Proposal Sent factuality:** Grace `sales_stage=proposal_sent` but `commercial_proposals` authoritative=false → draft “Checking in…” claims **no** proposal sent; disposable FUCloseout `37e052d1-…` with `status=sent`+`offered_at` shows UI “Proposal sent…” / “Proposal Sent”; Luv draft may mention “the proposal” (verified fact available)
  - **Discard=DELETE:** draft `7104245d-…` Discard via UI → pending panel cleared; DB row **deleted** (not archived); no Draft History entry
- **DB/PERSISTENCE EVIDENCE:** discard DELETE proven; auth proposal `6f7050c4-…` on disposable; Grace props empty (stage-only); Grace pending draft cleaned after proof
- **REGRESSION EVIDENCE:** no source leakage of internal secret into `luv_drafts.content`
- **REMAINING WORK:** None

### STREAM 7 — Twilio / A2P

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / TD `:527` (proof on Texting E2E Disposable venue, then Fancy restored)
- **IMPLEMENTATION COMMIT(S):** current product (`communication_permissions` SoT; `lib/sms/*`)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** `lib/sms/texting-product.test.ts` + `lib/communication/permissions.test.ts` 19/19 PASS (opt-in required; phone≠consent; STOP/START; consent-request-only not_opted_in exception; automations cannot bypass)
- **BROWSER EVIDENCE (Texting E2E Disposable `31ea4816-…`, exact runtime):**
  - Dashboard: “happening at Texting E2E Disposable 1790024905116”
  - Settings → Communications: **Texting setup Status = Ready** / “You’re ready to text from Inbox.”
  - Lead ConsentReq `874faf76-…`: Text messaging **● Allowed** — “This person gave permission…” / “Customer opted back in via text message · September 23, 2026”
  - Contrast (Fancy, earlier this pass): “Texting isn't set up for this venue yet, so a permission request can't be sent.” + Not opted in
- **DB/PERSISTENCE EVIDENCE:**
  - `communication_permissions` SMS `16155550922` status=`opted_in` source=`twilio_start` (START evidence)
  - `communication_permissions` SMS `16035550199` status=`opted_in` source=`email_sms_consent` with consent_text + language_version `htc_sms_email_consent_v1`
- **REGRESSION EVIDENCE:** active venue restored to Jen's Fancy after proof (`venue_staff_active_context` → Fancy)
- **REMAINING WORK:** None

### STREAM 8 — Setup / Activation

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527`
- **IMPLEMENTATION COMMIT(S):** current Setup Hub
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a (product audit)
- **BROWSER EVIDENCE:** `/setup-hub` loads Setup with owner language (“Jen, here's what helps Jen's Fancy Venue…”); stages Your Venue / Calendar / Bring Your Business / Offerings / Client Experience / Leads / People / Online payments; readiness “You told us you're ready to invite couples in on 9/22/2026”; honest Stripe gap callout (charges not enabled). No stale Wevenu customer-facing copy on hub.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** Production untouched
- **REMAINING WORK:** None

### STREAM 9 — Automations

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527` (primary route); alias redirect committed pending next deploy
- **IMPLEMENTATION COMMIT(S):** current series engine; alias `app/(app)/automations/page.tsx` → `/communication/series` (committed locally this pass; not yet in sole RUNNING image)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a this pass
- **BROWSER EVIDENCE:** Nav Automations href=`/communication/series` (current); page title Automations; Sales group (New Inquiry Welcome 37 enrolled; Proposal Follow-Up; Tour Confirmation; Tour Follow-Up); Client group (Post-Event Thank You); help disclosure present. Naked `/automations` 404 on current image — alias fix ready for next Sandbox deploy.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none observed on list surface
- **REMAINING WORK:** None. Alias later GREEN on `453caf2d` and re-verified in Stream 16 (`/automations` → Sales + Client groups).

### STREAM 10 — Help / Guides

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527`
- **IMPLEMENTATION COMMIT(S):** none (audit only)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** `/help` Guidance hub — Hello to Cheers branding throughout; sections Getting Started / Your Venue / Finding & Booking / Working With Clients / Contracts & Payments / Building / Planning / Vendors / Event Day / Reports / After the Event. No customer-facing “Wevenu” product naming observed on hub.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** internal `wevenu:` storage keys / HQ docs remain non-customer; not treated as release defects
- **REMAINING WORK:** None

### STREAM 11 — Post-event / Feedback

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527`
- **IMPLEMENTATION COMMIT(S):** current product (Post-Event Thank You automation + Guidance)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a this pass
- **BROWSER EVIDENCE:** Automations Client → **Post-Event Thank You** (“Starts when an event is completed”); Guidance includes “What Happens After an Event?”; Settings Communications earlier this pass showed post-event thank-you toggle. Follow-up Completion remains separate (Stream 4 GREEN) — not merged.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** None

### STREAM 12 — Branding / white-label / customer-facing polish

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527`
- **IMPLEMENTATION COMMIT(S):** none (audit only)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** Staff surfaces title “Hello to Cheers”; Setup Hub / Guidance / Settings / Luv / contracts use HTC + venue brand. No release-blocking stale Wevenu customer strings on audited pages.
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** None

### STREAM 13 — Permissions / security / privacy

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527`
- **IMPLEMENTATION COMMIT(S):** existing RLS + Luv boundary + SMS permissions
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** Luv discard/cross-venue delete suites PASS; SMS permissions suites 19/19 PASS; Archive Stream 3 PASS
- **BROWSER EVIDENCE:** Internal notes private labeling; Luv exclusion of internal secret; Twilio opt-in Required on Texting E2E; Fancy texting-not-set-up; Archive≠Delete proven
- **DB/PERSISTENCE EVIDENCE:** `communication_permissions` venue-scoped; `luv_drafts` venue-scoped DELETE; active venue context switch restored
- **REGRESSION EVIDENCE:** no cross-venue leakage observed in proofs
- **REMAINING WORK:** None

### STREAM 14 — Release-relevant engineering cleanup

- **STATUS:** GREEN/CLOSED — forensic only; no unsafe dead-path found requiring code change beyond Automations alias
- **IMPLEMENTATION COMMIT(S):** Automations `/automations` → `/communication/series` alias (local; deploy with next cutover)
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** `/automations` 404 on current image (alias pending deploy); primary nav path healthy
- **DB/PERSISTENCE EVIDENCE:** latest migrations present through `20261410800000_…additional_event_spaces`; no pending Apply Migrations workflow found; Production clusters other than `htc-sandbox` not touched
- **REGRESSION EVIDENCE:** no accidental production deploy
- **REMAINING WORK:** None. Automations `/automations` alias later GREEN on `453caf2d`.

### STREAM 15 — Responsive / mobile

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `eeee6049` / `:527` (spot audit)
- **IMPLEMENTATION COMMIT(S):** none
- **RUNNING IMAGE/TAG:** `eeee60494716581fa0be2b3b4059ac845ce1ddf7`
- **DIGEST:** `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- **TASK DEFINITION:** `htc-sandbox-venue-app:527`
- **TASK ID:** `1659e4a4c5ce40feb0ac81a97a882372`
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** CDP mobile metrics 390×844 applied on Automations; page remains readable with primary nav + Sales/Client automation cards accessible (no clipped primary CTA observed in spot check)
- **DB/PERSISTENCE EVIDENCE:** n/a
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** None (spot audit; not a full device lab)

### STREAM 16 — Final cross-system regression

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `da6c79c9` / `:536` / task `101901f0…` / digest `sha256:d3db4a511e73…`
- **IMPLEMENTATION COMMIT(S):** n/a (integrated gate; no product redesign)
- **RUNNING IMAGE/TAG:** `da6c79c9f6451298d47942d3de98f007d2adb5b8`
- **DIGEST:** `sha256:d3db4a511e73c7ee1900090ae459148077a6df0871d05d36f91192ad66a53a1f`
- **TASK DEFINITION:** `htc-sandbox-venue-app:536`
- **TASK ID:** `101901f0fd3c494b9a4899862e6ea5ec`
- **AUTOMATED TEST EVIDENCE:** post-booking + event-setup + EO freeze 41/41 PASS; hold-occupancy + contract return-path + booking-lifecycle 45/45 PASS. Date-hold suite previously 121/121 on this image.
- **BROWSER + DB EVIDENCE:** see Stream 16 section below (same runtime). No Stream 16 defect found. Closed streams not reopened.
- **REMAINING WORK:** None.

### PA4 QA cleanup

- **STATUS:** GREEN/CLOSED — residual fixtures removed
- **IMPLEMENTATION COMMIT(S):** none (data-only)
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** n/a (Sandbox DB)
- **AUTOMATED TEST EVIDENCE:** n/a
- **BROWSER EVIDENCE:** Dashboard previously listed PA4 Near/Mid/Far overdue payments (pre-cleanup)
- **DB/PERSISTENCE EVIDENCE:** Dependency-safe delete order executed:
  1. `payment_line_items` ×3 (overdue deposits on schedules `917188d1…`, `dd289b5b…`, `9f38fc43…`)
  2. `payment_schedules` ×3
  3. `events` PHASE6-QA PA4 Near/Mid/Far (`e8fb4ca1…`, `a48b0780…`, `67e692ef…`)
  4. `clients` PHASE6-QA PA4-Near/Mid/Far (`c6b9624c…`, `e20524f7…`, `436bc5ac…`)
  - Post-check: zero PA4 events/clients remain; no invoices/contracts/docs attached; Goldi/Jane/Ron untouched
- **REGRESSION EVIDENCE:** disposable only
- **REMAINING WORK:** None

---

## New master-release UX / lifecycle items (2026-10-01)

### Documents — category filter roll-up

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `5d817403` / `:529`
- **AUDIT:** Existing `WorkspaceCategory` (12 values) remains storage/read-model truth via `mapCategory`. Presentation roll-up only: Contracts / Financial / Planning / Vendors / Other (+ All). Empty groups hidden.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **FILES:** `lib/document-workspace/user-facing-categories.ts`, `components/document-workspace/document-workspace.tsx`
- **AUTOMATED TEST EVIDENCE:** `user-facing-categories.test.ts` + documents surface tests PASS
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36959110951 (in progress at dispatch)
- **BROWSER EVIDENCE:** Piggy lead `20e470d8` Documents — All (2) | Contracts (1) | Financial (1); empty Planning/Vendors/Other hidden. Financial filter shows only “Piggy & Frog Invoice - Venue Space”; contract hidden. No Invoices/Questionnaires chips.
- **REMAINING WORK:** None

### Luv — Relationship Snapshot lifecycle authority

- **STATUS:** GREEN/CLOSED — remaining signed-not-booked matrix proven later on `453caf2d` (see “Signed-not-booked Snapshot”). Not reopened in Stream 16.
- **ROOT CAUSE:** Snapshot descriptors used numeric scores only (`scoreDescriptor`). Signed contracts could still show Interest “Still early” / Commitment “Progressing toward booking” because scores lagged authoritative contract/Booked facts.
- **CANONICAL FIXTURE (pre-fix proof target):** Miss Piggy lead `20e470d8-…` was tour_scheduled + FE when the bug was filed. DB now `sales_stage=booked`, `first_booked_at=2026-10-02T03:50:26Z`, commitment_score=100.
- **FIX:** `lib/leads/snapshot-lifecycle.ts` precedence over scores; `LeadMomentumCard` + `LuvDraftPanel` consume `bookingJourney` contract + `salesStage === booked` + payment outstanding context. Signed ≠ Booked preserved.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `snapshot-lifecycle.test.ts` matrix PASS
- **BROWSER EVIDENCE:** Piggy Luv tab on `5d817403`: Interest Booked / Responsiveness “No pattern yet” / Commitment Booked. Matches current Booked authority. Responsiveness correctly stays score-based.
- **REMAINING WORK:** None. Signed-not-booked / fully-executed-not-booked proven on `453caf2d` (RelProof SignedStale).

### Payment document — redundant / unexpected note provenance

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `5d817403` / `:529` for system-marker suppression
- **SOURCE OF `"Essential Wedding — booking commitment"`:** System-generated in `lib/booking-journey/setup-payments.ts` `commitmentNotes()` → written to `invoices.notes` for guided-setup recovery matching. Classification: **D/E system payment-setup / invoice metadata** — not venue-authored.
- **DB PROOF (pre-fix):** invoice `77f2f506-…` (SelUse) notes=`Essential Wedding — booking commitment`; linked schedule `a6b0c946-…` notes=null. Venue `name`=`Jen's Fancy Venue` vs `business_name`=`Fancy Venue LLC`.
- **WHY TWICE:** `InvoicePrintDocument` showed Payment Instructions as `paymentInstructions || invoice.notes` and Notes as `invoice.notes` (same field). Callers passed `scheduleNotes ?? invoice.notes` while schedule notes were empty.
- **WHY “Notes from Fancy Venue LLC”:** Notes heading used `businessName` (legal entity) ahead of customer-facing `venue.name`.
- **FIX:** `lib/invoices/customer-facing-notes.ts` — suppress system commitment markers from instructions + Notes; Notes only when genuine venue-authored and distinct; Notes attribution uses customer-facing venue name.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `customer-facing-notes.test.ts` PASS; adjacent invoice workflow tests PASS
- **BROWSER EVIDENCE:** SelUse invoice print `77f2f506` on `5d817403`. Accessibility tree has no “booking commitment”, no “Notes from”, no “Payment instructions”. Header shows Jen's Fancy Venue. DB notes field still `Essential Wedding — booking commitment` (unchanged storage). Genuine venue-note path not re-created this pass.
- **REMAINING WORK:** None for the duplicate system marker. Genuine-note attribution still covered by unit tests only.

### Payments — list identity / scanability

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `5d817403` / `:529` (list identity). Click-through observed as link focus; schedule route not re-opened this pass.
- **FORENSIC:** `PaymentScheduleList` used `s.title` (e.g. “Essential Wedding payments”) as primary; `clientName` was already on the row from repository join but secondary.
- **FIXTURES:** 7× “Essential Wedding payments” (Miss Piggy, SelUse, Jasmine, …); 3× Signature; 3× Full Service; 6× Garden Package — ideal scanability proof.
- **FIX:** Presentation only — primary = client/couple name (`list-identity.ts`); secondary = plan name + overdue count. Navigation/href unchanged.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `list-identity.test.ts` PASS
- **BROWSER EVIDENCE:** `/payments` attention list: Miss Piggy & Kermit Frog / Essential Wedding · 1 overdue payment; Lucy Peanut & Charlie Brown / Signature Wedding · 1 overdue payment; SelUse Proof5492 / Essential Wedding · 2 overdue payments. Same plan type is no longer the primary identity.
- **REMAINING WORK:** None for identity. Row navigation not re-clicked through to schedule URL this pass.

### Contracts — list identity / nomenclature

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `5d817403` / `:529`
- **FORENSIC:** `ContractList` used `contract.title` (document/template title, e.g. “Venue Rental Agreement — Jane…”, “AES Jane Additional Preview…”) as primary. `clientName` already on row from repository couple join. No separate contract-type enum — closest authoritative type is `contract_templates.name`; default title construction uses `Venue Rental Agreement — {clientDisplayName}` in ContractBuilder.
- **FIX:** Presentation only — primary = client/couple name; secondary = template name (else title prefix before em-dash, else “Contract”). Document/test titles no longer dominate list identity. Filters/status/nav/lifecycle unchanged. Href still `/contracts/{id}`.
- **IMPLEMENTATION COMMIT(S):** `5d81740312ac0c8aa2f268035a83f049182dfb24`
- **FILES:** `lib/contracts/list-identity.ts`, `components/contracts/contract-list.tsx`, `lib/contracts/service.ts` (template name enrich), `lib/contracts/list-filters.ts`
- **AUTOMATED TEST EVIDENCE:** `list-identity.test.ts` + list-filters + client-first-signing PASS
- **DEPLOY:** superseding prior in-progress UX4 deploy; target image includes UX4 (`934f82a3`) + this commit
- **BROWSER EVIDENCE:** `/contracts?filter=all` on `5d817403`. Filters intact (Action Required 13, All 44, Draft 9, Sent to Client 7, Awaiting Venue Signature 4, Fully Executed 24). Row text: “Jane Smith & John Doe / Wedding Venue Agreement / June 21, 2027 / Draft” and “Awaiting Venue Signature” / “Sent to Client”. “AES Jane…” and “Sign first-name…” absent from list. Click opened contract `7d3a1b5d` whose document title remains “AES Jane Additional Preview…” (detail title unchanged).
- **REMAINING WORK:** None

---

### Manual / offline payments — invoice vs schedule reconciliation

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `204c885f` / `:531` / task `2a503aef…` / digest `sha256:58d0d940…`
- **RUNTIME:** `204c885f` / `:531` / task `2a503aef22df4476ad5084cb297d9adb` / digest `sha256:58d0d94073a897b4a21b0b29b1cb31d3f96ec59c0d9c7f826d8889bad7a0bea6`
- **FIXTURE:** OfflinePay Disposable client `384ee231-…` invoice `328fe0ce-…` schedule `2898a151-…` line `6d6a1a16-…`
- **BEFORE:** line status `overdue`, amount 400, stripe ids null, invoice status `sent`, balance_due 400
- **BROWSER:** “Record payment received” → invoice Paid to Date $400, Balance $0, Paid in Full; schedule line “Sep 28, 2026 · paid”; schedule page PAID / Paid Oct 2, 2026 / method Other / activity “Payment received: $400” “Via other”. Attention payments list dropped from 16 to 15 and OfflinePay is absent from the overdue list.
- **DB:** line status `paid`, paid_amount 400, payment_method `other`, notes “Recorded manually (offline collection).”, stripe_payment_intent_id null, stripe_checkout_session_id null. Invoice status `paid`, balance_due 0. Activity type `payment_received` description “Via other”.
- **PROVIDER:** no Stripe id written. `quickbooks_sync_queue` row `e5d064ac-…` status `pending`, attempt_count 0, operation upsert — queued by the existing `markLineItemPaid` path, not a completed QuickBooks or Stripe charge.
- **WORDING (exact `204c885f` browser + DB):** Client `384ee231-3533-44f0-80ba-4cccce82e20e` booking-detail line is “$400.00 paid September 28, 2026”. The false “$400.00 due September 28, 2026” string is absent. Line `6d6a1a16-…` remains `paid`, paid_amount 400, method `other`, stripe ids null. Invoice `328fe0ce-…` remains `paid`, balance_due 0. Accounting was not rewritten.

### Taxes and discounts

- **STATUS:** GREEN on `453caf2d` for the first-release model (entered line amounts, no tax rate)
- **MODEL:** Venue prefs `useTaxes` / `useDiscounts` (default false). Builder hides those line types when off. Totals stay `computeInvoiceTotals`. Taxable amount = subtotal − discounts when tax is present.
- **BROWSER + STORED TOTALS:** Neither subtotal/total $1,000. Tax subtotal $1,000, taxable $1,000, tax $80, total $1,080. Discount subtotal $1,000, adjustments −$150, total $850, no taxable row. Both subtotal $1,000, adjustments −$100, taxable $900, tax $72, total $972. Print of Both matches. Neither dropdown omitted Tax and Discount. After enabling both flags, dropdown included Discount and Tax.
- **RESTORE:** Fancy `commercial_booking_prefs` returned to the pre-proof JSON (no useTaxes/useDiscounts keys). `space_operating_mode` remained `multi`.

### Luv global truth / relevance

- **STATUS:** GREEN on `453caf2d` for tour-follow-up supersession
- **RULE:** A completed-tour follow-up stays only while the relationship is still pre-agreement. Client-signed or fully signed contract, a received installment, or sales stage Booked/Lost supersedes it. A lead that cannot be loaded is omitted. Proposal stage alone does not. Same gate on no-show follow-ups. No TTL.
- **BROWSER:** RelProof Prebook `8e09b630-…` shows “completed their tour 3h ago — follow up while it's fresh.” RelProof BookedStale `81c20100-…`, SignedStale `0919f5ed-…`, and PaidStale `67bfb786-…` do not show that recommendation.
- **TESTS:** `lib/luv/observation-supersession.test.ts`

### Signed-not-booked Snapshot

- **STATUS:** GREEN on `453caf2d`
- **FIXTURE:** RelProof SignedStale, sales stage `proposal_sent`, contract status `signed`, not Booked.
- **BROWSER (Luv tab):** Interest “Contract fully executed”. Commitment “Contract fully executed · Not yet marked Booked”. Responsiveness “No pattern yet”.

### Automations alias

- **STATUS:** GREEN on `453caf2d`
- **BROWSER:** `https://app.sandbox.hellotocheers.com/automations` landed on `/communication/series`. Page title Automations. Sales group and Client “Post-Event Thank You” still present.

### Stream 1 residuals B/C/E/F — exact `204c885f`

- **B STATUS:** GREEN/CLOSED. ConflictSave Disposable `d2e876b5-…`. Visible Save was enabled (pointer-events auto) and was clicked; button text became “Saving…”. Warning stayed “Maximum simultaneous tours (1) reached for this time.” DB `follow_up_date` moved `2026-10-20` → `2026-10-22`. No tour row for that lead. Occupying tour `eac4a67f-…` unchanged.
- **C STATUS:** GREEN/CLOSED. Disposable matrix, one row each, no wrong-row mutation.
  - Scheduled `3e86512d-…` / tour `07fd001d-…`: `scheduled_at=2026-11-09T15:00Z`, actual null, completed null. UI “Nov 9, 2026 at 10:00 AM”. Calendar 2026-11-09 shows the tour. Occupying count at that timestamp = 1.
  - Walk-in `42d07d8f-…` / tour `56bb3524-…`: origin walk_in, scheduled_at null, `actual_occurred_at=2026-10-01T18:30Z`, completed set. UI “Oct 1, 2026 at 2:30 PM (completed)”. Luv “23h ago”.
  - Actual-only `73da36a3-…` / tour `69f12800-…`: same id after visible Save; scheduled_at stayed null; actual moved to `2026-10-01T19:15Z`; completed_at unchanged. UI “3:15”.
  - Two-clock `b24ed7a7-…` / tour `a54ac537-…`: `scheduled_at=2026-11-16T16:00Z` preserved, `actual_occurred_at=2026-10-02T20:00Z`, completed_at set. Lead UI shows Oct 2 completed. Calendar 2026-10-02 shows 4:00 PM completed. Calendar 2026-11-16 is empty. Occupying count at the original scheduled timestamp among scheduled/confirmed = 0.
- **E STATUS:** GREEN/CLOSED on exact sole RUNNING `7dbece3f` / `:534` / task `25a73246…` / digest `sha256:f58345f9…` (includes cherry-pick `0aa7a893` / same as `a626f6b5`).
  - **BROWSER (OccBook3 event `7eeae958-…` / client `cb9a5af8-…`):** Edit event → Ceremony=Garden Lawn, Reception=Barn, Cocktail Hour=Cocktail Terrace, Getting Ready=Getting Ready Suite → Save changes. Reloaded edit retained all four assignments. Single-mode temporary: form showed one **Event space** (no Ceremony/Reception). Reception-only permitted-uses temporary: form showed **Reception=Barn** only (no Ceremony). Fancy restored to `multi` + original permitted uses.
  - **DB AFTER SAVE:** `events.space_id=Barn` (`3b36ec69-…`) — **not** Garden Lawn. Assignments: ceremony→Garden Lawn, reception→Barn, cocktail_hour→Cocktail Terrace `dd3599b2-…`, getting_ready→Getting Ready Suite `9ca019b4-…`. `leads.planned_event_space_id` N/A (OccBook3 has no lead row); occupancy authority for booked event is `events.space_id`.
  - **FIXTURE CLEANUP:** Disposable Cocktail Terrace + Getting Ready Suite deleted after proof. OccBook3 retained `space_id=Barn` + ceremony/reception assigns. Fancy spaces remaining: Barn, Covered Bridge, Garden Lawn.
  - **AUTOMATED:** `lib/venue-spaces/assignments.test.ts` 6/6 PASS on proof pass.
- **F STATUS:** GREEN/CLOSED.
  - Skip: SkipProof Disposable lead `5e39964f-…` / client `55404125-…`. Staff set Ceremony to “Not decided yet” in the lead UI (Covered Bridge is not ceremony-eligible and was not an option). Confirm Mark as Booked landed `/clients/55404125-…/booked?eventId=9106da9a-…`. DB: ceremony pref `undecided` / space null; reception Barn; one assignment `reception` → Barn; no ceremony assignment; `events.space_id` Barn; lead booked; client confirmed.
  - Rollback: client `86ea23d2-…` whose lead belongs to Sweet Daisy. `book_relationship` raised “Lead not found for this client.” after the write point. After the exception: zero events for that client, status still `booking`, `lifecycle_booked_at` null. Probe client and foreign lead were deleted afterward. No partial booking remained.

### Package provenance — exact `204c885f`

- **STATUS:** GREEN/CLOSED
- Wilma Flintstone client `5b064028-…` / selection `f7d9cb91-…` / `proposal_id=323f6cb8-…`: browser “Selected by the couple”.
- Mira Vale client `d1ae24cc-…` / selection `50e28ac9-…` / `proposal_id` null / status draft: browser “Selected internally · Not yet shared”. No “Selected by the couple”.

### Client → Event Workspace IA

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `e33f2696` / `:533` / task `70b962e3…` / digest `sha256:26ea1d08…`
- **IMPLEMENTATION COMMIT:** `e33f269685b6741a311751eb373130a89bc1b1d5`
- **MIGRATION:** `event_setup_states` already applied (prior Apply Sandbox Migration SUCCESS)
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/37044727368 SUCCESS
- **FIXTURE:** IaSetup Disposable client `e331bacd-…` / event `ac3d9606-…` / lead `444de131-…`
- **BROWSER:**
  - Setup list: Planning, Timeline, Floor plans, Vendors, Questionnaires, Inventory, Event order, Client portal — each with Set up / Skip
  - Planning Set up → BookingSetupCard; DB `decisions.planning=set_up`
  - Timeline Skip → DB `timeline=skipped`; timeline_entries/floor_plans/tasks/apps remain 0
  - All remaining steps skipped → UI “Event setup complete” + Show setup; `collapsed_at` set
  - Show setup reopened with all prior decisions intact; `collapsed_at` cleared then re-collapsed
  - Disabled capability: Fancy `planning_timeline_enabled=false` on IaCapOff `55c7296b-…` — setup omitted Timeline (7 steps). Caps restored to all true afterward
  - Needs Attention: overdue payment `7826e2a2-…` showed only “Payments 1 payment overdue.” Empty modules absent. After mark paid, Needs Attention empty
  - Overview gone: Booking Journey, Event Readiness checklist, booked explanation, six summary tiles
  - Tabs present and Planning `#playbook` works; `/events/ac3d9606-…` resolves to `/clients/e331bacd-…`; Day Sheet loads
  - Lead `444de131-…` keeps Booking Details commercial facts (payment ≠ Booked copy)
  - Pre-book lead `8b3db896-…` mounts Booking Details; no setup strip leak
  - Celebration one-shot: re-hit `/booked` redirects to `/clients/{id}`; primaryHref overridden to `/clients/{id}`
  - Luv tab on pre-book: “Luv's Thoughts” / New Lead copy intact
- **DB:** `event_setup_states` row for `ac3d9606-…` with full decisions + collapsed_at; no duplicated module rows
- **AUTOMATED:** `lib/event-setup/state.test.ts` + booking-handoff + prepare-booking-planning-ux = 27/27 PASS
- **REMAINING WORK:** None for this stream. Stream 1E occupancy anchor is now GREEN on `7dbece3f` (separate residual entry).

### Event Order / Inventory commercial lifecycle (master release)

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `da6c79c9` / `:536` / task `101901f0…` / digest `sha256:d3db4a511e73…` (contains implementation `6a810904`).
- **LOCKED PRODUCT MODEL:** Same commercial lifecycle as booking. Finalize/lock = what will be provided. Invoice issuance = financial obligation. Payment plan optional. Included/$0 stay on the locked agreement and never freeze as charges. Client sees structured choices (not raw inventory). Amend reuses the same Client Choices instance.
- **IMPLEMENTATION COMMIT:** `6a810904ee1e84afed09b3821a56a1db6d858d0b` (ancestor of running `da6c79c9`; not redeployed backward)
- **PRIOR CLOSEOUT:** GREEN on `:535` / `6a810904` with fixture `870f7ff2-…` (later deleted). Re-proved on current sole image below.
- **FIXTURE (exact `da6c79c9`):** PostBook Gate16 client `86731d0b-3a0f-4911-b5ab-54c648d09738` / event `7b8eca64-e13a-4644-8204-bcccee3b3690` / Wedding Reception template `99585da2-…` / choices instance `540dfa9b-cdfa-4052-ae96-0ba5450f9600` (same ID through amend) / portal `/p/pb1617909807765657h0zi5bu`.
- **BROWSER + DB SCENARIOS (all PASS on this runtime):**
  1. **Included-only:** Start selections → Bartender included → Send → portal Submit → Finalize. Status `finalized`. EO line `a2704c35-…` Bartender `$0` `is_included=true` notes `choices:540dfa9b-…:9f01e86f-…`. Invoices `[]`. Payment schedules `[]`. Copy: “Locked — this is what will be provided.” Delivery subtotal `$0`.
  2. **Billable + invoice:** After mixed re-finalize, venue Create New Invoice `19dc321e-…` / `INV-2026-19DC32` → Mark as issued → status `sent`, `issued_at=2026-10-02T22:46:41Z`, total `$750`. One frozen line: Premium open bar `event_order_line_id=005520f0-…`. No payment schedule. Financial obligation began at issue, not at finalize.
  3. **Mixed:** Locked answers bartender + Premium. EO has both: Bartender `39ebb6af-…` `$0` included + Premium `005520f0-…` `$750` not included. Issued invoice line count `1` — bartender / Chiavari never on invoice lines.
  4. **Amendment (critical):** Amend kept same `client_choices.id=540dfa9b-…`. After Amend: status `draft`, `applied_line_ids` still `[a2704c35-…]`, submissions `#1`/`#2` retained. After re-finalize: old line `a2704c35-…` **deleted**; new applied `[39ebb6af-…, 005520f0-…]`; submissions `#1–#4` retained; activity “Removed: Bartender service” then re-added current pair; no duplicate current lines.
  5. **Inventory:** Event Inventory `464e7962-…` finalized → Add to Event Order. Chiavari included `$0` + sofa billable `$250` both `added_to_event_order_at` set and on EO. Existing sent invoice stayed `$750` / Premium only. UI: “$250.00 that is not on the current invoice yet.” Amended live-projection draft `9e048241-…` UI `$1,000` (750+250); included chairs not projected. Floor plan `64dff46e-…` + catalog table object `83172b2e-…` (`72\" Round Table` / `abd07513-…`) created **no** new invoice. Library `/library/inventory` operational (catalog + New/Import). Payment plan remained optional throughout.
- **AUTOMATED:** post-booking lifecycle / selections-billing / unbilled-delta / lifecycle-gates — 34/34 PASS this gate (prior closeout 36/36; 45/45 locally on implementation).
- **REGRESSION:** Date Holds stream not reopened. Production untouched.
- **REMAINING WORK:** None for this stream.

### Date Holds — multi-space + time-aware availability (master release)

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `da6c79c9` / `:536` / task `101901f0…` / digest `sha256:d3db4a511e73…`
- **FORENSIC FINDING:** `date_holds` stored optional `space_id` + `start_time`/`end_time`, but conflict paths (`_is_event_date_available`, `events_enforce_availability` hold check, precheck `holdCount`) treated holds as **date-level only**. UI hard-coded empty times and a single Space select. Multi-space lead prefs (`lead_event_space_preferences`) and booked `event_space_assignments` existed, but holds could not protect both Ceremony+Reception resources, and space-specific holds incorrectly closed the whole date.
- **PRODUCT DECISION:** Hold = **resource set + date + occupancy window**. Empty space set = whole venue. Null times = all-day (`00:00–23:59`) via existing `event_operational_window`. Overlap = existing `windowsOverlap` (exact boundary allowed). Turnaround remains booked-event-only (not invented for holds). Simultaneous venues (`max≥2`): space-specific holds do not block unrelated spaces; simple venues (`max<2`): any overlapping hold occupies the single venue slot.
- **IMPLEMENTATION:** `date_hold_spaces` junction; time/space-aware SQL + TS precheck; createHold conflict vs other holds; UI multi-select + times defaulted from lead venue_space prefs; booked occupancy intersects `event_space_assignments`.
- **COMMITS:** `8220c215` (feature), `da6c79c9` (RLS `current_user_venue_id` fix)
- **MIGRATION:** `20261411000000_date_hold_multi_space_time_aware.sql` — apply run https://github.com/jlcormier612/wevenu-website/actions/runs/37070139294 SUCCESS
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/37070225043 SUCCESS
- **AUTOMATED:** `hold-occupancy.test.ts` A–K + seams; `event-occupancy` / `precheck` / `same-owner-hold` / `date-hold-booked-boundary` / calendar space-filter — **121/121 PASS**
- **BROWSER (exact `da6c79c9`):** Lead `541ddde9-…` Ceremony=Covered Bridge / Reception=Barn → Place hold form defaults both spaces with Ceremony/Reception labels + occupancy times → placed hold `94a94a12-…` (then released; re-seed `0a92f112-…` for calendar persistence). Release restored Place-hold CTA.
- **DB PROOF:**
  - Multi-space hold: Bridge+Barn, `10:00–18:00`, `space_id` null, two `date_hold_spaces` rows
  - Overlap Barn morning blocked (`hold_blocks`); exact boundary `14:00` start after `14:00` end allowed; evening overlap blocked; after release morning allowed
  - Whole-venue hold (zero space rows) blocked Barn **and** Garden; release restored both
  - Convert: hold `637e17c1-…` → `converted`; event `d7ea07a5-…` setup/start/end/teardown preserved; assignments ceremony=Bridge + reception=Barn
- **REGRESSION:** Existing occupancy/precheck/tour/calendar filter suites GREEN; Production untouched
- **REMAINING WORK:** None for this stream

### Stream 16 — Final integrated release gate

- **STATUS:** GREEN/CLOSED on exact sole RUNNING `da6c79c9` / `:536` / task `101901f0…` / digest `sha256:d3db4a511e73…`
- **PURPOSE:** Prove the complete HTC product works coherently across the customer lifecycle on the actual Sandbox runtime. Not a redesign. Closed streams were not reopened.
- **RUNTIME RE-VERIFIED AT GATE:** image `da6c79c9f6451298d47942d3de98f007d2adb5b8` · TD `:536` · task `101901f0fd3c494b9a4899862e6ea5ec` · digest `sha256:d3db4a511e73c7ee1900090ae459148077a6df0871d05d36f91192ad66a53a1f` · desired/running/pending 1/1/0 · PRIMARY COMPLETED · `/api/health` HTTP 200 · clusters: `htc-sandbox` only (no `htc-production`)
- **FIXTURES:** PostBook Gate16 client `86731d0b-…` / event `7b8eca64-…` / choices `540dfa9b-…` / EO `0781cca4-…` / portal `/p/pb1617909807765657h0zi5bu`. Wilma Flintstone lead `4e7c5ab7-…` / contract `6817afd1-…` (`signed`). Active Fancy holds: 4 (including multi-space `32079292-…` Bridge+Barn).
- **BROWSER (15 journey areas — all PASS; no Stream 16 defect):**
  1. **Lead intake / workspace:** Leads list + Wilma workspace. Lead terminology intact. Ceremony/reception prefs. Commercial facts. Proposal path. Luv tab + customer-note disclaimer. Booked remains a venue decision. Texting permission present.
  2. **Proposal:** Wilma / Grace / Cinde Inbox + workspace retain proposal send / Selected by the couple vs Selected internally. Proposal Sent factuality not reopened; no false sent claim observed.
  3. **Contract:** `/contracts` filters intact. Wilma `6817afd1-…` Fully Executed (client then venue). Documents shows contracts in one place. Locked lifecycle not rewritten.
  4. **Initial financial lifecycle:** Contract → booking invoice / payment surfaces on Payments list and Inbox (Goldi planning payment reminder). Payment plan remains optional (Gate16 has none).
  5. **Client → Event workspace:** Gate16 lands `/clients/86731d0b-…?eventId=7b8eca64-…`. Operational tabs: Planning, Timeline, Floor Plans, Documents, Vendors, Event Order, Inventory, Payments, Conversation, Activity, Internal notes, Team. Setup/readiness strip present. No duplicated booking narrative.
  6. **Event spaces:** Edit event Ceremony=Covered Bridge (80), Reception=Barn (150). Saved assignments match DB. No Stream 1E regression.
  7. **Date Holds / availability:** Calendar space filter + availability copy intact. Four active Fancy holds persist including multi-space Bridge+Barn `32079292-…`. Prior Date Hold GREEN proof on this same image not reopened.
  8. **Event Order / Inventory:** Included bartender + Chiavari; billable Premium + sofa; mixed lock; same-instance amend already proven; payment plan optional; invoice $750 Premium only.
  9. **Invoices:** Staff `INV-2026-19DC32` Issued, Total/Balance $750, Paid $0. Preview Charges include Premium open bar; bartender/Chiavari/sofa/included absent. Portal: Balance $750, “No payment schedule has been set.” Amendment draft `INV-2026-9E0482` exists; sent invoice remains the active financial record until the amendment is sent (by design).
  10. **Payments / payment plans:** Gate16 `payment_schedules=[]`. Create-schedule is a CTA, not mandatory. Portal and staff both state no schedule yet.
  11. **Documents:** `/documents` All (104) / Contracts (42) / Financial (37) / Planning (25). Gate16 rows: sent invoice 19DC32, amend draft 9E0482, Event Order, Wedding Reception planning, floor plan. No duplicate charge representation of included lines.
  12. **Luv:** Portal Ask Luv: “Luv answers from those sources only” (Documents, contracts, payments, questionnaires, Your Choices, Venue Guide). From Luv guest-list suggestion is customer-facing. Settings: Luv never sends on its own. No private-note leak observed. Not redesigned.
  13. **Texting / Twilio:** Settings → Communications: Texting setup status “Setting up” (existing Sandbox A2P state). Inbox `/messaging` lists conversations; compose Channel = Email / Text (not ready) / Portal message. Internal note is a separate tab. Not an A2P reopen.
  14. **Setup / Guidance / Automations:** `/setup-hub` All set (3 spaces, branding/availability/packages/intake). `/setup` redirects ready venue to dashboard. `/help` Guidance library intact. `/automations` Sales + Client groups present (prior alias GREEN).
  15. **Mobile 390×844:** Dashboard hamburger + greeting + Business Snapshot readable. Portal payments: INV-2026-19DC32 / $750 / no schedule / no bartender. No clipped primary CTA.
- **DB / DATA INTEGRITY:**
  - Client `86731d0b-…` confirmed; Event `7b8eca64-…` confirmed `2028-11-11`; occupancy `space_id`=Barn; assignments ceremony=Bridge + reception=Barn
  - Choices `540dfa9b-…` finalized; applied `[39ebb6af-… bartender $0 included, 005520f0-… Premium $750]`
  - EO lines current (4): bartender $0 included, Premium $750, Chiavari $0 included, sofa $250 billable. Old amend line `a2704c35-…` absent. No duplicate descriptions
  - Invoices: unique IDs; sent `19dc321e-…` total 750 / balance 750 / one line Premium → `event_order_line_id=005520f0-…`; draft amend `9e048241-…` total 0 (live projection until send). `includedOnInvoices=[]`. Schedules `[]`
  - Inventory items both `added_to_event_order_at` set. Floor allocation created no invoice
  - Wilma lead `4e7c5ab7-…` `sales_stage=tour_scheduled` (Signed ≠ Booked preserved); contract `6817afd1-…` status `signed`
  - Active holds 4; multi-space hold `32079292-…` has Bridge + Barn rows. No unexpected state transitions
- **REGRESSION:** No Stream 16 defect. Date Holds, post-booking commercial lifecycle, Stream 1E, Client→Event IA, Luv, Twilio/A2P, Documents, Contracts, Invoices not reopened.
- **AUTOMATED (this gate):** 41/41 + 45/45 PASS (see above).
- **PRODUCTION:** untouched
- **REMAINING WORK:** None

### Date Holds — multiple active holds same lead/date (master release)

- **STATUS:** GREEN/CLOSED on exact Sandbox runtime `cfeff8ca` / `:539` (proof) and retained under sole RUNNING `c94245b8` / `:540`
- **IMPLEMENTATION:** `fd213041` (remove one-active-hold restriction); conflict remains authoritative
- **BROWSER (lead `297c8195-…` MultiHold ProofGate, date `2028-03-15`):**
  1. Hold #1 Covered Bridge `10:00–14:00` → Active: `Covered Bridge 10:00 AM–2:00 PM`
  2. Hold #2 Barn `16:00–22:00` without releasing #1 → both active; each has Release Hold
  3. Release ONLY Bridge #1 → Barn remains active (DB `c9950b72-…` status=active; Bridge `b812e1c3-…` status=released)
  4. Re-place Bridge `10:00–14:00` (`b2d97d58-…`) for conflict/boundary
  5. Conflict Bridge `13:00–15:00` rejected — toast: `That space and time window overlaps another active hold.` (no new DB row)
  6. Boundary Bridge `14:00–16:00` allowed (`77785cbc-…`) — UI `Covered Bridge 2:00–4:00 PM`
  7. Calendar day `2028-03-15`: three Hold links `10:00 AM – 2:00 PM`, `2:00 PM – 4:00 PM`, `4:00 PM – 10:00 PM`
- **DB:** separate `date_holds` IDs; correct lead/date/start/end; `date_hold_spaces` junction per hold; release changes only that hold
- **PRODUCTION:** untouched
- **REMAINING WORK:** None for this sub-gate

### Date Holds — 12-hour Active Hold display (master release)

- **STATUS:** GREEN/CLOSED on exact Sandbox `cfeff8ca` / `:539` (and retained on `c94245b8`)
- **IMPLEMENTATION:** `cfeff8ca` — Active Holds use HTC 12-hour formatter; DB remains HH:mm 24h
- **BROWSER:**
  - MultiHold Active Holds: `10:00 AM–2:00 PM`, `4:00–10:00 PM`, `2:00–4:00 PM`
  - Prior Minnie proof on same image lineage: Bridge `16:00–18:00` → `4:00–6:00 PM`; Barn `18:00–23:00` → `6:00–11:00 PM`
  - Calendar day view uses matching AM/PM windows
- **DB STORAGE UNCHANGED:** `10:00:00`/`14:00:00`, `16:00:00`/`22:00:00`, `14:00:00`/`16:00:00` (and Minnie `16:00:00`/`18:00:00`, `18:00:00`/`23:00:00`)
- **PRODUCTION:** untouched
- **REMAINING WORK:** None for this sub-gate

### Luv — pipeline stage never evidence / completed-tour intelligence / drafting (master release)

- **STATUS:** OPEN — not GREEN
- **IMPLEMENTATION ON SOLE RUNNING `c94245b8`:** `9bfbf4d6` (stage lock), `df5e7bc2`+`5f6e4e77`+`c94245b8` (completed-tour intelligence)
- **EXACT-RUNTIME PROVEN (partial):**
  - **A StageOnly `7bc69568-…`:** stage was `proposal_sent`, zero `commercial_proposals` → Luv Thoughts New Lead; draft does **not** claim proposal sent. Case D: stage changed to `new_inquiry` → same underlying non-claim.
  - **B StaleStage `a550748b-…`:** stage `new_inquiry` + confirmed tour → Luv noticed “all set for Sunday” from `tour_appointments`.
  - **E drafting stage-only proposal:** PASS (no sent claim).
  - **Completed-tour ACTION `7d95bab3-…`:** observation “asked about Saturday setup… not a generic thank-you” + CTA; draft subject `A quick answer about Saturday setup`; body addresses setup; internal note credit-score text **not** leaked.
  - **Completed-tour SILENCE `695fb092-…`:** no completed-tour Luv noticed; draft toast `Nothing useful to draft for this relationship right now.`
- **EXACT-RUNTIME DEFECTS (block GREEN):**
  1. **FakeBooked `d7816d81-…`:** stage `booked` + `first_booked_at=null` → Relationship Snapshot Interest/Commitment showed `Booked` via `lead.salesStage === "booked"`. Fix committed `501b5a05` (use `isAuthoritativeBooked`/`firstBookedAt`). Deploy not yet sole RUNNING.
  2. **TourContext `275474df-…`:** contextual mode correct (observation, no draft CTA) but copy garbled: “still need to Thanks so much for the tour.” Fix committed `ed87d485` (topic from full inbound). Deploy not yet sole RUNNING.
- **QUEUED DEPLOYS:** https://github.com/jlcormier612/wevenu-website/actions/runs/37079329287 (`501b5a05`); https://github.com/jlcormier612/wevenu-website/actions/runs/37079499238 (`ed87d485`)
- **AUTOMATED THIS GATE:** 111 + 50 PASS (pipeline-stage, completed-tour, drafting/workflow, hold presentation/multi-hold/occupancy/boundary, snapshot-lifecycle, discard-delete, calendar slice1/precheck)
- **PRODUCTION:** untouched
- **REMAINING WORK:** Wait for sole RUNNING `ed87d485` (includes `501b5a05`); re-prove FakeBooked snapshot + TourContext family copy + CONTEXT draft silence; then mark Luv sub-gates GREEN.

### Payment lifecycle + offline recording + Payments filters (master release)

- **STATUS:** OPEN — financial recording proven on sole RUNNING `d8ccf73c` (contains `23ed4f4a`). **Not GREEN.** Three UX defects on that runtime are fixed in the working tree and are not yet the sole running image.
- **ROOT CAUSE (Minnie four×$8k):** Invoice top-right “Record payment received” called `recordInvoiceInstallmentReceived` → `selectCurrentUnpaidInstallment` silently advanced to the next unpaid line on each click; invoice status stayed `sent` so the CTA remained. Four clicks = four installments marked paid.
- **PRODUCT LOCK:**
  - Offline payment is first-class via Venue Payment Collection Preferences (`acceptedPaymentMethods` + `clientPaymentInstructions`)
  - Deliberate Record Payment dialog: installment + amount + method + date + optional reference; never silent auto-advance
  - `$32k` invoice + 4×`$8k` plan is intentional; one `$8k` payment → invoice `partially_paid`, plan `1 of 4`, `$24k` remaining
  - Duplicate protection: UI submit lock + idempotency key + optimistic status/`paid_amount` lock + paid-line alreadyRecorded
  - Payments page filters: **All first**, then Action Required, On Track, Partially Paid, Paid in Full, No Payments
- **IMPLEMENTATION COMMIT(S):** `23ed4f4af517076faa66ba7155fd22cb907eb74e`
- **MIGRATIONS:** SUCCESS https://github.com/jlcormier612/wevenu-website/actions/runs/37081689994 — `20261411100000_invoice_partially_paid_status.sql`, `20261411200000_payment_line_partially_paid.sql`, `20261411300000_payment_line_offline_idempotency.sql`
- **DEPLOY PROVEN:** sole RUNNING `d8ccf73cdc0ae3cfbe26999354f8f820cfa7d5f5` (ancestor of required `23ed4f4a`). Image `405254329873.dkr.ecr.us-east-1.amazonaws.com/htc-sandbox-venue-app:d8ccf73cdc0ae3cfbe26999354f8f820cfa7d5f5`. Digest `sha256:0d8599895a8e77a0792f9746d8e551e7f9f07c918a7410ad4fc64ae1d81b6747`. Task def `htc-sandbox-venue-app:544` PRIMARY COMPLETED. Task `140c10ca77614f71b0783190f8445920`. desired/running/pending 1/1/0. Health HTTP 200 `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}`. Production cluster `htc-production` MISSING.
- **DISPOSABLE FIXTURE:** OffPay32 invoice `f37c063d-e876-4a2f-b9dd-c426508498c7` / schedule `0102df2a-b170-43c2-913e-8367169ec71a`. Minnie/Mickey not mutated.
- **BROWSER + DB (this runtime):** one Check payment of $8,000 on Initial Payment (`c887be1e-…`), reference `1001`, paid_at `2026-10-03`, idempotency `f945fa64-ef2e-40f3-b868-48d46340459e`. Invoice `partially_paid`, total 32000, balance 24000. Plan 1 of 4, $24,000 remaining. Other three lines pending. One `payment_received` activity (`Via check · Initial Payment`). Paid installment dropped out of the record selector. Submit button disabled as “Recording…”. Payments filters: All 29 first; OffPay32 in All and Partially Paid (5); absent from Action Required, On Track, Paid in Full, No Payments. Nav badge 15 = Action Required 15. Portal `/p/…` with Stripe not chargeable showed “How to pay / Accepted methods: Check, and ACH / bank transfer” plus the saved instructions. Fancy `commercial_booking_prefs` restored to the prior online-only JSON after the proof.
- **BLOCKING DEFECTS ON THAT RUNTIME (do not GREEN):**
  1. On Track included overdue unpaid schedules (Miss Piggy and others). Action Required was correct; On Track was not.
  2. Record dialog first paint said “no open installment” before the installment list loaded.
  3. After a successful record, the invoice badge stayed “Issued” until a full navigation; a reload showed “Partially Paid”.
- **FIX (local, not sole RUNNING):** On Track requires `scheduleStatus === "on_track"`; dialog opens in a loading state; invoice status follows the refreshed server status; record-method lists use venue preferences (no invented card/Venmo/Stripe).
- **AUTOMATED TEST EVIDENCE:** 90/90 PASS focused after the fix (`offline-recording`, `list-filters`, `attention-reasons`, invoice-balance, manual-installment, commercial-facts, venue-prefs, customer-facing-notes, portal payment-access).
- **PRODUCTION:** untouched
- **REMAINING WORK:** Deploy the fix; confirm it is the sole RUNNING image; re-check On Track, dialog first paint, and in-place Partially Paid badge. Then GREEN/CLOSED. Do not mark overall HTC GREEN.

## OVERALL HTC RELEASE

- **STATUS:** NOT GREEN
- Date Hold multiple holds: GREEN/CLOSED (exact browser+DB).
- Date Hold 12-hour display: GREEN/CLOSED (exact browser; DB storage unchanged).
- Luv pipeline-stage / completed-tour / drafting: GREEN/CLOSED on prior sole RUNNING `ed87d485` (do not reopen without regression).
- Payment lifecycle + Payments filters: OPEN — financial proof on sole RUNNING `d8ccf73c` / `:544`; On Track, dialog first paint, and in-place status badge block GREEN until the local fix is the sole running image.
- Venue Planning template + setup Overview: OPEN — implemented `d8ccf73c`; not GREEN until sole runtime + browser/DB proof.
- Production untouched.
- No later list. No new backlog.

### Venue Planning template + setup Overview (master release)

- **STATUS:** OPEN — not GREEN
- **AUDIT:** Venue Planning seed lived in `STANDARD_VENUE_WORKFLOW_*` (Booking = Send contract / Verify deposit; Final Details also held Build timeline / Create floor plan / Confirm rentals). Overview `EventSetupPanel` persisted `set_up`/`skipped` on `event_setup_states` but still rendered both decision buttons and the label “Set up”, so a finished decision looked unresolved.
- **PRODUCT LOCK:** Booking/commercial tasks removed from Venue Planning. Planning = prep (timeline, floor plan, rentals). Final Details = Vendor COIs only. Overview states: Needs a decision / Configured / Skipped, with decision buttons only while undecided. Applied event tasks are not rewritten.
- **IMPLEMENTATION COMMIT:** `d8ccf73c`
- **MIGRATION:** `20261411400000_venue_planning_starter_drop_booking.sql` — https://github.com/jlcormier612/wevenu-website/actions/runs/37082781667
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/37082780169
- **AUTOMATED:** venue-planning-starter + event-setup state + related playbook/payment trigger tests PASS (49 in the focused run)
- **BROWSER / DB / SOLE RUNTIME:** pending
- **PRODUCTION:** untouched
- **REMAINING WORK:** sole RUNNING `d8ccf73c`; browser proof of template + configured/skipped persistence; DB proof; then GREEN/CLOSED

## Production

Untouched. Sole HTC cluster in use: `htc-sandbox`.
