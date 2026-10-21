# Guest List Import Audit — STATUS

**Verdict:** **NOT GREEN — PRODUCT DECISION REQUIRED**  
**Date:** 2026-10-20  
**HEAD at audit:** `487cb347`  
**Sandbox serving:** `c1247d09` · TD `htc-sandbox-venue-app:817`  
**Code/schema changes:** none  
**Production:** untouched  
**Unrelated dirty tree:** preserved (~886)

## Why not GREEN

Guest lists are Client-Owned (`couple_guests`). Migration Center imports them with service-role writes and forced `visibility_to_venue = true`, while UI claims “on an active Event” though guests have **no Event FK**. Cross-venue Event targeting is blocked; ownership/authorization product intent is unresolved.

## Decision needed

See `FORENSIC.md` §6 — whether MC may seed couple guest lists, venue visibility expectations, and whether Event-scoped storage is required.

## Artifacts

- `FORENSIC.md`  
- `probe-sandbox.mts` / `probe-results.json`  
- Baseline tests: operational-continuity + guest-list-admin-write **14/14**
