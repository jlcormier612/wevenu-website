# STATUS — Event Order Template builder (category-first)

**Verdict: GREEN / CLOSED**

| Item | Value |
|------|-------|
| Commit | `e7f7178e1f4621561a395862470da12d2eac800d` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40241404522 |
| Image | `htc-sandbox-venue-app:e7f7178e1f4621561a395862470da12d2eac800d` |
| Digest | `sha256:85ce9adae5ddf30e8e428d455bdbc10e6e57c75dff121078386c0ce05c2ffa73` |
| Production | Untouched |
| Choice-tree / Offering-link / process-completion | Preserved |

## Root cause

Long-page IA: sections and choice groups were separate; Offering pickers were unfiltered mixed lists; dependent branches were peer cards without incomplete signaling.

## What changed

- Category (section) navigation + single-section workspace
- Choice groups scoped to the active section; dependents nested under parent options
- Incomplete empty dependents called out
- `CategorizedOfferingSelect` for section-aware catalog discovery (id-based link only)
- Client preview on the real template definition

## Intentional limitations

- Soft category↔section matching is for discovery only; venues may still pick All categories
- Empty dependent branches are not auto-filled with invented options
- Unassigned (no-section) groups remain in a separate tab when present
