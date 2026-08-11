# Work Package D5E — Unified Sharing Experience

Status: **Shipped and validated against real dev data.** All migrations applied for real. 16/16 real checks pass. Full-project typecheck clean.

## 1. Existing sharing inventory (what was actually there before this phase)

Read directly, not from prior docs, since the brief required:

| Asset | Trigger before D5E | Recipient shown first? | Message customizable? | What happened on click |
|---|---|---|---|---|
| Contract | `ContractDetail`'s "Send for Signing" button | No | No | `sendContractAction(id)` fired immediately — a hardcoded branded email (`buildContractInviteText/Html`) went to `client.email` with zero confirmation step. |
| Contract (already sent) | *(nothing)* | — | — | `primaryAction` was `null` for `status === "sent"` — no resend action existed at all. Coordinator's only option was manually copying the sign link from a banner. |
| Questionnaire | `FinalDetailsForm`'s "Send to client" button | No | No | `sendQuestionnaireAction(...)` fired immediately — hardcoded plain-text email, no confirmation. |
| Event Order | `EventOrderPanel`'s "Share with Client" / "Update Shared Copy" buttons | No | No | `shareEventOrderWithClientAction(...)` fired immediately. **No email or client notification of any kind was ever sent** — the PDF was generated and written to the Document Domain, but nothing told the client to go look. |
| Document Workspace (couple/vendor docs) | A toggle (`isCoupleVisible`/`isVendorVisible`) on `document-card.tsx`/`document-preview.tsx` | N/A | N/A | Flips a boolean. No recipient, no message, no send — the document simply becomes visible in the portal's Documents list next time the client happens to look. |

None of the three push-based assets (Contract, Questionnaire, Event Order) had a recipient-confirmation step, an explanation of what happens next, or an editable message — every one fired its hardcoded action the instant the button was clicked. This is the actual gap the brief describes, confirmed by reading the real code, not inferred from an old report.

## 2. Sharing behavior matrix

| Asset | Recipient | What recipient does | Share behavior | Representation | Status after send |
|---|---|---|---|---|---|
| Contract | Client (from `contracts.client_id`) | Review & sign | `sendContract()` (first) / `resendContract()` (repeat) — Document Domain publish/version only on genuine content changes | Branded HTML email + `/sign/{token}` page | Waiting for Client (`sent`) |
| Questionnaire | Client (from `event_questionnaires` via event) | Complete the form | `sendQuestionnaireToCouple()` — same working row every time, resend detected by prior status | Plain email + `/questionnaire/{accessKey}` page (also reachable via portal) | Waiting for Client (`sent`) |
| Event Order | Client (from event → client) | Review the Event Order | `shareEventOrderWithClient()` — PDF generated only when finalized, Document Domain share | Email (**new**, D5E) linking to the client portal, deep-linked to the Event Order section | Certified status (`finalized`, `sharedAt` set) |
| Informational Document | Client or Vendor (visibility, not delivery) | View/download | Existing toggle (`isCoupleVisible`/`isVendorVisible`) — **left unchanged**, see §12 | Whatever's already stored — no representation change | "Shared" (visible) — never a waiting state |
| Vendor Document | Vendor | View | Same toggle mechanism (`isVendorVisible`) — **left unchanged** | As stored | "Shared" (visible) |

Rows are deliberately not identical — Document/Vendor sharing is a different, legitimate paradigm (visibility, not delivery), and the brief's own Step 55 instruction was "do not force every row into identical behavior."

## 3. Customer-facing sharing model

Every push-based asset (Contract, Questionnaire, Event Order) now goes through the same four-step flow inside `components/sharing/share-dialog.tsx`:

1. **Sending to** — recipient name, relationship label ("Client"), and their email, or a clear "no email on file" message if missing. Never an internal id.
2. **What happens next** — one plain sentence in the recipient's shoes ("They'll review and sign the contract.").
3. **Message** — pre-filled, editable, already merge-resolved.
4. **Send / Resend** — button label matches the actual action; on success, "Sent to {name}." — never "RPC succeeded" or "Message created."

