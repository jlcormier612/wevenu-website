# Root cause — Overview outstanding + Inventory/Event Order “Unavailable”

**Preflight:** HEAD `41bd7eb9`; serving `0cd25c62`. Settings / Setup Profiles frozen.

## Causes

1. **Missing Inv/EO drafts labeled `unavailable`** with `nextAction: "Prepare and release portal"` even when a valid profile template ref exists. Product: that is recoverable, not Unavailable.
2. **`isOutstandingFollowUp` treats `unavailable` and Planning `draft` as outstanding**, so each row gets its own Prepare button while `canPrepareRelease` is false whenever non-planning outstanding exists — the primary release box hides and Prepare appears repeatedly in the amber list.
3. **Planning Open/Edit is suppressed** when the step is listed in outstanding (`!listedInOutstanding` gate on `SetupEditorLink`).
4. Copy still says “Prepare and release portal” after content is already profile-driven.

## Fix direction (Event Setup / readiness only — no Settings/Profile edits)

- Recoverable missing Inv/EO → `draft` + Open workspace; not `unavailable`.
- Planning awaiting release → not outstanding; Open Planning.
- Outstanding = genuine `needs_action` / true broken config only.
- One primary **Release to client portal** when decisions are complete.
- Always expose Open/Edit for Included areas.
