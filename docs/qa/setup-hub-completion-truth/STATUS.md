# Setup Hub completion truth (Team + BYB)

## Verdict

**GREEN / FROZEN**

## Lineage

| Item | Value |
|------|-------|
| Commit | `beca4bd85b2ba5962f4d186123b2ddacc2032f68` |
| Parent | `381a9499` (Planning Client Starter) |
| Vendor ancestry | `263bb3b2` yes |
| Hub copy ancestry | `56b19cda` yes |
| Planning ancestry | `381a9499` yes |
| Deploy | [37823287101](https://github.com/jlcormier612/wevenu-website/actions/runs/37823287101) |
| Serving image | `htc-sandbox-venue-app:beca4bd85b2ba5962f4d186123b2ddacc2032f68` |
| Digest | `sha256:d59264458f2829fe161bc97125a1dcd83a767ab0c747c5f82276e2d3823ade37` |
| Health | `{"ok":true,...}` |

## Rules

**Your People:** `invited_by` set (Team/Owners action; acceptance not required) OR `your_team_solo_confirmed_at`.

**Bring Your Business:** `migration_session_id` import OR path `individual` / `skipped`.

## Browser proof

`docs/qa/setup-hub-completion-truth/browser-results.json` — `ok: true`

- Lulu: Team invite → complete; `invited_by` = actor UUID (not `local`); acceptance null
- Texting disposable: solo incomplete → “It's just me for now” → complete + persisted
- Lulu BYB skip persisted; Fancy individual completes; spreadsheet ≠ migration
- Dashboard no Concierge; readiness copy intact; Planning + Vendor intact

## Tests

`lib/setup-hub/stage-completion.test.ts` — pass
