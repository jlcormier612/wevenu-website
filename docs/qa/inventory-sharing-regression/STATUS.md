# Inventory sharing regression — STATUS

**Verdict: GREEN** (Sandbox verified)  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty work:** preserved

---

## Root causes (verified)

1. **Inventory share email reused a financial portal token** when the client had no couple/planning session (`sessions[0]` fallback in `notifyInventoryShared`). Financial tokens always render Invoice & Payment Plan (`PaymentAccessShell`), ignoring `#inventory`.
2. **Deep link was hash-only** (`#inventory`). Choices already used `?view=…` because email click-tracking drops fragments; inventory did not.
3. **Share for selection disabled** because Additional items (`Dance Floor` $150, `DJ / Band Table` $200) had `client_selectable=false`. Gate is intentional; affordance/explanation was weak (hover `title` only).

Full forensic write-up: [`AUDIT.md`](./AUDIT.md).

---

## Fix (commit)

| Item | Value |
|---|---|
| Commit | `6f06bf08bb181910e93788c51cfcb23a7ef32afc` |
| Deploy | [40788795279](https://github.com/jlcormier612/wevenu-website/actions/runs/40788795279) — **success** |
| Serving ECS image | `htc-sandbox-venue-app:6f06bf08bb181910e93788c51cfcb23a7ef32afc` |

### Changed files
- `lib/event-inventory/inventory-portal-link.ts` (+ tests) — never pick financial; `?view=inventory#inventory`
- `lib/event-inventory/service.ts` — `pickInventoryPortalSession` + create Couple session when missing
- `app/(portal)/p/[token]/page.tsx` — honor `view=inventory`
- `components/event-inventory/event-inventory-panel.tsx` — clear instructions; visible disabled reason; clearer Select toggle
- `docs/qa/inventory-sharing-regression/*` — audit, harness, evidence

---

## Action semantics (final)

| Action | Meaning | Email destination |
|---|---|---|
| **Share to view** | Read-only inventory in couple portal | Couple token + `?view=inventory#inventory` |
| **Share for selection** | Couple chooses quantities on items marked **Select**, then submits | Same URL pattern; `collaboration_mode=select` |
| Per-row **Select** (Additional only) | Marks item `client_selectable` so Share for selection can enable | N/A |

Neither share action sends an invoice. Genuine financial `/p/{financialToken}` links still open Invoice & Payment Plan.

---

## Browser acceptance

```bash
EXPECTED_SHA=6f06bf08bb181910e93788c51cfcb23a7ef32afc \
  npx tsx docs/qa/inventory-sharing-regression/verify-browser.mts
→ GREEN — 13 pass / 0 fail
```

Evidence: `browser-results.json`, `browser-run.log`, `persisted-state.json`, `shots/`.

| Check | Result |
|---|---|
| Ursula financial token + `#inventory` → Invoice & Payment Plan (reproduce) | PASS |
| Share for selection disabled until Select; visible reason | PASS |
| Share for selection enables after Select on $150/$200 items | PASS |
| Share creates Couple session (does not email financial-only) | PASS |
| Couple `?view=inventory` URL is **not** invoice shell; shows inventory | PASS |
| Portal API select mode + priced selectable items | PASS |
| 390px not invoice shell | PASS |
| Genuine financial token still payment shell | PASS |
| Bad token no inventory leak | PASS |

Unit: `inventory-portal-link.test.ts` + `client-selection.test.ts` — pass.

---

## Operator note (Meadowbrook / Ursula)

The defective email already sent still points at the **financial** token. After this deploy, venue must **Share to view** or **Share for selection** again so a Couple session is created and a correct Inventory link is emailed. Do not treat the old email URL as fixed in place.

---

## Remaining limitations

| Item | Status |
|---|---|
| Old financial-token inventory emails already in inboxes | **OPEN** until venue re-shares (code fix does not rewrite historical messages) |
| Production | Untouched / not authorized |

---

**DONE:** Real inventory-share destination is the couple Inventory experience; selection vs view actions are distinct and explained; Additional $150/$200 items are selectable when marked Select; browser + persisted evidence on serving `6f06bf08`.
