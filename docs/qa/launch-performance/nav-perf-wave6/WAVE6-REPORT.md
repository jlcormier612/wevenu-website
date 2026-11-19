# NAV-PERF Wave 6 — Shared Layout First-Byte Optimization

**Status:** Implementation + local verification complete — **STOP for founder review**  
**Branch / worktree:** `perf/nav-perf-wave6` @ `.worktrees/nav-perf-first-byte`  
**Base:** `origin/main` `66b48de8` (docs tip; Sandbox still serves `83569a10`)  
**Wave 5:** **not included**  
**Production / deploy / commit:** none this pass  

PR #97 (Wave 3 docs) already **merged** `66b48de8` — Wave 6 register updates layer on that tip without overwriting Wave 3 evidence files.

---

## 1. Shared-layout dependency graph

See `DEPENDENCY-GRAPH.md` (written before code changes).

**Must stay serial:** auth → handoff → `clear_stale` → (reads) → classify.  
**Safe parallel:** after `clear_stale`, `list_my_venue_memberships` ∥ `current_user_venue_id`.

---

## 2. Exact timing instrumentation

| Mechanism | Detail |
|-----------|--------|
| Module | `lib/shell/layout-first-byte-timing.ts` |
| Scope | Entire `app/(app)/layout.tsx` document path via `withLayoutFirstByteTiming` |
| Correlation | `correlation_id` (UUID) per layout render |
| Venue | `venue_hash` = SHA-256 prefix only (no raw UUID) |
| Flag | every event sets `before_first_byte: true` |
| Events | `layout_first_byte_boundary`, `layout_first_byte_timing` (JSON stdout → CloudWatch when deployed) |
| Spans | `layout_get_user`, `layout_bootstrap`, `bootstrap_consume_handoff`, `bootstrap_clear_stale`, `bootstrap_memberships_and_venue_id_parallel` (or serial pair), `layout_get_current_venue`, `layout_gates_parallel`, `layout_owner_count`, `layout_complete_before_first_byte` |
| Not used | HTTP `Server-Timing` (streaming layout; correlated logs preferred) |
| Secrets | no tokens, emails, session payloads |

---

## 3. Safe parallelization opportunities

| Opportunity | Decision |
|-------------|----------|
| memberships ∥ venue_id after `clear_stale` | **Implemented** (default) |
| handoff ∥ clear_stale | **Rejected** — handoff may write active venue |
| clear_stale ∥ reads | **Rejected** — reads must see post-clear state |
| Collapse duplicate `getUser` | **Deferred** — no new auth cache invented |
| Booking SSR Suspense | **Out of scope** (Wave 6) |

A/B: `HTC_LAYOUT_BOOTSTRAP_SERIAL=1` restores serial reads for local before/after.

---

## 4. Files changed

| File | Change |
|------|--------|
| `lib/shell/layout-first-byte-timing.ts` (+ test) | Instrumentation |
| `lib/shell/nav-perf-wave6.test.ts` | Contracts |
| `lib/venue/active-context.ts` | Timed spans + parallel post-clear reads |
| `lib/venue/onboarding-handoff.test.ts` | Order assertion tolerates timing wrapper |
| `app/(app)/layout.tsx` | Timing wrapper + span labels |
| `next.config.ts` | Worktree-only turbopack root (local) |
| `docs/qa/launch-performance/nav-perf-wave6/*` | Graph, harness, report, spans |
| `docs/launch/LAUNCH-READINESS.md` | Wave 6 note; NAV-PERF OPEN |

---

## 5. Before/after **local** timing (not Sandbox)

**Method:** Fancy session on `http://127.0.0.1:3000`; before=`HTC_LAYOUT_BOOTSTRAP_SERIAL=1`; after=parallel default.

### Browser Dashboard warm (n=5)

| Metric | Before (serial) | After (parallel) |
|--------|-----------------|------------------|
| TTFB median / p90 | **949 / 1730** | **812 / 880** |
| Greeting median | 1908 | 1676 |
| Focus median / p90 | 2275 / 4453 | 1914 / 2063 |
| OpenAI | 0 | 0 |

### Layout server spans (from Next logs)

| Span | Before med | After med |
|------|------------|-----------|
| `layout_complete_before_first_byte` | **799** | **469** |
| `layout_bootstrap` | **390** | **296** |
| memberships+venue_id wall | ~90+95 serial | **~139 parallel** (one wall) |

Leads/booking single samples remain layout+route heavy (booking useful still multi-second) — expected; not the Wave 6 target.

**Do not claim Sandbox improvement from these local numbers.**

---

## 6. Auth / membership / venue isolation regression

| Check | Result |
|-------|--------|
| Unit/contract tests (33) | PASS |
| Fancy venue greeting after parallel bootstrap | PASS |
| Unauthenticated `/dashboard` → `/login` | PASS |
| Classification B/D/C/E semantics | PASS (tests) |
| Handoff before clear_stale before classify | PASS (source contract) |
| Wave 5 code absent | PASS |
| Multi-venue switch / revoked membership live DB matrix | **Not fully exercised live** this pass — covered by existing Wave 2 SQL/classification contracts; recommend Sandbox spot on release |

---

## 7. Remaining first-byte bottlenecks

1. **`layout_gates_parallel`** (enrollment + membership + role) — still on critical path; cold samples can exceed 1 s locally.  
2. **Booking `/clients/[id]` SSR** — still blocks first byte with large await fan-out (separate slice).  
3. **Single ECS task CPU saturation** — amplifier on Sandbox (from first-byte diagnosis); not changed here.  
4. Duplicate `getUser` across layout/bootstrap — minor vs gates/booking.

---

## 8. Recommendation for controlled Sandbox release

**Recommend controlled Sandbox release** of Wave 6 after founder approval:

- Low semantic risk (ordering of security-critical steps preserved)  
- Instrumentation enables true TTFB stage attribution on Sandbox spikes  
- Local evidence shows modest TTFB/layout-wall improvement  
- Keep **NAV-PERF OPEN**; remasure Dashboard warm TTFB median/p90 + layout span logs on `83569a10` successor tip  
- Do **not** bundle Wave 5  
- Next candidate after remasure: booking SSR streaming **or** gates-path slim — based on new Sandbox span evidence  

**STOP — no commit, push, merge, or deploy without founder approval.**
