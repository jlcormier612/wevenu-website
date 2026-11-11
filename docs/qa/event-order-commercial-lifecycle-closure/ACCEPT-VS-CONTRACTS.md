# Order Accept vs Contracts — established product rules

**Status:** Locked from existing product decisions + verified code. Not invented legal advice.  
**Date:** 2026-10-28

## Explicit answers

### 1. What does the couple’s Event Order Accept action mean?

**Operational acknowledgment of the shared delivery list** for the revision that was shared. It records `client_agreed_at`, `client_agreed_name`, and `client_agreed_revision` on the Event Order.

It is **not** an e-signature, **not** Contracts-module signing, and **not** a substitute for a venue contract.

### 2. Acknowledgement vs commercial commitment?

Within the product: **acknowledgment that the couple reviewed the shared Event Order delivery list.**  
Commercial amount due lives on **issued invoices** (and their payment schedules). Accept does not create, alter, or authorize an invoice.

### 3. When must a separate contract be created, sent, or signed?

When the venue uses the **Contracts** module for that booking (proposal / booking / amendment path). That workflow is independent of Event Order Accept.  
If no contract is required for the booking under venue practice, none is required by the Event Order Accept action.

### 4. Which transitions require acceptance or signature before invoicing?

**None for Event Order invoicing.** Established rule: finalize (venue) is the invoice gate; share and Accept are optional and not required to create or send an Event Order invoice. Contracts countersignature is likewise not a gate for EO incremental invoicing.

### 5. What should users see when invoicing happened but Accept or a required signature is incomplete?

- **Couple:** Invoice(s) and payment obligations remain visible and payable per remittance rules; Event Order may still show Accept if a share exists and they have not agreed.
- **Venue:** Journey shows invoice as current when an EO-linked invoice exists; do not present “Finalize” as the unfinished next step solely because Accept is empty. Contracts incompleteness (if any) stays on the Contracts surface.

### 6. Amendments / incremental charges

- Issued invoices and their schedules are **not** rewritten by later Event Order edits or catalog changes.
- Incremental invoices amend (bill new unbilled lines only) and **do not** inherit the original payment plan.
- Material changes after share require **re-share** so the couple’s shared snapshot matches the intended commitment before the **original** (non-amend) EO invoice is created/sent. Incremental amend invoices are not blocked by a stale share.

## Implementation notes (this closure)

- Portal Accept copy states acknowledgment of the delivery list, not legal e-sign.
- Journey / commercial-workflow copy states Accept and Contracts are separate from invoicing.
- Share-stale gate blocks original EO invoice create/send until re-share; amend path remains available.
