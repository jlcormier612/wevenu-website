# Work Package D4 — Contract Lifecycle, Versioning, Signing & Final Representation

## 1. Current-State Findings — what Contracts actually did before D4

D3 built and certified Contracts as a Collaborative Working Item (shared experience header/action row, activity timeline, waiting-state, notification on sign) but explicitly flagged three gaps as out of its own scope:

- **Concurrent editing was unsafe.** `updateContractContent` was a blind UPDATE with no version check — two venue users (or two tabs) editing the same draft could silently overwrite each other with no warning.
- **No real PDF existed anywhere in the app.** Every "export"/"print" surface (invoices, day sheets, floor plans, contracts) was HTML rendered through the browser's own print dialog. There was no server-side document generation.
- **Contracts never touched the Document Domain.** `canonical_documents` / `canonical_document_versions` / `canonical_document_representations` (built in D1) had zero real producers as of D3 — every prior phase correctly deferred integrating it rather than inventing a partial/parallel version history.
- **Signing and "done" were the same moment.** `sign_contract()` flips `contracts.status` to `signed` and that was the terminal state — nothing distinguished "signed" from "this is the final, locked, re-downloadable record."

D4's job was to close all four gaps using the existing, certified Document Domain — not to build a second document system, a generalized e-sign platform, or a generalized PDF framework.

## 2. Lifecycle Map

```
Template (contract_templates)
   │  createContract() — merges template + client/event fields
   ▼
Working Contract (contracts, status: draft)
   │  venue edits content (updateContractContent, optimistic-locked)
   ▼
sendContract() — status → sent
   │  FIRST send: publishContractDocument() → canonical_documents created,
   │              placeholder v1 + real v2 requested, shared
   │  LATER send (after reopen+edit): versionContractDocument() → new
   │              version requested, re-shared
   ▼
Client reviews via /sign/[token] (public, token-gated)
   │  "changes needed" today = venue reopens for editing (see §6)
   ▼
reopenContractForEditing() — status: sent → draft (only if unsigned)
   │  (loops back to "venue edits content" above)
   ▼
sign_contract() RPC — status → signed
   │  coordinator notification fires (D3 behavior, preserved verbatim)
   ▼
finalizeContract() — EXPLICIT venue action, separate from signing
   │  generates real PDF, uploads to private storage, calls
   │  finalizeContractDocument() → version locked, representation
   │  attached, canonical_documents.status → finalized
   ▼
Finalized Contract (immutable signed content + immutable PDF)
   │  createAmendmentFromContract() — only legal from a finalized contract
   ▼
New Working Contract (amends_contract_id → original)
   │  (loops back to "venue edits content" — full cycle repeats)
   │  original document → superseded only once the amendment itself
   │  finalizes (never at amendment creation)
```

There is exactly **one** authoritative lifecycle. `contracts.status` (draft/sent/signed/cancelled/expired) remains the single negotiation-state source of truth; `canonical_documents.status` is the single Document Domain state; nothing in the UI or backend derives a competing third status. The one place they must agree — "is this Contract's final representation ready" — is derived through a single function, `isContractFinalized()`, never duplicated.

## 3. Business-Object vs. Document-Domain Boundary

| Fact | Lives on | Why |
|---|---|---|
| Negotiation state (draft/sent/signed/cancelled/expired) | `contracts.status` | Contract-specific business rules (who can edit, when can it be sent/cancelled) don't belong in a generic Document state machine |
| Who it's for, event, client, template origin | `contracts` | Contract-specific relationships |
| Amendment lineage *before* a Document exists | `contracts.amends_contract_id` | An amendment is created before it's ever sent — there's no canonical Document yet to record the fact on |
| Content, version history, locking | `canonical_document_versions` | The certified single version model — Contracts don't get their own |
| The final PDF | `canonical_document_representations` | The certified single representation model |
| Amendment lineage *after* a Document exists | `canonical_document_references` (`reference_type: 'supersedes'`) | Recorded in the certified vocabulary once there's a Document to attach it to |