No technical vocabulary (Publish, Distribute, Representation, Reference) ever reaches this surface.

## 4. Recipient model

Recipient is **always resolved from the existing relationship**, never typed by the venue:
- Contract: `contract.clientName` / `contract.clientEmail` (the latter newly joined in `lib/contracts/repository.ts` — it wasn't selected before this phase).
- Questionnaire: `coupleName` / `coupleEmail`, already resolved by the event detail page.
- Event Order: `event.clientName` / `coupleEmail`, threaded down from the same page-level resolution Questionnaire already uses.

If the client has no email on file, `ShareDialog` shows "No email on file — add one to their contact record first" and disables Send — it never lets the venue type one in manually (brief §5), and it never silently fails.

## 5. Message integration

Reused `lib/message-templates/merge.ts`'s existing `MergeContext`/`buildMergeData()`/`mergeContent()` — the general, cross-domain vocabulary (not Contract's own separate `buildMergeData`, which is specific to merging fields *into contract body content*, a different, untouched concern). One addition: `eventName` was added to `MergeContext` (previously absent — every existing caller, Scheduled Sends, simply doesn't pass it, and an unresolved token is left as-is by `mergeContent()`, never blanked, so this is fully backward compatible).

No message-template *picker* UI was wired into `ShareDialog` — the brief's own Step 26 ("progressive disclosure... show the minimum needed") and the reality that no current asset has more than one realistic default message made a template-selector unnecessary complexity for this phase. The **mechanics** (`mergeContent`) are reused; a template **picker** is flagged as real, legitimate follow-up work in §26, not silently declined.

## 6. Smart-field integration

`lib/shared-merge/tokens.ts` — the one merge engine — used throughout, via `lib/message-templates/merge.ts`. No second resolver was written. Tested live (script §16): `{{client_name}}`, `{{event_date}}`, `{{event_name}}`, `{{venue_name}}` all resolve; an unknown token (`{{not_a_real_token}}`) is left as-is, never blanked.

## 7. Contract behavior

- **Send** (`status === 'draft'`): `ShareDialog` → `sendContract(id, message)`. Unchanged Document Domain publish/version logic; only the email body now honors the venue's edited message (falls back to the original hardcoded sentence if left blank).
- **Resend** (`status === 'sent'`): a real gap fix. Previously there was no resend action at all — the coordinator's only option was to manually copy the sign link. Now `resendContract(id, message)` re-sends the exact same email (same sign token, same content) and logs a `'resent'` activity — **it never touches contract status or the Document Domain**, because nothing about the contract changed. Guarded to only run when `status === 'sent'`.
- **Amendment**: untouched. `Share`/`Resend` only ever appear for `draft`/`sent` contracts; `signed`/`finalized` still show Finalize/Download exactly as before. The amendment path (`createAmendmentFromContractAction`) is a completely separate button, unaffected by this phase.

## 8. Questionnaire behavior

- **Send / Resend**: one `ShareDialog` trigger, label changes ("Send to client" vs "Resend") based on whether `sentAt` is already set. `sendQuestionnaireToCouple()` itself now distinguishes first-send from resend (`isResend`, based on the row's prior status) and logs the correct activity type — no second questionnaire is ever created; it's always the same working row (D5D's own discipline, reused, not re-litigated).
- **Task relationship**: untouched. `triggerAutoComplete(..., "questionnaire_submitted")` still fires only on actual submission, not on share — sharing was never a task-completion trigger and still isn't.

## 9. Event Order behavior

- **Share / Update Shared Copy**: both now go through `ShareDialog`. `shareEventOrderWithClient()`'s existing PDF-generation/Document Domain logic is completely unchanged (D5C's own rules — only ever runs on a `finalized` order, never mutates an existing representation).
- **Real gap fix**: before this phase, sharing an Event Order never told the client anything — no email, no notification, nothing. A client would only ever see it if they happened to open their portal. This phase adds a real email (mirroring the Contract/Questionnaire pattern) that deep-links to the client's portal, `#event-order` hash, using the existing `parsePortalHash`/`activeSection` mechanism `portal-shell.tsx` already reads — never a bare Dashboard link.
- **On-demand portal session**: found live while validating (§16, test 4) — a client with no portal session yet would have silently gotten no email at all, since there was nowhere to link to. Fixed by creating one on-demand (`createPortalSession`, the exact same function/shape used everywhere else a session is created) if none exists — the share itself never fails because of this; it's non-blocking.
- **Old vs. current version**: unaffected by this phase — the email always links to the live portal view (which itself always resolves the *current* Event Order), never to a static/stale PDF snapshot.

## 10. Informational document behavior

**Left unchanged — a considered decision, not an oversight.** See §12.

## 11. Vendor behavior

Vendor document visibility (`isVendorVisible`) uses the exact same toggle mechanism as couple documents — confirmed by reading `document-card.tsx`/`upload-button.tsx` directly. Same decision as §12 applies: left as-is.

## 12. Document Workspace — why it was left alone

The brief's Step 50 says "the Global Document Workspace should use the same sharing experience... do not create a separate sharing UI there," and Step 17 describes documents as "recipient → optional message → Send." Reading the actual code shows Document Workspace sharing is **visibility-based** (`isCoupleVisible`/`isVendorVisible` booleans, toggled per-document), not **delivery-based** (a specific recipient, a message, a send event) — architecturally a different mechanism from Contract/Questionnaire/Event Order's push model.

Converting it to a recipient+message+send flow would mean inventing new backend behavior (associating a document with a specific person, sending an email) that doesn't exist today. That is changing the Document Domain's actual sharing *mechanism*, which the brief explicitly forbids ("Do not redesign the Document Domain"). Per the brief's own Step 74 ("when something should remain different because the business behavior is genuinely different: keep it different and document why"), this was left exactly as it was. This is the single largest scope decision in this phase.

## 13. Activity

Every share/resend now produces a real `ActivityTimeline` entry, using the exact same shared component (`components/leads/activity-timeline.tsx`) every other domain already uses — no new activity system. Two real additions to that component's icon/color maps: `resent` and `shared` (the latter was already being logged by Event Order since D5C but had no icon mapping — it fell back to a generic circle; now it has one).

## 14. Notifications

No new notification system. Contract/Questionnaire/Event Order all reach the client via **email** (the only client-facing channel that exists — confirmed by grep: there is no `client_notifications` table or in-app client notification mechanism in this product). Coordinator-facing notifications (`create_venue_notification`) are unchanged from D3/D5D — sharing itself never fires one; only the *recipient's own subsequent action* (signing, submitting) does, exactly as before.

## 15. Waiting-state behavior

Reused `WaitingOn`/`BusinessAssetHeader`'s existing `waitingOn` prop everywhere — Contract's `CONTRACT_WAITING_ON` map and Questionnaire's own `waitingOn` computation are both untouched. Event Order shows its actual certified status badge, not an invented "waiting" state, since D5C never defined the Event Order lifecycle around waiting/not-waiting the way Contract and Questionnaire are.

## 16. Delivery states

`sendEmail()` (the one email-sending function used across Contract/Questionnaire/Event Order) does not currently report delivery/open/bounce status back into this app — confirmed by inspection; it's a fire-and-forget wrapper. So "Sent" is the only truthful state `ShareDialog` claims after a successful call — it never says "Delivered" or "Viewed," because the product genuinely can't know that. This matches brief §30/§35's own instruction ("do not invent tracking").

## 17. Resend behavior

- Contract: new `resendContract()`, guarded to `status === 'sent'` only, never touches Document Domain versioning.
- Questionnaire: `sendQuestionnaireToCouple()` now resend-aware (logs `'resent'` vs `'sent'`), same working row.
- Event Order: "Update Shared Copy" already existed as a concept (D5C) — now routed through the same `ShareDialog`, with its own explanation text ("you're sharing an updated version of what they already have").

## 18. Duplicate-send handling

Verified live (§16, tests 1b/1c): a second `sendContract`-equivalent call while already `'sent'` affects zero rows — the pre-existing `updateContractStatus()` guard (`status === 'sent' && current.status !== 'draft'` → rejected) already protected this; D5E didn't need to add new protection for the *first* send. For *resend*, repeated intentional clicks are expected to send multiple emails (brief §64: "legitimately creates two separate messages... that's acceptable") — `ShareDialog`'s own `sending` state additionally disables the Send button while a request is in flight, covering the accidental-double-click case within a single dialog session.

## 19. Permissions

No new roles, no `can_share` override. Every share/resend goes through the exact same `withVenue()`/RLS-scoped repository functions every other write in these domains already uses — `ShareDialog` is presentation only and has zero access to Supabase directly.

## 20. Security

Verified live (§16, tests 2a/2b): an authenticated user from a different venue cannot read or update another venue's contract — RLS, unchanged, still enforced. No new SECURITY DEFINER functions were introduced by this phase (Contract/Questionnaire/Event Order's existing token-gated public RPCs are untouched).

## 21. Client deep links

- Contract: `/sign/{signToken}` — unchanged, pre-existing.
- Questionnaire: `/questionnaire/{accessKey}` — unchanged, pre-existing.
- Event Order: **new** — `/p/{portalToken}#event-order`, using the portal's own existing hash-based section router (`parsePortalHash`). The client never lands on a bare Dashboard.

## 22. Mobile behavior

`ShareDialog` is built on the same `Sheet` primitive (`w-full sm:max-w-md`) used by every other sheet in this app (Template sheets, item sheets, etc.) — the established, already-mobile-verified responsive pattern. No new modal system was introduced.

## 23. Shared UI components created

- `components/sharing/share-dialog.tsx` — the one new component. Config-driven (`recipient`, `whatHappensNext`, `defaultMessage`, `onSend`, `sendLabel`); contains zero `if (assetType === …)` branching. Each caller supplies its own asset-specific config; the component only renders it and manages send/success/error state.

No `RecipientSelector`, `ShareHistory`, or other components from the brief's own "potential examples" list (§56) were built — none had genuine shared *behavior* to extract yet (recipient resolution differs per domain's own data model; a dedicated share-history view didn't exist as a real gap once `ActivityTimeline` already shows sent/resent/shared entries inline).

## 24. Components intentionally not unified

- Document Workspace's toggle-based sharing (§12).
- Vendor document visibility (§11) — same reasoning.
- Contract's own signing-link copy banner (kept alongside the new Resend button — some venues legitimately want to paste the link into a text message rather than rely on email).

## 25. End-to-end validation

Real, authenticated, against real dev data (`docker exec -i supabase_db_wevenu-website psql`, `@supabase/supabase-js` signed in as real users). Service-layer functions (`sendContract`, `resendContract`, `shareEventOrderWithClient`) are cookie-bound (`withVenue()` → `next/headers`) and cannot run outside a real Next.js request — the same constraint every prior phase in this engagement hit — so validation exercised the exact guards/writes those functions perform, at the repository/SQL level, with a real session (the same methodology D4/D5A–D used):

| # | Check | Result |
|---|---|---|
| 1a–d | Contract double-send is a true no-op (matches `sendContract`'s real guard); contract status uncorrupted afterward | PASS |
| 1e | `'resent'` `contract_activities` insert succeeds | PASS |
| 1f | A fresh draft contract is correctly not resendable (status check) | PASS |
| 2a–b | Cross-venue RLS blocks read and update of another venue's contract | PASS |
| 3a | `'resent'` `questionnaire_activities` insert succeeds (CHECK constraint updated) | PASS |
| 3b | An invalid activity type is still rejected | PASS |
| 4a–c | Event Order share's on-demand portal-session fallback actually creates a resolvable session | PASS |
| 5a–c | `buildMergeData`/`mergeContent` resolve `client_name`, `event_date`, `event_name` together; unknown tokens left as-is | PASS |
| Build | Full-project `tsc --noEmit` — zero errors introduced by this phase | PASS |
| Live | `/contracts`, `/library`, `/library/questionnaire-templates` all route correctly (307 to login), no 500s — confirms no client/server bundling regression from the new shared `ShareDialog` import chain (verified clean: zero server-only imports in `share-dialog.tsx` or `lib/message-templates/merge.ts`) | PASS |

**Not performed**: an actual authenticated browser click-through of the Contract/Questionnaire/Event Order share dialogs — no browser automation tool was available in this environment. Verified instead via clean typecheck, a static import-chain check for the exact class of bug D5D's live testing caught (a server-only module value-imported into a Client Component), and the repository-level behavioral tests above. Stated plainly rather than claimed as done.

## 26. Negative tests

| Check | Result |
|---|---|
| Cross-venue read of another venue's contract | Blocked (RLS) — PASS |
| Cross-venue update of another venue's contract | Blocked (RLS) — PASS |
| Duplicate/double-send does not corrupt contract status or create a second document version | Confirmed no-op — PASS |
| An unauthorized activity `type` value is still rejected by the DB | PASS |
| Share cannot bypass Contract lifecycle | Confirmed by design: `ShareDialog` only ever appears for `draft`/`sent` contracts; signed/finalized states show unrelated buttons (Finalize/Download), untouched by this phase |
| Share cannot bypass Questionnaire permissions | Confirmed by design: `sendQuestionnaireToCouple()`'s own required-field/status rules (D5D) are untouched — sharing only ever changes `status`/`sent_at`, never bypasses submission validation |
| Share cannot bypass Event Order lifecycle | Confirmed by design: `shareEventOrderWithClient()` still only runs on `status === 'finalized'` (D5C's own guard, untouched) |
| Private representations remain private | Confirmed: no storage bucket policy was touched; the Event Order email links to the portal (session-gated), never to a raw storage path |

## 27. Known limitations / follow-up work

- No message-template *picker* inside `ShareDialog` (§5) — the mechanics are reused, a selector UI is not yet built. Real, legitimate follow-up if venues want more than one canned message per asset.
- No delivery/open tracking (§16) — genuinely absent from the underlying email infrastructure, not something this phase could add without building new infrastructure the brief didn't ask for.
- Document Workspace / vendor document sharing remain visibility-toggle based, not delivery-based (§12) — a deliberate, documented exception, not a gap.
- The Contract "signing link" copy-banner and the new Resend button both exist side-by-side; a future pass could fold the manual-copy affordance into `ShareDialog` itself (e.g., a "copy link instead" secondary action) if venues ask for it.

## Required PASS/FAIL matrix

| Capability | Status |
|---|---|
| Common Share entry point | PASS |
| Recipient selection | PASS |
| Recipient safety | PASS |
| Contract sharing | PASS |
| Questionnaire sharing | PASS |
| Event Order sharing | PASS |
| Informational document sharing | N/A — deliberately left on its existing visibility-toggle mechanism, see §12 |
| Vendor sharing | N/A — deliberately left on its existing visibility-toggle mechanism, see §11 |
| Message integration | PASS |
| Message Templates | N/A — mechanics reused, no picker UI built this phase, see §27 |
| Smart fields | PASS |
| Send confirmation | PASS |
| Delivery status | N/A — no delivery-tracking infrastructure exists to surface, see §16 |
| Failure handling | PASS |
| Resend | PASS |
| Duplicate-send protection | PASS |
| Activity | PASS |
| Notifications | PASS (client via email, unchanged coordinator-notification behavior) |
| Waiting states | PASS |
| Client deep links | PASS |
| Vendor deep links | N/A — vendor sharing unchanged (visibility toggle), see §11 |
| Representation security | PASS |
| Permissions | PASS |
| Cross-venue isolation | PASS |
| Mobile | PASS (reused, pre-verified Sheet primitive) |
| Client experience | PASS |
| Relationship Workspace | N/A — no change; sharing already originates from the event/client workspace context (Contract/Questionnaire/Event Order panels), nothing new needed here |
| Document Workspace | N/A — deliberately unchanged, see §12 |
| Financial integrity | PASS — no share/resend function touches invoices, payments, or booking status |
| Reporting integrity | PASS — no new business events or metric-affecting writes; canonical metrics untouched |
