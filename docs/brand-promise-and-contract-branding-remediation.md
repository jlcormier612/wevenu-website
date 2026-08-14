# Brand Promise + Contract Branding Snapshot — Remediation Report

**Status:** Implemented  
**Date:** 2026-08-12  
**Scope:** Two approved changes only — Brand Colors setup copy, and Contract branding snapshot at release (matching Invoice). No commit/push.

---

## 1. Brand copy

| | |
|---|---|
| **Old** | `Primary, secondary, accent, and neutral brand colors displayed throughout your workspace.` |
| **New** | `These colors define your venue's visual identity where Hello to Cheers presents your brand to clients and in venue-branded collateral.` |
| **Where** | Settings → Brand colors (`components/settings/venue-settings.tsx` `SettingsSection` description) |
| **Why** | The old sentence implied the venue's own admin workspace is recolored. Venue colors shape client-facing presentation and venue-branded collateral; the internal Hello to Cheers workspace stays product-branded by design. |

**Explicit non-claims (copy must not imply):** admin workspace recoloring; equal use of all four colors everywhere; every PDF/email using every color; venue control of Hosted Experience / RSVP palette; Pipeline stage colors as venue branding.

**Unchanged:** Primary / Secondary / Accent / Neutral controls, hints, picker, storage, schema, preview strip, Setup `BrandStep` internals.

---

## 2. Contract snapshot

### Invoice pattern reused

| Rule | Invoice | Contract (this change) |
|---|---|---|
| Column | `invoices.branding_snapshot` jsonb | `contracts.branding_snapshot` jsonb |
| Write moment | `draft → sent` | `draft → sent` (release / `sendContract`) |
| Never overwrite | Yes (paid/void / re-send) | Yes (later transitions / existing snapshot) |
| No silent backfill | Pre-existing sent without snapshot → live venue | Same |
| Render preference | Snapshot when present, else live venue | Same |

### Lifecycle commitment point (inspected, current code)

Current Contract lifecycle (not invented):

1. Create draft  
2. Venue signs (still `status = draft`; content becomes immutable)  
3. **Release / send** → `draft → sent` (`sendContract`; client token becomes live)  
4. Client signs → `signed`  
5. Venue finalizes → PDF locked in Document Domain  

**Snapshot is captured at step 3 (`draft → sent`)**, matching Invoice's customer-visibility commitment and the moment branding first reaches the client (sign page). Venue sign locks *content*; release freezes *presentation*. Signing / release / status semantics were not changed.

### Fields snapshotted

Only fields Contract renderers actually consume (subset of Invoice's broader print snapshot):

- Identity: `name`, `businessName`, `logoUrl`
- Palette: `primaryColor`, `secondaryColor`, `accentColor`, `neutralColor`
- Contact / address used by PDF: `email`, `phone`, `website`, `addressLine1`, `addressLine2`

Not snapshotted (Invoice-only print fields): `city`, `stateRegion`, `postalCode`, `country`.

### Rendering paths

| Surface | Behavior |
|---|---|
| Sign page (`app/sign/[token]/page.tsx`) | `resolveContractBrandPresentation(snapshot, live venue)` for CSS vars + header |
| Contract PDF (`lib/contracts/pdf.ts`) | Same helper; colors via `resolvePdfBrandColors` |
| Finalize (`lib/contracts/finalize.ts`) | Unchanged call shape; uses contract from `getContractDetail` which now carries `brandingSnapshot` into PDF generation |
| Public RPC | `get_contract_by_token` returns `branding_snapshot` so the anonymous sign page can prefer it |

### Backward compatibility

- Existing contracts with `branding_snapshot IS NULL` continue to render from live venue (today's behavior).
- No retroactive rewrite / backfill.
- New releases get a snapshot; snapshot wins when present.

### Immutability (render path)

Brand A → send (snapshot A) → change venue to Brand B → re-open / PDF / sign page for that contract still resolves **A**. A new contract sent after Brand B captures **B**.

---

## 3. Email Primary-only (intentional — document only)

Customer-facing branded email (`lib/email/venue-brand.ts` `EmailVenueBrand`) accepts **Primary only**. Secondary / Accent / Neutral are intentionally out of scope for HTML email. Documented in a short module comment; **no runtime change**.

---

## 4. Deferred — Pipeline stage color cleanup

Out of scope for this remediation. Pipeline stage colors are **not** venue brand palette and must not be framed as such in Brand Colors copy. Any Pipeline color/architecture cleanup remains deferred and must not be mixed into venue branding work.

---

## 5. Validation

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass (exit 0) |
| `npm test` | Pass — **506** tests, **0** fail (includes `lib/contracts/branding.test.ts`) |
| Focused unit coverage | Snapshot field set; resolve prefers snapshot; null snapshot → live venue; Brand A frozen vs Brand B venue; new capture uses current brand; Invoice snapshot shape unchanged (smoke) |
| Migration applied (local) | `contracts.branding_snapshot` + `get_contract_by_token` returns snapshot |
| Browser — Brand Colors copy | Pass — old workspace claim gone; new truthful copy present; four controls present; admin root has no `--venue-primary` |
| Browser / DB — Contract A→B | Pass — sent contract snapshot stays `#AA1111` after live venue → `#BB2222`; new sent contract snapshots `#BB2222`; sign page `--venue-primary=#AA1111` for snapshotted contract A |

Evidence: `docs/qa/brand-promise-contract-branding-evidence/`.

Production build: not required for this path beyond typecheck + unit tests; PDF/sign changes are covered by resolve + existing PDF brand helper tests + sign-page immutability proof.

---

## 6. Files changed

| File | Change |
|---|---|
| `components/settings/venue-settings.tsx` | Brand Colors section description copy only |
| `lib/contracts/branding.ts` | **New** — capture + resolve helpers / snapshot type |
| `lib/contracts/branding.test.ts` | **New** — focused snapshot / render / Invoice-smoke tests |
| `lib/contracts/types.ts` | `brandingSnapshot` on `Contract` |
| `lib/contracts/repository.ts` | Map snapshot; write once at draft→sent |
| `lib/contracts/service.ts` | Capture snapshot in `sendContract` |
| `lib/contracts/pdf.ts` | Prefer snapshot when rendering PDF |
| `app/sign/[token]/page.tsx` | Prefer snapshot for sign-page brand chrome |
| `lib/email/venue-brand.ts` | Comment only — Primary-only ceiling |
| `supabase/migrations/20261286000000_contract_branding_snapshot.sql` | **New** — column + RPC returns snapshot |
| `docs/brand-promise-and-contract-branding-remediation.md` | This report |

### Explicitly not changed

Pipeline (colors/architecture/stages), Automation, Library, nav, Help, Luv, Dashboard, Couple Portal themes, Hosted Experience, RSVP, email runtime branding behavior, Invoice branding behavior, Contract signing/release/signer architecture, payments, financials, Vendors, Clients, Tasks, Requests, Tours. No terminology sweeps or drive-by refactors.
