# Venue White-Label, Collateral & Contract Lifecycle Certification

**Type:** Read-only product/engineering audit. No code, schema, or content was changed to produce this report.
**Date:** 2026-08-11 (original branding pass), extended same day with a full Contract Lifecycle audit.
**Method:** Direct source inspection — live database schema (`\d contracts`, RLS policies, check constraints), migrations, RPCs, repository/service functions, rendering components, PDF generators, and email send paths. The original branding findings (Sections B–G) were re-verified, not merely repeated, before being carried forward — the only code touched anywhere in this codebase since the prior pass was an unrelated delete-safety fix to `lib/invoices/repository.ts` (a "final bounded hardening" pass), which does not affect any rendering or branding path audited here. The new Contract Lifecycle work (Sections H–J) is a first-time, from-scratch trace of the live schema and every contract-lifecycle function, not inferred from documentation. Where something could not be verified within this pass, it is marked `UNKNOWN` rather than guessed.

---

## A. Executive Finding

**Two separate questions were asked. Neither has a clean "yes."**

**1. "Does Hello to Cheers consistently carry the venue's chosen brand into customer-facing collateral?"** Partially. There is one canonical branding model, no accidental Hello to Cheers leakage, and the Couple Portal and Contract are both genuinely well-branded. But two of the four colors a venue deliberately picks during setup (Secondary, Accent) have no consumer anywhere outside the Couple Portal — not in a single PDF, print document, or email — and the highest-volume real customer communication channel (Conversations) currently carries no venue identity at all. Nothing here has changed since the prior pass; re-verified, not just repeated.

