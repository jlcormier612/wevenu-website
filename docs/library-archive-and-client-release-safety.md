# Library Archive + Client Release Safety

**Date:** 2026-08-11  
**Product:** Hello to Cheers  
**Scope:** Soft-archive UX consistency + Use/Create vs Send/Publish/Share clarity  
**Constraint:** No second workflow engine, no second archive system, no invented client-release actions

---

## 1. Lifecycle standard

| Verb | Meaning |
|---|---|
| **Edit** | Change a reusable Library asset. Never client-facing by itself. |
| **Use / Create** | Snapshot or start a *working* domain object (draft). Still private to the venue. |
| **Send / Share / Publish** | Explicit client/prospect exposure via that domain’s existing send path. |
| **Archive / Restore** | Soft-hide or restore reusable Library assets (`is_archived` or packages `is_active`). Does not mutate historical working records. |
| **Withdraw / Stop access** | Only where the domain already has a status gate that removes public access — never claims email recall. |

Shared presentation only:

- `components/library/library-archived-section.tsx`
- `components/library/partition-archived.ts`
- Labels in `components/library/labels.ts`

Primary lists show **active only**. Archived items live in a collapsible **Archived** section with Preview + Restore (not Use).

---

## 2. Questionnaire withdraw honesty

| Capability | Supported? | Mechanism | Honest copy |
|---|---|---|---|
| Stop public form access | Yes | `withdrawQuestionnaireAccess` → `status = 'draft'` | Public link stops working |
| Preserve answers | Yes | Row not deleted; `access_key` kept | Answers stay on the event |
| Recall email | **No** | — | Must never claim email recall |
| Rotate access key | **No** (not needed for withdraw) | — | Re-send reuses key when opened again via send |
| Reopen after submit | Yes | `reopenQuestionnaire` → `sent` | Existing |
| Apply template after send | No | `applyTemplateToEvent` rejects non-draft | Existing isolation |

Public RPC allow-list (`get_questionnaire_for_couple`): `sent | submitted | reviewed` only.  
Draft = no couple access.

---

## 3. Domain matrix

| Domain | Current lifecycle | Issue found | Fix made | Validation | Intentional difference |
|---|---|---|---|---|---|
| Questionnaires | Template → apply draft → Send | Use felt send-like; archived mixed in; no withdraw | Use confirm → Create Questionnaire; Send consequence copy; Stop client access; Archived section | Unit + browser | — |
| Messages | Edit template; send in Messaging | One-click compose send | Confirm before Send; archive section; library copy | Spot browser | No Library Use — intentional |
| Contracts | Use Template → draft; Send for Signing | Use available on archived; create copy soft | Active-only Use; archived section; draft create copy; refuse archived template server-side | Spot | Cancel = existing withdraw |
| Brochures | Edit; Share from detail | List empty-state said “send”; no revoke | Archive section; Share honesty (no revoke today) | Spot | No revoke architecture |
| Event Orders | Template edit; EO finalize + Share | Template ≠ share ambiguous | List copy + Share dialog explains prior Use ≠ Share; archive section | Spot | sharedAt never cleared |
| Saved Reports | Open report / delete bookmark | Delete ambiguity | Confirm clarifies bookmark-only | Spot | No archive / no client send |
| Packages | Edit; `is_active` archive | Archived mixed | Active + Archived section | Spot | Booking apply elsewhere |
| Inventory | Edit; archive | Archived mixed | Archived section | Spot | No Use/Send |
| Inventory templates | Edit; archive | Archived mixed | Archived section | Spot | Apply on event |
| Timelines | Edit; apply on event | Archived mixed | Archived section + use≠send copy | Spot | Apply on event |
| Floor Plans | Edit; apply on event | Archived mixed | Archived section + use≠send copy | Spot | Apply on event |
| Payment Plans | Code masters; Use → invoice flow | Could imply send | Clarifying helper under CTA | Spot | No archive DB rows |
| FAQs/Guide | Save + per-FAQ publish toggle | Publish vs save unclear for starters | Copy: publish only after save with toggle on | Spot | Not `is_archived` |
| Playbooks | Edit; apply on event | Unarchive label; archived mixed | Restore label + Archived section | Spot | Apply on event |

