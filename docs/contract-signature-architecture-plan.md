# Contract Signature Architecture — Implementation Plan

**Type:** Implementation specification only. No code, migrations, or schema in this document — nothing here has been built. Every design choice reuses an existing, already-proven pattern from this codebase; none of it proposes a generic e-signature platform.
**Companion document:** `docs/contract-electronic-signature-readiness.md` — read that first; every recommendation below is justified there, not re-argued here.
**Supersedes, in detail:** Workstream D of `docs/venue-white-label-collateral-implementation-plan.md`, which sketched venue-first signing before this deeper signature-mechanics pass existed. That document's product-decision flags are resolved here with a recommendation; its general shape (reuse the client's own pattern, RLS via one added `WITH CHECK` condition, etc.) is carried forward unchanged.

---

## 1. Signer Model

**New table: `contract_signers`.** One row per required signer per contract — venue and client signers share the same table (a `signer_type` column distinguishes them), because the evidentiary shape they need to capture is identical (Section 2/12 of the readiness doc) and a shared table avoids duplicating that shape twice.

**Conceptual columns** (not a migration — a specification of what the table needs to represent):
- `id`, `contract_id` (FK to `contracts`)
- `signer_type` — `'venue' | 'client'`
- `signer_role` — for client signers, resolved from the existing `client_contacts.relationship`/`role_label` (reuse, don't re-invent); for venue signers, the venue-staff role at the time of signing (`owner`/`manager`)
- `signer_ref_id` — for client signers, a FK to `client_contacts.id` (or, for a contract's primary contact with no distinct `client_contacts` row, a FK to `clients.id` directly — confirm which is more common in practice before finalizing this union shape); for venue signers, a FK to the `venue_staff`/`auth.users` identity that signed
- `signer_name`, `signer_email` — captured *at the moment of signing*, copied from the resolved identity above, not re-typed free text for client signers (closes the readiness doc's Section 14 P1-3 gap) — **the client's typed-name field in the UI becomes a confirmation step, not the system of record for who they are**
- `is_required` — supports a contract with an optional cc'd signer in the future without forcing every signer to block finalization; default `true` for anyone actually added as a signer at creation time
- `sign_order` — an integer, used only to express "venue must precede all client signers"; client signers among themselves all share the same order value (parallel, per Section 9 of the readiness doc) unless a future contract genuinely needs client-side sequencing
- `sign_token` — one per signer, not one shared per contract (**a real change from today's model**, where a single `contracts.sign_token` is shared by whichever one client visits it) — each signer gets their own unique, single-use link
- `signed_at`, `signer_ip`, `signer_user_agent`, `consent_confirmed`, `consent_text` (the exact wording shown at that moment — closes readiness doc Section 12's "consent version" recommendation)
- `content_hash` — SHA-256 (or equivalent) of `contracts.content` at the exact moment this specific signature was captured (closes the readiness doc's single strongest finding, Section 4/14 P1-1)

**Why a new table and not new columns on `contracts`:** `contracts` already has exactly one signer's worth of columns (`signer_name`/`signer_ip`/etc.) — extending that shape to "one venue signer + N client signers" by adding more singular columns doesn't generalize. A child table is the same pattern this codebase already uses everywhere else a "one row grows to many" situation has come up (`contract_activities`, `payment_line_items` under `payment_schedules`, `event_order_lines` under `event_order_sections`) — reuse that shape, don't invent a new one.

**What stays on `contracts` itself:** `status` (see Section 4 below — kept small, not grown), `sign_token` is **deprecated in favor of per-signer tokens** but should not be dropped in the same pass that adds the new table (a contract already `sent` under the old model needs to keep working through its own lifecycle without a disruptive mid-flight migration — see Section 9, Failure/Retry, for how to handle in-flight contracts).

---

## 2. Venue Signer

A venue signer is just `signer_type='venue'` in the table above. The signing action itself:

- **New repository function**, mirroring `lib/contracts/repository.ts::updateContractStatus`'s exact shape (read current state → validate the transition is legal → write → return `{ok, message}`, never throw for an expected rejection).
- **New service function**, `venueSignContract`, mirroring `deleteContract_`'s exact role-check shape: `getCurrentUserRole()`, reject unless `owner`/`manager` (per the readiness doc's Section 8 recommendation — **PRODUCT DECISION: confirm Owner/Manager before implementing; if product wants any staff role to be able to sign for the venue, this is a one-line change to the check, but should be a deliberate choice, not a default**).
- Captures the exact same evidence shape as the client's own `sign_contract` RPC (IP/UA/timestamp server-derived, explicit consent checkbox, content hash) — **do not build a lighter-weight venue signature "because it's internal."** The venue's commitment deserves the same evidentiary rigor as the client's, especially since it's the one that gates release.
- UI: a new action on `components/contracts/contract-detail.tsx`, visible only when the contract is `draft` (or whatever the new pre-release state is called) and the current user is Owner/Manager. Shows the exact same contract content the client will see (this is the "venue reviews" step from the brief — it should render the *actual* customer-facing representation, not a separate internal preview, so there's no possibility of the venue signing off on something different from what the client sees).

---

## 3. Multiple Client Signers

Resolved from `client_contacts` at contract-creation time (Section 1 above), not entered free-text. **New UI at contract creation**: when a client has more than one active `client_contacts` row (or the client + a populated `partner_email`), the venue is prompted to select which are required signers for *this* contract — never auto-selected as "all of them," per the readiness doc's explicit instruction not to assume "couple = two signers."

**Each client signer gets their own unique `sign_token`** (Section 1) and their own email with their own link — **this is a real behavior change from today**, where one shared link goes only to `client.email`. If a second signer has no email on file (a `client_contacts` row missing `email`), the contract cannot add them as a required signer until one is provided — surface this as a clear validation error at signer-selection time, not a silent skip.

**Parallel, not sequential, among client signers** (readiness doc Section 9) — each client signer's link is live as soon as the venue has signed and the contract is released; nothing blocks Signer 2 from completing before Signer 1.

---

## 4. Status / State Model

**Recommend keeping `contracts.status` at its current five values, semantically tightened rather than expanded:**

| Status | Old meaning | New meaning |
|---|---|---|
| `draft` | Working, editable | Working, editable — **now also covers "awaiting venue signature"** |
| `sent` | Sent to client, awaiting their signature | **Now means: venue has signed, released to client(s), awaiting completion of all required client signers** |
| `signed` | Client signed | **Now means: all required signers (venue + every required client signer) have completed — fully executed** |
| `cancelled` | Cancelled from draft/sent | Unchanged |
| `expired` | (already existed, not currently enforced per the readiness doc — a separate, smaller finding) | Unchanged |

**The transition `draft → sent` now requires the venue-signature to exist first** — this is the one real change to `updateContractStatus`'s guard logic: `sent` should only be reachable if a `contract_signers` row with `signer_type='venue'` and a non-null `signed_at` exists for this contract. **The transition `sent → signed` now requires every `is_required=true` client `contract_signers` row to have a non-null `signed_at`**, not just one signature the way the old `sign_contract` RPC assumed.

**Derived, UI-only state** (not a new column, not a new enum value — computed at read time, per Engineering Standard #10, already established in this codebase): "Awaiting venue signature" / "Awaiting Jane's signature (1 of 2)" / "Fully executed" — computed by joining `contracts.status` against the `contract_signers` rows' completion state, shown on the Contract Detail page and anywhere else a contract's status is currently surfaced.

**Why not a `venue_signed` status value:** flagged as the alternative in the readiness doc; rejected here as the default recommendation specifically because it would require auditing every existing `status`-filtering consumer (reports, dashboards, the contracts list page) for whether it needs to learn a sixth value, versus the tightened-semantics approach, which only changes *when* `sent`/`signed` are reached, not what querying for them means downstream.

---

## 5. Authorization / RLS

**New RLS policy on `contract_signers`:** `venue_id`-scoped (via a join back to `contracts.venue_id`, the same pattern `payment_line_items`/`invoice_line_items` already use for their own parent-scoped RLS), `SELECT` open to any authenticated venue staff (matching `contracts_select`'s own current shape — no role restriction there today), `INSERT`/`UPDATE` restricted so that a `signer_type='venue'` row can only be written by a session whose `current_user_role()` is `owner`/`manager` — **the exact `WITH CHECK` addition pattern already proven twice this engagement** (TR-G5's refund backstop, this pass's own Invoice-void-RLS fix): one added condition on an existing-shaped policy, not a bespoke new mechanism.

**The client-signer completion RPC** (the successor to today's `sign_contract`) stays `SECURITY DEFINER`, anonymous, token-validated — exactly like today's, just now keyed on the new per-signer `sign_token` instead of the shared `contracts.sign_token`.

**Existing RLS this must not weaken:** `contracts_update`'s current guard (venue-scoped) and the Invoice-void-shaped backstop pattern generally — this workstream adds a new gate, it does not touch any existing one.

---

## 6. Evidence / Immutable Artifact / Content Snapshot

Per the readiness doc's Section 12 recommendation, adopted here as the spec:

- Every signature event (venue or client) computes and stores a content hash of `contracts.content` **at that exact moment**, on its own `contract_signers` row.
- The venue's own signature hash and every client signer's hash should all match once fully executed (since content is guard-blocked from changing between signatures) — **a validation worth adding at the `sent → signed` (fully-executed) transition itself: if any two signers' stored hashes don't match, treat this as a genuine integrity failure and block the transition rather than silently finalizing** (this would only ever fire if the existing `draft`-only edit guard had a gap somewhere — exactly the kind of defense-in-depth this engagement has repeatedly favored: don't just trust the guard, verify its own guarantee at the moment it matters most).
- **Finalize (`lib/contracts/finalize.ts`) stays the PDF-generation trigger point** — no change to *when* the durable PDF file is created, only to what precedes it. The content-hash addition above is a lightweight, fast, always-on check; it does not replace Finalize's own real PDF artifact, it protects the integrity claim *before* that artifact is ever generated.

---

## 7. Audit Trail

**`contract_activities` gains an actor column** — a real, pre-existing gap (readiness doc P1-5) that this workstream cannot produce a trustworthy signing audit trail without closing. Every existing call site that inserts a `contract_activities` row (there are several — created, sent, signed, cancelled, reopened, finalized) should be updated to pass the current actor (a `venue_staff`/`auth.users` id for authenticated actions, `null`/a signer reference for the anonymous client-signing event) — this is a mechanical, low-risk change to an already-simple insert pattern, not a redesign.

---

## 8. Notification Sequencing

- **Venue signs** → no external notification needed (the venue already knows they just signed) — but an internal `contract_activities` entry, per Section 7.
- **Release to client(s)** → each required client signer receives their own branded invite email (reusing `lib/email/contract-invite.ts`'s existing template, parameterized per-signer rather than only ever `client.email`) with their own unique link.
- **Each client signer signs** → the venue is notified per-signature (today's `create_venue_notification` call, extended to fire once per signer rather than assuming exactly one), so a venue with two required signers sees "Jane signed" and later "John signed" as two distinct events, not one conflated notification.
- **All required signers complete** → a distinct "fully executed" notification to the venue, separate from the individual per-signer notifications — this is the actual "the deal is done" moment and deserves its own signal, not to be inferred from the last individual signature notification alone.

---

## 9. Failure / Retry Behavior

- **A client signer's link fails to deliver** (email bounce, wrong address) — the venue should be able to see per-signer delivery status (reuse the existing `notification_log`/delivery-tracking pattern already established for tour confirmations and other transactional email in this codebase, per `docs/trust-risk-register.md`'s TR-B2/TR-B3 fixes) and resend to a corrected address without needing to recreate the whole contract.
- **A signer attempts an already-used or invalid token** — return the same honest, non-revealing failure the current `sign_contract` RPC already returns (`{ok:false}`, no detail leaked about why) — do not weaken this.
- **In-flight contracts at migration time:** any contract already `sent` under the *old* single-signer model when this ships should be allowed to complete its lifecycle under the old rules (its existing shared `contracts.sign_token` keeps working) rather than being forcibly migrated into the new per-signer model mid-flight — **a real migration-sequencing decision the implementer must make explicitly, not assume away.** The simplest safe approach: only contracts created *after* this ships use the new `contract_signers` flow; anything already in `sent` status at cutover finishes under the legacy path, and the legacy `sign_contract` RPC is not removed until nothing is using it anymore (confirm via a real query before ever dropping it).

---

## 10. Cancellation / Withdrawal

**Cancellation** — `cancelContract`'s existing guard (`draft`/`sent` only, never `signed`) is already correct and needs no change in shape, only in which underlying `contract_signers` state it should also account for: cancelling a contract that has a venue signature but no client signatures yet should be allowed (nothing binding has happened on the client side) and should record why the venue signature is now moot, rather than silently orphaning it.

**Withdrawal of a single required signer** (e.g., a required co-signer needs to be swapped mid-flight, before they've signed) — not explicitly asked for in the brief, but a real edge case worth naming: recommend this is out of scope for the first build (a venue that needs to change required signers before anyone has signed can cancel and recreate; changing signers mid-signature-collection is a genuinely harder problem, deliberately deferred, not silently unsupported without saying so).

---

## 11. Amendment / Version Dependency

**No new dependency — the existing `amends_contract_id` mechanism (gated to Document-Domain-`finalized`, confirmed live and correctly untouched by this workstream) continues to work exactly as it does today.** An amendment is a brand-new `contracts` row; it goes through the *entire* new venue-first-then-client flow itself, from scratch, exactly as a first-time contract would — it does not inherit or reuse its predecessor's `contract_signers` rows in any way. This requires no change to `createAmendmentFromContract`'s own logic beyond it now producing a contract that (like any new contract) starts in the pre-venue-signature state rather than `draft` meaning "just send it."

---

## 12. Acceptance Criteria

1. A contract can be created, and the venue can review the exact customer-facing representation before doing anything else.
2. An Owner/Manager (and no other role, unless product explicitly widens this) can sign as the venue; the action is blocked server-side (not just hidden in the UI) for any other role, verified via a direct API/RPC attempt, not just the UI.
3. Once venue-signed, the contract's content cannot be edited (mirrors the existing `draft`-only guard, extended one state earlier).
4. Release to client(s) only becomes possible after venue signature; each required client signer receives their own unique, working link.
5. Each client signer can complete independently (parallel); the contract only reaches "fully executed" once every required signer — venue and all required clients — has signed.
6. A fully-executed contract's content and every signer's stored content-hash all match; any mismatch blocks the transition rather than silently completing.
7. Finalize (PDF generation) continues to work exactly as today, now firing from the new "fully executed" state.
8. A later venue-branding change does not alter the already-generated PDF or any already-recorded `contract_signers` evidence (reuses the already-proven Contract snapshot behavior, unaffected by this workstream).
9. A legitimate post-execution change goes through the existing, unmodified amendment path, producing a brand-new contract that itself requires a fresh venue-then-client signing cycle.
10. `contract_activities` records an identifiable actor for every event type, not just the new signing ones.

---

## 13. Validation Plan

**Browser/real-session validation** (the certification's own established methodology throughout this engagement — real authenticated sessions, never superuser bypass):
1. Create a working contract as a real Owner/Manager test account; confirm the review UI shows the exact real merge-resolved content.
2. Sign as the venue; confirm the action is rejected for a real Coordinator/Staff test session first (negative case), then succeeds for Owner/Manager.
3. Confirm the contract cannot be edited post-venue-signature (attempt via the existing `updateContractContent_` action; confirm rejection).
4. Confirm each of two real, distinct test client contacts receives their own working, distinct signing link.
5. Sign as each client signer independently (parallel); confirm the contract does not reach "fully executed" until both have completed.
6. Confirm the venue receives a distinct notification per client signature, plus one final "fully executed" notification.
7. Finalize; confirm the resulting PDF matches the signed content exactly.
8. Change the venue's branding; re-view the already-finalized contract; confirm no change.
9. Create an amendment from the finalized contract; confirm it starts a fresh, independent venue-then-client cycle, not inheriting any prior signatures.

**API/adversarial validation** (the class of test this engagement has repeatedly used to catch exactly this kind of gap — see the Trust Risk Register's own methodology):
1. Attempt to call the new venue-signing RPC/action directly as a non-Owner/Manager session (real role, not superuser) — confirm server-side rejection, not just UI absence.
2. Attempt to reuse an already-consumed per-signer `sign_token` — confirm rejection, matching today's proven single-use behavior.
3. Attempt to submit a client signature with a tampered/mismatched IP or user-agent header — confirm these remain server-derived, not client-influenceable (should already be true by construction; verify it stays true in the new implementation).
4. Attempt a direct-table `UPDATE` against `contract_signers` as an unauthorized role (a Staff session, or a Manager attempting to write a `signer_type='venue'` row) — confirm the RLS `WITH CHECK` backstop blocks it, independent of whatever the application-layer check does, per this engagement's own "two enforcement layers" standard (Engineering Standard #3).
5. Attempt to transition `draft → sent` via a direct API call while no venue-signature row exists — confirm the new guard blocks it.
6. Attempt to transition `sent → signed` (fully executed) while a required client signer is still missing — confirm blocked.

**Acceptance for this plan overall:** every item in Section 12 verified live, not assumed from source inspection — matching the standard every other workstream in this program has been held to.

---

## Explicitly out of scope for this build

A generic e-signature platform usable for arbitrary document types beyond the Wedding Venue Agreement contract; a third-party e-signature provider integration; drawn/image-based signature capture; sequential (as opposed to parallel) client-side signing; signer withdrawal/mid-flight substitution; any change to the Document Domain's own finalization mechanics beyond what's needed to gate on the new signer-completion check. If any of these become genuinely necessary, they are separate, later decisions — not silently bundled into this one.
