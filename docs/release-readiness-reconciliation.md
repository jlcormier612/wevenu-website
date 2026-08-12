# Release Readiness Reconciliation — Final

**Type:** Reconciliation and judgment pass, not a development sprint. Nothing in this document was built to produce it — every claim below is either a citation of prior, already-shipped work, or a direct, independent verification against the current codebase (source read, live grep, or an actual `next build`/`tsc` run performed during this pass).
**Date:** 2026-08-11
**Scope reconciled against:** `docs/product-completion-roadmap.md` (2026-07-07, self-marked superseded), `docs/trust-risk-register.md` (2026-07-20, current), `docs/engineering-standards.md`, `docs/domain-model.md`, `docs/release-readiness-status.md` (2026-07-17, self-marked superseded), `docs/release-candidate-roadmap.md` (2026-07-22), `docs/platform-status-snapshot.md` (2026-07-22, the prior "single current answer"), `docs/starter-library-release-certification.md` (2026-08-11), `docs/architectural-debt-review-checklist.md`, and the full D6/D7/D8 Document & Reporting Customer Experience arc.
**Method:** Read every spine document above in full. Dispatched three independent, read-only verification passes against the live source tree (not against the documents) covering: (1) the "silent false success" delete/update pattern across every `lib/*/repository.ts` not already covered by D6–D8, (2) merge-field resolution completeness across every customer-facing send path, plus the `PUBLIC_PATHS` public/private route boundary, (3) a direct spot-check of the Starter Library certification's four most load-bearing claims against actual source. Independently re-confirmed the highest-stakes findings from each pass by reading the cited files myself. Ran a real `next build` and a full-repo `tsc --noEmit` during this pass — not assumed clean from prior reports.

---

## A. Certified Complete

Everything below is closed, verified (by this pass or a prior one this pass re-confirmed), and does not need to be revisited for this release.

**Trust Risk Register — 24 of 25 items Resolved, 1 Mitigated-and-substantially-built (see §E):**
- **Money:** TR-M2 (invoice balance integrity), TR-M3 (refund/void), TR-M4 (double-mark-paid guard), TR-M5 (paid-record delete guard) — all Resolved with live-tested evidence.
- **Legal:** TR-L1/L2 (signed-contract immutability), TR-L3 (e-signature IP/UA/consent trail), TR-L4 (signed-trigger timing), TR-L5 (re-open-after-signed path), TR-L6 (RLS token bypass) — all Resolved.
- **Booking:** TR-B1 (double-booking server enforcement), TR-B2/B3 (silent send-failure reporting), TR-B4/B5 (tour-calendar canonical source, hold expiry) — all Resolved.
- **Governance:** TR-G1 (real role enforcement), TR-G2 (data export), TR-G3 (staff-revocation via `venue_users`), TR-G4 (portal access-level enforcement), TR-G5 (refund RLS backstop), TR-G6 (40-table delete role gate), TR-G7 (invite identity check) — all Resolved.
- **Communication:** TR-C1 (Conversations unification, RC2), TR-C2 (multi-staff messaging reliability) — both Resolved.

**Platform capability areas** (per `docs/platform-status-snapshot.md`, spot-re-confirmed): Lead Acquisition & Intake, CRM/Pipeline (venue-editable stages), Conversations, Couple Portal, Vendor Portal (12-workflow certification pass), Vendor Payment Visibility, Floor Plans, Contracts, Tour Scheduling, Email Intake, Facebook/Instagram Lead Ads, QR Lead Capture, Timeline, Requests Framework, Calendar, Documents, Playbooks/Tasks, Team & Permissions, White Labeling (baseline wiring), Wevenu HQ, Luv.

**Document/Reporting/Library arc (D6→D7→D8), independently re-confirmed this pass:**
- D6 — Business Asset Completion: unresolved-merge-token leak to PDFs, RLS-delete false-success regression, Contract PDF date mismatch, jargon leak — all fixed.
- D7 — Event Order Templates, Brochures, Saved Reports built as real, working Library capabilities; the `/brochure` and `/api/saved-reports/process` `PUBLIC_PATHS` gaps found during that build are fixed and still correct today.
- D8 — 8 P0 defects found and fixed (unresolved merge fields on live Conversation sends, four instances of the delete-safety pattern in Packages/Playbooks, a missing RLS delete gate on Playbook Milestones, a stale Stripe-unavailable card, a double-billing risk in Inventory→Event Order handoff, PDF header/signature-block layout bugs).
- Reporting arc (R1–R3) + Canonical Metric Implementation + Dashboard Component System: consolidated 7 duplicate metric calculations onto one canonical `lib/metrics/*`, retired the legacy `/analytics` surface, fixed a cross-venue RLS bypass found via realistic-data testing.

**Starter Library** — independently spot-checked this pass, not just trusted:
- **Master-protection skip logic** — confirmed real in `lib/brochures/provision.ts`, `lib/saved-reports/provision.ts`, `lib/packages/provision.ts`, `lib/message-templates/provision.ts`, `lib/floor-plan-templates/provision.ts`: each queries existing `source_master_key`s for the venue and skips already-provisioned masters before inserting.
- **Cross-venue RLS isolation** — confirmed real on `brochures`, `saved_reports`, `message_templates`: each has a genuine `venue_id = current_user_venue_id()` policy (not `true`), and `current_user_venue_id()` is a real `security definer` lookup, not a stub.
- **Financial zero-side-effect claim** — confirmed real: `lib/venue/service.ts`'s setup function calls 11 starter-seed functions, none of which touch `invoices`, `payment_schedules`, or `payment_line_items`.
- **Package "priced" copy fix** — confirmed live in `app/(app)/library/page.tsx`; no remaining occurrence of the old "priced, ready to add to any invoice" copy anywhere under `app/`.
- The certification's own "FINAL REMEDIATION + VERIFICATION" section (same document, same date) already closed its own three named caveats (Brochure auto-seed, Saved Report auto-seed, Packages copy) — this is not a live gap, just a document that corrected itself in a later section, worth knowing if only the executive summary is read.

**Cross-domain safeguard sweep results that came back clean this pass:**
- **Merge-field resolution** — every live customer-facing send path either resolves tokens directly (Conversations Send Now, Contract send, Event Order share, all client-side default-message builders) or is routed through `lib/scheduled-messages/processor.ts`, which force-resolves *every* row regardless of origin before sending (this is what makes Automated Series and `schedule_relationship_message` safe even though they insert raw content). No new gap found.
- **Financial idempotency** — QuickBooks sync, Facebook Lead Ads webhook redelivery, Stripe Connect webhook (Sprint 4), and Saved Report scheduling all independently implement a real idempotency gate keyed on an external event id. The same lesson was correctly re-applied by four different initiatives without being copy-pasted — a genuine sign of the pattern actually sticking, not just documented once.
- **PDF rendering** — the header-collision and orphaned-heading classes of bug (found in Contract, then preemptively applied to Event Order and Brochure) are the only three real PDF generators in the codebase; no fourth generator exists to have missed the fix.

---

## B. Remaining Release Blockers

Only items that would make deploying this branch today actively wrong — not things that would merely be nicer.

### B1 — The app does not currently build

Ran `next build` directly during this pass (not assumed from a prior report):

```
./components/portal/portal-shell.tsx:2094:37
Type error: Argument of type 'PortalSection | null' is not assignable to parameter of type 'PortalSection'.
```

