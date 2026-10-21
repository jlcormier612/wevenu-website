# Merge Lead — Preserve Both Inquiry Messages — STATUS

**Verdict:** GREEN  
**Date:** 2026-10-20  
**Product commits:** `c9a3f2f8` (feature) · `c1247d09` (client-safe helpers)  
**Serving:** `c1247d09` / TD `htc-sandbox-venue-app:817`  
**Deploy:** [39526509590](https://github.com/jlcormier612/wevenu-website/actions/runs/39526509590)  
**DB migration:** [39526054285](https://github.com/jlcormier612/wevenu-website/actions/runs/39526054285) · `20261420400000_merge_preserve_inquiry.sql`  
**Production:** untouched  
**Unrelated dirty tree:** preserved

## Model finding

Inquiry text lives on `leads.inquiry_message` (single field). No separate submission table is suitable for venue-visible dual retention without mislabeling as a staff note. Keep-both archives the secondary text as `lead_activities.type = additional_inquiry_message` with title **Additional inquiry from merged lead**, including secondary lead id, submission time, and source.

## Browser + DB

`verify-inquiry-keep-both.mts` → **15/15 PASS** (`inquiry-keep-both-results.json`)

- Keep both: primary field + distinct activity; not concatenated; soft-mark OK  
- Keep primary only / use secondary: field matches choice; no extra activity  
- Identical messages: no inquiry choice UI; no history dup  
- No sequence enrollments on fixture leads  

## Unit tests

`lib/leads/merge.test.ts` — **28/28** (includes keep-both resolution + contracts)
