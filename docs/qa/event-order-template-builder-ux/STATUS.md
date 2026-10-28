# Event Order Template Builder UX — acceptance STATUS

**Verdict: GREEN** (complete venue-owner workflow + usable UI on Sandbox)  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

---

## Deployment reconciliation

| Item | Result |
|---|---|
| GitHub run `40782882893` | `success` — Deploy Sandbox — headSha `3865e4c1494fae80572ef3640b35bf7c907713e9` |
| ECS PRIMARY | single deployment, `rollout=COMPLETED`, steady state |
| Serving image (pre follow-up fix) | `…/htc-sandbox-venue-app:3865e4c1494fae80572ef3640b35bf7c907713e9` |
| Competing deploy | none at acceptance start |

UX product tip was already serving. This pass closed harness gaps, proved the full workflow, then applied one residual copy correction (sheet save button) — see “UX changes this pass.”

---

## Original audit / root cause

See [`AUDIT.md`](./AUDIT.md).

**Root cause (confirmed):** guided builder already modeled package items vs primary/follow-up choices correctly; venue-facing labels and empty states previously collapsed those into “Included” + catalog-major jargon. Commit `3865e4c1` fixed that framing. This acceptance pass verifies the **actual** experience end-to-end, not label assertions alone.

---

## UX changes this pass

| Change | Why |
|---|---|
| Sheet primary action: **Add package item** / **Save package item** (was “Add offering” / “Save offering”) | Sheet title and workspace already said package item; the commit button still said “offering,” which reintroduced catalog jargon at the moment of save. |
| Stale unit assertions updated (`offerings.test`, `hierarchy.test`, `builder-ux.test`) | Prior copy expected “Add from Offerings” / “Select where this belongs” on EO choice UI — obsolete after multi-parent catalog + package-item language. |

No schema, pricing-model, or selection-engine redesign.

---

## Browser acceptance matrix (Sandbox, serving tip)

Harness: `docs/qa/event-order-template-builder-ux/verify-browser.mts`  
Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/`

Command:

```bash
EXPECTED_SHA=<serving> npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts
```

### Automated checks — all PASS (35)

| Area | Checks | Result |
|---|---|---|
| Deploy | `serving_sha` | PASS |
| Usability copy | package items / choices headings; no “Included in Catering”; no major-choices jargon; primary CTA; empty state | PASS |
| A — package items + pricing | catalog covered (`Day-of coordination`); template-only additional charge `$150` Champagne Toast; UI Covered vs Additional; catalog vs template-only labels | PASS |
| B — primary question | Dinner style + Buffet/Plated same `group_id`; answers under question in UI | PASS |
| C — follow-ups | Sides → Buffet; Entrées → Plated; catalog + template-only under Sides; preview path switch; incomplete reject; complete accept | PASS |
| D — catalog vs template-only | offering_id set/null; Champagne Toast did not create Offering | PASS |
| E — reopen / finalize integrity | reopen structure; server validate reject/accept; resolve both paths; rejected finalize no lines; apply lines once; no duplicate reapply; template rename does not mutate EO snapshot | PASS |
| Mobile | 390px structure readable | PASS |

### Actual browser workflows exercised

1. New wedding EO template → Catering category workspace  
2. Add catalog package item (covered by package price)  
3. Add template-only package item (additional charge $150)  
4. Add primary question “Dinner style” + Buffet Dinner / Plated Dinner answers  
5. Add Sides under Buffet (Caesar salad catalog + Roasted Vegetables template-only)  
6. Add Entrées under Plated (Chicken Marsala catalog)  
7. Leave / reopen template — structure intact  
8. Preview: Buffet path shows Sides only; Plated path shows Entrées only  
9. Preview validation: incomplete follow-up rejected; complete plated path accepted  
10. Desktop 1280 + mobile 390 screenshots

### Persisted state verified

- Lines: catalog `included_by_default=true` + `offering_id`; template-only `included_by_default=false`, `unit_price=150`, `offering_id=null`  
- Groups: Dinner style root; Sides `depends_on` Buffet; Entrées `depends_on` Plated  
- Options: catalog offering_ids for Caesar/Chicken; template-only roast `offering_id=null`  
- Finalization simulation: incomplete answers blocked; valid plated resolve → EO lines; rename template option label left EO line “Chicken Marsala”

### Screenshots

| File | Stage |
|---|---|
| `shots/01-workspace-empty-1280.png` | Initial Catering workspace |
| `shots/02-package-items-pricing-1280.png` | Covered vs additional package items |
| `shots/03-primary-answers-1280.png` | Dinner style + both answers |
| `shots/04-followups-both-branches-1280.png` | Sides + Entrées branches |
| `shots/05-preview-initial-1280.png` | Couple preview |
| `shots/06-preview-buffet-path-1280.png` | Buffet → Sides only |
| `shots/07-preview-plated-path-1280.png` | Plated → Entrées only |
| `shots/08-builder-390.png` | Mobile 390 |

### Visual / usability evaluation

| Question | Verdict |
|---|---|
| Next action obvious? | Yes — empty state + “Add a primary question” + Add package item |
| Direct package items clear? | Yes — “Items always on this package” + note that always ≠ free |
| Pricing treatment truthful? | Yes — Covered by package price vs Additional charge on each row |
| Primary question vs answers distinct? | Yes — PRIMARY QUESTION band; answers nested; follow-up CTAs per answer |
| Buffet/Plated follow-up relationship obvious? | Yes — “FOLLOW-UPS UNDER EACH ANSWER”; preview path switches |
| Catalog vs template-only at add? | Yes — sheet source help + list “From Offerings catalog” / “Template-only” |
| Preview reflects couple experience? | Yes — same validator; inactive branch hidden |

---

## Unit / regression

| Suite | Result |
|---|---|
| `lib/event-order-templates/builder-ux.test.ts` | PASS |
| `lib/event-order-templates/offerings.test.ts` | PASS (assertions updated for current copy) |
| `lib/offerings/hierarchy.test.ts` | PASS (multi-parent asserted on catalog UI, not EO choice UI) |
| `lib/client-choices/validate-answers.test.ts` | PASS |
| `lib/client-choices/conditional-groups.test.ts` | PASS |

Focused batch: **71 pass / 0 fail**.

Related prior browser workstreams (category integrity, selection progress/finalize, multi-parent) remain documented GREEN under their own `docs/qa/*/STATUS.md`; this pass did not re-run those long harnesses against a new product deploy unless a follow-up deploy SHA requires it.

---

## Behaviors not verified / limitations

| Item | Status |
|---|---|
| Live staff UI click of `finalizeClientChoices` against a portal session in this harness | **OPEN** — covered by shared `validateChoicesAnswers` + `resolveSelectedOptions` + isolated EO line apply/reject simulation; full portal finalize remains proven in `docs/qa/selection-progress-finalize` / EO commercial lifecycle harnesses |
| Over-selection UI when max &lt; available options | **OPEN** — server/unit covered; this template used choose-1 groups |
| Production deploy | Not authorized — untouched |

None of the OPEN items block venue-owner builder clarity or the supported A–E workflow on Sandbox.

---

## Definition of done

- Serving SHA reconciled; no competing deploy  
- Full A–E workflow verified in browser + persistence  
- UI clear enough without internal terminology coaching  
- Regression unit coverage green  
- Production untouched; unrelated dirty work preserved  

**GREEN.**
