# Timeline T3 — Release preview removal disclosure

## Status: GREEN

Serving commit: `d57245eee37c8c2f1f9e27962f2e423950a97f69`

## What shipped

- Preview returns `removedFromRelease` (last-release snapshot ids absent from current working, by stable entry id).
- Confirm fingerprint embeds active release baseline (`workingFp|releaseId`) so concurrent pointer changes are stale; stored `working_fingerprint` remains working-only for `workingAheadOfRelease`.
- Share confirm dialog lists removals with plain-language consequence when non-empty.
- Migration: `20261424200000_venue_timeline_release_removal_preview.sql` (Sandbox applied).

## Evidence

| Check | Result |
|-------|--------|
| Unit (`lib/timeline/*.test.ts` focused set) | 125 pass / 0 fail |
| Migration workflow | https://github.com/jlcormier612/wevenu-website/actions/runs/40429589686 |
| Deploy Sandbox | https://github.com/jlcormier612/wevenu-website/actions/runs/40429592211 |
| ECS image | `…/htc-sandbox-venue-app:d57245eee37c8c2f1f9e27962f2e423950a97f69` |
| Digest | `sha256:a90c3806b1a13f5892f42883bf12aefd5fa1e7ce5ecc8bb3a66fae0f9d7a2985` |
| Live `dpl=` | `d57245eee37c8c2f1f9e27962f2e423950a97f69` |
| Health | `ok` / supabase `ok` |
| Harness `T3REM63198` | **26 pass / 0 fail** → `removal-results.json`, `removal-run.log` |

### Harness command

```bash
EXPECTED_SHA=d57245eee37c8c2f1f9e27962f2e423950a97f69 \
E2E_RUN_ID=T3REM63198 \
npx tsx docs/qa/timeline-p1b-working-released/verify-removals.mts
```

## P1 closure note

T1 (via P1a+P1c) and T3 core (P1b) plus this removal disclosure close the remaining P1 audit gap for §6.3.4 removals. Add/edit field diffs remain out of scope (approved).
