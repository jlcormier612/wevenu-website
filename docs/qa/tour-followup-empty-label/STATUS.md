# Empty Tour & follow-up entry label

**Status: GREEN** on Sandbox tip `4ab44e52`

Empty-state action is **Add tour/follow-up details**. Click still opens the existing editor (tour date + follow-up date). Schedule Tour is unchanged.

| Item | Value |
|---|---|
| Commit | `4ab44e5245ecebdf2590477f2004a80414b4a15e` |
| Deploy | [38931101959](https://github.com/jlcormier612/wevenu-website/actions/runs/38931101959) success |
| Serving `dpl` | `4ab44e5245ecebdf2590477f2004a80414b4a15e` |
| Browser | `verify-browser.mts` all checks pass; `empty-editor-1280.png` |
| Tests | `lead-workspace-compaction` + `tour-followup-card-layout` + `single-follow-up-date` — **19/19** |

Files: `components/leads/relationship-card.tsx` (button + matching empty hint), `lib/leads/lead-workspace-compaction.test.ts`.
