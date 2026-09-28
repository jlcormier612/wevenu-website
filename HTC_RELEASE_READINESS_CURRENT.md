# HTC Release Readiness — Current Delta

**Date:** 2026-09-28  
**Purpose:** What is actually still open right now. Not a historical audit.  
**Sources:** current repo, git history, existing tests, `docs/qa/launch-recovery-e2e/*`, current Sandbox runtime, this pass's contract-send UX fix.

Locked product decisions (booking, date holds, contracts, payment plans, payment requests, Smart Fields, Calendar/Tasks) are **not reopened**.

---

## GREEN — VERIFIED COMPLETE

Evidence is the 2026-09-28 launch-recovery run on Sandbox image `8567ff57`, plus the listed tests/commits. Jennifer's independent final acceptance is still outstanding and is **not** listed as unfinished product work.

| Item | Evidence |
| --- | --- |
| Supabase auth amplification repair | Root cause + proxy skip + tests; image `8567ff57`; no new 409/429/AuthRetryableFetchError storm; public-route Auth 9→0 |
| Public-route auth-call elimination | `integrations/supabase/proxy.ts` + proxy tests |
| Bounded polling / backoff | `lib/polling/poll-schedule.ts` + tests; Phase 6: 2 hits / 20s, no overlap |
| First-login blank-page / RSC loop | Login returns `redirectTo` + `window.location.assign`; proved in journey |
| Provisioning `venue_staff.access_title` NOT NULL | Owner/manager writes + mapping; dedicated E2E venue provisioned |
| Dedicated E2E venue/staff | `docs/qa/launch-recovery-e2e/IDENTIFIERS.md` — Recovery E2E Venue 1790617113989 |
| Tenant isolation, legal acceptance, venue setup, Setup Hub | Journey STATUS GREEN |
| Lead create + persistence + idempotency | Journey STATUS GREEN |
| Lead → Client without consuming hold; Booked consumes overlapping hold | Robin Avery hold `71eea892` `converted` after `20261408300000`; Taylor leftover not mutated |
| `bookClient` is the Lead → Booked Client transition | Journey + date-hold booked-boundary tests |
| Package select + persist | Essential Wedding $18,000 on Robin |
| Smart Fields + Preview (locked matrix, no catalog change) | Tokens stay in draft; preview resolves; 144 contract tests on prior pass; journey GREEN |
| Client-first signing | Send → client signs → Awaiting Venue Signature → venue signs → Fully Executed; `contracts.status=signed` |
| Payment plan (approved anchors; no booking-date input) | $4,500 + $13,500, 2 installments |
| Payment request + duplicate-send protection | Review does not send; already-sent banner; in-flight second click blocked |
| Lead Documents relationship scope | Contract visible from lead |
| Client / Event workspace | Booked, package, Fully Executed, payment plan |
| Notifications | Contract awaiting signature + new inquiry |
| Calendar / Tasks surfaces | Render; event lives on booking file (not a Calendar dump) |
| Phase 6 Sandbox resilience (client-side faults) | 503/timeout on notification poll; page usable |
| `20261408300000` applied | Applied after incident miss; Robin path proved |
| Push of journey record | Remote `7e8fa883` contains IDENTIFIERS + STATUS |

---

## IMPLEMENTED — NEEDS HUMAN-FACING VERIFICATION

### Starter-policy placeholders: warning, not blocker (this pass)

- **Exact issue:** "Send to Client" on a contract that still has starter policy placeholders used to hard-block. Locked decision: warn, then **Go Back & Edit** or **Send Anyway**.
- **Current evidence:** Implementation + 39 focused tests passing locally. Not yet on the running Sandbox image (`8567ff57` still journey-verified, pre-this-fix).
- **What remains:** Deploy this commit; Chrome journey: warn → Go Back (no send) → warn → Send Anyway → sent, no duplicate, persist/reopen.
- **Smallest next action:** Deploy + Chrome on dedicated E2E venue (not Jennifer).
- **Commits:** this pass (see git after commit).
- **Tests:** `lib/contracts/starter-placeholder-send-warning.test.ts`, `lib/contracts/starters.test.ts`.
- **Browser required:** Yes.

### Jennifer independent final acceptance

- **Exact issue:** Recovery journeys are Cursor-proved. Jennifer has not walked the path on a venue she trusts.
- **Current evidence:** `docs/qa/launch-recovery-e2e/STATUS.md` READY FOR JENNIFER — paused until this warning fix is on the image she will accept.
- **What remains:** After this fix is image-verified, Jennifer walks the same customer path independently.
- **Smallest next action:** Do not hand her a pre-fix image.
- **Browser required:** Yes (Jennifer).

### Payment document copy delivery (A–E) on current image

- **Exact issue:** `docs/qa/payment-document-delivery-edit-safety/STATUS.md` still says GREEN=NO awaiting image `04738e08`. Later images superseded that SHA. Launch-recovery proved **payment request**, not the independent Document Copy retrieve path.
- **Current evidence:** Implementation committed earlier; request-path GREEN on `8567ff57`.
- **What remains:** One Sandbox invoice: Send copy of payment plan and invoice → client retrieves complete document; edit hidden after send. Do not re-audit payment architecture.
- **Smallest next action:** After placeholder-send Chrome, run Document Copy A–E on the new image.
- **Browser required:** Yes.

