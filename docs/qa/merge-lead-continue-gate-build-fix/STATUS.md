# STATUS — Merge Lead Continue-gate build fix

**Verdict: IN PROGRESS** (local build GREEN; awaiting Sandbox serve + browser)

## Root cause

Client value-import of `canAdvanceToMergeFinalConfirm` from server `lib/leads/merge.ts` pulled `getCurrentVenue` → product-sync → `fs/promises` into the Client Component bundle. See `ROOT-CAUSE.md`.

## Fix

- New `lib/leads/merge-client.ts` — types + Continue-gate helpers, **zero imports**
- `merge-lead-dialog.tsx` imports only `merge-client`
- Server `merge.ts` re-exports for actions/tests; keeps privileged logic server-side
- Continue gate behavior unchanged

## Tests / build

| Check | Result |
|-------|--------|
| `merge.test.ts` + `merge-client-boundary.test.ts` | **35 pass** |
| `npm run build` | **EXIT 0** (`production-build.log`) |

## Deploy / browser

- Commit: `f5cc61e4429ebb69730888c7a579a300003e41a0`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/40258243938
- Browser when serving:

```bash
EXPECTED_SHA=f5cc61e4429ebb69730888c7a579a300003e41a0 \
  npx tsx docs/qa/merge-lead-discovery/verify-browser.mts
```

Until ECS serves this SHA, overall status remains **IN PROGRESS** (not GREEN).
