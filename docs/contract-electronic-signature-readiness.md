# Contract Electronic Signature & Signer Model — Readiness Assessment

**Type:** Read-only product/technical/legal-readiness audit. No code, schema, or content was changed to produce this report.
**Date:** 2026-08-11
**Companion documents:** `docs/venue-white-label-collateral-certification.md` (Section H/I/J — the prior audit that first surfaced the venue-first-signing gap), `docs/venue-white-label-collateral-implementation-plan.md` (Workstream D — the prior, now-superseded-in-detail sketch of a venue-signing build). This document is the deeper, authoritative pass on signature mechanics specifically; the implementation plan companion to *this* document is `docs/contract-signature-architecture-plan.md`.
**Legal disclaimer, stated once here and implied throughout:** this document is a product/technical readiness analysis, not legal advice. Every claim about what U.S. federal or state law generally requires is sourced to the FTC and standard summaries of the E-SIGN Act and UETA (cited in Section 5); no claim here should be treated as a legal opinion about Hello to Cheers's own compliance, and nothing in this document should be published to customers without the specific attorney-review flags in Section 13 being honored.

---

## 1. Current Signing Architecture

Traced directly from `/sign/[token]` (`app/sign/[token]/page.tsx`) through `sign-form.tsx` → `actions.ts` → `lib/contracts/service.ts::signContractByToken` → the `sign_contract` Postgres RPC (read via `\sf sign_contract` against the live database, not inferred from application code alone) → `contracts` table → `contract_activities`.

**The full, current flow, exactly as it runs today:**
1. A venue user creates a working contract (`createContract`) from a template; unresolved merge tokens block creation outright.
2. `sendContract` transitions `draft → sent`, publishes the first Document Domain version of the content, and emails `client.email` a link: `{baseUrl}/sign/{contract.sign_token}`.
3. The recipient opens the link — **no authentication of any kind is required or possible.** The page (`page.tsx`) fetches the contract by token via `getContractByToken`, displays the full contract text, and shows `SignForm`.
4. The signer types their name into a plain text field and checks a single consent checkbox reading "I agree this constitutes my legal signature on this agreement."
5. On submit, `signContractAction` → `signContractByToken` reads `x-forwarded-for` and `user-agent` from the actual request headers (server-derived, not client-supplied — confirmed) and calls `sign_contract(p_token, p_signer, p_ip, p_user_agent, p_consent)`.
6. The RPC (SQL, confirmed via direct database introspection):
   - Rejects immediately if `p_consent` is false.
   - Looks up the contract `where sign_token = p_token and status = 'sent'` — if no row matches (wrong token, already signed, cancelled, or never sent), the call fails with no further detail.
   - Updates the row: `status='signed'`, `signer_name = trim(p_signer)`, `signed_at = now()`, `signer_ip`, `signer_user_agent`, `consent_confirmed`.
   - Inserts one `contract_activities` row (`type='signed'`).
   - Notifies the venue coordinator and fires a Luv celebration.
7. Separately, and only later, an authenticated venue user must explicitly click "Finalize" (`lib/contracts/finalize.ts::finalizeContract`), which regenerates the PDF from the *current* database content, uploads it once to storage, and locks the Document Domain record.

---

## 2. Authentication / Token Analysis

Answered directly against the verified code and schema, in the order asked:

1. **Token generation:** `sign_token uuid not null default gen_random_uuid()` — Postgres's cryptographically-random UUIDv4 generator (122 bits of entropy). Not sequential, not derivable from the contract ID or any other visible value.
2. **Entropy:** Strong. A UUIDv4 is not brute-forceable in any practical sense.
3. **Expiry:** **A `contracts.expires_at date` column exists on the table but is never read by `sign_contract` or `getContractByToken`.** Confirmed by direct grep across the entire signing path — the field is mapped through to the application type layer but never used as an access-control check anywhere. **The sign link functionally never expires**, regardless of what `expires_at` displays in the UI (if it's displayed at all — not independently verified this pass). This is the same "field exists but nothing enforces it" pattern already found and fixed once in this codebase (`TR-B5`, `date_holds.expires_at`).
4. **Single-use:** Yes, functionally — enforced correctly. The RPC's `where ... and status = 'sent'` clause means a second signing attempt on an already-signed contract finds zero matching rows and fails. This is genuine, working single-use enforcement, just achieved via the status guard rather than a dedicated "token consumed" flag.
5. **Tied to a specific contract:** Yes — `sign_token` is a column on the specific `contracts` row with a `UNIQUE` constraint.
6. **Tied to a specific intended signer:** **No.** Nothing on the `contracts` row records who the token was *for* beyond the linked `client_id`, and the RPC never compares the submitted name against any expected value.
7. **Tied to an email address:** **No.** The contract has no "expected signer email" field at all; `p_signer` is unconstrained free text.
8. **How the URL is delivered:** Email only, to `client.email` (the client's primary email on file), via the branded `contract-invite` email. No SMS delivery path found for this specific link.
9. **Must the signer authenticate:** No — by design, matching the pattern the codebase already uses for the analogous public token flows (`/p/[token]`, `/book/[key]`, `/rsvp/[token]`).
10. **Can the link be forwarded:** **Yes, with no technical barrier.** Since the token is neither email-bound nor session-bound, anyone possessing the raw URL can open it and sign, whether that's the intended client, a different member of the couple who wasn't sent the link, or (in the worst case) anyone who obtained the link some other way.
11. **Evidence the intended signer performed the action:** None beyond the typed name itself and whatever inference can be drawn from IP/user-agent (e.g., if it matches a device/location plausibly associated with the client — not something the system itself checks or surfaces).
12. **Evidence of intent:** The explicit consent checkbox, its exact wording, and the fact that it's a required, separate, affirmative action (not pre-checked, not implied by clicking "Sign") — this is a genuine, real intent signal, correctly implemented.
13. **Evidence retained after signing:** `signer_name`, `signed_at`, `signer_ip`, `signer_user_agent`, `consent_confirmed` — all five persist on the `contracts` row indefinitely (no TTL/purge found).
14. **Is IP server-derived:** Yes — read from `x-forwarded-for` inside the Next.js server action, not accepted as a client-submitted parameter.
15. **Is user-agent server-derived:** Yes — same mechanism, from the actual request headers.
16. **Is timestamp server-derived:** Yes — `now()` inside the SQL function, not a client-supplied value.
17. **Is the signer name trusted or self-entered:** **Purely self-entered, with no verification of any kind** against a known identity (no comparison to `client.firstName`/`lastName`, no comparison to `client_contacts`, nothing).
18. **Does the system record signer email:** **No.** This is a real, notable gap — the one piece of contact information the system already has on file for the recipient (the email the invite was sent to) is never captured alongside the signature event itself.
19. **Does the system record authenticated user identity:** N/A — there is no authentication step for the client signer by design (correctly so, matching every other anonymous customer-facing token flow in this codebase).
20. **Can a signed contract be signed again:** No — confirmed blocked by the RPC's own status guard (see #4).
21. **Can a signed contract be modified:** No — `updateContractContent_` and `deleteContract_` are both confirmed `draft`-only (TR-L1/TR-L2, re-verified live in the prior white-label/contract-lifecycle audit).
22. **Is the exact signed content preserved:** **Not distinctly.** See Section 4 — this is the most important open question in this document.

---

## 3. Evidence Matrix

| Evidence element | Captured? | Source | Notes |
|---|:---:|---|---|
| Signer's typed full name | Yes | User input, unverified | No cross-check against any known identity |
| Signer's email | **No** | — | Not captured at all, despite being on file |
| Explicit, separate consent action | Yes | Required checkbox, blocks submission if unchecked | Real, correctly implemented |
| IP address | Yes | Server-derived (`x-forwarded-for`) | Not client-supplied — trustworthy as far as IP addresses go |
| User-agent | Yes | Server-derived | Same |
| Server timestamp | Yes | `now()` in the SQL function | Trustworthy |
| Signing token binding to a specific contract | Yes | `sign_token` UNIQUE column | Strong |
| Signing token binding to a specific signer identity | **No** | — | Anyone with the link can sign as anyone |
| Content the signer actually saw | Partially | `contracts.content` at the time of page render | See Section 4 — not independently frozen at the *moment of signing* |
| Audit log of the signing event | Yes | `contract_activities` row, `type='signed'` | **No actor/identity column on this table at all** — every activity type, not just signing, lacks this |
| Re-signing / tampering protection | Yes | RPC status guard | Genuinely single-use |
| Post-signature content immutability | Yes | `draft`-only edit/delete guards | Confirmed live |
| Record retention/access | Yes | Persists indefinitely on the row; PDF generated later, at Finalize | See Section 4 for the timing gap |

---

## 4. Signed-Content Integrity Analysis

**The suspicion this audit set out to verify is confirmed true, precisely stated: at the moment a signature is captured, no PDF, hash, checksum, or content snapshot is created. The signature event updates `contracts.content`'s parent row's status; it does not independently freeze or fingerprint `content` itself.**

What this means precisely: `signer_name`/`signed_at`/`signer_ip`/`signer_user_agent`/`consent_confirmed` are written to the **same row** whose `content` column holds the contract text. Nothing at the moment of signing computes a hash of `content`, stores a copy of it elsewhere, or otherwise creates an artifact that says "this exact text, at this exact byte level, is what was agreed to." The only thing preventing `content` from silently drifting after signing is the separate, correctly-working `draft`-only edit guard (Section 2, #21) — which is a real and effective protection, but it is a *behavioral* guarantee (the API refuses to change it), not an *evidentiary* one (there is no independent proof of what the content was at signing time, only trust that the guard has always worked and always will).

**The PDF does eventually get created — at Finalize, not at Signing** (`lib/contracts/finalize.ts`), which reads `contract.content` *at that later moment* and renders it. Because content cannot change between `signed` and `finalized` (the edit guard blocks it), the PDF that results is, in practice, faithful to what was actually signed — **but this is true by absence of a bug, not by design of a snapshot.** If the edit guard were ever to have a gap (the kind of gap this exact engagement has found and closed several times elsewhere in this codebase for other tables), there would be nothing else standing between a signed contract and a silently altered one — no independent hash to detect the drift, no stored copy from the moment of signing itself.

**Evidentiary implication, stated carefully, not overstated:** this is not "the system has no record of what was signed" — the content is real, persisted, and (correctly) protected from ordinary edit paths. It is "the system's guarantee that the signed content matches the finalized PDF rests entirely on one access-control guard holding, rather than on an independent, tamper-evident artifact created at the moment of the signing event itself." UETA's own record-retention principle (Section 5) speaks directly to this: a retained record should "accurately reflect the information... after it was first generated in its final form" — the *first final form* here is genuinely the moment of signing, and nothing is generated at that specific moment to anchor that claim independently of the live database row.

---

## 5. U.S. Electronic-Signature Legal Framework

**Not legal advice — a plain-language summary of publicly available regulatory guidance, for product-readiness purposes only.**

**Federal — the E-SIGN Act (Electronic Signatures in Global and National Commerce Act, 2000).** Per FTC guidance, an electronic signature is valid when there is genuine **intent to sign** (a typed name, a drawn signature, or a clearly-labeled "Accept" action can all satisfy this) and **consent to conduct the transaction electronically**. Separately, where a law requires a record be provided in writing, ESIGN requires the recipient's consent be obtained in a way that "reasonably demonstrates" they can actually access the electronic form being used. General compliance guidance (not a strict textual requirement of the Act itself, but the practical standard businesses are held to) is that an **audit trail linking the signature to the signer's identity and intent** should be maintained.

**State — the Uniform Electronic Transactions Act (UETA), adopted with variations by most U.S. states (a small number, including New York, use their own separate state e-signature statute instead of adopting UETA).** UETA's core attribution principle: a signature is attributable to a person if it was genuinely "the act of that person" — and critically, **UETA allows this to be shown "in any manner,"** including (per standard practice under the Act) security procedures, unique identifiers (an email address, an IP address, login credentials), or a technical process demonstrating only the authorized person could have signed. UETA's record-retention principle: a retained electronic record must accurately reflect the information "after it was first generated in its final form" and remain accessible for later reference.

**What this means for a product-readiness read (not a legal opinion) of the Hello to Cheers implementation, mapped directly to Section 2/3/4's findings:**
- **Intent and consent** are both genuinely, correctly captured (the explicit checkbox, the affirmative "Sign Agreement" click).
- **Attribution** is the weakest link relative to both frameworks' own stated standards: UETA explicitly contemplates security procedures, unique identifiers, or technical processes as the *evidence* of attribution — Hello to Cheers today has IP/user-agent/timestamp (genuine technical evidence) but explicitly lacks the "unique identifier" UETA calls out by name as a standard method (an email address tied to the actual signing act, not just to where an invite was sent).
- **Record retention / "final form"** is the second weakest link — UETA's own "first generated in its final form" language maps almost exactly onto the Section 4 gap: nothing is generated in a final, fixed form *at* the moment of signing.

**This is a real, honest gap relative to what a sophisticated venue operator (or their own attorney) would expect from a modern e-signature product, but it is not a claim that current signatures are legally invalid** — ESIGN/UETA's own standards are explicitly permissive about *how* attribution and intent are shown ("in any manner"), and what Hello to Cheers has today (typed name + explicit consent + server-derived IP/UA/timestamp + single-use token + append-only audit entry) is a real, non-trivial evidence set, just a thinner one than the strongest available under the law's own contemplated methods.

**Sources:**
- [US electronic signature laws and history — Docusign](https://www.docusign.com/learn/esign-act-ueta)
- [Joint FTC/Commerce Department Report on the "Reasonable Demonstration" Requirement of ESIGN — Federal Trade Commission](https://www.ftc.gov/news-events/news/press-releases/2001/06/joint-ftccommerce-department-report-released-reasonable-demonstration-requirement-esign)
- [Electronic Signature Laws & Regulations — United States — Adobe](https://helpx.adobe.com/legal/esignatures/regulations/united-states.html)
- [Uniform Electronic Transactions Act (1999), full text — Uniform Law Commission, via CMU](https://euro.ecom.cmu.edu//program/law/08-732/Transactions/ueta.pdf)
- [Uniform Electronic Transactions Act — Wikipedia](https://en.wikipedia.org/wiki/Uniform_Electronic_Transactions_Act)
- [What's the difference between UETA and E-Sign Act? — Adobe Acrobat](https://www.adobe.com/acrobat/business/hub/difference-between-esign-act-vs-ueta.html)

---

## 6. Current Strength Assessment

| Requirement / Evidence | Current Implementation | Strength | Gap |
|---|---|:---:|---|
| Intent to sign | Explicit "Sign Agreement" click, required consent checkbox | **Strong** | None |
| Explicit consent | Separate, required, unchecked-by-default checkbox with specific legal-signature language | **Strong** | None |
| Signer attribution | Self-entered name only, no cross-check | **Weak** | No email capture, no identity verification of any kind |
| Signer identity | Not verified against any known record | **Weak** | Same as above |
| Signing token security | UUIDv4, single-use via status guard | **Strong** | Not expiry-enforced (field exists, unused); not email-bound |
| Authentication | None (by design, appropriate for this transport) | **Adequate** | Appropriate for the pattern, but means the token *is* the entire access control |
| IP evidence | Server-derived, real | **Strong** | None |
| User-agent evidence | Server-derived, real | **Strong** | None |
| Server timestamp | Real, trustworthy | **Strong** | None |
| Audit event | Recorded, but no actor field on the table at all | **Adequate** | Cannot distinguish who/what triggered non-signing activity types either — a pre-existing, broader gap |
| Content association | Same row, not independently frozen at signing | **Weak** | See Section 4 |
| Immutable signed representation | Real, but arrives at Finalize, not at Signing | **Adequate** | Correct end state, wrong trigger point |
| Re-sign protection | Confirmed working | **Strong** | None |
| Post-sign modification protection | Confirmed working (`draft`-only guards) | **Strong** | None |
| Record retention/access | Persists indefinitely, no PDF until Finalize | **Adequate** | Depends on Finalize actually being performed — a signed-but-never-finalized contract has no durable file artifact at all |

---

## 7. Client Signer Recommendation

**Do not hardcode "exactly one" or "exactly two" client signers.** Both product research (Section 8 below) and the existing codebase argue against a fixed number. Recommend: **a contract records one or more required client signers, each independently resolved from the existing `client_contacts` table** (already a real, working multi-person-per-client model with `first_name`/`last_name`/`email`/`relationship`/`role_label`/`is_primary` — confirmed live in the schema) **rather than re-collecting free-text name/email per signer.** A contract created against a client with only a primary contact defaults to one required client signer; a contract created against a client with multiple active `client_contacts` rows (e.g. both partners, or a paying parent) should let the venue explicitly choose which contact(s) are required signers for *this specific contract* — the system should never infer "couple = two signers" automatically from the mere existence of `clients.partner_first_name`/`partner_email`, since a venue's actual contracting party may legitimately be only one of the two (Example C in the brief) or a third party entirely (Example D).

## 8. Venue Signer Recommendation

**Does not exist today in any form** (confirmed exhaustively in the companion contract-lifecycle audit). Recommend a new, single required venue signer per contract, captured with the same evidentiary rigor already proven for the client (typed name + explicit consent + server-derived IP/UA/timestamp), **role-gated to Owner/Manager**, matching this codebase's own already-established pattern for every other consequential, binding, or irreversible action (contract deletion, invoice voiding, refunds — all Owner/Manager-only via the identical "app-layer check + RLS backstop" shape this engagement has applied repeatedly). A generic Staff/Coordinator session should not be able to bind the venue to a signed agreement by default, though this remains a product decision to confirm, not an engineering fait accompli — see the architecture plan's explicit flag on this exact point.

---

## 9. Signing Order Recommendation

**Recommend: Venue signs first, sequentially, then all required client signers, who may sign in parallel with one another (not sequentially against each other).**

Reasoning: the venue-then-client ordering is the explicit product requirement and has an obvious rationale (a venue should not ask a couple to commit to an agreement the venue itself hasn't yet formally committed to). Within the *client* side, once the venue has signed and released the agreement, there is no comparable reason to force one named client signer to wait for another — both partners (or a partner + paying parent) reviewing and signing independently, whenever each is available, is both the friendlier customer experience and the lower-engineering-risk option (parallel signer completion just needs an "all required signers done" check, not a signer-order state machine on the client side). If a future contract genuinely needs client-side sequencing (e.g., a parent must co-sign only after the couple has), that's a real, separate requirement to name explicitly if it ever comes up — not something to build defensively now.

---

## 10. Target State Machine

**Recommend NOT adding new `status` enum values for this. Recommend deriving a display-level state from a `contract_signers` table (see the architecture plan) plus the existing `status` column, rather than growing the enum.**

Reasoning: `contracts.status` today is a small, well-understood, heavily-guarded enum (`draft|sent|signed|cancelled|expired`) with real transition rules enforced in `updateContractStatus`. Adding `venue_signed` as a sixth value would require re-auditing every existing consumer of `status` (reports, dashboards, filters) for whether it needs to learn the new value — a real, non-trivial ripple effect. The cleaner path: keep `status` meaning roughly what it means today (`sent` = released and awaiting completion, `signed` = all required parties have signed, i.e. fully executed — a genuine, small semantic tightening, not a rename), and let a **derived** state — computed from the new `contract_signers` rows (who has signed, who hasn't) — drive the UI's own richer display ("Awaiting venue signature" / "Awaiting Jane's signature" / "Fully executed"). This is the same "canonical objects own truth; cross-cutting views project it" pattern already established elsewhere in this codebase (Engineering Standard #10) — the signers table is the source of truth for who's signed; the UI computes a friendly label from it at read time rather than storing a second, parallel status.

---

## 11. Authorization Recommendation

**Venue signer: Owner or Manager only**, per Section 8's reasoning. **Sending/finalizing today has no role check at all** (`sendContract`/`finalizeContract`/`cancelContract`/`reopenContractForEditing` — confirmed, none call `getCurrentUserRole()`) — this is a genuine, pre-existing inconsistency worth naming: if venue-signing becomes Owner/Manager-gated, product should decide whether Send (now effectively "release after venue signature") and Finalize should tighten to match, or whether the looser standard for those specific actions was always intentional (a Coordinator routinely sending a routine, already-reviewed contract is plausibly fine; a Coordinator unilaterally *committing the venue* to a contract's terms is a different weight of action). Flagged, not decided, here.

## 12. Evidence Retention Recommendation

Minimum evidence per signer (client or venue), all append-only, never mutated after write: contract ID, a content identifier tying the signature to the exact text signed (see below), signer's resolved identity (a `client_contacts.id` or venue-staff `user_id`, not just a free-text name), signer email (currently missing entirely for clients — close this), signer role/relationship label, signing timestamp, IP, user-agent, the exact consent statement text/version presented at that moment (not just a boolean — if the consent language ever changes, a historical signature should still show what it actually agreed to), the signing token or authenticated-session context used, a distinct signing-event ID (not reused across signers on the same contract), and the resulting contract state after this specific signature.

**Content identifier — recommend adding a simple content hash (e.g. SHA-256 of the `content` text) computed and stored at the moment of *each* signature**, not just relying on the `draft`-only edit guard to make hashing unnecessary. This directly closes the Section 4 gap and directly answers UETA's own "first generated in its final form" language with a real, independent, tamper-evident artifact rather than a behavioral guarantee alone. This is a small, additive change — not a new content-management system — and does not require building full document-versioning infrastructure to be worthwhile on its own.

---

## 13. Customer-Facing FAQ Draft

**⚠️ REQUIRES ATTORNEY REVIEW BEFORE PUBLICATION — every answer below is a draft for legal review, not approved customer-facing copy.**

**"Are electronic signatures legally binding?"**
> Electronic signatures are recognized as legally valid for most business agreements under U.S. federal law (the E-SIGN Act) and corresponding state law. Whether a specific signature is enforceable can depend on the details of how it was captured and the nature of the agreement — for anything with significant legal or financial weight, we recommend reviewing your agreement with your own advisor if you have questions. *(Flag for counsel: confirm this is accurate to publish without further qualification for our specific implementation.)*

**"How does Hello to Cheers verify a signature?"**
> When you sign a document through Hello to Cheers, we record your typed name, the date and time, your IP address, and your device/browser information, along with your explicit confirmation that you intend the action as your legal signature. *(Flag for counsel: do not claim identity verification beyond what's actually captured — see Section 6's attribution gap. Avoid language implying we confirm you are who you say you are.)*

**"Who needs to sign the contract?"**
> This depends on who your venue has identified as the contracting party or parties for your event — this may be one person, both members of a couple, or another authorized party. Your venue will let you know who needs to sign. *(Flag for counsel: confirm this framing is acceptable — do not state a universal rule, since none exists.)*

**"Can both members of a couple sign?"**
> Yes — if your venue has set up your agreement with more than one required signer, each person will receive their own signing link and can sign independently.

**"Can someone else sign for me?"**
> No — please don't forward your signing link to someone else. The system does not currently verify the identity of whoever opens a signing link, so signing should only be done by the person the agreement is intended for. *(Flag for counsel: this is an honest disclosure of a real current limitation — do not soften it into an implied guarantee we don't have.)*

**"What happens after I sign?"**
> Your signature is recorded immediately and your venue is notified. Once all required signers have completed the agreement, it becomes final.

**"Can a contract be changed after I sign?"**
> No — once you've signed, the agreement you signed cannot be edited.

**"What if I need to make a change after signing?"**
> Your venue can create a formal amendment, which becomes a new linked agreement referencing the original — the original signed record is never altered.

---

## 14. Gap Register (P0/P1/P2/P3)

### P0 — cannot safely operate
None. The existing single-signer flow is honest about what it does, does not misrepresent itself, and has no active security hole that lets an unauthorized party silently alter a signed record. Nothing here rises to "unsafe to operate as-is."

### P1 — material deficiency, should be resolved before release
1. **No independent, tamper-evident signed-content artifact at the moment of signing** (Section 4) — the strongest single finding in this document. Recommend the content-hash addition in Section 12 as the minimum viable close, independent of the larger venue-signing build.
2. **`expires_at` exists but is never enforced** — a sign link functionally never expires, contradicting whatever the field's own presence implies to a venue reading the schema or (if surfaced) to a couple reading a UI label.
3. **No email capture on the signature event itself**, despite the email being known at send time — closing this is small and directly strengthens UETA-style attribution.
4. **Venue-first signing does not exist in any form** — already the dominant finding of the companion contract-lifecycle audit, restated here as it is squarely this document's subject too.
5. **`contract_activities` has no actor column** — cannot be fixed for signing specifically without fixing it for the table generally; a real, pre-existing gap this workstream will need regardless.

### P2 — meaningful improvement, not release-blocking
- Signer name is not cross-checked against any known record (weak attribution, but the consent+IP+UA+timestamp combination is still a real, non-trivial evidence set — this does not need to be P1 on its own, only in combination with the content-hash gap above, which is already separately P1).
- No signature drawing/image capture — explicitly **not** classified P1 per the task's own instruction; a typed name plus explicit consent is a recognized, valid method of showing intent under both ESIGN and UETA (Section 5) — this is a stylistic/trust-perception enhancement, not an evidentiary deficiency.

### P3 — future enhancement
- A third-party e-signature provider integration (DocuSign-class) — explicitly out of scope; the existing self-built mechanism, once the P1 items above are closed, is a reasonable, defensible approach for this product's actual stakes (a venue services agreement, not a high-value financial instrument requiring notarization-grade assurance).
- Signature drawing/image capture, if ever desired for trust-perception reasons alone.
