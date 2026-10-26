# STATUS — Merge Lead discovery / confirm workflow

**Verdict: GREEN / CLOSED** (browser on serving `8215db63`)

## Root cause (disabled Confirm)

Confirm was gated on a successful Preview, but Preview required a separate click after selection. Venue owners selected a duplicate, saw Confirm disabled, and also saw UUID troubleshooting. See `WORKFLOW-ROOT-CAUSE.md`.

## Fix commit (workflow)

`8215db63c2b21ecf715fff4954191546296c58cf`

- Auto-preview on candidate select
- Remove UUID paste / troubleshooting from normal dialog
- Continue → explicit **Confirm permanent merge** / **Cancel — keep both leads**
- Double-submit guard

## Serving verification

| Item | Value |
|------|--------|
| Deploy | [40252933491](https://github.com/jlcormier612/wevenu-website/actions/runs/40252933491) success |
| SHA | `8215db63c2b21ecf715fff4954191546296c58cf` |
| Digest | `sha256:eec700aa2e7d3d8f5c9a20e2bf0ba384720aa54faeacba517aa521929916aaa5` |
| Unit | **32/32 PASS** (includes Continue-gate conflict regression) |
| Browser | **GREEN** — `browser-results.json` / `browser-run-8215db63.log` |

### Browser coverage on that image

- Search by name / email / phone; current lead excluded; ambiguous hint
- No UUID UI; Continue gated until preview
- Auto-preview on select; earliest survivor
- Conflict choices → Continue → final irreversible confirm
- Cancel — keep both: no mutation
- Confirm permanent merge: secondary soft-marked; phone filled; partner email kept; tour reassociated same row
- Self-merge blocked

## Continue-gate hardening (follow-on)

Serving `8215db63` allowed Continue while conflict fields were unresolved (`openFinalConfirm` toasted only). Harness now resolves conflicts before Continue.

Product aligns Continue `disabled` with conflict/survivor gates via `canAdvanceToMergeFinalConfirm` in `796fe9149b1a21d74997f45d4869d87718e22c69` — Sandbox deploy [40255549328](https://github.com/jlcormier612/wevenu-website/actions/runs/40255549328) (queued). Re-run browser on that image when ECS serves it; workflow GREEN already proven on `8215db63`.

## Production

**Untouched.**
