# NAV-PERF Wave 7A — Minimal Booking Streaming Foundation

**Status:** Local implementation complete — **STOP for founder review**  
**Branch / worktree:** `perf/nav-perf-wave7a` @ `.worktrees/nav-perf-wave7a`  
**Base:** `origin/main` `59b06831` (includes Wave 6 docs)  
**Sandbox serving (unchanged):** `c1b993f6…`  
**NAV-PERF:** P1 / OPEN  
**No commit / push / merge / deploy**

---

## 1. Exact files changed

**New**
- `lib/shell/booking-first-byte-timing.ts`
- `lib/shell/booking-wave7a.test.ts`
- `app/(app)/clients/[id]/booked-workspace-detail.tsx`
- `components/clients/booking-identity-fallback.tsx`
- `docs/qa/launch-performance/nav-perf-wave7a/*` (measure harness + evidence)

**Modified**
- `app/(app)/clients/[id]/page.tsx` — auth/identity shell + one Suspense boundary
- Source-path updates in existing booking wiring tests (slice1/2/3a/3b, luv-scope, documents, invoices/contracts lists, etc.)
- `next.config.ts` — **env-gated** `HTC_TURBOPACK_WORKTREE_ROOT=1` only (unused in webpack measure; safe when unset)

**Not changed:** EventDetail structure, booking/payment/contract/proposal rules, ensure* invocation semantics (still in deferred detail loader batch), Production/Sandbox.

---

## 2. Instrumented loader timings (local server logs)

Pre-first-byte (page return / shell):

| Span | Sample ms (4 requests) |
|------|-------------------------|
| `get_client` | 544, 217, 196, 165 |
| `list_events_for_client` | 214, 42, 47, 65 |
| `booking_celebration_pending` | 50, 37, 50, 35 |
| `get_event_identity` | 166, 77, 73, 74 |
| **`booking_page_return_before_first_byte`** | **1101, 491, 395, 369** |

Post-first-byte (single deferred island; ensure* timed only):

| Span | Sample ms |
|------|-----------|
| `get_or_ensure_event_recommendations` | 1556, 1776, 601, 585 |
| `ensure_questionnaire_family_plus_templates` | 1896, 1962, 610, 720 |
| **`booked_detail_promise_all`** | **2192, 2276, 843, 896** |

Logs use `venue_hash` only (no raw venue/client/event ids).

---

## 3. Deferred data/components

**One Suspense boundary** wrapping `BookedWorkspaceDetail` (existing EventDetail data graph unchanged inside).

Deferred includes: invoices/contracts/journey, tasks/timeline extras, vendors/recommendations, documents, questionnaires (+ ensure family), floor plans, payments/order/inventory catalogs, conversation/notes, Luv, setup, practice banner, event switcher (also present on fallback).

**Not deferred:** `getClient`, celebration gate, `getEvent` identity, Delete button, identity fallback (name/status/Edit/Day-sheet).

---

## 4. Proof essential content remains available immediately

- Fallback testids: `booking-identity-fallback`, `event-header-actions`, `event-action-edit`, `event-booking-summary`
- Local measure: `sawFallbackAny: true`
- Server: page returns after identity spans **before** deferred Promise.all
- No financial placeholders in fallback

**Gap:** Cancel / Return-to-Booked (client onClick) are not in the fallback; they appear when EventDetail resolves. Edit + Day-of Sheet Links are available immediately.

---

## 5. Functional parity results

| Check | Result |
|-------|--------|
| Focused booking wiring tests (slices 1–3, luv, docs, invoices/contracts, wave7a) | PASS |
| ensure* still in deferred loader; not removed/relocated alone | PASS |
| One Suspense only | PASS |
| Sandbox baseline harness (deployed, no 7A): no fallback; identity≈detail | PASS |
| OpenAI on nav (local + sandbox harness) | 0 |
| EventDetail broad restructure | Not done |

Preparing/cancelled/draft/staff/cross-venue: covered by existing source contracts + fixture inventory from design; full interactive matrix not re-run end-to-end in browser this pass (local server instability / webpack cold compile).

---

## 6. Before/after performance

**Deployed Sandbox baseline (`c1b993f6`, same harness)** — before Wave 7A code:

| | med | notes |
|--|-----|-------|
| TTFB | 1765 | |
| Identity | 2629 | |
| Actions | 2631 | |
| Detail | 2633 | identity≈detail (no streaming) |
| Fallback | false | |

**Local after Wave 7A** (webpack `next dev`, Fancy booked fixture):

| | med (n=4) | warm-ish (excl. worst cold) |
|--|-----------|------------------------------|
| TTFB | 4229 | ~1290–1426 |
| Identity | 5613 | ~2220–2227 |
| Actions | 5638 | ~2236–2243 |
| Detail | 5657 | ~2344 |
| Fallback | **true** | |
| Server page-return | | **369–1101** |
| Server deferred batch | | **843–2276** |

Do **not** claim Sandbox improvement from local numbers. Local proves shell/deferred split and that page-return no longer waits on the full batch.

---

## 7. Regression findings

- Missing import `getFloorPlanSeatCountsForEvent` caught in first local render; fixed before final measure.
- Deferred ALS correlation id often null across Suspense (Next boundary) — spans still emit.
- Unrelated pre-existing: `prepare-booking-planning-ux` TimelineView empty-state string assert fails on main tip (not introduced by 7A).
- Worktree Turbopack + symlinked `node_modules` panics; webpack used for local measure.

---

## 8. Recommendation: **KEEP** (narrow Sandbox candidate)

Keep Wave 7A as the foundation: instrumentation + one Suspense identity shell is reversible, does not touch EventDetail internals or ensure* semantics, and demonstrably returns the page before the heavy batch.

**Before Sandbox release:** founder accept Cancel-not-in-fallback gap; optional polish to surface Cancel via server Link/action; remasure on Sandbox after deploy (not claimed here).

**Do not** expand to a second streaming island or ECS changes in this slice.
