# Create Contract Server Action — forensic audit

**Identifier:** `40572dcd97fe589a00e91ac821ace49419860f8a2`  
**Not present in source.** Next.js generates this hash per build. It is not a function name.

## Exact runtime at the failure window

Two venue-app images were registered on the ALB at once:

| Task | Task def | Image | Role |
| --- | --- | --- | --- |
| `24ab8d4cbe7f486aa55ebfa8c6d0b8f2` | `:409` | `…venue-app:d253db31…` | ACTIVE / then DRAINING |
| `c6acb44617ca47079523e8ca1749f7e2` | `:410` | `…venue-app:46574963…` | PRIMARY rolling in |

Deploy run: https://github.com/jlcormier612/wevenu-website/actions/runs/36364689226 (proposal-name workstream).

## Button → action

`What they booked` → `CommercialFacts` “Create contract” → `BookingJourneyPanel.handleCreateContract` → **`prepareCreateContractAction`** in `app/(app)/booking-journey/actions.ts` (`"use server"`).

That action still exists. It was **not** removed/renamed by Smart Fields (`3d2892b4`) or Luv (`aba6685b`). `git diff 3d2892b4 46574963 -- app/(app)/booking-journey/actions.ts` is empty.

`createContractAction` in `app/(app)/contracts/actions.ts` is a later step (contract builder), not this button.

## Why the IDs differ

Next.js Server Action IDs are build-scoped. A page HTML/RSC payload from `:409` embeds action IDs from `d253db31`. A POST that lands on `:410` cannot resolve `40572dcd…`.

ALB had one **healthy** new target and one **draining** old target during Jennifer’s click. That is a proven mixed client/server pair — not a missing Create Contract implementation, not a barrel break, not Smart Fields deleting the action.

The panel catch only matched `Failed to find Server Action|older or newer deployment`. The production message is `Server Action "…" was not found on the server.` so the raw Next error surfaced.

## Not the cause

- Action deleted or moved
- Smart Fields import/barrel change
- Contract creation service semantics
