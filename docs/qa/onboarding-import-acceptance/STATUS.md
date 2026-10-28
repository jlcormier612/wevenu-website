# Onboarding / Bring Your Business import acceptance — STATUS

**Overall:** OPEN — awaiting Sandbox tip re-verify after auto-map fix `5c98ade9`.

**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40727641211  
**Prior serving tip when defects found:** `0b3838d3`  
**Fix commit:** `5c98ade9`

## Confirmed root cause (pre-fix)

Migration Center auto-mapped CSV headers only with exact camelCase key or exact label match. Tripleseat `first_name` / `last_name` and imperfect third-party headers (`Couple Name`, `E-mail Address`) never mapped, so every row failed with “Missing a name” / “Missing a first and last name” after Bring in — while the UI still advertised HoneyBook/Tripleseat recognition.

## Fix

`lib/migration/auto-map-headers.ts` — compact alphanumeric match + alias table; wired into `components/settings/migration-center.tsx`. Unit coverage in `auto-map-headers.test.ts`.

## Paths observed on `0b3838d3` (pre-fix)

| Path | Result |
|---|---|
| Skip / start fresh | PASS — hub path `skipped`, MC reachable later, no false import |
| Add individually | PASS — hub path `individual`, import later available |
| Tripleseat | FAIL — 5/5 rows “Missing a name” (auto-map) |
| Another system | FAIL — mapping defaulted Don’t import; rows missing names |
| Resume / explicit HoneyBook | BLOCKED — disposable login flake on first venue; retest on tip |

See `IMPORT-ENGINE-MATRIX.md` and `browser-results.json`.