All `canonical_document_*` writes go through the one `DocumentService` interface (`lib/document-domain/integration/service.ts`) via a new boundary module, `lib/contracts/document-integration.ts`. No direct table write to any `canonical_document_*` table exists anywhere in `lib/contracts/*`. This is the **first real producer integration** the Document Domain has had since D1.

## 4. Concurrency Model — the mandatory fix

**Before:** `updateContractContent(id, title, content)` — plain UPDATE, no check. Last write always won, silently.

**After:** `updateContractContent(id, title, content, expectedUpdatedAt)` — the UPDATE's WHERE clause includes `.eq("updated_at", expectedUpdatedAt)`, using the trigger-maintained `updated_at` column as an optimistic version token. Zero rows affected → `reason: "stale"`, distinct from "not found" or "not editable." The UI (`contract-detail.tsx`) shows the server's message, exits edit mode, and refreshes to the server's current copy — it never silently overwrites.

**Real test evidence (not simulated):** An initial same-transaction `BEGIN...ROLLBACK` test showed a false pass — `now()` is frozen for an entire Postgres transaction, so two "sessions" inside one transaction never actually see `updated_at` change. Caught and corrected: re-ran with two genuinely separate `psql` connections and real elapsed wall-clock time.

- Session 1 loads the contract (`updated_at = T0`), edits, saves → succeeds, `updated_at` genuinely advances to `T1`.
- Session 2 loaded the contract before Session 1 saved (still holds `expectedUpdatedAt = T0`), edits differently, saves → **0 rows affected**, correctly rejected as stale.
- Final content in the database confirmed as Session 1's — Session 2's edit never silently applied.

Test data from this run was committed (real connections, real commits) and explicitly cleaned up afterward.

## 5. Version Rules

