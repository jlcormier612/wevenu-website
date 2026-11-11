# Workflow root cause — disabled Confirm + UUID UX

## Screenshot state

Venue owner had selected a duplicate, saw a separate “Selected duplicate” card, and **Confirm merge** stayed disabled. “Paste lead ID (troubleshooting)” was still visible.

## Exact cause

Confirm was gated on `preview !== null`:

```ts
disabled={pending || !preview || preview.blockers.length > 0}
```

Preview only ran after a separate **Preview merge** click. Selection alone did not load preview, so Confirm remained disabled with no clear explanation. That looked like a broken dialog rather than a multi-step gate.

Secondary UX defects:
- UUID troubleshooting control in the normal path.
- Redundant “Selected duplicate” card duplicating the result row.
- Single Confirm button both meant “I’m ready” and “execute merge” — no irreversible-action step.

## Fix

1. Auto-run preview when a candidate is selected.
2. Remove UUID paste / troubleshooting from the dialog.
3. Show selection on the result row; drop the duplicate card.
4. Footer **Continue to permanent merge** (enabled only when preview succeeds).
5. Separate **Confirm permanent merge** / **Cancel — keep both leads** panel before RPC.
6. Double-submit guard via `submittingRef` + pending disable.
