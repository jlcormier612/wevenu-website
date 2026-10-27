# Timeline P2 / D5 — Overview replace guard

**Status: GREEN** on Sandbox

## Serving

| Item | Value |
|------|--------|
| App commit | `8703267e6cf9dd3be7afb598fafcce0fc5ccefc1` |
| SQL follow-up | `d32b3e56…` (`202614244` atomic RAISE fix) — DB only; app image remains `8703267e…` |
| Deploy | [40432801978](https://github.com/jlcormier612/wevenu-website/actions/runs/40432801978) success |
| Migrations | [40432799919](https://github.com/jlcormier612/wevenu-website/actions/runs/40432799919) (`243`), [40433784991](https://github.com/jlcormier612/wevenu-website/actions/runs/40433784991) (`244`) |
| ECS / `dpl=` | `8703267e6cf9dd3be7afb598fafcce0fc5ccefc1` |
| Digest | `sha256:0d54c071415f0317d857a3a2485d965f1d26a4c32dc1ad17b080a3d4a19a0841` |
| Health | ok / supabase ok |

## Acceptance

```bash
EXPECTED_SHA=8703267e6cf9dd3be7afb598fafcce0fc5ccefc1 \
  npx tsx docs/qa/timeline-p2-replace-guard/verify-browser.mts
```

Run **`P2R65155`**: **18 pass / 0 fail** (`browser-results.json`, `browser-run.log`).

## Unit

`replace-guard` + related Timeline suites exercised in delivery: replace-guard **6/6**; broader timeline subset **114/114** (pre-existing unrelated planning-setup Inventory editor assertion remains red outside this scope).

## Boundaries

Production untouched. P3 / Floor Plans not started. P1 not reopened.