---

## 4. Relationship to interaction-model doc

Extends `docs/library-interaction-model-standardization.md` §8 Use and §11 Overflow:  
**Archived assets must not expose Use** until Restore.

---

## 5. Key files

| Area | Path |
|---|---|
| Withdraw | `lib/events/questionnaire.ts` `withdrawQuestionnaireAccess` |
| Apply guard (archived) | `lib/questionnaire-templates/service.ts` `applyTemplateToEvent` |
| Activity type | `supabase/migrations/20261280000000_questionnaire_access_withdrawn_activity.sql` |
| Library Use UX | `components/questionnaire-templates/questionnaire-template-list.tsx` |
| Event Send/Withdraw UX | `components/events/questionnaire-family-panel.tsx` |

---

## 6. Validation (this pass)

**Date:** 2026-08-12  
**Env:** local venue Next on `:3000` (`owner@example.com` / Sweet Daisy) + Docker Supabase  
**Runner:** Playwright (`docs/qa/library-archive-release-safety/capture.mjs`) — browser MCP unavailable

### Login diagnosis

| Finding | Evidence |
|---|---|
| **Cause** | Not a missing `/login` route. Venue `next-server` on `:3000` had a **corrupt/stale `.next` Turbopack cache** (ENOENT on `build-manifest.json` / `[turbopack]_runtime.js`; iCloud-duplicated type files like `routes.d 3.ts`). Proxy correctly redirected `/` → `/login`, but App Router returned the builtin **404** until cache wipe + restart. A second stray venue process also appeared on **:3010** and competed briefly. |
| **Fix** | Killed listeners on 3000/3010, `rm -rf .next`, restarted via `scripts/start-venue-dev.sh`. `/login` → **200** + “Welcome back”. |
| **Product regression?** | **No** — `app/(auth)/login/page.tsx` present and listed in `AppRoutes`. |

### Migration

| Item | Result |
|---|---|
| `20261280000000_questionnaire_access_withdrawn_activity.sql` | **Already applied** locally — constraint includes `access_withdrawn`. Capture script re-asserts constraint idempotently. `supabase db push --local` blocked by unrelated older unapplied migrations (`--include-all` not used). |

### Matrix (Tests A–G + archive spot-checks)

| Check | Result | Evidence |
|---|---|---|
| **A** Archive separation (Questionnaires) | **PASS** | Archived open: Use=0, Restore=2, Preview≈2 |
| **B** Use → Create draft (not send) | **PASS** | status=`draft` after Create; template applied |
| **C** Pre-send review surface | **PASS** | Preview as client=1, Send Questionnaire=1 on event |
| **D** Send consequence copy | **PASS** | Send sheet mentions email/secure link |
| **E** Send status + timestamp | **PASS** | Sent status + timestamp text |
| **F** Withdraw / Stop client access | **PASS** | UI Stop → `draft`; `get_questionnaire_for_couple` rows=0; honesty dialog recorded |
| **G** Reopen + working isolation | **PASS** | Reopen (scoped to `#questionnaires`) → `sent`; Create/Apply hidden when non-draft |
| Packages Archived | **PASS** | After seed: Use=0, Restore=1 |
| Messages Archived | **PASS** | After seed: Use/Send=0, Restore=1 |
| Contracts Archived Use blocked | **PASS** | Use Template in archived=0 |
| Unit (prior) | **PASS** | 21/21 (`partition-archived` + resolve + status contract) |

**Evidence:** `docs/qa/library-archive-release-safety/report.json` + screenshots in the same folder.

### Intentional QA notes

- Capture must target **`#questionnaires` Reopen** — event Playbook tasks also expose “Reopen” and will false-fail Test G if scoped to the whole page.
- Cold Turbopack after wiping `.next` needs longer login waits (`#email` visible). Prefer keeping a single venue process on `:3000`.

Withdraw is **sent → draft only** (submitted/reviewed use Reopen → sent). Confirmation copy: stops link access; does **not** recall email.

---

## STOP

Do not invent revoke for brochures/EO when architecture lacks it. Do not build a second send/archive engine.