- A new `canonical_document_versions` row is created only at real share boundaries: the first `sendContract()` call (which also requests the real content as v2, since `publishDocument()`'s own certified shape only ever creates an empty placeholder v1), and every subsequent `sendContract()` call after a reopen+edit cycle.
- Draft edits between sends are **never** versioned — only what was actually shared is, per the brief's explicit "not a version per keystroke" instruction.
- Old versions are never deleted or overwritten — `is_current` moves forward, the row stays.
- **New in D4:** once a version's `locked_at` is set (at finalize time), the version becomes truly immutable — see §11 for the real gap this closed.
- No new version-history UI was built — the existing `VersionHistorySheet` (D1/certified) is the only surface; D4 didn't duplicate it.

## 6. Sharing, Review & "Changes Needed"

The client reviews the current shared version at `/sign/[token]` (public, token-gated, unchanged from D3). "Requesting changes" in this system is: the venue reopens the contract for editing (`reopenContractForEditing`, gated to `status = 'sent'` only, atomic single-query UPDATE), edits, and resends — which creates a new version and re-shares. There is no separate "change request" object or comment thread; the brief explicitly forbade building a generalized collaboration/comment engine for this phase. "Whose turn" continues to be read directly off `contracts.status` via the existing `CONTRACT_WAITING_ON` map (draft→venue, sent→client, signed→done) — the same mechanism every other Working Item already uses, not a new one.

No "Compare Changes" diff view was built — explicitly forbidden by the brief (Step 21) as a feature that would misrepresent what limited version data actually supports.

## 7. Signature Rules — preserved, not strengthened

D4 did not touch the signature capture mechanism. `sign_contract()` (SECURITY DEFINER, token-gated RPC) still records a typed name, IP, user agent, and an explicit consent boolean — exactly as D3 left it. The brief explicitly forbade inventing stronger identity verification that doesn't exist. This fact is stated **in the generated PDF itself**, not just in code comments:

> "This signature was captured as a typed name with explicit consent, not a cryptographic or identity-verified electronic signature."

No PDF, UI copy, or code comment in this phase uses the words "legally binding," "certified signature," or "tamper-proof."

## 8. Finalization Rules

Finalization is an **explicit, separate, venue-triggered action** (`finalizeContract(contractId)`), never automatic on signing — `sign_contract()` only ever sets `status = 'signed'`. Finalize:

1. Requires `contracts.status === 'signed'`.
2. Resolves the Contract's `canonical_documents` id (errors clearly if none exists — a contract signed before this feature shipped).
3. Generates a real PDF from the *exact current signed content* (no separate re-fetch — same data already on screen).
4. Uploads it to the private `contract-representations` bucket via the service-role client (the bucket's own policy grants `authenticated` only `select`, never `insert`).
5. Calls `finalizeContractDocument()` — which locks the current version and attaches the PDF as a `signed_copy` representation **atomically**, then transitions `canonical_documents.status → finalized`.
6. If this is an amendment, supersedes the prior document **only after** the new finalization actually succeeds (§10).

On a Document Domain write failure after a successful upload, the orphaned storage file is explicitly cleaned up before the error propagates — no representation-less artifact is left behind.

Post-finalization, the Contract Detail UI is read-only for content (no Edit button once finalized); the only actions available are Download Final PDF and Create Amendment.

## 9. Final Representation Rules

- **Real PDF, not a print dialog.** `lib/contracts/pdf.ts` uses `@react-pdf/renderer` (server-side, no headless browser) — the first real document generator anywhere in this app.
- **Immutable.** `canonical_document_representations` has UPDATE revoked for all roles (D1's own design). D4 additionally closed a gap where the *version's content* underneath the representation could still be tampered with after locking (§11).
- **Securely stored, not a public bucket.** The pre-existing `documents` bucket is `public: true` — confirmed via direct fetch to return the file with **zero authentication** (`HTTP 200` on a bare URL). The new `contract-representations` bucket is `public: false`; the same bare-URL fetch against it returns `HTTP 400`. Every real download goes through a **freshly minted 5-minute signed URL** (`getContractPdfUrl`), never a stored or cached path.
- **White-labeled with what's real.** Venue logo, name, address, and brand primary color render from real venue data. Typography is a single fixed pairing — BA1 already confirmed no venue typography customization field exists anywhere in the schema, so no fake customization point was invented.

## 10. Amendment Rules

`createAmendmentFromContract(sourceContractId)`:
- Gated on `isContractFinalized(sourceContractId)` — only a truly finalized contract (Document Domain status, not merely `status='signed'`) can be amended.
- Clones title (`"{original} — Amendment"`), client, event, and content into a **new** `contracts` row, `amends_contract_id` set to the source. The original row, its signature, and its finalized PDF are **never modified**.
- Deliberately does **not** touch the Document Domain at creation time — publishing is deferred to the amendment's own first `sendContract()` call, exactly like any other new contract, so an unshared draft amendment is never marked `shared`.
- At that first send, `recordAmendmentLineage()` records a `canonical_document_references` row (`reference_type: 'supersedes'`) linking the new document back to the original.
- The original document is transitioned to `superseded` **only when the amendment itself successfully finalizes** — not at amendment creation, not at amendment signing. Verified by direct test: original stayed `finalized` through the amendment's creation and signing, and flipped to `superseded` only after the amendment's own `finalizeContractDocument()` call returned successfully.
- The amendment goes through the exact same edit → share → sign → finalize cycle as any Working Contract — no special-cased UI.

## 11. Real gaps found during validation — fixed within D4's scope

Two genuine defects were found by real transactional/rendering tests (not assumed away) and fixed, both squarely inside D4's own "signed-version immutability" and "PDF quality" requirements:

**a) Locked version content was not actually immutable at the database level.** `canonical_document_versions.locked_at` was documented (D1) as "the immutability marker," and `lockVersion()` sets it exactly once via an app-level `WHERE locked_at IS NULL` guard — but nothing at the database level stopped a direct UPDATE to `content` (or a re-stamp of `locked_at`) after locking. Confirmed live: an UPDATE against a locked, finalized contract's current version succeeded. **Fixed** via a new migration (`20261246000000_document_version_lock_immutability.sql`) adding a `BEFORE UPDATE` trigger that rejects any change to `content`, `locked_at`, `document_id`, or `sequence_number` once `locked_at` is already set — while still permitting the legitimate `is_current` flip `createVersion()` performs when a new version supersedes an old one. Validated transactionally (tamper attempt correctly rejected; legitimate `is_current` flip still succeeds) before being applied for real.

**b) The generated PDF's footer silently vanished on every full page, and rendered at the top instead of the bottom on a short final page.** Found by actually opening generated PDFs (Step 49's own requirement), not just checking that a file existed. Bisected by regenerating the real PDF repeatedly while removing template pieces: the root cause was a `lineHeight` value set at the **page** level in the `@react-pdf/renderer` stylesheet — inherited into the `fixed`, absolutely-positioned footer, it corrupted that library's pagination math for the footer's position on every page, not just where the triggering text sat. **Fixed** by removing `lineHeight` from the page-level style (it was already redundantly set on `contentText`, so body text spacing is unaffected) and documenting why in the code. Re-verified: all 6 pages of a long contract and the single page of a real short contract now show the footer, contact line, and correct "Page N of M" at the bottom, in both cases.