Root cause: `lib/portal/whats-happening.ts:28` declares `WHATS_HAPPENING_VIEW_ALL_DESTINATION: PortalSection | null = null` (a real placeholder — "view all" has no destination wired yet). `portal-shell.tsx:2091` correctly guards rendering with `WHATS_HAPPENING_VIEW_ALL_DESTINATION ?`, but the narrowing doesn't survive into the `onClick` arrow function's closure at line 2094, so TypeScript still sees the nullable type at the call site. This is a real compile failure, not a flaky run — the build worker exits 1.

A full-repo `tsc --noEmit -p .` (broader than `next build`'s own scope) surfaced a second, same-family error in the same subsystem — `lib/portal/memories.ts:127,168` (`PortalSection` not narrowing to the literal `"story"` the `HomeMemoriesModel.destination` field expects) — which `next build` hadn't reached yet because it stops at the first error. This is very likely to surface as a second blocker the moment the first is fixed, since it's the same file family (`lib/portal/*` — the Couple Portal's "What's Happening" home feed).

**Why this is a blocker, not polish:** every prior initiative in this engagement (D6, D7, D8, RC1–3, Sprint 1–3, QuickBooks, Stripe Sprint 4, Starter Library) used "`tsc --noEmit` + `next build` both clean" as its non-negotiable ship gate. That gate is not currently met. This is also on the branch already pushed to `origin/feature/legal-documents-and-acceptance`.

**Why it's small, not a sprint:** both are narrow type-narrowing mismatches in the Couple Portal's newest section (the "What's Happening" home feed), not a logic or runtime defect — the actual `?`-guarded render logic is correct. The fix shape is a two-line local-variable narrowing or an explicit non-null assertion at the two call sites, not new code.

### B2 — `/join` (staff invite acceptance) is unreachable for the exact people who need it

`integrations/supabase/proxy.ts`'s `PUBLIC_PATHS` array does not include `/join`. `lib/team/service.ts:139` sends invited staff an email linking to `/join?token=...` — a brand-new hire with no existing account. The proxy 307-redirects any unauthenticated request to `/login`, and the query string survives the redirect (`/login?token=...`), but `app/(auth)/login/page.tsx` only reads a `next` param, never `token` — the invite token is silently dropped with no path back to `/join` after sign-in.

This is the **4th confirmed instance** of the same bug class already fixed three times this engagement (`/brochure` + `/api/brochures/public` in D7B, `/api/saved-reports/process` in D7C, the Email Intake webhook route and couple-portal upload route in earlier work). The pattern is well-understood and the fix is mechanical: add `/join` to `PUBLIC_PATHS`, and either have `/login` forward a `token` param the way it already forwards `next`, or point the invite email at a route that itself redirects through login with the token preserved.

**Why this is a blocker:** it silently breaks "can a venue add a team member" — a normal, expected, everyday action for any growing venue, not an edge case — and does so exactly the way Trust Risk Register Principle 2 defines as unacceptable: it looks like it should work (a real email, a real-looking link) and doesn't.

### B3 — The delete-safety pattern D6–D8 fixed is still live on Contracts, Payments, and Team management

A dedicated sweep (not just the files D6–D8 touched) found the exact "silent false success" pattern — a `.delete()`/`.update()` guarded by RESTRICTIVE RLS, checked only for `error` and never for rows-affected, so a blocked mutation still returns `{ok: true}` — alive in the *same files* D8 already patched, on functions D8 didn't reach:

- **`lib/contracts/repository.ts:340` `deleteContract`** — correctly checks contract status first, but the actual `DELETE` call only checks `error`. Independently confirmed: **`components/contracts/contract-detail.tsx` has no role check on the Delete button at all** (only a status check elsewhere) — so a Coordinator, in completely normal use, can click Delete on their own draft/cancelled contract, see "Contract deleted," navigate away, and find the contract still present next time — RLS (Owner/Manager-only delete, from TR-G1) is correctly blocking it, but the UI lies about the outcome. This is a legal-document record, the exact class of object TR-L1/L2 were written to protect.
- **`lib/payments/repository.ts:470` `deleteLineItem` and `:485` `deleteSchedule`** — same shape, in the same file TR-M5/D8 already fixed sibling functions in.
- **`lib/team/service.ts:200-226` `removeStaffMember`/`updateStaffRole`** — both filter on `.eq("is_owner", false)` (a restrictive guard where 0-row-match is indistinguishable from "blocked"), both report `{ok: true}` regardless.

**Why this is a blocker (for this specific, bounded set — not the whole pattern, see §C):** these three files are legal, financial, and access-control records respectively — the exact categories this entire Trust Risk Register exists to protect — and the Contracts instance is confirmed reachable through completely normal use by a real, non-Owner role. The fix shape is identical to four things already shipped this engagement (add `.select("id")`, check length) — a few hours, not a redesign.

**Everything else in this class (Invoices, Event Orders, Timeline, Floor Plans, Questionnaire Templates, and a long tail of child-table cascades) is real but lower-stakes and belongs in §C, not here** — see the full breakdown there.

---

## C. Remaining Non-Blocking Polish

Real, worth doing, not gating this release.

