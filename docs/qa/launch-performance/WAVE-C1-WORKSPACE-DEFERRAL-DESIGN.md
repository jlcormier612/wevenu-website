# Wave C1 — Lead/Client workspace tab deferral (design gate)

**Status:** DESIGN ONLY — not implemented in this PR  
**Date:** 2026-11-12  
**Branch:** `perf/launch-remediation` (based on PR #33 tip `ee22f319`)

## Problem

`app/(app)/clients/[id]/page.tsx` and `app/(app)/leads/[id]/page.tsx` eagerly `Promise.all` multi-domain data (tasks, timeline, floor plans, vendors, EO, inventory, documents, questionnaires, …) before painting Overview.

Sandbox medians: lead detail ~4.5 s; booked client ~2.2–5.2 s. Tab switches feel fast (~80–160 ms) **because all panel data is already on the page**.

## Constraint from launch brief

> If Wave C requires architectural changes to shared workspace data or caching, stop and present the proposed design before implementation.

## Proposed design (for approval before code)

### Approach

1. **Resolve identity first** — `getLead` / `getClient` (+ auth) must remain on the critical path.
2. **Overview-minimum pack** — fetch only what Overview (and Booking Journey / Setup) need.
3. **Tab packs** — `timeline`, `floorplan`, `vendors`, `documents`, `payments`, `playbook`, etc. load via:
   - nested `loading.tsx` / `Suspense` **or**
   - authenticated RSC `fetch` / server actions keyed by tab + record id  
   when the tab/hash becomes active.
4. **Deep links** — `#floorplan`, `?tab=`, Conversations hash must trigger the matching pack on first paint (no empty tab).
5. **React `cache()`** — dedupe identity + overview within one request; do not invent a second workspace store.
6. **No optimistic money/contracts** — payments, signatures, booking confirmation stay truthful pending/success/failure.
7. **Preserve** Setup Profile inheritance, portal release gates, RLS, URLs, Back/Forward, unsaved client state in editors already mounted.

### Explicit non-goals for C1

- No DB migrations.
- No rewrite of `EventDetail` interaction model beyond data injection boundaries.
- No hiding components while still querying their data on the server.

### Risk

**Med–high** — regress empty tabs, hash deep links, print views, portal preview. Requires focused browser matrix before merge.

### Recommendation

Ship **Wave B + Wave C2** first. Implement C1 only after this design is approved and a thin prototype proves Overview-minimum omits floor-plan/timeline queries from the initial RSC payload (network/SQL evidence).
