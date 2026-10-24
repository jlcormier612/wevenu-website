# Client Portal Preview navigation — STATUS

## Verdict: GREEN

Serving Sandbox `4ef14218` / digest `sha256:f3ba33aadb64461398c690cda13085b5a7456db80641ebf6f5da8f25b29c8902`.

Harness: `verify-browser.mts` → **14/14 PASS**.

## Tabs (exact order)

1. Planning (default)
2. Timeline
3. Floor Plans
4. Vendors

Inventory and Event Order do **not** appear in preview. Event commercial Inventory & Event Order surfaces remain on the event page (regression checks passed).

## Commits

- Nav fix: `7854705a`
- Serving: `4ef14218`

## Evidence

- `browser-results.json`, `browser-run.log`
- Shots under `shots/`
- Deploy: https://github.com/jlcormier612/wevenu-website/actions/runs/40065359281
