# STATUS — Merge Lead survivor selection (both directions)

**Verdict: GREEN / CLOSED**

## Root cause

Survivor selection radios rendered only when `needsExplicitPrimaryChoice || !primaryIsDefaultEarliest`. On the default earliest-submission path the lead cards were display-only while copy said “You can choose the other lead below,” so the alternate lead was not selectable.

Server merge already accepted an explicit `primaryId`; the defect was UI gating, not merge semantics.

## Fix

Commit `1d8a7098f732ff78113362ceba101b89c6f5350a`

- Both lead cards are always a radio group (`merge-survivor-radiogroup`)
- Selecting the alternate lead calls `selectSurvivor` → `previewMergeLeads(..., { primaryId })` so field diffs / Keep primary / Use secondary reorient
- Switching back restores the earliest-as-survivor direction
- Final confirm lists the selected survivor / merged lead with `data-lead-id`
- Copy updated so it does not promise a control that is missing

## Serving evidence (Sandbox)

| Item | Value |
|------|--------|
| Deploy | [40265257229](https://github.com/jlcormier612/wevenu-website/actions/runs/40265257229) **success** |
| Image SHA | `1d8a7098f732ff78113362ceba101b89c6f5350a` |
| Digest | `sha256:5c392af2882e94402c852a86047e07b733a04d20eb5191edaa66a455a3b3f7bb` |
| Browser | **GREEN** — `browser-run-r2.log` / `docs/qa/merge-lead-discovery/browser-results.json` |

## Tests / build

| Check | Result |
|-------|--------|
| Unit (`merge.test.ts` + boundary) | **42 pass** (`unit-test.log`) |
| `npm run build` | **EXIT 0** (`production-build.log`) |
| Browser both directions | **GREEN** |

### Acceptance coverage

**Default direction:** earliest survives; phone/space/staff persist; tour reassociated; reload OK; cancel no mutation; Continue-gate; FK names intact.

**Reverse direction:** select later lead as survivor; final confirm IDs match; later ID survives; earlier soft-marked; tour on early reparented to late; switch-alone no mutation; reload OK.

## Production

**Untouched.**
