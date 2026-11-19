# HTC NAV-PERF — Wave 7A Final Safety and Usability Review

**Status:** STOP for founder review — **do not release**  
**Worktree:** `.worktrees/nav-perf-wave7a` @ `perf/nav-perf-wave7a`  
**HEAD base:** `59b06831` (uncommitted Wave 7A + this safety pass)  
**Sandbox serving (unchanged):** `c1b993f6`  
**NAV-PERF:** P1 / OPEN  
**No commit / push / merge / deploy / Production**

Desktop evidence: `~/Desktop/HTC-NAV-PERF-WAVE7A/`

---

## 1. Cancel / Return eligibility findings

### Existing EventDetail rules (unchanged)

| Action | UI eligibility | Mutation | Confirm |
|--------|----------------|----------|---------|
| Edit | Always (link) | N/A | N/A |
| Day-of Sheet | Always (link) | N/A | N/A |
| Cancel | `event.status !== "cancelled"` | `updateEventStatusAction` → `updateEventStatus_` → `withVenue` (+ cancel RPC when cancelling) | Native `confirm(...)` with existing copy |
| Return to Booked | `event.status === "cancelled" && event.bookedAt && event.clientId` | `getBookingConfirmationDraftForClientAction` then `returnClientToBookedAction` → `returnClientToBooked` → `withVenue` + occupancy confirm | `PipelineBookedConfirmDialog` |
| Today’s Dashboard | `daysUntil(eventDate) === 0` | Link / router push | N/A |

Permissions / venue isolation are enforced in the existing server actions (`withVenue`), not approximated in the shell. Owner/staff UI does not add a separate role gate for Cancel/Return beyond what EventDetail already used.

### Shell safety decision

Cancel and Return **can** be shown in the identity shell safely because:

- Eligibility is pure fields already available from `getEvent` before Suspense.
- Mutations reuse the **same** server actions and dialogs.
- No EventDetail restructuring was required (EventDetail keeps its own header; Suspense replaces the fallback when detail resolves).

---

## 2. Exact changes made (this safety pass)

| File | Change |
|------|--------|
| `components/clients/booking-identity-status-actions.tsx` | **New** client component: Edit / Day-sheet / Cancel / Return / Today with EventDetail predicates + same actions/dialogs |
| `components/clients/booking-identity-fallback.tsx` | Uses status-actions component; optional deferred error copy |
| `app/(app)/clients/[id]/booked-workspace-detail.tsx` | try/catch around deferred render; on failure re-shows identity shell with `booking-workspace-detail-error` (not stuck “Loading…”) |
| `lib/shell/booking-wave7a.test.ts` | Contracts for Cancel/Return reuse + failure surface + one Suspense |
| `docs/qa/launch-performance/nav-perf-wave7a/measure-local.mts` | Usefulness gates: `primaryActionParity` = Cancel for booked fixture; fallback duration; CLS |
| `docs/qa/launch-performance/nav-perf-wave7a/action-parity-spot.mts` | Focused browser spot matrix |

**Not changed:** booking business rules, contracts/payments, Timeline/floor plans, Communications, Luv, questionnaire/recommendation ensure* semantics, ECS, schema, Production, EventDetail structure, Suspense count (still one).

---

## 3. Action parity results

Local browser spot (`action-parity-spot.json`) — **allOk: true**

| Case | Result |
|------|--------|
| Booked (owner) | Cancel yes, Return no; Edit + Day-sheet; detail ready; fallback seen |
| Cancelled + bookedAt | Return yes, Cancel no |
| Preparing / no event (`planning`, 0 events) | No Cancel/Return chrome |
| Unknown client | No action chrome (denied) |
| Cross-venue client (Fancy session) | No action chrome (denied) |

Incomplete Edit-only bar is **no longer** counted as full primary-action readiness.

---

## 4. Streaming lifecycle and failure handling