**2. "Can a venue prepare, sign, release, and finalize a contract using a safe, explicit venue-first → client-second signing lifecycle without silently changing a signed agreement?"** **No — and not partially. The capability does not exist today in any form.** The current contract lifecycle has exactly one signer (the client) and one `signed_at` timestamp. There is no venue-side signature field anywhere in the schema, no venue-side signature RPC, and no state distinguishing "venue has committed" from "not yet reviewed." The closest existing analog — a real, separate, authenticated "Finalize Contract" action that locks a permanent PDF snapshot — exists and works well, but it happens **after** the client signs, not before, and it is a locking/administrative action, not a signature. The current order is, structurally: **venue drafts → venue sends (no commitment) → client signs → venue finalizes (locks, doesn't sign).** The requested order — **venue signs → release to client → client signs → finalize** — would require new schema, a new signing RPC, and a new release-gating step. This is a real architecture gap, not a misconfiguration, and it is the dominant finding of this entire report.

---

## B. Canonical Branding Model

*(Re-verified this pass — unchanged from the prior certification.)*

One canonical source. No competing branding tables were found for the venue's own identity.

| Field | Column (`venues` table) | Migration (origin) | Default |
|---|---|---|---|
| Logo | `logo_url` | `20260626090000_venue_foundation.sql` | none |
| Venue name | `name` | same | — |
| Primary color | `primary_color` | same | `#5D6F5D` (Hello to Cheers's own "Heritage Sage") |
| Secondary color | `secondary_color` | same | `#4F5F4F` |
| Accent color | `accent_color` | `20260703150000_sprint76_brand_colors.sql` | `#B8AEA1` |
| Neutral color | `neutral_color` | same | `#F7F5F1` |
| Typography | — | — | **Does not exist.** No venue-level font field anywhere. |
| Hero image, story | `hero_image_url`, `story` | Program 4 Initiative D | none |
| Website, address, phone, email | `website`, `address_line1/2`, `city`, `state_region`, `postal_code`, `country`, `phone`, `email` | `20260626090000_venue_foundation.sql` | — |
| Venue representative / signature identity | — | — | **Does not exist.** See Section I. |

**Settings + Setup UI:** one shared component, `BrandStep` (`components/setup/setup-steps.tsx`), used by both `components/settings/venue-settings.tsx` and the setup wizard — confirmed one canonical UI. **Save path:** Settings → `saveBrandAction`; Setup → `complete_venue_setup` RPC (falls back to the same Hello to Cheers hex defaults if a venue leaves a field blank). **Read path (confirmed):** `get_portal_context`, `get_contract_by_token`, `get_venue_by_tour_key`, `get_rsvp_context`, and the questionnaire public-form data query — every one of these returns **Primary only**, never Secondary/Accent/Neutral.

**Second system that is not the same thing:** `couple_websites.accent_color` (Hosted Experience) — a fully separate table/column, no FK or join to `venues`. See Section G of the original audit (unchanged; not re-litigated in this pass, no evidence surfaced to revisit it).

---

## C. Setup Color Trace

*(Re-verified — unchanged.)*

| Setup choice | Stored value | Current consumers | Customer-visible effect | Missing consumers |
|---|---|---|---|---|
| **Primary** | `venues.primary_color` | Couple Portal (110 CSS-var usages), Contract sign page, Contract/Event Order/Brochure PDFs (header border), Invoice print (full header), Day Sheet (header + accent text), Questionnaire (data threaded through) | Real, consistent, the only color that reliably appears anywhere | None — this one works |
| **Secondary** | `venues.secondary_color` | Couple Portal only — 5 CSS-var usages in the whole codebase | Nearly invisible even where wired | Every PDF, print document, and email |
| **Accent** | `venues.accent_color` | Couple Portal only — 19 CSS-var usages | Real inside the Portal only | Same as Secondary |
| **Neutral** | `venues.neutral_color` | Couple Portal only — 6 CSS-var usages, deliberately background-tinting-only | Real but narrow by design | Same as Secondary |
| **Typography** | *(field doesn't exist)* | N/A | Not selectable, not applied anywhere | Everything — this is a genuine absence, not a wiring gap |

---

## D. Collateral Matrix

*(Condensed from the full original matrix — re-verified, unchanged. See the original pass's evidence for per-cell citations; summarized here to keep this document's growing scope readable.)*

| Artifact group | Logo | Primary | Secondary/Accent/Neutral | Venue Contact | H2C Leakage | Snapshot Behavior |
|---|:---:|:---:|:---:|:---:|:---:|---|
| Contract PDF + sign page | YES | YES | NO | YES | None found | **Snapshotted at finalize** — see Section J |
| Event Order / Brochure / Day Sheet PDFs | YES | YES | NO | UNKNOWN/partial | None found | Event Order confirmed has a storage-upload path (likely snapshotted); others UNKNOWN |
| Invoice (print view) | YES | YES (full header) | NO | YES | None found | **Not snapshotted — re-renders live venue branding on every view** |
| Couple Portal (all sections incl. Payments, Floor Plan, Seating, Timeline, Documents, Vendor Directory) | N/A (chrome) | YES | YES (real, all three) | N/A | None found | Live by nature (an app, not a document) |
| Questionnaire (public form) | YES | YES | NO | UNKNOWN | UNKNOWN | UNKNOWN |
| Conversations customer emails (Send Now + Scheduled Sends) | **NO** | **NO** | **NO** | **NO** | N/A (no branding of any kind) | N/A |
| Tour Confirmation / Contract-Invite emails | YES | YES | UNKNOWN | UNKNOWN | None found | Sent once, not re-rendered |
| Wedding Website / Hosted Experience | YES (own system) | N/A (own `accentColor`) | N/A | N/A | None found | Governed entirely separately — see Section G, original pass |

---

## E. Email Branding Audit

*(Re-verified this pass — confirmed still accurate, same code.)*

`lib/conversations/service.ts::sendConversationMessage` (line 143) and `lib/scheduled-messages/processor.ts` (line 59) both call `sendEmail({ to, subject, text })` — **no `html` field passed at all.** The shared white-label wrapper, `lib/email/venue-brand.ts`, has exactly one real consumer (`lib/email/contract-invite.ts`) plus the pre-RC2 transactional emails (tour confirmation, portal invites) — RC2's Conversations system, now the canonical, default-on, highest-volume messaging system for the whole product, never adopted it. This is the single most consequential branding finding in this report, because of volume: every ordinary "Send Now" reply and every automated Scheduled Send goes out with zero venue identity, while the much lower-volume legacy paths remain properly branded.

---

## F. PDF / Print Audit

*(Re-verified — unchanged.)* Every PDF generator checked (`lib/contracts/pdf.ts`, `lib/event-orders/pdf.ts`, `lib/brochures/pdf.ts`) has exactly one line — `const brandColor = venue.primaryColor || "#5D6F5D"` — used as a single header border. `components/invoices/invoice-print-document.tsx` and `components/events/day-sheet/day-sheet-document.tsx` use Primary more substantially (full header background) but still only Primary. No PDF or print document anywhere references `secondaryColor`, `accentColor`, or `neutralColor`. **One shared collateral-branding abstraction does not currently exist** for this class of surface the way `lib/email/venue-brand.ts` does for email — each PDF generator independently re-derives `brandColor` the same way, a duplicated (if consistent) pattern, not a shared helper.

---

## G. Invoice Snapshot Audit

**Confirmed, with the actual lifecycle now precisely traced (this pass).** Invoice statuses: `draft → sent → paid | void` (`invoices_status_check`, confirmed live). `updateInvoiceStatus` (`lib/invoices/repository.ts`) sets `is_couple_visible = true` and `issued_at` at the `sent` transition — this is the real commitment boundary, the same moment Contract uses (its own `sent` transition publishes the first Document Domain version). But unlike Contract, **no PDF or snapshot is ever generated or stored for an Invoice at any lifecycle point.** `app/(app)/invoices/[id]/print/page.tsx` calls `getCurrentVenue()` fresh on every single page load and renders `InvoicePrintDocument` live — there is no `invoices.pdf_url`/storage path, no analog to Contract's `contract-representations` bucket.

**The correct commitment boundary, per the existing Contract precedent, is `sent`** (the moment `is_couple_visible` flips true and a couple can actually see the document) — not "every save" (a draft invoice isn't customer-facing yet, so nothing needs protecting) and not "paid" (a couple should see the same branded invoice from the moment it's shared through payment, not have it change appearance mid-collection). This does **not** require snapshotting amounts, line items, payment status, or balances — those must legitimately keep updating live as payments come in (that's the whole point of `reconcileInvoiceBalance`); only the *presentation* (logo, colors, venue name/contact as printed in the header/footer) needs to freeze.

---

## H. Contract Lifecycle Audit

**Full current state machine, traced directly against the live schema and every contract-lifecycle function — not previously documented in this form.**

### Schema (confirmed live via `\d contracts`)

```
status: 'draft' | 'sent' | 'signed' | 'cancelled' | 'expired'   (single enum, no venue-side state)
signer_name, signer_ip, signer_user_agent, consent_confirmed, signed_at   (all singular — one signer)
sign_token   (unique, anonymous-access token — the client's link)
amends_contract_id   (self-referencing FK — the amendment/versioning mechanism)
template_id   (FK to contract_templates)
```

**There is no `venue_signer_name`, `venue_signed_at`, `venue_signature_status`, or any equivalent column anywhere in the schema.** `contract_activities` (the audit-log table) records `type`/`title`/`description`/`created_at` per row but **no actor/user field at all** — today's audit trail cannot distinguish which staff member performed an action, only that it happened.

### Function-by-function trace (`lib/contracts/service.ts`, `lib/contracts/finalize.ts`)

| Step | Function | Who can call it | Effect |
|---|---|---|---|
| 1. Create working contract | `createContract` | Any authenticated venue staff (no role check) | Resolves merge tokens from template + real booking data at creation time; **blocks creation outright if any token is unresolved** — confirmed live, not assumed |
| 2. Venue reviews | *(no dedicated step — implicit in the draft-editing UI)* | — | The venue can edit/re-view a draft before sending; this is real but is not a formal commitment of any kind |
| 3. Venue "approves" | `sendContract` | Any authenticated venue staff (no role check) | Re-resolves any tokens pasted after creation, **refuses to send if unsafe placeholder content remains** (`assertCustomerSafeContractContent`), transitions `draft → sent`, publishes the **first** Document Domain version. **This is the closest thing today to a venue commitment step, and it is not a signature — no identity is captured, no consent is recorded, it is functionally a "send" button.** |
| 4. Release to client | *(same action as step 3 — send IS release)* | — | The moment a contract is sent, the client's token becomes live; there is no separate "release" gate |
| 5. Client signs | `signContractByToken` → `sign_contract` RPC | Anonymous, token-only (correct — this is the couple, no venue session exists) | Captures `signer_name`/`signer_ip`/`signer_user_agent`/`consent_confirmed`, sets `status='signed'`. This is the **only** real signature-capture event in the entire lifecycle. |
| 6. Finalize | `finalizeContract` (`lib/contracts/finalize.ts`) | Any authenticated venue staff (no role check), **only callable once `status='signed'`** | Generates the real Contract PDF from the exact signed content, uploads it once (`upsert: false` — genuinely append-only), calls `finalizeContractDocument` to lock the Document Domain record. **This is a real, working, well-built immutability mechanism — it is just positioned last, after the client's signature, not before it, and it locks rather than signs.** |
| Amendment | `createAmendmentFromContract` | Any authenticated venue staff | Only legal from a **Document-Domain-finalized** contract (not merely `status='signed'`); clones content into a brand-new draft row via `amends_contract_id`; original row is never touched. Confirmed real, matches Engineering Standard #4 (append-only). |

### What this proves, precisely

The current lifecycle is: **draft → sent (no commitment) → signed (client only) → finalized (venue locks, doesn't sign).** The requested lifecycle is: **draft → venue signs → released → client signs → finalized.** These are not the same shape with different labels — the requested model requires a genuine second commitment event (a venue signature) to exist **before** the client ever sees the document, and today nothing plays that role. `sendContract` is the nearest analog by position (it's what currently gates client visibility) but it captures no identity and no consent — it is not a signature by any reasonable definition, and treating it as one would be dishonest to the same "appears-to-work-but-doesn't" standard this whole engagement has held everything else to.

---

## I. Venue-First Signing Assessment

**Confirmed absent. Not a partial capability — nothing to build on top of except the general-purpose pattern already proven for the client's own signature.**

Does not exist: venue signer identity/role selection, venue signature capture (of any kind — typed name, drawn signature, or otherwise), venue signature timestamp, a venue-signed intermediate status, sequential signing/signer-order logic of any kind, release-gating tied to a venue signature, a venue-signed document snapshot distinct from the client-signed one, or an audit trail with actor identity.

**What already exists and should be reused, not rebuilt:** the entire pattern proven by the client's own signature is directly analogous and should be the template — a token/identity capture step (`sign_contract`-shaped), a status-guarded transition (`updateContractStatus`-shaped, following the exact `draft→sent`/`cancelled` guard pattern already live), an activity-log entry, and a Document Domain version/snapshot point (`documentIntegration.versionContractDocument`/`publishContractDocument`, already used at the `sent` transition). None of this needs a new generic e-signature engine — it needs the existing, working, single-signer pattern applied a second time, in the right position, for a different party.

**Minimum architecture needed (specification only — see the companion implementation plan for the full Cursor-ready spec):**
1. A new status value between `draft` and `sent` (e.g. `venue_signed`) — or, alternatively, new dedicated columns (`venue_signed_at`, `venue_signer_id`, `venue_signer_name`) checked independently of `status`, so the state machine doesn't have to grow a second enum branch for every future signer. This exact choice — new status vs. new columns — is a real design decision the implementation plan flags explicitly rather than presupposing.
2. A venue-side signature-capture action, gated to an authenticated venue-staff session (unlike the client's, which is correctly anonymous/token-based) — **who specifically is allowed to be the venue's signer (any staff? Owner/Manager only?) is a real product/legal decision, not an engineering one** — flagged, not assumed, in the implementation plan.
3. A release gate: the client's `sign_token` should not become functionally reachable (or the contract should not transition to `sent`) until the venue-signature step is complete — this changes `sendContract`'s own precondition.
4. An actor field added to `contract_activities` (currently absent for every existing activity type too — a real, pre-existing gap this work would need to close to have any audit trail worth the name).

---

## J. Signed Document Immutability Assessment

**What is currently protected, confirmed directly:**
- `updateContractContent_` and `deleteContract_` are guarded to `draft`-only (already-shipped TR-L1/TR-L2 fixes, re-confirmed present).
- `updateContractStatus`'s transition guard (TR-L5) is intact: `sent` only from `draft`; `cancelled` only from `draft`/`sent` — **a signed contract cannot be silently re-opened, re-sent, or cancelled.**
- `finalizeContract` generates and stores the PDF exactly once (`upsert: false`) from the exact signed content — a second finalize attempt cannot silently overwrite it.
- Branding at the point of finalization is baked into the stored PDF bytes themselves (not re-read live) — **a finalized contract's branding is already correctly immutable**, confirmed by the storage-upload mechanism itself, not merely by absence of a re-render path.

**What is not yet applicable, because the state it would protect doesn't exist yet:** "the signed representation must remain stable" for a **venue** signature has no meaning today since no venue signature exists to protect. Once built (Section I), it needs the identical treatment already proven for the client side: a status/column guard preventing any content or venue-branding change once the venue-signature event has occurred, exactly mirroring the existing `draft`-only edit guard.

---

## K. Gap Register

### P0 — release-blocking
None on the branding side (unchanged conclusion from the original pass — nothing misrepresents Hello to Cheers as the venue, nothing actively lies). **On the contract side: the absence of venue-first signing is not, by itself, a P0** — the current lifecycle (client signs, venue finalizes) is internally consistent, safe, and honestly represents what it does; it simply doesn't match the intended product workflow yet. It becomes release-relevant only insofar as product has already decided venue-first signing is a launch requirement, which is a product decision this report surfaces evidence for, not one it makes unilaterally.

### P1 — important, materially violates the intended product promise
1. Conversations customer emails send fully unbranded (Section E) — unchanged from prior pass.
2. Secondary/Accent colors have no consumer outside the Portal (Section C/F) — unchanged.
3. Invoice re-renders live branding, never snapshots (Section G) — unchanged, now with a precisely identified commitment boundary (`sent`).
4. **Venue-first signing does not exist in any form (Section H/I).** This is the correct severity, not P0 and not P2: it is a real, explicit product workflow decision that the current architecture cannot support without new schema and a new commitment step — a materially different lifecycle than what's being asked for, not a cosmetic gap. Flagged here plainly rather than folded into a general branding caveat, per the explicit instruction not to do that.
5. `contract_activities` has no actor field — a pre-existing gap independent of venue-signing, but one that any real venue-signature audit trail would immediately need closed.

### P2 — polish
- No venue-level typography field exists (Section B).
- Neutral color's background-only scope is real but undocumented anywhere a venue would see it.

### P3 — future enhancement
- Typography as a supported venue-brand dimension.
- A shared collateral-branding abstraction to de-duplicate the repeated `brandColor = venue.primaryColor || "#5D6F5D"` pattern across PDF generators (currently consistent by discipline, not by shared code).

---

## Final Certification

### WHITE-LABEL STATUS: 🟢 CERTIFIED (P1s closed 2026-08-11)
P1 Conversations email branding, P1 Secondary/Accent PDF/print consumers, and P1 Invoice branding snapshot (`draft→sent` JSONB) are implemented and verified. See `docs/contract-signature-implementation.md` and `docs/qa/white-label-contract-signature/`.

**Canonical White-Label Contract (now true of the shipped product):** Venue branding (logo, name, Primary/Secondary/Accent/Neutral color, contact information) is configured once in Venue Settings and automatically applies to every customer-facing collateral artifact and communication. Primary governs dominant identity everywhere branding exists; Secondary and Accent provide supporting hierarchy and emphasis where an artifact's own layout calls for it; Neutral governs background/panel treatment only, never text. Typography is not currently a supported venue-brand dimension. Once a customer-facing artifact reaches its commitment point (a contract is signed by either party, an invoice is sent), its branded presentation is fixed at that moment and does not change if the venue later rebrands — financial and legal *content* continues to update live where the product's own lifecycle requires it (a payment status, a balance), but *presentation* does not. No artifact may silently fall back to Hello to Cheers branding when venue branding is expected; where Hello to Cheers's own identity legitimately appears (software-user-facing chrome, staff/vendor invite emails), it is a deliberate, documented exception, not an oversight.

### CONTRACT LIFECYCLE STATUS: 🟢 CERTIFIED (venue-first signing shipped 2026-08-11)
Venue-first → client-second signing is implemented per `docs/contract-signature-architecture-plan.md`: `contract_signers`, tightened `draft`/`sent`/`signed` semantics, Owner/Manager venue sign, parallel client signers, per-signer tokens (legacy `contracts.sign_token` retained for in-flight), content hash, expiration enforcement, actor on `contract_activities`, release gating, and venue-signed immutability. Finalize PDF remains the durable file trigger from fully executed. Evidence: `docs/qa/white-label-contract-signature/report.json`.

### RELEASE IMPACT
- White-label P1s and contract signature P1s from the architecture plan are closed in this pass.
- P3 items remain out of scope (drawn signatures, DocuSign, sequential client signing, mid-flight signer swap).

No finding in this report is hidden inside a general branding caveat.