### Tour / sequence greeting + signature on current image

- **Exact issue:** STATUS still "NOT GREEN" from an in-flight deploy that was later superseded. Launch-recovery did not re-prove Betty-style greeting.
- **Current evidence:** `3da084a0` in lineage of later images; Fancy-owner local proof in that STATUS.
- **What remains:** Open one New Inquiry Welcome / tour email on current image; confirm `Hi {first_name}` and coordinator signature, not venue name.
- **Smallest next action:** Targeted email-body check on current image — do not reopen merge architecture.
- **Browser required:** Yes (or delivered-email inspect).

### Lead pipeline Option A live UI

- **Exact issue:** `docs/qa/lead-pipeline-stage-lifecycle/STATUS.md` marked NOT GREEN after a failed deploy; later `8e287b73` / `8567ff57` include Option A. Launch-recovery created leads and saw New Inquiry, but did not drag stages.
- **Current evidence:** Fresh lead "Lifecycle Gate Ada" proof on `8e287b73`; recovery lead create GREEN.
- **What remains:** If needed for launch, one browser drag/drop across the seven locked stages. Do not re-audit pipeline architecture.
- **Smallest next action:** Browser drag/drop only.
- **Browser required:** Yes.

---

## NEEDS IMPLEMENTATION

### Deploy must verify actual target DB migrations (P1 process)

- **Exact issue:** `SANDBOX_DB_URL` unset → deploys skip DB verify. `20261408300000` sat unapplied while tests passed.
- **Current evidence:** `docs/qa/launch-recovery-e2e/MIGRATION-GAP.md`, `TECH-DEBT.md`.
- **What remains:** Set `SANDBOX_DB_URL` (or equivalent) so every Sandbox/prod deploy diffs `schema_migrations` vs repo.
- **Smallest next action:** Environment secret + confirm the existing deploy hook runs. Do not redesign migrations.
- **Commits:** n/a (ops).
- **Tests:** none yet against live DB.
- **Browser required:** No.

### HQ `startOperatorConfigureAction` still Server-Action-redirects (P2)

- **Exact issue:** Same blank-page collision as first-login, on HQ White-Glove `/setup-hub`.
- **Current evidence:** `docs/qa/launch-recovery-e2e/TECH-DEBT.md`.
- **What remains:** Hand destination to the client (same shape as login fix).
- **Smallest next action:** After P0/P1 customer paths, apply the login-shaped navigation fix to that action only.
- **Browser required:** Yes, HQ path.

---

## KNOWN DEFECTS

### Legal `auth.users` lookup + `listUsers` cap 2000 (P2)

- **Exact issue:** PostgREST `PGRST106` on `auth.schema("auth")`; fallback pages Admin `listUsers` (max 2000). Works at 46 users; will miss acceptances past the cap.
- **Current evidence:** `TECH-DEBT.md`; Sandbox logs.
- **What remains:** Security-definer email→id RPC. Do not scan Admin API.
- **Smallest next action:** Implement RPC after P0/P1 journeys.
- **Browser required:** No (login/legal path unit + one live accept).

None of the locked booking / hold / signing / payment-request defects remain open on the recovery image.

---

## BLOCKED

None that stop the current customer journey. Stripe live collection (historical TR-M1) remains an external credential/product track, not a recovery-gate blocker.

---

## OBSOLETE / CLOSED

Do **not** treat these as the active launch list:

| Old item | Why closed / superseded |
| --- | --- |
| `docs/release-readiness-status.md` (2026-07-17) | Explicitly superseded 2026-07-20; Program 1–3 reds are historical snapshot |
| "Re-audit every HTC feature after Supabase incident" | Recovery gate is journeys + persistence + resilience — already run |
| Re-investigate applied migrations / Smart Field catalog / payment-plan anchors / client-first signing | Locked and journey-proved |
| Pipeline architecture redesign / Smart Field matrix edits | Locked; only remaining work is targeted live checks |
| `docs/qa/contract-smart-field-system/STATUS.md` "NOT GREEN — deploy in flight" | Superseded by launch-recovery Smart Field + Preview GREEN on `8567ff57` |
| Reopen Taylor Morgan leftover hold as a product defect | Pre-migration evidence; RPC self-heal tested; do not hand-edit |
| Auth refresh storm / 429 / pool-timeout incident investigation | Closed unless runtime regresses |

---

## Priority of what is actually left

| Pri | Item |
| --- | --- |
| P0 | Starter-policy Send Anyway (this pass) — blocks the live contract journey Jennifer is walking |
| P1 | Deploy-time live migration verification (`SANDBOX_DB_URL`) |
| P2 | Payment Document Copy A–E on current image |
| P2 | Tour/sequence greeting + signature on current image |
| P2 | Pipeline drag/drop if still required for launch |
| P2 | Legal email→id RPC; HQ operator redirect |
| P3 | ALB access logs; `pgrst_db_pool_available` −14 (flagged, not correlated) |
| Gate | Jennifer independent final acceptance after the P0 image is running |

**This pass:** finish P0 (placeholder warning), deploy, Chrome-verify, then continue P2 customer journeys. Do not start P3 while P0 is unverified on the running image.
