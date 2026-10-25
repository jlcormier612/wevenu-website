# Serving image verification — combined Sandbox

**Verified at:** 2026-10-25 (final combined release verification)

| Field | Value |
|-------|--------|
| Live `dpl=` (login HTML) | `d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Serving image | `htc-sandbox-venue-app:d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Venue-app digest | `sha256:63e9cfdaf8f7f1c196deef86930675f4889022ca1119d02b4565a96f470c93c0` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/40242707489 (`success`) |
| Deploy head SHA | `d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Later Sandbox deploys after this tip? | **No** (most recent Deploy Sandbox = this run) |

## Ancestry — all three fixes coexist on the serving image

```
d9e25c77  floor-plan inventory identity (serving tip)
e7f7178e  category-first EO template builder
20e9e316  package-led EO inclusion seeding
```

`git merge-base --is-ancestor 20e9e316 d9e25c77` → true  
`git merge-base --is-ancestor e7f7178e d9e25c77` → true  

Historical tip tags `20e9e316` / `e7f7178e` are superseded as *serving* labels but remain ancestors. No redeploy required for this verification pass.

## Migrations / config

No additional migrations required beyond what those commits already shipped. Live app exercises package seed, template builder, conditional choices, and floor-plan inventory UI on this image.

## Production

Untouched.
