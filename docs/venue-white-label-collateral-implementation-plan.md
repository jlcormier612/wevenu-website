# Venue White-Label, Collateral & Contract Lifecycle — Implementation Plan

**Type:** Implementation specification for a future execution pass (Cursor or otherwise). Nothing in this document has been built. No code, schema, or content was changed to produce it.
**Companion document:** `docs/venue-white-label-collateral-certification.md` — read that first; this document assumes its findings.
**Date:** 2026-08-11

**Ground rule for whoever executes this:** every workstream below reuses an existing, already-proven architectural pattern from this codebase. None of them require a new branding system, a new e-signature engine, or a new document/workflow framework. Where a genuine product/legal decision is required before implementation can proceed safely (who may sign for the venue; new status vs. new columns), it is flagged explicitly as **PRODUCT DECISION REQUIRED** rather than assumed.

---

## Workstream A — Email Branding (Conversations)

**Objective:** every customer-facing Conversation email (both the live "Send Now" path and the Scheduled Sends cron) carries the venue's logo, name, and primary color, matching the tour-confirmation/contract-invite emails that already do this correctly.

**Current behavior:** `lib/conversations/service.ts::sendConversationMessage` and `lib/scheduled-messages/processor.ts` both call `sendEmail({ to, subject, text })` — plain text only, no venue identity of any kind.

**Target behavior:** the same two call sites additionally build an `html` payload by wrapping the message body in the existing `lib/email/venue-brand.ts` wrapper, and pass both `text` (unchanged, as the plain-text fallback) and `html` to `sendEmail`.

**Existing architecture to reuse — do not build a new one:** `lib/email/venue-brand.ts` (the shared wrapper — logo, venue name, primary color header/footer, no Hello to Cheers attribution, already used successfully by `lib/email/contract-invite.ts` and `lib/tours/communication.ts::buildConfirmationContent`). Use `buildConfirmationContent`'s own shape (`{subject, text, html}`) as the reference pattern for how a send-site should construct its payload.

**Files/components likely affected:**
- `lib/conversations/service.ts` (the `sendConversationMessage` function specifically, around the existing `sendEmail` call)
- `lib/scheduled-messages/processor.ts` (the existing `sendEmail` call)
- Possibly a new small helper (e.g. `wrapConversationMessageHtml`) if the message body needs light HTML formatting (paragraph breaks) before wrapping — check whether `text` currently contains `\n`-only formatting that would look wrong dumped raw into an HTML wrapper.

**Database changes:** none.

**RLS/permission implications:** none — this is a presentation-layer change to an existing, already-permission-checked send path.

**Rendering implications:** the recipient's email client renders HTML instead of plain text; must preserve the plain-text `text` fallback (do not drop it) for accessibility and email clients that reject/strip HTML.

**Lifecycle implications:** none — this doesn't change when or whether a message sends, only what it looks like.