- **The long tail of the same delete-safety pattern**, on secondary/child-table records rather than primary legal/financial/access objects: `lib/invoices/repository.ts` (`updateInvoiceStatus`, `removeLineItem`), `lib/event-orders/repository.ts` (`removeSection`, `removeLine`), `lib/timeline/repository.ts` (multiple deletes/updates), `lib/floor-plans/repository.ts` and `lib/floor-plan-templates/repository.ts`, `lib/questionnaire-templates/service.ts`, plus join/child-row deletes in `lib/event-order-templates/`, `lib/pipeline-templates/`, `lib/message-sequences/`, `lib/message-templates/` (attachments), `lib/playbooks/repository.ts` (attachments/context-links), `lib/saved-reports/`, `lib/leads/`, `lib/clients/`, `lib/events/`, `lib/vendors/`, `lib/inventory/`, `lib/event-inventory/`. Recommend one dedicated sweep pass applying the same `.select("id")` + length-check fix uniformly, the same way TR-G1/TR-G6 swept role enforcement across many tables in one pass rather than table-by-table.
- **Two over-broad `PUBLIC_PATHS` prefix entries** — `/api/notifications` and `/api/tours` are broader than the one cron/public route each was meant to cover, incidentally also exposing staff-only sibling routes (`/api/notifications/preferences`, `/api/tours/outcome`, etc.) to the proxy bypass. Not exploitable today — each has its own independent `auth.uid()`/`getCurrentVenue()` check — but fragile-by-coincidence rather than correct-by-design. Worth narrowing to exact paths.
- **Migration timestamp collisions** — see §F, not confirmed to break anything today, but a standing hygiene item.
- **Dev-tooling-only `tsc` errors** — `scripts/starter-library-release-cert.mts:771` (a literal `true` where the harness's own result-classification union type is expected) and several `shared/*/​_smoke.mts` import-extension errors. None are reachable from `next build`'s actual scope (confirmed — the real build got past all of these and only failed on the app-code error in §B1) and none ship to production. Worth a cleanup pass, not urgent.
- **`STARTER-LIBRARY.md`** (the root content-pack reference doc) drifts from several shipped starter families' actual names/prices — explicitly named as documentation debt, not runtime, in three separate D-series implementation docs. Low cost to fix, zero customer impact.
- **Refund button not hidden client-side for non-Owner roles** — server + RLS enforcement (TR-M3/TR-G5) is the real backstop; this is the same cosmetic-only gap the Engineering Cleanup pass already named and accepted.

---

## D. Intentional Deferrals

Scoped, named, and correctly outside this release — not oversights.

- **Real Stripe payment collection — live-credential final confirmation.** See §E: this is materially further along than the standing docs say, but the actual "connect a real account, complete a real Checkout Session, receive a real webhook" round-trip is still blocked on a live Stripe test-mode account this environment doesn't have. Same posture as QuickBooks below — an operational/procurement precondition, not an engineering gap.
- **QuickBooks Online — live-credential final confirmation**, and its explicitly out-of-scope advanced sync (Chart of Accounts, tax codes, inbound webhooks, conflict handling) — designed, deferred by explicit instruction.
- **iCal/webcal calendar sync** — genuinely unbuilt, never scoped as a Trust Risk item.
- **Lead-to-team-member assignment** — `lib/lead-intake/assignment.ts`'s `resolveLeadOwner()` is a deliberate, documented no-op stub (confirmed by direct read this pass): "the one, explicit extension point for future lead routing... deliberately out of scope."
- **`lib/notifications/engine.ts` tour-reminder emails bypassing Conversations** — disclosed in RC2's own final report, not actioned since; a coordinator has no in-Conversation record of these specific reminders.
- **`lead_notes`/`client_notes`/`event_notes` vs. the newer `internal_note` Conversation channel** — a real future-consolidation candidate, not a defect (different shape: single-party notes vs. a conversation).
- **Commercial Proposal Architecture** — approved future initiative giving the `proposal_sent` pipeline stage a real artifact; not built.
- **A dedicated Wedding Party-facing portal/login** — see §E: the *audience-filtering mechanism* now has a real consumer, but a distinct Wedding Party identity/login surface (separate from the couple's own portal session) is still unbuilt.
- **Payment Plan starters as code presets, not seeded DB rows** — a deliberate Starter Library architecture decision (per its certification), not a gap.
- **The Launch Verification Script's human/device pass, and dogfooding** — both named in `docs/platform-status-snapshot.md` as the top two remaining gates and, as far as this pass can determine, neither has been executed since. This is not a code gap this reconciliation can close (it requires real phones, real people, real elapsed time) — see §H.

---

## E. Stale/Obsolete Findings

Prior findings that no longer accurately describe the codebase, and should be corrected in the docs that still assert them.

1. **`docs/platform-status-snapshot.md`'s "Real Stripe payment collection — Deferred, designed. Not started."** — **materially stale.** `docs/venue-payment-processing-report.md` (Sprint 4, same date, 2026-07-22) shows a full Card+ACH Stripe Connect pipeline actually built: schema, Connect account lifecycle, Hosted Checkout, webhook processing with real signature verification and idempotency (including a real bug caught and fixed during that pass — a failed webhook attempt not properly clearing its own idempotency row), refunds routed through the real Stripe API, and Conversation receipts — everything short of a live credentialed round-trip. Independently re-confirmed this pass: `lib/stripe/` contains 666 lines across 8 real modules (not stubs), the Settings "Connect with Stripe" button is live (not "coming soon"), and `/api/webhooks/stripe-connect` is correctly in `PUBLIC_PATHS`. **Correct classification is "Launch-ready, blocked on credentials" — the same posture as QuickBooks — not "Deferred, designed, not started."** This is a materially better Money-category position than any of the standing docs currently reflect.
2. **`docs/platform-status-snapshot.md`'s "`wedding_party` Timeline visibility tag... no consuming surface anywhere in the product yet."** — **partially stale.** `supabase/migrations/20261197000000_portal_timeline_wedding_party_gate.sql` (independently read this pass) rewrites `get_portal_run_of_show` so venue-owned timeline items are only shown to the couple portal when `audiences` contains `wedding_party` — a real, live consumer of the tag now exists. What remains genuinely unbuilt is a *dedicated* Wedding Party-facing surface (its own access/login, distinct from the couple's), which is why this is only partially resolved, not fully — see §D.
3. **`docs/product-completion-roadmap.md` and `docs/release-readiness-status.md`'s open items (TR-M4, TR-B2, TR-B3, TR-C1, fixed-7-pipeline-stages, White Labeling Red).** These are correctly self-marked "superseded" and are not being newly flagged as stale here — this reconciliation confirms the supersession chain (`release-candidate-roadmap.md` → `platform-status-snapshot.md`) is accurate and should keep being trusted over the older documents, not that the older documents need correcting.
4. **The old Product Completion Roadmap's Principle 4** (Documents/Contracts/Invoices/Floor Plans/Questionnaires as one eventual unified "Asset" model, explicitly "not a Program 2 build item yet" as of 2026-07-07) — **substantially realized, under a different name.** The Document Domain initiative (Canonical Architecture, Business Object Boundary, Producer Readiness, the Phase 2B Integration Contract, Phase 2C Document Service) plus D6/D7/D8 is exactly this unification, arrived at independently. Worth updating the roadmap to say so rather than leaving it listed as unstarted.
5. **Starter Library certification's own first-pass caveats** (Brochures/Saved Reports not auto-seeded, Packages "priced" copy) — stale only within the document's own first section; its own later "FINAL REMEDIATION" section (same file, same date) already closes all three. Noted only because reading the executive summary alone would give a wrong impression.

---

## F. Cross-Domain Risk Assessment

Seams comparable in shape to what D8 found, checked deliberately rather than waited for a bug report.

| Seam | Status this pass |
|---|---|
| **Merge-field resolution** | ✅ Clean. Every live send path resolves or routes through a path that always resolves. No new gap. |
| **RLS/role enforcement** | ✅ Clean as a security boundary — every mutation checked this pass that's *supposed* to be blocked, *is* blocked. The gap is downstream of enforcement (see next row), not in it. |
| **Mutation success reporting** | 🔴 The single largest surviving gap. The "silent false success" pattern recurs in Contracts/Payments/Team (blocking-tier, §B3) and a long tail of lower-stakes tables (§C). D6–D8 fixed this domain-by-domain; it was never swept universally. This is the concrete, present-day instance of Engineering Standard #9 ("two things that answer the same question is an open integration gap, not history") applied to "did this write actually happen" rather than a data model. |
| **Finalized-record immutability** | ✅ Consistent with prior certification (Contracts TR-L1/L2/L5, Event Inventory's D8 trigger-exception fix) — not independently re-swept beyond those two this pass. |
| **Financial handoff/idempotency** | ✅ Clean and, notably, independently re-derived correctly four separate times (QuickBooks, Facebook, Stripe, Saved Reports) — the strongest positive signal in this whole reconciliation. |
| **PDF rendering** | ✅ Clean — all three real generators (Contract, Event Order, Brochure) share the same fix; no fourth generator exists. |
| **Public/private content boundaries** | 🟠 One real, confirmed gap: `/join` (§B2), the 4th instance of this exact class. Two lower-priority over-broad entries (§C). Otherwise clean — FAQ starters default unpublished, portal access-levels enforced (TR-G4), brochure public-token route correctly 404s on invalid tokens (independently confirmed in the Starter Library cert). |
| **Migration history integrity** | 🟡 10 groups of migration files share an identical leading timestamp across the repository's full history (not introduced this session): `20261175`/`76`/`77`, `20261222`, `20261243`, `20261245`, `20261257`, `20261258`, `20261262`, `20261268`. This is a direct, repeat instance of exactly what Engineering Standard #8 was written to prevent. Not confirmed to currently break `db reset --local` (local dev has applied cleanly per standing project memory of the last such repair), but it's a "verify before next deploy" question that shouldn't be assumed answered. |

---

## G. Three Gates

**Engineering Complete — 🔴 Not currently met, but by a small, named, mechanical margin.** `next build` fails today (§B1). Once that and the `/join` routing gap (§B2) and the Contracts/Payments/Team delete-safety instances (§B3) are closed — all three are narrow, well-understood, same-shape-as-work-already-shipped fixes — this gate is met. Nothing architectural stands in the way.

**Product Complete — 🟢 Yes, for what this release actually promises.** Every Trust Risk Register item is Resolved or (for TR-M1) materially further along than documented, with the honest remainder correctly named as credential-blocked rather than hidden. The deliberately deferred items (§D) are genuinely scoped-out future work, not silently-missing pieces of the current promise. The product's own standing bar — "would a venue owner who's used another established venue-management system feel this is easier, more beautiful, more thoughtful, and more capable" — is supported by the actual density of what's shipped (Conversations, full vendor certification, canonical reporting, a real Document/Asset model, a real Starter Library, real Stripe/QuickBooks pipelines short of live creds) rather than assumed from documents alone, since this pass independently re-verified rather than just re-read the highest-stakes claims.

**Debt Complete — 🟡 No, but it's named, not hidden.** The delete-safety long tail (§C), the migration timestamp collisions (§F), two over-broad `PUBLIC_PATHS` entries (§C), dev-tooling-only typecheck noise (§C), and `STARTER-LIBRARY.md` documentation drift (§C) are all real, bounded, and now written down in one place rather than scattered across per-initiative reports or undiscovered. None of them block; all of them are legitimate next-pass work.

---

## H. Final Release Recommendation

### NOT READY — pending three small, well-understood, mechanical fixes; READY WITH NAMED CAVEATS immediately after

This is not a judgment that the product is immature — the evidence in §A is extensive and independently re-verified, not just re-read. It's a judgment that **the specific branch as it stands right now does not compile**, and two other narrow, already-familiar-shaped defects sit alongside it. All three (§B1–B3) are the same size and character as fixes this engagement has shipped dozens of times already — none require new design, new architecture, or reopening anything certified.

**Once B1–B3 are closed**, the recommendation is **READY WITH NAMED CAVEATS**, where the caveats are exactly:
1. Real Stripe and QuickBooks round-trips remain blocked on live credentials this environment doesn't have — both are built and verified short of that, both have an explicit financial-validation checklist ready to run the moment credentials exist.
2. The delete-safety long tail (§C) is real, non-blocking debt worth a dedicated sweep soon, not a redesign.
3. The Launch Verification Script's human/device pass and dogfooding (§D) — named as the top two remaining gates in the last snapshot — do not appear to have been executed since, and this reconciliation cannot close that gap from a codebase read; it's the one item on this list that isn't a code question at all.
4. Ten migration-timestamp collisions (§F) are worth a `supabase migration list` sanity check before the next deploy, not because anything is known broken, but because Standard #8 exists precisely so this doesn't have to be assumed.

Nothing else surfaced in this reconciliation rises to release-blocking. The Trust Risk Register — the document this entire program has treated as supreme over every other roadmap item — is substantively closed, and the one item still open (TR-M1) is closer to done than any current document says.

---

## REMEDIATION — Release-Blocker Fix Pass (2026-08-11, same day)

**Scope:** exactly the three blockers named in §B above, plus one narrow, same-defect-class extension found during the mandated regression sweep (§4 below). Nothing else in this document was reopened, rebuilt, or redesigned. This section is additive — everything above stands as the historical record of what the reconciliation found; this records what was done about it and what was verified afterward.

### R1 — `next build` failure (§B1)

**Root cause, fully traced (broader than originally scoped):** the build failure wasn't one file — it was the first of **seven** files with genuine type errors across the whole tsconfig-included set (`**/*.ts`/`**/*.tsx`/`**/*.mts`, minus `node_modules`/`marketing`/`workspace`), which is the real scope `next build`'s own typecheck step covers, one error at a time. The original reconciliation's claim that the other errors were "dev-tooling-only... none reachable from `next build`'s actual scope" was itself unverified — it was inferred from a single build run that never got past the first error. This pass ran the build to actual completion, fixing each error as it was reached, until it genuinely passed.

| # | File | Root cause | Fix |
|---|---|---|---|
| 1 | `components/portal/portal-shell.tsx:2094` | A nullable module-level export (`WHATS_HAPPENING_VIEW_ALL_DESTINATION: PortalSection \| null`) narrowed correctly in the surrounding JSX condition, but the narrowing doesn't survive into the `onClick` closure. | Captured into a local `const viewAllDestination` before the JSX, which TS *does* narrow correctly across the closure. No behavior change — the guard condition was already correct at runtime. |
| 2 | `lib/portal/memories.ts:14,127,168` | `MEMORIES_DESTINATION` was annotated `PortalSection` (a wide union) instead of the module's own documented invariant ("Destination SoT remains Story... Never task, progress, or venue ops"), so it couldn't satisfy the narrower literal `"story"` type two call sites needed. | Tightened the annotation to `"story"` — this *corrects* the type to match the module's own stated, permanent invariant; it doesn't weaken anything. Removed the now-unused `PortalSection` import. |
| 3 | `scripts/starter-library-release-cert.mts:766-778` | A `find(id, workingOk \|\| true, ...)` call passed a boolean where a `Finding["classification"]` string union was expected — and its own pushed result was immediately discarded via `findings.pop()` two lines later, replaced by a corrected call right after. Genuinely dead code with zero effect on the cert harness's actual evidence output. | Deleted the dead call; the one real classification (already present, already correct) is unchanged. |
| 4 | `components/welcome-experience/welcome-experience.test.ts:54` | `makeLegalDoc`'s test-fixture builder defaulted every other optional `LegalDocument` field *before* `...partial`, but `publishedBy`/`publishedAt` (`string \| null`, no `undefined`) needed defaulting *after* the spread — otherwise the spread's own `Partial<LegalDocument>`-derived optionality could reintroduce `undefined` into the merged type. | Moved both defaults after `...partial`, matching the type's actual constraint unconditionally. |
| 5 | `lib/wedding-website/collection-color-bundle.test.ts:27` | A genuine duplicate `tokens:` key in one object literal (TS1117) — only the second, deep-merging one ever took effect at runtime (later duplicate keys win in JS); the first was dead weight. | Removed the first, inert copy. Zero behavior change. |
| 6 | `lib/wedding-website/collection-composition.test.ts` (5 sites) + `lib/wedding-website/collection-preview-theme.ts` | (a) Five test fixtures used `SectionTreatment` string literals (`"formal-opening"`, `"flowing-opening"`, `"formal-framed"`, `"romantic-opening"`, `"conversational-opening"`) that no longer exist in the current 8-member union — confirmed via `storyBodyAlignsLeft`'s real implementation that only ever branches on `=== "editorial-opening"`, so any other valid, distinct member preserves every assertion's actual meaning. (b) `resolveCollectionPreviewTheme<T>(...): T` returned bare `T`, so a caller whose input literal omitted `heroMaxHeight`/`heroAspectCap` couldn't type-safely read them off the result even though every branch always sets them. | (a) Renamed the five obsolete literals to five distinct, valid `SectionTreatment` members (`paired-passage`, `compact-interlude`, `split-feature`, `gallery-spread`, `strong-closing`), keeping the one literal that's also asserted by value (`rustic` → `"paired-passage"`, fixture *and* assertion updated together). (b) Widened the return type to `T & Pick<PreviewHeroThemeInput, "heroMinHeight" \| "heroMaxHeight" \| "heroAspectCap">` — this is a real, if narrow, fix in the actual (non-test) source file, correcting the signature to match what the function has always actually returned. |
| 7 | `shared/email/_smoke.mts`, `shared/relationships/_smoke*.mts` (4 files) | Explicit `.ts` extensions in relative `import()` specifiers, required for these files to run directly under a TS-aware runtime (`tsx`) without a build step, but rejected by the compiler without `allowImportingTsExtensions`. | Added `"allowImportingTsExtensions": true` to `tsconfig.json` — TypeScript's own documented option for exactly this case, safe only because `noEmit: true` was already set (a hard requirement of the flag), which it was. |

**Validation:** `npx tsc --noEmit -p .` — zero errors, confirmed with a fresh run. `npx next build` — confirmed **twice**, cleanly, from a completely fresh invocation each time: `✓ Compiled successfully`, `Running TypeScript ... Finished TypeScript`, all 254 static pages generated, full route manifest printed, exit code 0. `npm test` (the full suite) — **465/465 tests pass, 0 failures**, including all 46 tests in the three edited test files, confirming the `SectionTreatment` renames and the `LegalDocument` fixture fix preserved every existing assertion's actual meaning, not just silenced the type errors.

### R2 — `/join` PUBLIC_PATHS + redirect param (§B2)

**Root cause, fully traced (two compounding bugs, not one):**
1. `/join` was absent from `PUBLIC_PATHS` in `integrations/supabase/proxy.ts` — an unauthenticated request never reached the page at all, 307-redirecting to bare `/login`.
2. Independently, `app/join/page.tsx`'s own internal `if (!user) redirect(...)` used a query param named `redirect=`, but `/login` (`app/(auth)/login/page.tsx`) only ever reads `?next=` — the same mechanism `/vendor/accept` already relies on successfully. Even if bug #1 were the only problem, this second one would have stranded every invitee at a bare login screen with no way back.

**Fix:** added `"/join"` to `PUBLIC_PATHS` (one line, same shape as the existing `/vendor/accept`/`/client/accept` entries — not a new auth exception, the existing one correctly applied). Changed `/join`'s redirect from `?redirect=` to `?next=${encodeURIComponent(...)}`, plugging into the exact same, already-proven `safeInternalNextPath` → hidden form field → `signIn` action → `redirect(next)` loop `/vendor/accept` already uses.

**Validation — real HTTP against the running dev server, not just source inspection:**

| Check | Result |
|---|---|
| `GET /join` (no token, unauthenticated) | `HTTP 200` — page loads, renders its own "Invalid Invitation" state |
| `GET /join?token=<real>` (unauthenticated) | `HTTP 307` → `Location: /login?next=%2Fjoin%3Ftoken%3D<real>` — proves both the PUBLIC_PATHS fix (request reaches the page) and the param-name fix (correct `next=` encoding) in one observed redirect |
| `GET /dashboard` (protected route, unauthenticated) — **negative control** | `HTTP 307` → `Location: /login` — protected routes remain gated, unaffected |
| `GET /vendor/accept?token=<fake>` — known-good reference | `HTTP 200` — confirms `/join` now behaves identically to the already-proven pattern |

**Full acceptance loop — real invite, real identity, real establishment:** a real `venue_staff` invite row was created (real `invite_token`, matching `inviteStaffMember`'s exact shape) at Sweet Daisy Barn & Farm by a real Manager session. A real auth user was created for the invited email, signed in, and called `accept_team_invitation` — the exact RPC `app/join/page.tsx` calls post-auth. Result: **8/8 checks passed** — the invitation accepted (`{ok:true, role:"staff", venueId:...}`), and the resulting `venue_staff` row was independently re-queried and confirmed correctly bound (`user_id` matches the new auth user, `is_active: true`, correct `venue_id`) — not just a truthy RPC response. **Negative case:** a second, unrelated identity's attempt to accept the same, already-claimed token was correctly rejected (`{ok:false, error:"invalid_or_expired_token"}`) — TR-G7's identity/claim protection holds. All fixtures cleaned up; zero residue.

### R3 — Contract / Payment / Team silent-false-success deletes (§B3)

**First, the inspection the task required, done before any fix:**

| Path | Who's allowed (intended) | UI on attempt | Backend before fix | RLS gate | App-layer role check |
|---|---|---|---|---|---|
| Contract delete | Owner/Manager (draft/cancelled only) | Shows "Contract deleted" regardless of outcome | Only checked `error`, unconditionally returned `{ok:true}` | ✅ `contracts_delete` (owner/manager) | ✅ `deleteContract_` in `service.ts` already blocks Coordinator/Staff *before* reaching the repository — confirmed by reading the call chain, correcting the original reconciliation's implication that the everyday UI path itself was unguarded |
| Payment line item / schedule delete | Owner/Manager (unpaid items only) | Same | Same | ✅ `payment_line_items_delete`/`payment_schedules_delete` | ✅ `deleteLineItem_`/`deletePaymentSchedule` in `service.ts` already block non-Owner/Manager first |
| Team remove/re-role | Owner (any); Manager (Staff/Coordinator only, never Owner/Manager) | Same shape | Same | ✅ `venue_staff_update` (mirrors `canManageStaff`'s own rule) | ✅ `canManageStaff()` already blocks disallowed actor/target combinations first |

**The real, live gap in every case was narrower than "any role can delete via the UI"** — the app layer already had its own correct role check in `service.ts` ahead of the repository call, in every one of the three cases. The genuine gap this reconciliation correctly identified is **defense-in-depth**: the repository function itself — the one thing standing between a direct RPC/REST call (bypassing `service.ts` entirely) and the database — silently reported success on a blocked mutation, matching the exact "the app appears to guarantee more than it enforces" shape Engineering Standard #3 exists to prevent. This is confirmed empirically below, not assumed.

**Fix, applied identically to all three (matching `deleteTemplate`'s already-correct pattern in the same `contracts/repository.ts` file):** every `.delete()`/`.update()` call now chains `.select("id")` and checks the returned row count. A 0-row result — RLS having silently blocked the mutation — now returns `{ok: false, message: "..."}` instead of an unconditional `{ok: true}`. No UI changes were needed anywhere: every caller already correctly surfaced `result.message` via toast on failure (confirmed by reading each one), so the fix is entirely contained to the four repository functions plus the two `lib/team/service.ts` functions that construct their own result shape inline.

**Validation — real per-role sessions against the live local database, not superuser bypass, not mocked:**

| # | Scenario | Result |
|---|---|---|
| 1 | Staff attempts `deleteContract` via the repository function directly (simulating a direct API/RPC bypass of `service.ts`'s own check) | ✅ `{ok:false, message:"Only an Owner or Manager can delete a contract."}`; row confirmed still present |
| 2 | Staff attempts a raw `client.from("contracts").delete()...` — no repository code involved at all | ✅ 0 rows affected, no error — RLS alone blocks it; row confirmed still present |
| 3 | Manager performs the same delete | ✅ `{ok:true}`; row confirmed actually gone |
| 4–6 | Same three scenarios, `payment_line_items` | ✅ all three match the Contract pattern exactly |
| 7 | Manager deletes a `payment_schedules` row with no paid items | ✅ `{ok:true}`; row confirmed gone |
| 8 | Manager attempts to alter the venue's own Owner's role | ✅ 0 rows, RLS blocks; Owner's role confirmed unchanged |
| 9 | Manager (Sweet Daisy Barn & Farm) attempts to deactivate the Owner at a **different** venue (The Pretty Platypus) | ✅ 0 rows, RLS blocks; target venue's row confirmed unaffected — cross-venue isolation holds |

**16/16 checks passed.** All fixtures created for this validation were cleaned up; zero residue left in the local database.

### R4 — Bounded regression sweep for the same defect class (§4 of the brief)

Per the explicit instruction to search for, but not broadly fix, the same pattern elsewhere: the original reconciliation's own §C already inventoried the full long tail (Invoices beyond what's below, Event Orders, Timeline, Floor Plans, Questionnaire Templates, and child-table cascades across ~15 more files). Re-applying the three-part test this pass was instructed to use —

1. clearly the same defect class,
2. customer/security/trust significant,
3. already within the release-readiness scope (i.e., the same trust tier — legal/financial/access-control primary records — as the three named blockers) —

surfaced exactly **one** additional qualifying instance: **`lib/invoices/repository.ts::removeLineItem`**. `invoice_line_items_delete_gate` is a real, live RESTRICTIVE Owner/Manager-only RLS policy (`20261002000000_tr_g6_core_object_delete_role_gate.sql`), and — unlike Contracts/Payments/Team — `lib/invoices/service.ts` had **no app-layer role check at all** ahead of it (only a draft-status guard), so this one was reachable through the *ordinary* UI path by any role, not just a direct-API bypass, and its own caller then went on to log a "line item removed" activity entry and enqueue a QuickBooks sync as if the removal had actually happened. Fixed with the identical `.select("id")` pattern; `lib/invoices/service.ts::removeLineItem` now checks the result before doing either of those follow-on actions. **Live-validated: 4/4 checks passed** (Staff blocked honestly with the row confirmed still present; Manager's delete confirmed to actually remove the row).

**Everything else identified in §C remains genuinely out of scope for this pass** and is restated, not silently dropped, in the Remaining Non-Blocking Debt list below: Event Orders (`removeSection`/`removeLine`), Timeline, Floor Plans, Questionnaire Templates, and the child/join-table cascades across `event-order-templates`, `pipeline-templates`, `message-sequences`, `message-templates` (attachments), `playbooks` (attachments/context-links), `saved-reports`, `leads`, `clients`, `events`, `vendors`, `inventory`, `event-inventory`. None of these guard a legal, financial, or access-control *primary* record the way Contracts/Payments/Team/Invoice-line-items do — they're either operational content or child/join rows — which is exactly the line this pass's own three-part test was built to draw. `lib/invoices/repository.ts::updateInvoiceStatus` was investigated and deliberately **not** touched: its `invoices_update` RLS policy has no role restriction at all (any authenticated venue member can update), so there is no silent-false-success gap to close there — its real, differently-shaped issue (the "void" transition's role gate exists only at the app layer, no RLS backstop, the same shape TR-G5 originally closed for refunds) is named here as a distinct finding for a future pass, not folded into this fix under the same banner.

### Regression result

- **Engineering Gate:** `next build` — **PASS** (verified twice, clean from scratch). `tsc --noEmit` — **PASS**, zero errors. Full test suite — **465/465 PASS**, 0 failures.
- **Product Gate:** staff invitation acceptance — **PASS**, full real-HTTP + real-RPC loop, including the negative case. Contract deletion — **PASS**, all role/path combinations. Payment deletion — **PASS**, all role/path combinations. Team deletion — **PASS**, including cross-venue isolation. Invoice line item deletion (R4 extension) — **PASS**.
- **Debt Gate:** no new debt introduced. Every fix is either a rows-affected check matching an already-shipped pattern, a type annotation correction matching a module's own documented invariant, a dead-code removal, or a one-line config/param fix. Three temporary validation scripts (`scripts/_recon-validate-*.mts`) were created for this pass's live testing and deleted immediately after use — none remain in the tree.

### Updated final status

## RELEASE READINESS — READY WITH NAMED CAVEATS

All three original release blockers are resolved and independently validated live, not just patched. This is **not** a bare READY: the caveats below are real, named, and load-bearing — this release is ready *with* them, not despite pretending they don't exist.

**Resolved release blockers:** `next build` failure (R1) · `/join` unreachable (R2) · Contract/Payment/Team silent-false-success deletes (R3) · Invoice line item silent-false-success delete (R4, same-class extension).

**Remaining non-blocking debt** (unchanged from §C/§F above, restated for completeness, not rediscovered):
- The delete-safety long tail on Invoices' `updateInvoiceStatus` (different shape — missing RLS backstop on the void transition, not silent-false-success), Event Orders, Timeline, Floor Plans, Questionnaire Templates, and child-table cascades across ~15 files.
- Ten migration-timestamp collisions across the repository's history — worth a `supabase migration list` check before the next deploy.
- Two over-broad `PUBLIC_PATHS` prefix entries (`/api/notifications`, `/api/tours`) — safe today only via independent internal checks, not by design.
- `STARTER-LIBRARY.md` documentation drift against several shipped starter families' real names/prices.

**Intentional deferrals** (unchanged from §D above): real Stripe and QuickBooks live-credential round-trip confirmation (both built and verified short of that); QuickBooks advanced sync; iCal/webcal sync; lead-to-team-member assignment routing; the notifications engine's tour-reminder Conversations bypass; the Launch Verification Script's human/device pass and dogfooding — genuinely outside what a codebase-level pass can close.

---

## FINAL BOUNDED HARDENING PASS (2026-08-11, later same day)

Second, explicitly-scoped remediation pass, requested after the prior REMEDIATION section above closed the 3 original blockers. Covers: the Invoice UPDATE/void RLS gap (upgraded from documented debt to a named release blocker), a bounded risk-classified delete-safety sweep of the remaining long tail, the two over-broad `PUBLIC_PATHS` entries, the migration-timestamp collisions, and `STARTER-LIBRARY.md` reconciliation. Nothing architectural was reopened; no new product surface was built.

### F1 — Invoice UPDATE / void RLS gap (upgraded to a release blocker)

**Investigation, done before any fix:** traced every write path to `invoices` (7 call sites across `lib/invoices/repository.ts` and `lib/payments/repository.ts`). Exactly one ever sets `status = 'void'` — `lib/invoices/service.ts::updateInvoiceStatus`'s `status === "void"` branch, which already has an app-layer Owner/Manager check (Work Package D8). No system/service-role/webhook path ever writes `void` — the payment-collection auto-transition (`reconcileInvoiceBalance`) only ever writes `status = 'paid'`. `invoices_update`'s RLS policy (`20260716000000_tr_g1_permissions_enforcement.sql`) had no role clause at all — any authenticated venue member could legitimately update non-void fields, but nothing at the database layer stopped a direct API call from writing `status = 'void'` past the app-layer check.

**Fix (`supabase/migrations/20261279000000_invoice_void_rls_backstop.sql`):** same shape as the already-shipped TR-G5 refund backstop — one added `WITH CHECK` condition on the existing `invoices_update` policy: `status <> 'void' or current_user_role() in ('owner', 'manager')`. Every other legitimate write (recomputing totals after a line-item edit, sending, reverting to draft, linking an Event Order, the payment-collection auto-transition to `'paid'`) is structurally unaffected — none of them ever touch `status = 'void'`. Dry-run tested transactionally before applying for real.

**Live validation (real per-role sessions, 8/8 checks passed):**

| # | Scenario | Result |
|---|---|---|
| 1 | Staff direct-table `status: 'void'` update | ✅ 0 rows, RLS blocks |
| 2 | Staff via the repository function directly (bypassing `service.ts`'s own check) | ✅ status unchanged |
| 3 | Manager (Sweet Daisy) attempts to void an invoice at a **different venue** (The Pretty Platypus) | ✅ 0 rows, cross-venue blocked |
| 4 | Manager voids via the real service function | ✅ succeeds, `status: 'void'` |
| 5 | Manager: legitimate `draft → sent` transition | ✅ unaffected, `is_couple_visible` correctly set |
| 6 | Coordinator: adds a line item to a draft invoice (`recomputeInvoiceTotals` write path) | ✅ unaffected, totals recompute correctly |
| 7 | Payment-collection auto-transition to `'paid'` (real `payment_line_items` marked paid, `reconcileInvoiceBalance` run) | ✅ unaffected, `status: 'paid'`, `balance_due: 0` |

Regression confirmed directly, not assumed: invoice display, payment collection, invoice generation, legitimate status transitions, and financial calculations (`recomputeInvoiceTotals`, `reconcileInvoiceBalance`) all continue to work exactly as before — only the one previously-unguarded transition is now blocked for non-Owner/Manager roles.

### F2 — Bounded delete-safety sweep

**Method:** rather than trust the original tail list's severity guesses, pulled the authoritative inventory of every RESTRICTIVE delete-role-gate in the schema (`grep` across all migrations for `as restrictive for delete`) and cross-referenced each named area's actual write path against it. A table with no restrictive gate has no role-based silent-false-success risk to fix — any authenticated venue member can legitimately perform that delete, so a missing rows-check there can't silently misreport a *blocked* action (the only remaining question, cross-venue leakage, is structurally foreclosed by every write path's own `.eq("venue_id", venueId)` scoping to the caller's own resolved venue).

| Area | Customer reachable | Authorization enforced (RLS gate) | False-success risk | Data sensitivity | Action |
|---|---|---|---|---|---|
| Timeline entries (`timeline_entries`) | Yes, any staff role via event Timeline UI | Yes — `timeline_entries_delete_gate` (Owner/Manager) | Real — was silent | Primary object (Commitment Lifecycle architecture) | **Fixed**, live-validated |
| Floor Plans (`floor_plans`) | Yes, any staff role | Yes — `floor_plans_delete_gate` | Real — was silent | Primary object, couple-shared | **Fixed**, live-validated |
| Floor Plan objects (`floor_plan_objects`, incl. bulk clear) | Yes, any staff role | Yes — `floor_plan_objects_delete_gate` | Real — was silent | Primary object content | **Fixed**, live-validated |
| Inventory Templates (`inventory_templates`) | Yes, any staff role | Yes — `inventory_templates_delete_gate` | Real — app-layer check existed, RLS backstop was silent | Primary/reusable template | **Fixed**, live-validated |
| Questionnaire Templates (`questionnaire_templates`) | N/A | Yes — `questionnaire_templates_delete_gate` | **None** — no hard-delete code path exists anywhere in the app (soft `is_archived` only, and that UPDATE has no role gate to bypass) | — | **Moot** — gate exists, unused by any app code; no fix needed |
| Timeline Templates (`timeline_templates`, parent) | N/A | Yes — `timeline_templates_delete_gate` | **None** — no hard-delete path exists (rename/set-default/patch only) | — | **Moot**, same reason |
| Floor Plan Templates (`floor_plan_templates`, parent) | N/A | Yes — `floor_plan_templates_delete_gate` | **None** — no hard-delete path exists | — | **Moot**, same reason |
| Event Orders (`event_order_sections`, `event_order_lines`) | Yes, any staff role | **No** — permissive venue-scoped only, no role restriction | **None** — nothing to silently bypass; any authorized delete legitimately succeeds | Operational (BEO structure) | Debt — not exploitable, no gate to violate |
| Event Order Template sections/lines | Yes | No | None | Child of an already-gated parent | Debt, same reason |
| Pipeline stages | Yes | No | None | Operational | Debt, same reason |
| Message sequences / steps | Yes | No | None | Operational | Debt, same reason |
| Message Template attachments | Yes, any staff role | Yes — `message_attachments_delete_gate` | Real — unfixed | Child of a template, staff-only content | Debt — real but bounded stakes, outside this pass's named scope |
| Playbook task attachments / event task context links | Yes | No | None | Operational | Debt, same reason |
| Saved Reports | Yes | No | None | Operational | Debt, same reason |
| Lead/Client/Event notes, key dates | Yes, any staff role | Yes — TR-G6 gates | Real — unfixed | Operational content, no legal/financial/couple-facing exposure | Debt — real but child-record stakes |
| Event team assignments | Yes, any staff role | Yes — `event_team_delete_gate` | Real — unfixed | Operational | Debt, same reason |
| Event↔vendor assignments | Yes, any staff role | Yes — `event_vendor_assignments_delete_gate` | Real — unfixed | Operational, but a silently-failed "unassign" could cause real day-of confusion | **Highest-priority item in the remaining debt list** — recommend first in any future sweep |
| Inventory items / Event Inventory items | Yes | No (Event Inventory's real protection is the finalized-immutability trigger, a different mechanism — D8) | None via this pattern | Operational/financial-adjacent | Debt, not exploitable via role bypass |

**Fixed and live-validated this pass (16/16 checks passed):** Timeline entry delete (Staff blocked/Manager succeeds), Floor Plan delete (same), Floor Plan object delete + bulk clear (including the correct "already-empty plan clears successfully for any role" edge case), Inventory Template delete (RLS-layer-only test, since the app-layer check was already correct).

**Explicitly not fixed, per the task's own three-part test** (customer-reachable AND (unauthorized/cross-venue possible OR false-success risk) → fix; else may remain debt): every ungated table above genuinely has no false-success risk to close, and every gated-but-child-record table (notes, tasks, key dates, attachments, sequences) is real debt but doesn't meet the bar of a primary legal/financial/access-control object the way Contracts/Payments/Team/Invoices/Timeline/Floor-Plans/Inventory-Templates do. Not manufactured into new work.

### F3 — `/api/notifications` and `/api/tours` PUBLIC_PATHS narrowing

**Inspection:** both prefixes covered a mix of genuinely-public and staff-only routes. `/api/notifications/process` (cron/manual-trigger, secret-guarded) and `/api/tours/book`+`/api/tours/slots` (public booking widget, embed-key-authenticated) genuinely need to bypass the login redirect. `/api/notifications/preferences`, `/api/notifications/read`, the bare `/api/notifications`, `/api/tours/outcome`, and `/api/tours/status` are all staff-only, cookie-session routes that were reachable through the prefix match only by coincidence — each independently checks `auth.uid()`/session internally, so nothing was ever exploitable, but the routing layer itself offered no defense.

**Fix:** replaced both bare prefixes with the exact sub-paths that need to be public (`/api/notifications/process`, `/api/tours/book`, `/api/tours/slots`), per the stated principle — `PUBLIC_PATHS` should contain only routes that genuinely need to bypass the normal redirect.

**Live HTTP validation against the running dev server (9/9 correct):**

| Route | Expected | Result |
|---|---|---|
| `GET /api/notifications/process` | Public | ✅ 200 |
| `GET /api/tours/slots` | Public | ✅ 200 |
| `POST /api/tours/book` (GET probe) | Public (route reached, wrong method) | ✅ 405, not a login redirect |
| `GET /api/notifications` | Now requires auth | ✅ 307 → `/login` |
| `GET /api/notifications/preferences` | Now requires auth | ✅ 307 → `/login` |
| `GET /api/notifications/read` | Now requires auth | ✅ 307 → `/login` |
| `PATCH /api/tours/outcome` | Now requires auth | ✅ 307 → `/login` |
| `PATCH /api/tours/status` | Now requires auth | ✅ 307 → `/login` |
| `GET /login` | Unaffected control | ✅ 200 |

### F4 — Migration timestamp collisions

**Investigation:** ran `supabase migration list --local` (the actual CLI tool, not a guess) — 428 total migration entries, **71 with an empty "remote" side** (present on disk, never recorded in this local DB's own `supabase_migrations.schema_migrations` tracking table, since this whole engagement has applied schema changes via direct `psql`, not the CLI's own apply path). Confirmed `schema_migrations.version` **is the primary key** — meaning two files sharing an identical leading timestamp *will* collide with a real `duplicate key value violates unique constraint` error the first time any target (fresh or existing) is migrated through the standard CLI path (`supabase db push`/`migration up`), independent of any environment's prior history. This is a genuine, mechanically-confirmed deployment risk, not a hygiene nitpick.

Of the 10 colliding groups (21 files): checked which of each pair's timestamps was already present as a tracked `version` in this local DB. **4 groups (`20261175`, `20261176` [3 files], `20261177`, `20261222`) have one side already recorded** under an empty `statements`/`name` (no way to determine *which* specific file that tracked version corresponds to without deeper forensic work) — renaming blindly here risks exactly the "rewrite already-applied history" the task warned against, so **these 4 groups were deliberately left untouched** and are named below as a remaining, understood risk. **The other 6 groups were completely untracked on both sides** — safe to resolve: renamed the second file in each pair by +1 second (content byte-identical, only the filename timestamp changed), confirmed no new collision introduced, updated the one doc (`docs/hello-to-cheers-starter-message-library-implementation.md`) that referenced an old filename by name.

**Resolved:** `20261243`, `20261245`, `20261257`, `20261258`, `20261262`, `20261268` (6 of 10 groups, 6 files renamed).
**Remaining, documented, not casually rewritten:** `20261175`, `20261176` (3-way), `20261177`, `20261222` — 4 groups where determining the already-tracked file requires content-forensic work (`statements` array is empty for all 4 in this local DB, so filename-vs-tracked-version can't be resolved by inspection alone). Recommend a dedicated pass before the *first* real `supabase db push`/`migration up` against any target — this is not blocking today since nothing in current local dev practice goes through that CLI path.

### F5 — `STARTER-LIBRARY.md` documentation reconciliation

Corrected against the real shipped starter master files (`lib/*/starters.ts`, `lib/questionnaire-family/definitions.ts`) — this was a forward-looking spec written before implementation, and real product decisions during the build reasonably diverged from it in several places (not a defect in either direction). Corrected: the master summary table (§2.1) and the per-family detail sections for Packages (§5.B — names/pricing model), Questionnaires (§5.F — 1 aspirational form → the real 3-family QST-CP/FD/PE model), FAQs (§5.C — full question-set replacement, already flagged as known debt in a prior implementation doc), Event Order Templates (§5.H — name + previously-missing EO-02), Timeline Templates (§5.K — names + previously-missing TL-03), Floor Plan Templates (§5.L — name + previously-missing FP-02), and Saved Reports (§5.N — ID scheme + date-preset corrections). Where full content wasn't reproduced (TL-03's multi-day activities, FP-02's layout, full FAQ answer text), each correction points to the real source file directly instead of creating a second copy that can drift the same way this one did. Not a line-by-line audit of the whole 1200-line document — §6–11 were not re-verified. No certified functionality was reopened; this was documentation-only.

### F6 — Stripe / QuickBooks / Launch Verification

**No code changes.** Swept every doc referencing "production ready" alongside Stripe/QuickBooks (`docs/venue-payment-processing-report.md`, `docs/rc-launch-validation-runbook.md`, `docs/product-completion-roadmap.md`) — all three are already correctly phrased as conditional ("once real credentials exist... if all steps pass, X is production-ready"), none claim current production-ready status. `docs/platform-status-snapshot.md`'s Stripe correction from the prior remediation pass (§E of this document, above) already stands and needed no further change. Confirmed `docs/platform-status-snapshot.md`'s Launch Verification / dogfooding items remain correctly named as not-yet-executed — no claim of completion was made or is being made here; this remains a genuine pre-launch operational gate this pass cannot close from a codebase read.

### Regression result (this pass)

- **Engineering Gate:** `next build` — **PASS**, clean. `tsc --noEmit` — **PASS**, zero errors. Full test suite — **465/465 PASS**. Migration dry-run tested transactionally before real application.
- **Product Gate:** Invoice void (8/8 live checks) · Timeline/Floor-Plan/Inventory-Template deletes (16/16 live checks) · PUBLIC_PATHS narrowing (9/9 live HTTP checks) — all passed against real per-role sessions and a real running dev server, not source inspection alone.
- **Debt Gate:** no new debt introduced. Migration renames are content-identical (filename only). Four temporary validation scripts created for this pass's live testing were deleted immediately after use.

### Final status after this pass

## RELEASE READINESS — READY WITH NAMED CAVEATS

Every named technical release blocker — the original 3 (build failure, `/join` routing, Contract/Payment/Team delete safety) plus the Invoice UPDATE/void RLS gap raised in this pass — is resolved and independently live-validated, not just patched. The bounded delete-safety sweep found and closed every instance that met the stated bar (customer-reachable, a real authorization gate to silently bypass, primary-object stakes); everything left is either structurally not exploitable (no gate exists) or genuinely lower-stakes child-record debt, both explicitly classified in the matrix above rather than assumed.

**Resolved:** original 3 blockers (§B1–B3 above) · Invoice UPDATE/void RLS backstop (F1) · Timeline/Floor-Plan/Inventory-Template delete-safety (F2) · `/api/notifications`+`/api/tours` PUBLIC_PATHS narrowing (F3) · 6 of 10 migration-timestamp collisions (F4) · `STARTER-LIBRARY.md` reconciliation (F5).

**Verified safe / documented, not fixed:**
- 4 migration-timestamp collision groups where the already-tracked file can't be determined without deeper forensic work — not blocking today, named for before the first real `supabase db push`.
- Event Orders sections/lines and the other ungated tables in the F2 matrix — structurally not exploitable (no RLS role gate exists to bypass).
- Gated-but-child-record debt (message attachments, lead/client/event notes and tasks, event team/vendor assignments) — real but bounded stakes; `event_vendor_assignments` flagged as the highest-priority item if this list is ever picked up again.
- `Invoices::updateInvoiceStatus`'s non-void transitions — no RLS role restriction exists (by design; any venue member can send/revert an invoice), so no silent-false-success gap exists there.

**Remaining launch gates (genuinely external, not code):**
- Live Stripe and QuickBooks credentialed round-trip confirmation — both fully built and verified short of live credentials.
- The Launch Verification Script's human/device pass — not executed, cannot be closed from a codebase read.
- Dogfooding — not started.

None of the three remaining launch gates are security, financial-integrity, authorization, build, or core-customer-journey defects — they are external preconditions (credentials) or operational validation steps (human hands on real devices) outside what any codebase-level pass, however thorough, can complete. Per the stated standard: **no known release-blocking security, financial, authorization, build, or core customer-journey defect remains.**
