# Sandbox Hospitality Recovery — Status (not GREEN)

**Date:** 2026-11-11  
**Production:** untouched  
**Verdict:** **RED / IN PROGRESS** — approved hospitality experience is **not** fully restored and verified on Sandbox yet.

---

## 1. Current Sandbox serving SHA / task / digest

| Item | Value |
| --- | --- |
| Serving image (live) | `9889638823e2873ab891dc056a6df5c6186197a8` |
| ECS task definition | `htc-sandbox-venue-app:1168` |
| Rollout | COMPLETED (still the reporting-only image) |
| PR #22 merge | `989e2a8e` — **did not deploy** |
| PR #22 deploy | [43083384042](https://github.com/jlcormier612/wevenu-website/actions/runs/43083384042) **FAILURE** |
| Failure | `focus-attention-row.tsx` imports missing `dismissDashboardAttentionAction` (venue-app typecheck) |
| Build fix | PR #23 merged → `7582d7c7` |
| Deploy in flight | [43084484688](https://github.com/jlcormier612/wevenu-website/actions/runs/43084484688) (queued/running after #23) |

**Browser acceptance on the hospitality+reporting image:** **not possible yet** — Sandbox still serves `98896388`. Hard-nav / hospitality / Welcome Back code is on `main` but not in the running task.

---

## 2. Browser acceptance results

| Check | Result |
| --- | --- |
| Hospitality shell on live Sandbox | **Not verified** (wrong SHA still serving) |
| Dashboard / Leads / Clients / Events / Reports | **Blocked** on deploy |
| Desktop / mobile | **Blocked** |
| Direct `/reporting` + refresh | **Blocked** on deploy (fix is in `main` layout; not live) |
| Doughnuts / trends / Saved Reports | Still present on live `98896388`; must re-verify after `7582d7c7` rolls out |

---

## 3. Hospitality parity inventory (`f22b8c14` vs `main`)

Marker-based scan (htc-hospitality / canvas / botanical):

| Metric | Count |
| --- | --- |
| Marked files on `f22b8c14` | ~140 |
| Marked files on current `main` | ~29+ (after #22/#23 page wrappers) |
| Still absent / not fully ported | ~98 marker files |

### Already present on `main` (foundation)

- `app/globals.css` Contemporary Botanical tokens (`#f8f7f3`, `#446b56`, hospitality utilities)
- Layout hard-nav fix (no pre-graduation `/setup-hub` wall)
- Sidebar botanical active indicator
- Hospitality page classes on: Dashboard, Leads, Clients, Tours, Setup Hub, Reports*, Calendar, Library, Packages, Payments, Contracts, Invoices, Tasks, Vendors, Settings*, Pipeline, etc.
- Client list + lead list toolbar/table hooks
- `collection-back-link`, `starter-ownership-banner`, `lib/ui/selected-state` (#23)
- Docs: `htc-visual-system.md`, dashboard light spec
- Reporting preserved from `98896388`

### Outstanding Wave G / page-specific work

**Now import-unblocked for careful forward port (~41 files)** after #23 enablers — includes many Library/communication/vendor editors. Still require **focused PRs**, not a blind tree checkout (behavior drift risk).

**Still blocked by missing modules (~51 files)**, top remaining deps:

- `lib/navigation/attention` (+ service / inbox-ownership)
- `lib/authorization/membership` (+ multi-venue)
- `lib/event-types/venue-options`
- `relationship-photos/*`
- `shared/brand/logo`
- `lib/library/template-apply-targets-service`
- `lib/inventory/reservations-service`
- `lib/event-setup/state`
- billing org/referral cards, offerings choice-groups, etc.
- Shell pieces needing `venue/active-context` + venue-switcher

**Events list:** on `main` redirects to `/clients` (by design) — no standalone Events hospitality page to restore.

See also `PARITY-INVENTORY.md` when present in this folder.

---

## 4. Welcome Back email verification

| Item | Status |
| --- | --- |
| In `main` (`7582d7c7` / #22+#23) | **Yes** |
| In live Sandbox image | **No** (still `98896388`) |
| Unit tests | **6/6 pass** |
| WG rendered body | Uses suggested coordination paragraph; no “settling in” |
| Self-setup rendered body | Keeps “begin settling in”; no WG claim |
| Former Weven verification copy | Independent of onboarding method |
| Customer emails sent this turn | **None** |

---

## 5. Tier-upgrade route integration status

| Piece | Status |
| --- | --- |
| `greetingSalutation` / `personGreetingName` on shared helpers | On `main` |
| Lifecycle templates on `main` wired to salutation | Yes |
| `shared/pricing/*` + `app/api/internal/pricing/tier-upgrades/*` | **Absent from `main`** |
| Safest path | Forward-merge the already-tested pricing Phase 3 notice path from the billing/hospitality line onto `main` in a **dedicated PR** after Sandbox visual recovery stabilizes; do not change tier math or Stripe schedules |

---

## 6. Tests and deployment evidence

| Evidence | Result |
| --- | --- |
| Welcome Back tests | Pass |
| PR #22 Sandbox deploy | Fail (typecheck) |
| PR #23 merge | `7582d7c7` |
| PR #23 Sandbox deploy | In progress `43084484688` |
| Live ECS | Still `:1168` / `98896388` |

---

## 7. Remaining blockers before GREEN

1. **Deploy `7582d7c7` successfully** to Sandbox; confirm new ECS revision + digest.
2. **Browser-verify** hospitality shell + reporting coexistence + hard-nav `/reporting`.
3. **Port remaining unblocked Wave G page treatments** in focused PRs (Library/editors/lists), preserving main behavior.
4. **Decide and schedule blocked dependency waves** (attention nav, multi-venue shell, relationship-photos, brand logo module).
5. **Confirm Welcome Back** on the deployed image (code path + optional Sandbox template render — no customer send).
6. Only then: declare visual recovery GREEN **together with** reporting.

**Do not call GREEN now.** Foundation is on `main`; Sandbox is not yet serving it; full Wave G parity is incomplete.