**Preserve explicitly (per the certification's own instruction):** message content, merge fields (confirm `resolved.body`'s merge-field resolution happens before HTML wrapping, not after — wrapping must not re-introduce raw `{{tokens}}`), threading/reply behavior, existing delivery/retry behavior, and any compliance/unsubscribe footer this product already has elsewhere (check `lib/email/venue-brand.ts` for whether it already includes one, and if not, whether one is needed here — flag to product if genuinely absent, don't invent one blind).

**Regression risks:** breaking reply-threading if the HTML wrapper injects content that interferes with the reply-parsing logic (check how inbound replies are matched back to a Conversation — likely by a header or a reply-to address, not by body content, but verify before assuming safe).

**Validation requirements (real, not source-inspection-only):**
1. Send a real Conversation message ("Send Now") from a test venue with a distinctive logo/color to a real test inbox; confirm the received email shows the venue's logo and color, not Hello to Cheers's.
2. Trigger a real Scheduled Send the same way; same confirmation.
3. Confirm merge fields (e.g. `{{client_name}}`) resolve correctly inside the branded HTML — no raw tokens visible.
4. Reply to the branded email from the test inbox; confirm it still threads into the same Conversation (proves the branding change didn't break the RC2 inbound-reply matching).

**Acceptance criteria:** both real send paths produce venue-branded HTML email with an intact plain-text fallback; zero regression in merge-field resolution or reply threading; zero Hello to Cheers branding in the output.

---

## Workstream B — PDF/Print Branding (Secondary/Accent/Neutral)

**Objective:** give Secondary and Accent a real, visible role in the product's PDF/print documents, without mechanically dumping all four colors onto every artifact.

**Current behavior:** every PDF generator (`lib/contracts/pdf.ts`, `lib/event-orders/pdf.ts`, `lib/brochures/pdf.ts`) and print document (`components/invoices/invoice-print-document.tsx`, `components/events/day-sheet/day-sheet-document.tsx`) independently derives `const brandColor = venue.primaryColor || "#5D6F5D"` and uses it for exactly one treatment (a header border or background). Secondary/Accent/Neutral are never referenced.

**Target behavior**, matching the visual-hierarchy standard the certification specifies (Primary = dominant identity, Secondary = supporting hierarchy, Accent = highlights/emphasis, Neutral = backgrounds/borders) and the *already-proven-in-the-Portal* role assignment (Secondary → "hover/gradient stops"-equivalent secondary treatments, Accent → "highlights/emphasis," Neutral → background tinting only, never text): each PDF/print document gains **one** additional, restrained use of Secondary or Accent appropriate to its own layout — not all three on every document. Candidate, low-risk placements (a design pass should confirm the exact choice per artifact, not an engineering guess):
- Contract/Event Order/Brochure PDFs: a Secondary-colored section-heading rule or divider (these documents already have repeated section headings — `sectionHead` styles — that currently use a fixed neutral gray).
- Day Sheet: Accent for the current-item/next-item highlight state (a day sheet already has a "what's happening now" emphasis need).
- Invoice: Accent for the "Amount Due" figure specifically (already the single most emphasis-worthy number on the page).

**Existing architecture to reuse:** the `brandColor` derivation pattern itself (`venue.xColor || fallback`) — repeat it for `secondaryColor`/`accentColor` with the same null-safety shape, not a new mechanism.

**Files/components likely affected:** `lib/contracts/pdf.ts`, `lib/event-orders/pdf.ts`, `lib/brochures/pdf.ts`, `components/invoices/invoice-print-document.tsx`, `components/events/day-sheet/day-sheet-document.tsx`.

**Database changes:** none — the fields already exist and are already fetched everywhere `venue.primaryColor` currently is.

**RLS/permission implications:** none.

**Rendering implications:** react-pdf (`@react-pdf/renderer`, used by the three `.ts` PDF generators) vs. plain React/CSS (used by the two print documents) are different rendering engines — a shared "collateral branding" helper, if built, would need to produce either a react-pdf `StyleSheet` fragment or a CSS-in-JS object depending on caller, or simply stay as two small per-engine helpers rather than one true shared abstraction. **Flag to whoever implements this: do not force a single shared component across both rendering engines if it makes either one awkward — two small, consistent helpers is preferable to one contorted one, per this project's own "prefer the smallest correct thing" discipline.**

**Lifecycle implications:** for Contract and Event Order specifically, this change must respect the existing snapshot behavior (Section J of the certification) — a color-treatment change to the PDF *generator* only affects PDFs generated *after* the code change; already-finalized/stored PDFs are correctly unaffected (they're static files, not re-rendered).

**Regression risks:** low. This is additive (a new style property on existing elements), not a rewrite of any generator's structure.

**Validation requirements:** generate a real PDF from each of the 5 affected generators/documents using a test venue with visually distinct Primary/Secondary/Accent colors; visually confirm all three are legible and appropriately subordinate to Primary (Secondary/Accent should read as "supporting," not compete with Primary for dominance).

**Acceptance criteria:** each of the 5 artifacts visibly uses at least Primary + one of Secondary/Accent; a venue with a distinct 3-color palette can identify at least one place in at least one document where each of their chosen colors (beyond Primary) appears.

---

## Workstream C — Invoice Branding Snapshot

**Objective:** an invoice's presentation (logo, colors, venue name/contact as printed) stops changing after the invoice is sent, matching Contract's existing snapshot discipline — without touching any financial data.

**Current behavior:** `app/(app)/invoices/[id]/print/page.tsx` calls `getCurrentVenue()` fresh on every page load; `InvoicePrintDocument` always reflects the venue's *current* branding. No PDF or snapshot artifact is ever generated or stored for an Invoice.

**Target behavior:** the moment an invoice transitions to `sent` (`is_couple_visible` flips true, per `lib/invoices/repository.ts::updateInvoiceStatus`), the venue's branding fields (logo URL, primary/secondary/accent/neutral color, name, contact info) at that instant are captured and become the presentation used for that invoice from then on — regardless of later venue rebranding. **Financial fields (amounts, line items, payment status, balances, due dates) are explicitly untouched and continue to compute live, exactly as today** — this workstream is presentation-only.

**PRODUCT DECISION REQUIRED before implementation:** should this be (a) a lightweight snapshot — a JSON column on `invoices` capturing just the branding fields at `sent` time, read by `InvoicePrintDocument` in preference to live `venue.*` when present — or (b) a full generated-and-stored PDF artifact, matching Contract's `contract-representations` bucket pattern exactly? (a) is smaller and faster to build; (b) is more consistent with Contract's own precedent and gives the venue a genuinely durable, downloadable, unchanging file the way a signed Contract has. The certification recommends flagging this rather than presupposing it — Contract's own pattern is the stronger long-term precedent, but a bucket/storage/PDF-generation build is a materially bigger unit of work than a JSON snapshot column, and product should choose knowingly rather than by default.

**Existing architecture to reuse:** if (b) is chosen — `lib/contracts/finalize.ts`'s exact pattern (`generateXPdf` → `serviceClient.storage.upload(..., { upsert: false })` → a `pdf_url`/`storage_path`-equivalent column) is the direct template, including its `upsert: false` immutability guarantee. If (a) is chosen — a single new nullable JSONB column (e.g. `invoices.branding_snapshot`) populated once at the `sent` transition, read by `InvoicePrintDocument` as `snapshot ?? venue` at render time.

**Files/components likely affected:** `lib/invoices/repository.ts` (`updateInvoiceStatus`, where the `sent` transition already lives), `lib/invoices/types.ts` (if a snapshot field/type is added), `components/invoices/invoice-print-document.tsx` (read the snapshot in preference to live venue data when present).

**Database changes:** one new column (shape depends on the product decision above) plus a migration; **explicitly not** a change to any existing financial column.

**Migration requirements:** additive-only (`alter table invoices add column ...`), backward-compatible — existing sent invoices with no snapshot fall back to live venue branding (today's behavior) until a real fix is available for backfilling them, which should be named as an explicit, separate decision (backfill vs. leave pre-existing sent invoices on live-rendering forever) rather than silently assumed.

**RLS/permission implications:** none beyond what already exists on `invoices` (the write happens inside the already-permission-checked `sent` transition path).

**Rendering implications:** `InvoicePrintDocument` needs a small branch: prefer the stored snapshot's branding fields over the live `venue` prop when a snapshot exists.

**Lifecycle implications:** must not fire on `draft` (nothing to protect yet — a draft invoice isn't customer-facing) or `paid`/`void` (those transitions happen *after* `sent`, when the snapshot should already exist and must not be overwritten by a second, later snapshot).

**Regression risks:** if the snapshot logic accidentally fires on every status transition instead of only the first `sent`, it could silently re-capture branding at `paid` time too, defeating the whole point (the invoice would still change appearance if the venue rebrands between `sent` and `paid`). Guard explicitly: only write the snapshot when transitioning **into** `sent` **from** `draft`, and never overwrite an existing snapshot.

**Validation requirements (the certification's own explicit script):**
1. Issue a real invoice with a test venue on "Brand A" (a distinctive logo/color).
2. Change the venue's branding to "Brand B."
3. Re-render/re-print the *original* invoice — confirm it still shows Brand A.
4. Issue a *new* invoice from the same venue — confirm it shows Brand B.
5. Confirm the invoice's amounts/balance/status are identical in both re-renders (proves financial data was never touched by this change).

**Acceptance criteria:** an invoice's presentation is fixed at the moment it's sent; financial calculations are bit-for-bit unaffected; pre-existing sent invoices behave exactly as documented in the migration plan (backfilled or explicitly left on live-rendering, not silently either).

---

## Workstream D — Contract Venue-First Signing

**This is the most consequential workstream in this plan. Read the certification's Section H/I/J in full before implementing any part of it.**

**Objective:** support the product-intended lifecycle **draft → venue reviews → venue signs → released to client → client signs → finalized**, replacing today's **draft → sent (no commitment) → client signs → venue finalizes**.

**Current behavior:** fully traced in the certification, Section H. No venue-side signature exists in any form.

**Target behavior:** a new, explicit venue-signature step is inserted between "draft" and what is today called "sent" — the client's `sign_token` must not become functionally reachable (or the contract must not enter the state that makes it reachable) until the venue has completed this new step.

### PRODUCT DECISIONS REQUIRED before implementation (do not let an implementer default-guess these)

1. **New status value vs. new columns.** Option 1: add `'venue_signed'` to the `contracts_status_check` constraint, positioned between `'draft'` and `'sent'` in the conceptual flow (though enums aren't ordered in Postgres — the *application* logic enforces the sequence, not the database type). Option 2: keep the existing 5-value status enum unchanged and add independent `venue_signed_at`/`venue_signer_id`/`venue_signer_name` columns, checked alongside `status` rather than folded into it. **Recommendation, not a decision:** Option 2 is lower-risk — it doesn't require updating every existing `status`-based query/guard/report that currently assumes the 5-value enum, and it mirrors how the *client's* own signature already works (separate columns, not a dedicated status value beyond `'signed'` itself, which conflates "signed" as a state with "signed" as an event — actually note: the client's signature **does** double as a status transition (`status='signed'`), so there's already internal precedent for either approach in this exact schema. Flag both to product explicitly; do not silently pick one.
2. **Who may sign for the venue?** Any authenticated staff member (matching today's permissive `sendContract`/`finalizeContract`, which have no role check), or Owner/Manager only (matching the established financial/legal-action pattern used for contract deletion, invoice voiding, and refunds — TR-G1/TR-M3/this pass's own Invoice-void-RLS work)? **Recommendation, not a decision:** given this is a legally consequential signature, not a status update, Owner/Manager-only is more consistent with how this codebase has treated every other genuinely consequential legal/financial action — but this is explicitly a product/legal call, not an engineering default.
3. **What does "venue signs" actually capture?** A typed name + consent checkbox (mirroring the client's own `sign_contract` pattern exactly — the same evidentiary weight, for consistency), or something stronger? Recommend mirroring the client's pattern for consistency and speed, unless product has a specific reason a venue-side signature needs different evidentiary weight than the client's own (which currently has no cryptographic signature either — see `lib/contracts/pdf.ts`'s own disclaimer text).

### Implementation shape (once the above is decided)

**Files/components likely affected:**
- `supabase/migrations/` — one new migration for the schema change (status value or columns, per decision 1), following this project's own established migration hygiene (unique timestamp, dry-run tested transactionally before applying — see Engineering Standard #8 and the recent migration-collision remediation in this same repo for why this matters).
- `lib/contracts/repository.ts` — a new `venueSignContract` function, mirroring `updateContractStatus`'s existing guard shape (read current state, validate the transition is legal, write, return `{ok, message}` — not the older `throw`-based pattern).
- `lib/contracts/service.ts` — a new `venueSignContract` service wrapper (role-gated per decision 2, following `deleteContract_`'s existing `getCurrentUserRole()` check as the template), and a modification to `sendContract`'s own precondition — it should now require the venue-signature step to be complete first (or be renamed/repurposed as the "release to client" action that only fires after venue-signing, depending on how decisions 1–2 shape the flow).
- `app/(app)/contracts/actions.ts` — a new server action wrapping the new service function.
- `components/contracts/contract-detail.tsx` — new UI: a "Sign as Venue" action (visible only when the contract is in the right pre-signature state), and updated status/badge display distinguishing "awaiting venue signature" from "awaiting client signature" from "fully executed."
- `contract_activities` — extend `insertContractActivity` calls to include an actor field (a real, pre-existing gap independent of this workstream — see certification P1-5 — but one this workstream cannot produce a trustworthy audit trail without closing first).
- `lib/contracts/pdf.ts` — if the finalized PDF should show a venue-signature block (name/title/timestamp) alongside the client's — a real design decision, not just a data-plumbing one.

**Database changes:** per decision 1 above — either a `status` enum addition or 2–3 new nullable columns, plus (separately) an actor column on `contract_activities`.

**Migration requirements:** additive-only; must not touch any existing contract row's current `status`/`signer_*` data. If Option 1 (new status value) is chosen, every existing query/report that filters or branches on `contracts.status` needs an explicit audit for whether it needs to learn about the new value (e.g. does a "pending contracts" dashboard count need to include `venue_signed` contracts as "still pending" or as a distinct bucket? — flag to product, don't assume).

**RLS/permission implications:** a new RLS policy (or an extension of the existing `contracts_update` policy) matching decision 2 — if Owner/Manager-only, follow the exact `WITH CHECK` pattern already proven twice this engagement (TR-G5's refund backstop, this pass's own Invoice-void backstop): one added condition on the existing UPDATE policy, not a new separate policy, so the fix can't be silently bypassed by a direct API call the way every other role-gate gap in this codebase's history has been found and closed.

**Rendering implications:** the client's own sign page (`/sign/[token]`) and the venue-side Contract Detail page both need new state-aware UI (a client should never see a contract that hasn't been venue-signed yet, if the release-gating decision requires that — confirm the `sign_token` itself remains inert, or the RPC that reads it returns "not yet available," rather than merely hiding a UI affordance while the underlying data is still reachable, per this whole engagement's own "server-side guard, not just UI hiding" standard).

**Lifecycle implications:** this changes the *meaning* of `sent` — today it means "sent to the client," tomorrow it likely means "released to the client after venue signature," a real semantic shift that touches every place `status='sent'` is currently read (search for every consumer before implementing, not just the write paths documented here).

**Regression risks — explicitly preserve, per the certification's own instruction:**
- Merge-token safety (`assertCustomerSafeContractContent`, the unresolved-`{{token}}` block) must still gate whichever step now precedes client release — do not accidentally move this check to only fire at the old `sendContract` point if that's no longer the actual release gate.
- The existing signed-contract immutability guards (`updateContractContent_`/`deleteContract_`/`updateContractStatus`'s transition rules) must be extended to also protect a venue-signed-but-not-yet-client-signed contract — a contract the venue has committed to but the client hasn't seen yet should not be silently editable either, matching the certification's own Section J requirement.
- The amendment path (`createAmendmentFromContract`, gated to Document-Domain-`finalized`) should not need to change at all — amendments already only ever apply to fully finalized contracts, a state this workstream doesn't touch the definition of.

**Validation requirements — the certification's own explicit 15-step script, verbatim:**
1. Create working contract. 2. Populate real event/client/package/payment data via the existing merge architecture (confirm no manual re-entry). 3. Venue reviews. 4. Venue signs first. 5. Verify venue signature recorded correctly (name, timestamp, actor). 6. Verify the venue-signed representation is stable (attempt an edit, confirm it's blocked). 7. Release to client (confirm the client's token/link only becomes meaningfully live at this point, not before). 8. Client signs. 9. Verify fully-executed state. 10. Attempt an ordinary modification post-full-execution — confirm blocked. 11. Verify the lock. 12. Change the venue's branding. 13. Verify the already-signed/finalized contract's stored representation does *not* change (per Workstream C/existing Contract snapshot behavior). 14. Use the existing amendment path for a legitimate change. 15. Verify amendment behavior is unaffected by this workstream.

**Acceptance criteria:** a real contract can be created, venue-signed, released, client-signed, and finalized in that exact order, with each transition guarded server-side (not just hidden in the UI) and each committed state (venue-signed, fully-executed) genuinely immutable to content and branding changes; the existing merge-safety, immutability, and amendment protections are all still intact after the change, verified live, not assumed.

---

## Workstream E — Contract Signed-State Immutability (extension, not new)

**Objective:** ensure the immutability guarantees already proven for the client-signed/finalized state extend correctly to the new venue-signed intermediate state introduced by Workstream D.

**This is not a separate build — it is the specific regression-safety requirement embedded in Workstream D above (see "Regression risks" there).** Called out as its own workstream only because the certification's own brief separates it, and because it deserves its own explicit acceptance criterion: **a contract the venue has signed but the client has not yet seen must be exactly as protected from silent modification as a fully-executed one** — the same status/content guard shape, applied one state earlier than it currently starts.

**Acceptance criteria:** `updateContractContent_`, `deleteContract_`, and any future edit path all correctly reject a write against a venue-signed contract, with the same honest `{ok:false, message}` shape (not a silent no-op) already proven for every other guarded state in this codebase.

---

## Workstream F — Documentation / Branding Contract

**Objective:** once Workstreams A–E ship, produce the "canonical White-Label Contract" the original audit brief asked for — a short, durable product statement, not a new document per se, added as a closing section to the certification once its findings are actually closed rather than still open.

**Draft, to be finalized only after A–C ship (do not publish this as settled while the P1 findings above remain open — that would itself be a "appears-to-work-but-doesn't" violation of this program's own standing principle):**

> Venue branding (logo, name, Primary/Secondary/Accent/Neutral color, contact information) is configured once in Venue Settings and automatically applies to every customer-facing collateral artifact and communication. Primary governs dominant identity everywhere branding exists; Secondary and Accent provide supporting hierarchy and emphasis where an artifact's own layout calls for it; Neutral governs background/panel treatment only, never text. Typography is not currently a supported venue-brand dimension. Once a customer-facing artifact reaches its commitment point (a contract is signed by either party, an invoice is sent), its branded presentation is fixed at that moment and does not change if the venue later rebrands — financial and legal *content* continues to update live where the product's own lifecycle requires it (a payment status, a balance), but *presentation* does not. No artifact may silently fall back to Hello to Cheers branding when venue branding is expected; where Hello to Cheers's own identity legitimately appears (software-user-facing chrome, staff/vendor invite emails), it is a deliberate, documented exception, not an oversight.

**Files/components affected:** documentation only — no code.

**Acceptance criteria:** this paragraph is added to the certification's own final section, and every claim in it is true of the shipped product at that time (not aspirational) — verified the same way every other claim in the certification was, by direct inspection, before publishing it as settled.

---

## Cross-Workstream Notes

- **Sequencing:** A and B are independent and can proceed in any order or in parallel. C should be scoped (product decision 1a/1b) before starting. D is the largest and most consequential — it should not start until the three product decisions inside it are actually made, not assumed by whoever implements it. E is not separately schedulable — it's part of D. F is last, deliberately, and should not be published until A–C are actually shipped and re-verified.
- **What this plan explicitly does not include, per the certification's own scope boundary:** a generic e-signature platform, a generic branding builder/theme engine, a generic document-workflow engine, venue-signature support for any document beyond the Wedding Venue Agreement contract type, new Starter Library families, Luv, Automation, or unrelated UX cleanup. If any of these seem tempting mid-implementation, that's scope creep against this plan's own brief — stop and confirm with product first.
