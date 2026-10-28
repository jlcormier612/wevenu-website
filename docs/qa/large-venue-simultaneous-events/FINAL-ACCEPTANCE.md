# Large-venue simultaneous independent events — FINAL ACCEPTANCE

**Verdict: GREEN**  
**Serving commit:** `38f709412ba3a033074e708d3546f72ba3b36c93`  
**ECS image:** `htc-sandbox-venue-app:38f709412ba3a033074e708d3546f72ba3b36c93`  
**Proven run:** `LVSEMVSAFSZL` · event date `2029-10-13`  
**Venue:** Jen's Fancy Venue (`a415ac52-cd74-42a6-8df7-7a8f6e71d080`)  
**Production:** untouched  
**Product code changes this task:** none (tip already implements correct occupancy / public / calendar behavior)

---

## Plain-English answers

1. **Can one venue host two independent, overlapping weddings in separate spaces?**  
   **Yes.** Wedding A (Barn) and Wedding B (Ballroom) both persisted as confirmed Events with distinct clients on the same date with overlapping times under `max_simultaneous_events=3`.

2. **Does a booking in the Barn leave the Ballroom available when venue rules permit?**  
   **Yes.** Creating Wedding B in the Ballroom succeeded while Wedding A occupied the Barn. A Barn booking alone does not block the Ballroom.

3. **Does the system prevent conflicting use of the same space?**  
   **Yes.** Overlapping inserts into an occupied Barn or Ballroom fail with `space_overlap` and a clear message naming the occupying Event.

4. **Does public availability agree with the actual booking rules?**  
   **Yes, with the documented inquiry semantics.** Default `allow_simultaneous_public_availability=false` closes the date venue-wide once any occupying Event exists. Opt-in `true` keeps the date Available when another active space can still take a full-day Event (A+B present → Available). Opt-in does **not** override venue capacity or same-space staff write rules. At max overlapping Events, inquiry stays Unavailable even with opt-in. Flag restored to `false` after the run.

5. **Can staff see both events and filter the calendar by space?**  
   **Yes.** Month / Week / Day / Agenda (month-list) on tip show both couples. Barn filter shows Ava and hides Blair; Ballroom filter shows Blair and hides Ava; clearing the filter restores both. Opening a calendar item reaches the correct client workspace.

6. **Do client, contract, financial, Event Order, floor-plan, and timeline records stay separate?**  
   **Yes.** Each wedding has its own client, EO, contract, invoice, payment schedule, floor plan, and timeline entry. Mutating Wedding A's contract/FP/timeline titles left Wedding B's rows unchanged.

7. **Does the configured venue-wide simultaneous-event limit work?**  
   **Yes.** With max=3, a third overlapping Event in Lakeside Pavilion succeeded; a fourth overlapping Event failed with `venue_at_capacity: Maximum simultaneous events (3) reached for this time.` Non-overlapping same-space (Barn morning vs evening) succeeded.

8. **What remains unsupported or unverified?**  
   - **`permitted_uses` on the assignment RPC** — found during this acceptance (cocktail-only Patio accepted reception). Tracked and fixed in the permitted-use follow-up (`docs/qa/permitted-use-enforcement/`); this document records the historical finding on tip `38f70941`.  
   - **Public inquiry is date-level**, not “is this specific space free?” — verified behavior; product decision deferred. See `PUBLIC-AVAILABILITY-LIMITATION.md`.  
   - **Tours / holds** follow separate capacity/hold rules (not re-litigated here beyond confirming calendar blocks are venue-wide).  
   - **QuickBooks live sync** was not re-exercised (no shared pathway changed). Prior tip QBO acceptance remains supporting evidence only.

---

## Configuration (Phase 2)

| Setting | Value |
|---|---|
| Spaces | Covered Bridge, **Barn**, Garden Lawn, Stone Patio, **Ballroom** (added), **Lakeside Pavilion** (added) |
| `max_simultaneous_events` | **3** (was 2; set for 4-space large-venue proof) |
| `allow_simultaneous_public_availability` | default **false** (toggled only inside Phase 5; restored) |

Ballroom / Lakeside Pavilion created via service-role fixture (named synthetic spaces on Fancy). Remaining acceptance exercised through DB occupancy authority + staff browser calendar/client workflows.

## Fixtures (run `LVSEMVSAFSZL`)

| Wedding | Event ID | Client ID | Space | Window |
|---|---|---|---|---|
| A — Ava Allen | `85c55895-b82c-4ef3-8d66-c3ebc82f1ef7` | `a0abed88-f77a-4cb4-9bcf-dac30ef9bebc` | Barn | 16:00–22:00 |
| B — Blair Blake | `9f569e99-cca9-4b5e-be5c-bbe0b60affc4` | `97f64686-1b72-49d9-9f26-cc424fd6038b` | Ballroom | 17:00–23:00 |

Prefix: `LVSE-LVSEMVSAFSZL-`. Synthetic emails `@hellotocheers-test.invalid`.

## Evidence

- Behavior matrix: `BEHAVIOR-MATRIX.md`
- Machine results: `browser-results.json` (31/31 checks PASS, matrix 0 FAIL)
- Screenshots: `shots/LVSEMVSAFSZL-*.png` (month/week/day/agenda, Barn/Ballroom filters, client workspaces)
- Harness: `verify-large-venue.mts`
- Unit regressions: **125/125** pass (`event-occupancy`, simultaneous-public, space-filter, assignment-windows, precheck)

## Defects found / fixes

No product defect required a code change for GREEN. First harness attempt failed calendar assertions because (a) month view needs `year`/`month` query params, and (b) calendar items display **couple names + use labels**, not raw Event names — harness corrected; product behavior was already correct.

## Unrelated work / Production

Working tree dirty/untracked items outside this QA directory were preserved. Production was not deployed or modified.
