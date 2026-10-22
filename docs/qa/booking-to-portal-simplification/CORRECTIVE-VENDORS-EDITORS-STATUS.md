# Corrective — Vendors Change editor + event-specific editor audit

**Overall: GREEN** for Vendors editor + pattern audit (Floor Plans lifecycle evidence remains prior GREEN on `c0266abd`).

Production untouched. Unrelated dirty tree preserved.

## SHAs

| Item | Value |
| --- | --- |
| Product (serving) | `015d1a3a8894fb1485e8ccf00500c73fce7397f6` |
| Prior product commit | `72f4dcec` (assignment editor) |
| Unit-test follow-up (not required on serving) | `aa318c90` |
| Deploy | [39718790834](https://github.com/jlcormier612/wevenu-website/actions/runs/39718790834) success |
| Serving `dpl=` | exact match `015d1a3a…` |

## Vendors — root cause and fix

**Root cause:** Change opened highlight-focused explanatory UI with Open Vendors, not `event_vendor_assignments`.

**Fix:**

1. Assignment list + Network Select add + remove via existing assign/remove actions.
2. Highlights stay on Vendors tab; Open Vendors stays on Overview.
3. While the sheet is open, local assignment state is not wiped by `router.refresh()` prop sync (fix after first Sandbox fail).

### Tests

```text
npx tsx --test lib/event-setup/vendors-setup-editor.test.ts lib/vendors/directory-vs-assignment.test.ts
→ pass

EXPECTED_SHA=015d1a3a8894fb1485e8ccf00500c73fce7397f6 \
  npx tsx scripts/qa/booking-to-portal-simplification-acceptance.mts
→ browser-results.json GREEN passed=111 failed=0
  servingSha=015d1a3a8894fb1485e8ccf00500c73fce7397f6
```

Fixture: `eventId=45109b6d-16c7-48c8-b696-15cf81efe816`.

Proven live: assigned list / empty truth, add persists, no highlight row created, remove persists, Network relationship kept, reopen idempotent, Open Vendors still reaches management + highlights section, no invite/release side effects from editor saves.

## Editor pattern audit

| Area | Verdict |
| --- | --- |
| Vendors | **GREEN** (this pass) |
| Floor Plans | **PASS** — prior working-layout GREEN `c0266abd` + seating JSON; no duplicate Open button |
| Planning | **PASS** — Change editor has checklist content; Open Planning separate |
| Timeline | **PASS** — entries + Save All; Day-of sync prior GREEN |
| Inventory | **PASS** — draft customize path; Open for share/finalize |
| Event Order | **PASS** — draft customize path; Open for shared snapshot |

No further Change-editor Open-button removals required.

### Floor Plans lifecycle (separate)

See `FLOOR-WORKING-LAYOUT-STATUS.md` and `seating-working-layout-results.json`. Not re-run in this Vendors pass; prior SHA-matched evidence stands.

## Questionnaires (brief B)

See `docs/qa/questionnaires-optional-planning/STATUS.md`. Implementation committed after this Vendors GREEN; scheduled sends remain **PARTIAL/BLOCKED** (no automated delivery schedule in domain).

## Preservation

- Unrelated dirty/untracked files not staged for product commits
- Production not deployed
