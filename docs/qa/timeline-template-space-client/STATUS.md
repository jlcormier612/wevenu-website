# Timeline Template ↔ Space ↔ Event ↔ Client

**STATUS: GREEN / COMPLETE**  
**Date:** 2026-10-23  
**Serving (at E2E):** `df95f7c4…`  
**Evidence:** `browser-results.json`, `browser-run.log`, `shots/`  
**Counts:** **11 PASS / 0 FAIL / 0 BLOCKED** (run `TS3776`)

## 1. Template → space assignment

| Finding | Detail |
| --- | --- |
| Where | Create/starter picker **Space** select; stored as `timeline_templates.space_id` |
| Persist | Verified save/reload in Sandbox DB |
| Effect | Functional for **default preselect** via `resolveDefaultTimelineTemplateId(eventType, spaceId)` on event Timeline setup — does **not** copy space onto timeline entries |
| Missing space / other space | Falls back to broader defaults (type-only, then venue-wide) |

Regression: `lib/timeline-templates/default-for-event.test.ts`.

## 2. Library → client

| Question | Answer |
| --- | --- |
| Direct Library send? | **Intentionally prohibited** (UI copy + no Send control) |
| Supported path | Library edit → **Apply on event** (Setup / Timeline Use Template) → customize event copy → **Share with couple** on event timeline (in-app audience flip; **no email**) |
| Isolation | Event edits do not mutate master template; invalid portal token cannot see fixtures |

## 3. UX copy

Library blurb updated to explain space default, apply-on-event, and Share-with-couple (pending deploy of tip commit).

## Confirmations

Sandbox only · Production untouched · no real email/SMS · fixtures cleaned (`QA-TS-*`).
