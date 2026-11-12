# Wave C1 prototype results — Lead workspace deferral

**Status:** PROTOTYPE ONLY — not authorized for full lead/client rollout  
**Date:** 2026-11-12  
**Branch:** `perf/wave-c1-lead-deferral-prototype`  
**Based on:** PR #34 @ `181aa3c7`  
**No merge / no deploy**

---

## E. Architecture

### Selected workspace: **Lead** (`/leads/[id]`)

| Why Lead | Why not Client first |
| --- | --- |
| Clear tab boundaries (Documents, Luv) vs Overview | Client/EventDetail eagerly loads many more domains (floor plans, vendors, EO, inventory, questionnaires…) — higher rewrite risk |
| Audit median ~4.5 s open | Larger surface for a “thin” prototype |
| No EventDetail interaction rewrite | Design gate forbids EventDetail rewrite |

### Deferred domains (exactly two)

1. **Documents pack** — `getDocuments`, `getVenueWorkspaceDocuments`, `getPinnedDocumentKeys`  
2. **Luv drafts pack** — `getDraftsForLead`

### Loading boundary

| Moment | Behavior |
| --- | --- |
| Initial Overview | Critical-path `Promise.all` **omits** both packs (source-proven) |
| First Documents / Luv tab | Honest pending UI → server actions `loadLeadDocumentsPackAction` / `loadLeadLuvDraftsPackAction` (authorize via `getLead`) |
| Warm return | Pack kept in tab-local React state — no second global store |
| Record switch | Generation counters discard stale responses |
| `?tab=documents` / `?luv=` | Eager server fetch (deep-link without relying on hash) |
| `#documents` / `#luv` | Client hash sync activates tab → deferred load (verified via `hashchange`) |

---

## F. Evidence — genuine initial work reduction

### Source / unit proof

`lib/leads/wave-c1-deferral.test.ts` — **PASS**

- Critical-path `Promise.all` does **not** call `getDocuments` / `getVenueWorkspaceDocuments` / `getPinnedDocumentKeys` / `getDraftsForLead`.
- Deferred packs only via `"use server"` actions that re-check `getLead`.

### Runtime (local `next start`, Claire Nguyen `54db1c0c-…`, n=3)

| Metric | PR #34 eager (3457) | C1 deferred (3458) |
| --- | ---: | ---: |
| Overview useful median | 2048 ms | **1911 ms** |
| Overview useful p95 | 6138 ms | **2059 ms** |
| Documents first open median | 96 ms (already in RSC) | **1025 ms** (pending → load) |
| Documents warm return median | 52 ms | **62 ms** |
| Documents first pending shown | no | **yes** |
| Rapid tab switches | ~65–77 ms | **~65–82 ms** |

Raw: `raw/c1-prototype-latest.json`  
Screenshots: `screenshots/c1-prototype/`

**Interpretation:** Initial Overview no longer waits on documents/Luv draft I/O. First deferred-tab open pays ~1 s with honest pending; warm returns stay in the &lt;100 ms class. This is **not** “hide while still querying on the server.”

Local timings are **not** Sandbox SLIs.

---

## G. Tab responsiveness

| Scenario | Result |
| --- | --- |
| Initial Overview | Improved tail latency vs eager on same machine |
| First deferred tab | Pending affordance + ~1 s pack fetch |
| Warm return | ~60 ms — previously loaded pack retained |
| Rapid Overview↔Documents↔Luv | ~65–82 ms click handling |
| `#documents` after hydrate | Tab selects Documents; pending then content (hashchange verified) |
| `?tab=documents` | Eager pack; Documents selected; no deferred pending |

---

## Functional coverage (prototype)

| Area | Result |
| --- | --- |
| Overview / Booking Journey | PASS (packages still critical-path) |
| Documents tab | PASS (deferred) |
| Luv tab | PASS (deferred) |
| Conversation / Notes / Tasks / Activity | Untouched (still use existing props) |
| Floor Plans / seating / EO / inventory / questionnaires | **N/A** — not on Lead workspace |
| Setup Profile / portal release | **N/A** — event/client booked surfaces |
| Contracts / payments semantics | Unchanged (no optimistic money) |

---

## J. Recommendation

**REVISE then expand carefully — not STOP, not full GO.**

- Prototype **proves** query elimination + warm-tab speed preserved for two Lead domains.  
- Before extending to Client/EventDetail: harden initial-URL hash hydration tests, add failure/out-of-order browser tests, and design pack boundaries for floor-plan/timeline/vendors without rewriting EventDetail.

---

## Restrictions honored

Isolated branch; no #33 edits; no migrations; no demo reseed; no merge/deploy.
