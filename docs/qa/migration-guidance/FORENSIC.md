# Migration Center Guidance — Phase 1 Forensic Audit

**Date:** 2026-10-20  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**HEAD:** `401fd7f9`  
**Sandbox serving:** `401fd7f9` / TD `:814`  
**Production:** untouched  
**Dirty tree:** preserved (~886)

## Entry points (verified)

| Surface | Route | Guidance present |
|---------|-------|------------------|
| Import Data | `/settings/import` | Concise intro + “Bringing over…” → MC; help link |
| Migration Center | `/settings/migration` | Source lanes + entity picker (only after choosing a source); dense page description; help link |
| Team & Data | `/settings/team` | Import entity links + MC link (MC blurb understates calendar/finances) |
| Setup Hub | `/setup-hub` | Bring Your Business choices → MC / Import |
| Help (linked from Import/MC) | `/help/what-should-i-set-up-before-i-start` | Paths + limitations; thin order; uses “Active commitment” |
| Setup guide (richer) | `/help/setup-bring-your-business` | Step-by-step cutover; still uses “active commitment” |
| Calendar & Availability | `/settings/availability` | Prerequisite for dated Events (multi-space) |

## Browser baseline (`audit-baseline.json`)

- Import Data still shows unexplained **Active Commitment** (jargon).
- Migration Center defaults to **starting from scratch** → **entity picker hidden** until a source is chosen (major discoverability gap).
- No recommended-order checklist on the MC page itself.
- Help article mentions Import vs MC but does not give a clear prepare → import → verify journey in plain language.
- “Active commitment” appears in MC entity dropdown and help copy.

## Capability matrix (code-backed; unchanged this workstream)

| Record | Import Data | Migration Center | Notes |
|--------|-------------|------------------|-------|
| Clients / leads / vendors | Yes | Yes | Import Data also Excel/Word/PDF/paste |
| Inventory templates | Yes | No dedicated entity | |
| Package templates | Yes | Yes | Included-item text; no inventory SKU links |
| Events / tours / holds / blocks | No* | Yes | *Past client dates → historical Events on Import Data |
| Documents (files) | No | Yes | |
| Invoice / payment schedule / signed agreement | No | Yes (`active_commitment` workflow) | Not a standalone payment CSV |
| Guest list / vendors on event / timeline / floor plan | No | Yes | Specialized |
| Session undo | — | Partial cleanup of attributed records only | No one-click full undo |
| OCR of scanned PDFs | — | Text/DOCX/PDF extract where implemented | Do not promise scanned-image OCR |

## Journey answers (summary)

1. **Start:** Setup Hub or Settings → Team & Data / Import / Migration — fragmented.
2. **Import vs MC:** Partially clear on Import Data; MC intro does not contrast paths well; Team MC card understates scope.
3. **Prepare:** Help mentions Calendar & Availability; no single checklist on MC.
4–8. **What belongs where / order:** Supported in code; poorly sequenced in UI.
9. **Won’t transfer:** Package↔inventory links; standalone payments; key dates; full undo — mentioned in help, not on MC.
10–11. **Ambiguous rows / outcomes:** MC review + session history — discoverable only after starting a session.
12. **Resume:** Session history works; not explained on landing.
13. **Verify:** View links on Import Data; MC outcome sentences — no end-to-end “go check calendar/clients” checklist.
14. **Recovery:** Session cleanup (attributed only); no full rollback.

## Gaps solvable by guidance (this workstream)

- Plain-language finances path (stop leading with “Active Commitment”).
- Recommended order + path distinction on Migration Center (visible even before source selection).
- Canonical help article rewritten for the venue journey.
- Import Data + Team & Data copy aligned.
- Entity dropdown label for finances in plain language.

## Gaps requiring future product work (out of scope)

- True migration progress / completion certification across all entity types.
- Full session undo / reconciliation dashboard.
- Automatic package↔inventory linking.
- Showing entity picker without choosing a source (engine requires source_key) — mitigated by always-visible guidance panel.
