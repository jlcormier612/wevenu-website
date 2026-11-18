# LUV-FINAL — P0 Lifecycle Safety + P1 Planning Intelligence

**Branch:** `feat/luv-final-p0-p1` (from `origin/main` @ `7b7b6788`)  
**Mode:** Implementation complete for founder review — **no commit, push, deploy, or paid AI calls**

Unrelated dirty work on `feat/reporting-chart-palette-correction` was left untouched (separate worktree).

---

## 1. Implementation summary

### Phase A — P0 lifecycle
**Already on `main` (PR #42):** shared `resolveRelationshipLifecycle`, generate/presentation gates, lazy `context.lifecycleWithdrawal` (status enum unchanged), pre-accept revalidation, `past_due` tour classification, observation supersession shared resolver.

**Added in this workstream:**
- Redundant-draft gate: block new `follow_up_email` when an actionable pending draft exists, or venue outbound within 48h (`lib/luv/draft-redundancy.ts` wired into `generateFollowUpDraft`).
- Lazy withdraw runs before the redundancy count so withdrawn Ellie-class drafts do not block legitimate new drafting incorrectly… wait — actually for Ellie, draftCapable is already false so we never reach redundancy. Redundancy protects prospects with duplicate pendings / recent sends.

### Phase B — P1 couple planning
Extended Ask portal context (Ask POST only) with:
- Open / overdue / completed planning tasks (+ suggested next)
- Questionnaire open vs completed
- Couple-visible published/shared timeline entries (venue-only audiences excluded)

Prompt + next-step keys: `open_tasks`, `open_questionnaire`, `open_timeline`.

### Phase C — Performance
- No AI / no Ask context on dashboard, portal home, or venue navigation GET
- Phase 3B L1 guardrail updated to read Focus Suspense island (Wave C2 moved assembly out of `page.tsx`) while preserving `getLuvObservations` ban on service + assembly

---

## 2. Files changed

| File | Why |
|------|-----|
| `lib/luv/draft-redundancy.ts` (+ test) | P0 redundant draft / recent outbound |
| `lib/luv/drafts.ts` | Wire redundancy after lifecycle withdraw |
| `lib/luv/portal-context/planning.ts` (+ test) | Pure planning builders |
| `lib/luv/portal-context/types.ts` | Planning fact types |
| `lib/luv/portal-context/build.ts` | Compose planning into portal context |
| `lib/luv/portal-context/format.ts` | Prompt formatting |
| `lib/luv/portal-context/load.ts` | Ask-POST loaders (tasks/questionnaire/timeline) |
| `lib/luv/portal-context/index.ts` | Exports |
| `lib/luv/ask-outcome.ts` (+ test) | New next-step keys |
| `lib/luv/couple-ask-prompt.ts` | Planning instructions |
| `app/api/portal/luv-ask/route.ts` | Comment only |
| `lib/dashboard/phase3b-l1-critical-path.test.ts` | Point L1 assembly assertions at focus island |

---

## 3. Lifecycle / send-boundary tests

Focused suite: **118 passed / 0 failed** including:
- Ellie-class signed-without-`first_booked_at`
- Prospect follow-up allowed
- Past-due ≠ upcoming
- Withdraw pending sales drafts
- Pre-send / accept path covered by existing lifecycle regression + draft send tests
- New redundancy unit tests

No OpenAI calls in these tests.

---

## 4. Couple context / permission tests

- Overdue vs open vs completed tasks
- Questionnaire status mapping without invention
- Venue-only timeline audiences excluded
- `includePlanning: false` keeps planning null
- `loadLuvAskPortalContext` only referenced from Ask route; not portal home / dashboard / dashboard service

---

## 5. Performance regression evidence

- `phase3b-l1-critical-path.test.ts` — pass (service still bans `getLuvObservations`; L1 assembly assertions now include `dashboard-focus-island.tsx`)
- Planning queries added only inside `loadLuvAskPortalContext` (Ask POST)
- Draft redundancy uses existing lead draft query + already-loaded messages — no page GET change

---

## 6. Remaining limitations

- No seating / EO / inventory / contract clause text (out of scope)
- No multi-turn Ask memory
- No staff / vendor chat
- Redundancy window is 48h heuristic (not venue-configurable)
- Withdrawal still stamps `context` (status stays `pending_review`) — intentional; no enum migration
- Practice Run × Luv isolation still not separately proven here

---

## 7. Proposed controlled AI evaluation (needs separate approval)

~12–20 Ask questions + ~4–8 draft generates on disposable Sandbox fixtures:

| ID | Probe |
|----|--------|
| D1 | Unbooked + upcoming tour → sales draft OK |
| D2 | Signed/booked → generate blocked |
| D3 | Pending equivalent → redundancy block |
| D4 | Accept/send after book → blocked |
| A1 | Next payment due |
| A2 | What should we work on next? |
| A3 | Outstanding questionnaires |
| A4 | Published timeline item |
| A5 | Cancellation clause → honest gap |
| A6 | Florist arrival not listed → gap |

**Do not run until founder authorizes paid calls.**

---

## 8. Commit / deploy recommendation

1. Review this branch `feat/luv-final-p0-p1` in the worktree  
2. On approval: commit on this branch only (do not touch reporting dirty branch)  
3. PR → merge to `main`  
4. Deploy Sandbox **from main only** after merge  
5. Then optional controlled AI/browser acceptance  

**Production:** untouched.
