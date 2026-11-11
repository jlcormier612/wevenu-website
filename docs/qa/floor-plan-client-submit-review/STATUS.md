# Floor plan client submit → venue review (with confirm dialog)

## Verdict: GREEN

| Item | Value |
| --- | --- |
| Confirm-dialog product commit | `18b8964a7d46aa764b4657ec7dc31eb80b8fc342` |
| Confirm-dialog deploy | [40215221981](https://github.com/jlcormier612/wevenu-website/actions/runs/40215221981) **success** |
| **Actual serving tip** | `2aad64718c9295b97a0114c217f165178698414e` (includes `18b8964a` + capacity clarity) |
| Serving digest | `sha256:9c64f696da1bba3a5b394cbcbd70364c912ad0cebd6eb7cfd7054e5fbc43d556` |
| Harness | `EXPECTED_SHA=2aad6471… verify-browser.mts` → **GREEN 24/24** |
| Production | untouched |

`18b8964a` is an ancestor of the serving tip; the confirmation dialog is present and verified on the live image. Running `EXPECTED_SHA=18b8964a…` alone would fail the serving-sha check because ECS tip moved forward after later Sandbox deploys.

## Confirm dialog proof (deployed)

| Check | Result |
| --- | --- |
| Submit opens confirm dialog | PASS |
| Cancel — no submit, still editable | PASS (`working`, `client_submitted_at` null) |
| Confirm — persists `submitted`, locks placement | PASS |
| Move blocked while submitted | PASS (`awaiting_review`) |
| Resubmit opens confirm again | PASS |
| Approve after resubmit | PASS (`approved`) |
| Operational plan id unchanged | PASS (`18c943fb-…`) |

## Evidence

- `browser-results.json`, `browser-run.log`, `persisted-state.json`
- `shots/` including confirm dialog, submitted, venue review, changes-requested, approved
