# Luv lifecycle communication safety — implementation report

Branch: `fix/luv-lifecycle-communication-safety`  
Base: `origin/main` @ `ded67b84` (PR #40 merge)  
**No merge / deploy / bulk withdrawal / sends performed.**

## 1. Baseline and blast radius

| Item | Value |
|------|--------|
| Main tip at branch create | `ded67b8462de45f11756401b5637dd3024ee416d` |
| Sandbox serving during build | still C1 `3c5b2e24` while PR #40 deploy was in flight (Reporting parallel; not touched) |
| Tables touched (read) | `leads`, `clients`, `contracts`, `contract_signers`, `payment_schedules`, `payment_line_items`, `tour_appointments`, `luv_drafts` |
| Tables mutated | `luv_drafts.context` only (lazy stamp) — **never** booking/contract/tour rows |
| Status enum | unchanged (`pending_review` \| `accepted` \| `discarded`) |

**Paths inventoried**

| Path | Lifecycle gate |
|------|----------------|
| `generateFollowUpDraft` | Yes — facts + eligibility |
| Auto-generate on Luv panel | Yes — uses `followUpDraftEligible` from presentation |
| `loadLeadFollowUpPresentation` CTA | Yes |
| Pending review list | Yes — filters lifecycle withdrawals |
| Copy / accept | Yes — server `updateDraftStatus` revalidates |
| Messages send → mark accepted | Yes — same server path |
| Dashboard tour observations | Shared via `tourFollowUpSuperseded` → lifecycle resolver |
| Client planning drafts / portal | Untouched (separate surfaces) |

## 2. Files changed and why

**New**

- `lib/luv/relationship-lifecycle-eligibility.ts` — pure A/B/C resolver
- `lib/luv/relationship-lifecycle-loader.ts` — read-only facts loader
- `lib/luv/relationship-lifecycle-eligibility.test.ts`
- `lib/luv/relationship-lifecycle-regression.test.ts`
- `docs/qa/luv-lifecycle-audit/*` — preview + acceptance plan + this report

**Modified**

- `follow-up-draft-eligibility.ts` — consume lifecycle facts; block sales intents
- `drafts.ts` — load facts; generate gate; lazy withdraw; pre-accept revalidation
- `follow-up-presentation.ts` — same facts for CTA
- `follow-up-workflow-context.ts` — `past_due` tour classification (no DB rewrite)
- `observation-supersession.ts` — delegate to shared resolver
- `draft-status.ts` — actionable vs withdrawn pending filters
- `luv-actions.ts` / lead & event detail / `luv-draft-panel.tsx` — handle reject + UI

## 3. Lifecycle rules and precedence

1. Lost / archived → no sales follow-up  
2. Booking cancelled → withdraw sales drafts  
3. Past event + commitment → no prospecting  
4. Consent revoked → block  
5. Official Booked (`first_booked_at` **or** `clients.lifecycle_booked_at`) → no sales  
6. Signed contract **or** paid line item → commercially committed (sales superseded) **without** inventing Booked  
7. Else prospect — sales intents allowed  
8. `answer_questions` remains allowed after commitment when purpose-built  
9. Past-due `scheduled`/`confirmed` tours → `past_due` (not `upcoming`) — classification only  

No generic post-booking check-in is generated.

## 4. Test results

Focused suite (lifecycle + draft send/discard + owner capability + supersession + workflow):

**92 passed / 0 failed**

Known pre-existing on clean `ded67b84` (unrelated):  
`pipeline-stage-evidence.test.ts` — “upcoming tour all-set…” expects `recommendation === undefined` but gets “Review tour logistics”. Confirmed failing with our changes stashed.

## 5. Existing behavior preserved

- Owner draft vs proactive silence for **prospects** (completed tour → owner can still draft)  
- Lost/archived hard blocks  
- Consent / channel protections unchanged (recheck hook via `channelConsentOk`)  
- Booking stamps, contracts, payments, tours **not rewritten**  
- Draft history / discard-delete semantics  
- Reporting / Stripe / billing untouched  
- No status-enum migration  

## 6. Pending-draft impact preview (read-only)

File: `docs/qa/luv-lifecycle-audit/pending-draft-impact-preview.json`

| Metric | Count |
|--------|------:|
| Pending sales drafts scanned | 22 |
| Would withdraw on lazy access | 9 |
| Already withdrawn | 0 |

Includes Ellie `1e1e64a7-…` → `contract_signed`.  
**No bulk stamp performed** — lazy invalidation only when lead Luv loads or accept/copy/send is attempted.

## 7. Browser acceptance

See `SANDBOX-ACCEPTANCE-PLAN.md`. Requires approved Sandbox deploy of this branch tip. Ellie records must not be mutated; no sends.

## 8. Performance

Per lead Luv load: one parallel batch for tour + proposal + messages + lifecycle facts (clients → contracts/payments). Lazy withdrawal updates only drafts that need a stamp (typically 0–few). No N+1 per message.

## 9. Remaining risks

- Drafts lacking `workflowIntent` in old context default to sales-family withdrawal when commercially committed (intentional for `follow_up_email`).  
- Payment join omitted from **preview** (conservative on contract/booked only); runtime loader includes payments.  
- Browser GREEN blocked until Sandbox deploy approval.  
- Pre-existing pipeline-stage-evidence failure remains outside this scope.

## 10. Verdict

**YELLOW** — implementation + unit/regression matrix GREEN; live Sandbox browser acceptance and deploy not yet authorized.

Stop for deploy approval.