Neither of these was a hypothetical — both were caught by the actual validation this phase required, and both are now covered by the real tests below.

## 12. Permission Matrix

| Action | Owner | Manager | Coordinator | Staff |
|---|---|---|---|---|
| Create / edit / send Working Contract | ✅ | ✅ | ✅ | ✅ |
| Reopen for editing | ✅ | ✅ | ✅ | ✅ |
| Finalize | ✅ | ✅ | ✅ | ✅ |
| Download final PDF | ✅ | ✅ | ✅ | ✅ |
| Create amendment | ✅ | ✅ | ✅ | ✅ |
| Cancel | ✅ | ✅ | ✅ | ✅ |
| Delete | ✅ | ✅ | ❌ | ❌ |

Unchanged from D2/D3's certified 4-tier model (`current_user_role()`); D4 did not widen or narrow any existing gate. Delete remains Owner/Manager-only (pre-existing `deleteContract_` check, reused unmodified).

## 13. Notification Matrix

| Event | Notification | Source |
|---|---|---|
| Contract signed | Coordinator alert via `create_venue_notification('contract_signed', ...)` | D3 fix, preserved verbatim — re-verified live in this phase's own test run |
| Contract finalized | None (deliberately) — finalization is a venue-initiated action on their own contract, not something a coordinator needs alerting about | New in D4, by design |
| Amendment created/signed | Same `contract_signed` notification fires again for the amendment's own signing — no separate amendment-specific notification type was invented | New in D4 |

## 14. Activity Matrix

Reuses the existing `contract_activities` table and `ActivityTimeline` component unchanged. New activity types added: `reopened`, `finalized`. No second activity system was built.

## 15. Smart Field / Template Matrix

Unchanged from D2. Template → Working Contract merge (`buildContractMergeData` / `mergeContent`) was not touched by D4; amendments clone already-merged content directly (no re-merge against the original template, since the amendment is editing a specific agreement, not regenerating from scratch).

## 16. Storage & Access Security Model

| | `documents` bucket (pre-existing) | `contract-representations` bucket (new, D4) |
|---|---|---|
| `public` | `true` | `false` |
| Bare unauthenticated URL fetch | `HTTP 200` (confirmed live) | `HTTP 400` (confirmed live) |
| `authenticated` INSERT | allowed | **not** granted — writes are service-role only |
| `authenticated` SELECT | allowed | allowed (`select` policy only) |
| Real download path | stored/public URL | fresh 5-minute signed URL, minted on demand, never stored |

The `documents` bucket's `public: true` setting was confirmed as a real, pre-existing vulnerability (file bytes are served with no RLS check at all once a path is known/guessable) — not repeated for contract final representations.

## 17. Complete Journey Validation — real evidence

Run against the live local Supabase stack, authenticated as the real dev Owner user (`owner@example.com`, from `supabase/seed.sql`), using real venue/client/event data and the actual production code paths (`lib/contracts/*`, `lib/document-domain/*`) — not reimplemented logic, not mocks. All 20 checks below passed on the final run, after the two fixes in §11:

```
PASS — Owner sign-in
PASS — Create working contract
PASS — Publish to Document Domain on first send
PASS — Document status after send is 'shared'
PASS — Reopen -> edit -> resend creates a new version (3 versions: placeholder, first content, resend)
PASS — Old version preserved (not deleted)
PASS — Sign via sign_contract RPC
PASS — Coordinator notification created on signing
PASS — Generate real PDF (long contract, 6 pages, 2.57MB)
PASS — Upload PDF to contract-representations bucket
PASS — Finalize document (locks version + attaches representation)
PASS — isContractFinalized() reads true
PASS — Representation UPDATE is rejected (immutable)
PASS — Locked version UPDATE is rejected (immutable) — fixed in this phase, see §11a
PASS — Signed URL generation works
PASS — Bare public URL to private bucket fails (HTTP 400)
PASS — Create amendment from finalized contract
PASS — Amendment lineage recorded (supersedes reference)
PASS — Sign amendment
PASS — Original document becomes 'superseded' once amendment finalizes
PASS — Original representation storage path unchanged (untouched by amendment)
```

**PDF visual inspection** (Step 49): both a 6-page synthetic long contract and a real 1-page signed booking contract (Emma Carter & Jordan Lee, real venue branding) were rendered to actual image pages and inspected — correct header/logo/brand-color border, correct client/event/prepared meta, clean paragraph flow with no clipping, correct signature block with the honesty disclaimer, and a correctly-positioned footer with venue contact info and accurate "Page N of M" numbering on every page. This inspection is what caught the bug fixed in §11b.

Test data (contracts, canonical documents/versions/representations, storage objects) created during this validation was explicitly deleted afterward — this was disposable test data, not left in the shared dev database.

## 18. Known Limitations / Follow-up

- **Mobile verification was not performed** — no scriptable mobile session is available in this environment, consistent with every prior phase's own documented limitation. Desktop-width verification only.
- **`service_role` lacks table grants on several tables** (`canonical_documents`, `venue_notifications`, and likely others) — discovered incidentally while writing this phase's own validation script. Zero current impact: no real app code path ever asks `service_role` to read/write those tables (Document Domain writes always go through the `authenticated` client; `service_role` is used only for the storage upload, which correctly does have its own grant). Flagged here, not fixed, since it's outside this phase's scope and nothing currently depends on it.
- **A pre-existing, unrelated git index anomaly was observed** in the working tree during this phase's cleanup step (the index shows nearly the entire repository staged as deleted relative to `HEAD`, while every file remains fully intact on disk — consistent with a `git rm -r --cached` having been run by a different concurrent process). No file content was affected and this phase made no git commits. Flagged for the user's attention; not something this phase's own work caused or attempted to fix.
- **Amendment creation does not re-merge template smart fields** — it clones the prior agreement's already-resolved content directly. If the underlying template changed since the original was created, the amendment won't pick that up. This matches the brief's intent (amending *this specific agreement*, not regenerating from a template) but is worth stating explicitly.

## Final PASS / FAIL Matrix

| Capability | Status |
|---|---|
| Template → Working Contract | PASS |
| Template isolation (editing a Working Contract never touches the Template) | PASS |
| Smart fields (D2 merge system, reused unchanged) | PASS |
| Venue editing | PASS |
| Client review | PASS |
| Sharing | PASS |
| Waiting State | PASS |
| Change requests (via reopen-for-editing loop) | PASS |
| Versioning | PASS |
| Concurrent editing protection | PASS — real separate-connection stale-write test |
| Activity | PASS |
| Notifications | PASS — coordinator notification re-verified live |
| Permissions (4-tier) | PASS |
| Initials/Signature capture | PASS — preserved unchanged, not overstated |
| Signing | PASS |
| Signing audit (IP, user agent, consent, timestamp) | PASS — preserved from D3 |
| Finalization (explicit, separate action) | PASS |
| Immutable representation | PASS — representation UPDATE revoked; version-lock trigger added this phase |
| PDF generation (real, server-side) | PASS |
| PDF quality (visual inspection, short + long) | PASS — one real bug found and fixed this phase |
| Download / access security | PASS — private bucket, signed URLs only, confirmed against the known-open `documents` bucket |
| Amendment creation | PASS |
| Amendment sharing | PASS |
| Amendment re-signing | PASS |
| Original preservation on amendment | PASS — verified original representation storage path unchanged, document correctly superseded only on amendment finalize |
| Mobile | NOT VERIFIED — no scriptable mobile session available in this environment |
