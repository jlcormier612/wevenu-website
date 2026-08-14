# Contract Signature Implementation

**Date:** 2026-08-11  
**Authoritative plans:** `docs/contract-signature-architecture-plan.md`, `docs/contract-electronic-signature-readiness.md`  
**Companion white-label work:** `docs/venue-white-label-collateral-implementation-plan.md` Workstreams A–C

This document records what shipped — not a redesign. No generic e-sign platform.

---

## Signer model

New table `contract_signers` (venue + client share one table):

| Column | Role |
|---|---|
| `signer_type` | `'venue' \| 'client'` |
| `signer_role` | owner/manager at venue sign; contact relationship/role for clients |
| `signer_ref_id` / `client_contact_id` | resolved identity (not free-text as system of record) |
| `signer_name` / `signer_email` | captured from resolved identity; typed name confirms |
| `is_required` | default true for added signers |
| `sign_order` | venue `0`; clients parallel at `1` |
| `sign_token` | per-signer UUIDv4 (new contracts) |
| `signed_at`, `signer_ip`, `signer_user_agent`, `consent_confirmed`, `consent_text` | evidence |
| `content_hash` | SHA-256 of `contracts.content` at that signature |

`contracts.sign_token` remains for legacy in-flight contracts; `sign_contract` RPC kept until drained. New path: `sign_contract_signer`.

---

## Lifecycle (status semantics tightened, enum unchanged)

| Status | Meaning |
|---|---|
| `draft` | Working **or** awaiting venue signature |
| `sent` | Venue signed + released; awaiting required client signers |
| `signed` | Fully executed — all required signers done |
| `cancelled` / `expired` | Unchanged |

Sequence: **create → venue reviews → venue signs (Owner/Manager) → release (`draft→sent`) → client(s) parallel → fully executed → Finalize PDF** (unchanged trigger, from fully executed).

Derived UI labels (not a new enum): Review / Sign contract / Signed by venue / Ready for client / Awaiting client signature / Fully signed.

---

## Evidence / hash / expiration / auth

- **Consent:** checkbox preserved; exact `consent_text` stored per signer row (`CONTRACT_SIGNATURE_CONSENT_TEXT`).
- **Content hash:** SHA-256 on each signature; at fully-executed transition, mismatched hashes **block** (`reason: content_hash_mismatch`).
- **Expiration:** `contracts.expires_at` enforced in `get_contract_by_token` and both sign RPCs.
- **Venue auth:** app `getCurrentUserRole()` Owner/Manager + RLS `WITH CHECK` on `contract_signers` UPDATE when `signed_at` is non-null.
- **Client release:** server-side — `sendContract` / `updateContractStatus(…, 'sent')` require venue `signed_at`.
- **Immutability:** content edit blocked once venue `signed_at` set (not only when `status ≠ draft`). Withdraw venue signature (Owner/Manager) or reopen from `sent` clears signatures to allow edits.
- **Audit:** `contract_activities.actor_id` / `actor_label` on insert call sites.
- **Legal:** no invented legal claims; FAQ drafts remain attorney-review flagged in the readiness doc. Consent language is factual typed-name + consent only.

---

## White-label P1s (same pass)

- Conversations Send Now + Scheduled Sends wrap HTML via `lib/email/venue-brand.ts` (plain-text fallback kept; merge before wrap).
- PDF/print: Secondary on Contract/EO/Brochure section rules; Accent on Day Sheet current highlight and Invoice Amount Due; Neutral on invoice amount panel background.
- Invoice `branding_snapshot` jsonb at `draft→sent` only; never overwrite; pre-existing sent without snapshot fall back to live venue (documented, no silent backfill).

---

## Migration

`supabase/migrations/20261281000000_white_label_contract_signature.sql` — additive.

---

## Evidence

See `docs/qa/white-label-contract-signature/` (`report.json`, `README.md`, `smoke.mjs`).
