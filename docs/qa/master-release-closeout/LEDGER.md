# HTC Master Release Closeout Ledger

**Status of this document:** working ledger for the current execution. Production untouched.

Exact Sandbox runtime (latest sole RUNNING at last verification):

- Commit / image tag: `eeee60494716581fa0be2b3b4059ac845ce1ddf7` (React #418 hydration fix)
- Digest: `sha256:b1cd685c46901aac21713c3890eeb0bdb9c905482df12986737c6b66119ac3a3`
- Task definition: `htc-sandbox-venue-app:527`
- Task ID: `1659e4a4c5ce40feb0ac81a97a882372`
- Desired / running / pending: 1 / 1 / 0
- Rollout: PRIMARY COMPLETED
- Health: `/api/health` HTTP 200
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/36956772206
- Cluster: `htc-sandbox` only
- Production: untouched
- Prior sole RUNNING retained for S3/S4 proofs: `876c9d51` / `:526` / `af8590f4…` (invoice back-nav GREEN; do not reopen)

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
- **REMAINING WORK (closeout re-proof — concrete):**
  - **B** combined follow-up save + tour conflict on disposable lead (exact `eeee6049`)
  - **C** disposable tour lifecycle matrix (scheduled→complete, walk-in, actual-only) beyond Jasmine regression already GREEN
  - **E** browser-prove single-mode UI + reception-only-via-permitted-uses presentation (DB check: `space_operating_mode` enum is only `single`|`multi`; Fancy restored `multi` after single cycle)
  - **F** disposable Booking-E1 skip inactive/disallowed + seed rollback DB proof (unit skip already PASS 4/4)
  - Stream 1 product previously GREEN on `1d6c96c2`; do not reopen A/D/G/H/AES add-on without regression

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
- **REMAINING WORK:** Deploy automations alias redirect on next Sandbox cutover; then re-hit `/automations` → series (not required to reopen stream once deployed)

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
- **REMAINING WORK:** Ship Automations alias on next Sandbox deploy

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

- **STATUS:** OPEN — blocked until Stream 1 remaining B/C/E/F closeout items are GREEN
- **IMPLEMENTATION COMMIT(S):** n/a
- **RUNNING IMAGE/TAG / DIGEST / TD / TASK:** not yet
- **AUTOMATED TEST EVIDENCE:** none
- **BROWSER EVIDENCE:** none
- **DB/PERSISTENCE EVIDENCE:** none
- **REGRESSION EVIDENCE:** none
- **REMAINING WORK:** after Stream 1 residual gates close + Automations alias deploy, run full Lead→Client→Event→Contract→Invoice/Payment + Tours/Spaces/Smart Fields/Luv/Tasks/Dashboard/Documents/Archive/portal matrix on sole RUNNING.

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

- **STATUS:** IMPLEMENTATION COMPLETE — awaiting sole-RUNNING Sandbox + browser proof (not GREEN from tests alone)
- **AUDIT:** Existing `WorkspaceCategory` (12 values) remains storage/read-model truth via `mapCategory`. Presentation roll-up only: Contracts / Financial / Planning / Vendors / Other (+ All). Empty groups hidden.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **FILES:** `lib/document-workspace/user-facing-categories.ts`, `components/document-workspace/document-workspace.tsx`
- **AUTOMATED TEST EVIDENCE:** `user-facing-categories.test.ts` + documents surface tests PASS
- **DEPLOY:** https://github.com/jlcormier612/wevenu-website/actions/runs/36959110951 (in progress at dispatch)
- **BROWSER EVIDENCE:** pending exact runtime
- **REMAINING WORK:** Deploy → sole RUNNING → browser prove populated-only filters + correct roll-up membership

### Luv — Relationship Snapshot lifecycle authority

- **STATUS:** IMPLEMENTATION COMPLETE — awaiting sole-RUNNING Sandbox + browser proof
- **ROOT CAUSE:** Snapshot descriptors used numeric scores only (`scoreDescriptor`). Signed contracts could still show Interest “Still early” / Commitment “Progressing toward booking” because scores lagged authoritative contract/Booked facts.
- **CANONICAL FIXTURE (pre-fix proof target):** Miss Piggy lead `20e470d8-…` — interest=0 / commitment=45 / responsiveness=0 / sales_stage=`tour_scheduled` / contract `107fcc2c-…` status=`signed` (Fully Executed, all signers done) — currently would render the buggy early language from scores alone.
- **FIX:** `lib/leads/snapshot-lifecycle.ts` precedence over scores; `LeadMomentumCard` + `LuvDraftPanel` consume `bookingJourney` contract + `salesStage === booked` + payment outstanding context. Signed ≠ Booked preserved.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `snapshot-lifecycle.test.ts` matrix PASS (early / sent / client-signed / FE / Booked / payment / responsiveness)
- **BROWSER EVIDENCE:** pending exact runtime
- **REMAINING WORK:** Browser-prove regression matrix on disposable fixtures + DB contract state

### Payment document — redundant / unexpected note provenance

- **STATUS:** IMPLEMENTATION COMPLETE — awaiting sole-RUNNING Sandbox + browser proof
- **SOURCE OF `"Essential Wedding — booking commitment"`:** System-generated in `lib/booking-journey/setup-payments.ts` `commitmentNotes()` → written to `invoices.notes` for guided-setup recovery matching. Classification: **D/E system payment-setup / invoice metadata** — not venue-authored.
- **DB PROOF (pre-fix):** invoice `77f2f506-…` (SelUse) notes=`Essential Wedding — booking commitment`; linked schedule `a6b0c946-…` notes=null. Venue `name`=`Jen's Fancy Venue` vs `business_name`=`Fancy Venue LLC`.
- **WHY TWICE:** `InvoicePrintDocument` showed Payment Instructions as `paymentInstructions || invoice.notes` and Notes as `invoice.notes` (same field). Callers passed `scheduleNotes ?? invoice.notes` while schedule notes were empty.
- **WHY “Notes from Fancy Venue LLC”:** Notes heading used `businessName` (legal entity) ahead of customer-facing `venue.name`.
- **FIX:** `lib/invoices/customer-facing-notes.ts` — suppress system commitment markers from instructions + Notes; Notes only when genuine venue-authored and distinct; Notes attribution uses customer-facing venue name.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `customer-facing-notes.test.ts` PASS; adjacent invoice workflow tests PASS
- **BROWSER EVIDENCE:** pending exact runtime + DB provenance proof
- **REMAINING WORK:** Browser-prove payment document; confirm Notes absent when only system metadata; genuine note path

### Payments — list identity / scanability

- **STATUS:** IMPLEMENTATION COMPLETE — awaiting sole-RUNNING Sandbox + browser proof
- **FORENSIC:** `PaymentScheduleList` used `s.title` (e.g. “Essential Wedding payments”) as primary; `clientName` was already on the row from repository join but secondary.
- **FIXTURES:** 7× “Essential Wedding payments” (Miss Piggy, SelUse, Jasmine, …); 3× Signature; 3× Full Service; 6× Garden Package — ideal scanability proof.
- **FIX:** Presentation only — primary = client/couple name (`list-identity.ts`); secondary = plan name + overdue count. Navigation/href unchanged.
- **IMPLEMENTATION COMMIT(S):** `934f82a38cfa3162356bcb4c14769c577995d400`
- **AUTOMATED TEST EVIDENCE:** `list-identity.test.ts` PASS
- **BROWSER EVIDENCE:** pending exact runtime
- **REMAINING WORK:** Prove multi-client same-plan scanability + click-through; adjacent invoice back-nav / setup routing smoke

### Contracts — list identity / nomenclature

- **STATUS:** OPEN — implementation complete; awaiting sole-RUNNING Sandbox + browser proof
- **FORENSIC:** `ContractList` used `contract.title` (document/template title, e.g. “Venue Rental Agreement — Jane…”, “AES Jane Additional Preview…”) as primary. `clientName` already on row from repository couple join. No separate contract-type enum — closest authoritative type is `contract_templates.name`; default title construction uses `Venue Rental Agreement — {clientDisplayName}` in ContractBuilder.
- **FIX:** Presentation only — primary = client/couple name; secondary = template name (else title prefix before em-dash, else “Contract”). Document/test titles no longer dominate list identity. Filters/status/nav/lifecycle unchanged. Href still `/contracts/{id}`.
- **IMPLEMENTATION COMMIT(S):** pending this commit
- **FILES:** `lib/contracts/list-identity.ts`, `components/contracts/contract-list.tsx`, `lib/contracts/service.ts` (template name enrich), `lib/contracts/list-filters.ts`
- **AUTOMATED TEST EVIDENCE:** `list-identity.test.ts` + list-filters + client-first-signing PASS
- **BROWSER EVIDENCE:** pending exact runtime
- **REMAINING WORK:** Deploy → sole RUNNING → browser prove client-first / type-second hierarchy + click-through; confirm lifecycle filters unchanged

---

## Production

Untouched. Sole HTC cluster in use: `htc-sandbox`.
