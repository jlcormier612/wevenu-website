# Root cause — Merge Lead Continue-gate Sandbox build failure

## Failed evidence

- Commit: `796fe9149b1a21d74997f45d4869d87718e22c69`
- Run: https://github.com/jlcormier612/wevenu-website/actions/runs/40255549328
- Error: `Module not found: Can't resolve 'fs/promises'` (and `fs`, `node:fs`) in venue-app Turbopack build

## Exact import path

```
components/leads/merge-lead-dialog.tsx  ("use client")
  → value import canAdvanceToMergeFinalConfirm from lib/leads/merge.ts
    → getCurrentVenue from lib/venue/service.ts
      → @shared/product-sync (owner-activation, store-file, …)
        → fs/promises / node:fs
```

## Why 8215db63 built but 796fe914 did not

On `8215db63` the dialog used **type-only** imports from `merge.ts` (`import type { FieldDiff, … }`), which Turbopack erased. The Continue-gate commit added a **runtime** import of `canAdvanceToMergeFinalConfirm` from the same server module, which pulled the full graph into the Client Component Browser / SSR chunks.

The Continue gate itself is correct; the defect is the module boundary.

## Fix

Move types + Continue-gate pure helpers to `lib/leads/merge-client.ts` (zero imports). Dialog imports only that module. Server `merge.ts` re-exports for tests/actions and keeps Supabase/venue logic server-side.