| Risk | Finding |
|------|---------|
| Duplicate ensure* / writes | ensure* only in deferred `renderBookedWorkspaceDetail` batch; page shell does not call them |
| Lost mutations during nav | Cancel/Return use same server actions + `router.refresh()` as EventDetail |
| Stale event state | Shell uses the same pre-Suspense `event` object EventDetail receives; refresh after mutation |
| Contract / payment calc | Unchanged; still deferred with EventDetail |
| Inconsistent booking status | Status badge + Cancel/Return predicates share `event.status` / `bookedAt` / `clientId` |
| Unauthorized exposure | Identity still gated by page `getClient` / `getEvent`; mutations via `withVenue` |
| Hydration / Suspense errors | No second Suspense; no new hydration path observed in measure |
| Deferred batch failure | try/catch → identity shell + clear error testid (not permanent Loading) |

Server logs (local): `booking_page_return_before_first_byte` **before** `booked_detail_promise_all` on each sample (e.g. page return ~367–895 ms; deferred ~861–1337 ms).

ALS `correlation_id` null on deferred spans remains a known instrumentation note (not a functional regression).

---

## 5. Comparable before / after local timings

**LOCAL only.** Do not treat as Sandbox improvement.

### Sandbox baseline (deployed `c1b993f6`, no Wave 7A) — reference only

| Metric | median |
|--------|--------|
| TTFB | 1765 |
| Identity | 2629 |
| Actions (Edit) | 2631 |
| Detail | 2633 |
| Fallback | false |

### Local prior Wave 7A (Edit counted as “actions”; Cancel still deferred)

| Metric | median (n=4) | warm-ish |
|--------|--------------|----------|
| Identity | 2220 | ~2220–2227 |
| Actions (Edit) | 5638 | ~2236–2243 |
| Detail | 5657 | ~2344 |
| Fallback | true | |

### Local after this safety pass (Cancel required for primaryActionParity)

| Metric | median (n=4) | warm samples |
|--------|--------------|--------------|
| TTFB | 857 | 632–857 |
| First identity/status | 2192 | 1940–2192 |
| Edit | 2205 | 1952–2205 |
| **First usable primary action (Cancel)** | **2216** | **1963–2216** |
| Full EventDetail ready | 2331 | 1978–2331 |
| Fallback duration | 674 | 514–674 |
| Layout shift (CLS sum) | 0 | 0 |
| Fallback observed | **true** | |
| OpenAI | 0 | |

**Usefulness verdict (local):** Cancel is available with the identity shell (~same wall time as identity; ~100–140 ms before full detail on warm). That is a genuine usability improvement over waiting for EventDetail for Cancel/Return. Streaming fallback is observable (~0.5–1.4 s) without measured layout-shift score > 0.

---

## 6. Focused regression results

**PASS**

- `lib/shell/booking-wave7a.test.ts` (incl. Cancel/Return reuse + failure surface)
- Booking workspace slices 1 / 2 / 3a / 3b, Luv scope, workspace-event, booking-mobile-actions
- Preparing documents, invoices/contracts workspace lists, questionnaire selector, client-invite preview, space-assignments, venue-couple visibility
- Browser action-parity spot (booked / cancelled / preparing / unknown / cross-venue)
- Payment/status source contracts: `timing-booked-at`, `confirmed-occupancy` (pass within mixed run)

**Unrelated failures (not modified)**

1. `lib/playbooks/prepare-booking-planning-ux.test.ts` — empty TimelineView TemplatePicker assertion (`assert.ok(afterEmpty > emptyStart)`). Timeline not in scope.
2. `lib/team/booking-assignment.test.ts` — “keeps the other planning tabs” expects `questionnaires` on row-1 TabsList; current EventDetail row-1 is overview/playbook/timeline/floorplan/vendors. Pre-existing vs Wave 7A; not touched.

---

## 7. Recommendation

**Revise (hold — do not release).**

- **Keep** the Wave 7A foundation locally: streaming shell + Cancel/Return parity reuse existing eligibility/actions without EventDetail rewrite.
- **Do not release** to Sandbox/Production yet: Sandbox still on `c1b993f6`; production-like streaming proof and a controlled Sandbox pass are still required.
- **Do not abandon:** the action-availability gap that blocked usefulness is closed without expanding architecture.

NAV-PERF remains **P1 / OPEN**.
