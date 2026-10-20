# Lead Merge — Status

**Feature:** Venue-controlled Merge Lead (soft-mark secondary, atomic RPC)  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Production:** untouched

## Phase 1 — Forensic
See `FORENSIC.md`. Tour cancel/reparent probe **8/8 GREEN**. Baseline lead suites **38/38** then **53/53** with merge unit contracts.

## Phase 2 — Implementation
- Migration `20261420100000_lead_merge.sql` — columns + `merge_leads_v1`
- `lib/leads/merge.ts` — preview/confirm
- UI: Merge lead on lead detail; secondary redirects to primary
- Duplicate banner points to Merge lead (detection still warn-only)

## Phase 3–4
Pending: migration apply → Sandbox deploy → RPC probe → browser verify.
