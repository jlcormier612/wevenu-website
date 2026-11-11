# STATUS — Guided Event Order Template setup

**Verdict: GREEN / CLOSED**

| Item | Value |
|------|-------|
| Serving commit | `20a5d08c39d26efaef2fe098d3b42cf3e6c5000a` |
| Image | `htc-sandbox-venue-app:20a5d08c39d26efaef2fe098d3b42cf3e6c5000a` |
| Digest | `sha256:9d1ef2ca21208c6977951e349acdfebd4cc7d6dd5e5af5c201a91e568c84c53b` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40245915864 (`success`) |
| Live `dpl=` | `20a5d08c39d26efaef2fe098d3b42cf3e6c5000a` |
| Production | Untouched |

## Acceptance gates (this tip)

| Gate | Result |
|------|--------|
| `verify-guided-setup.mts` | **GREEN** (`browser-run.log`) |
| `verify-browser.mts` (conditional choices) | **GREEN 26/26** |
| `verify-financial-fixture.mts` | **GREEN** — $2189.81 / rev 26 |

## What shipped

Guided category → pattern → choices → branches → review → preview wizard; preferred Offering filter no longer silent-dumps all categories; choice-tree engine preserved.

## Intentional limitations

- Deselecting a category with content requires confirm + remove (no soft-disable column).
- Starter empty dependents remain until the venue fills or removes them in the branch step.
- Fancy invoice fixture has no payment schedule (skipped, not a mismatch).
- Advanced editor remains as an escape hatch.
