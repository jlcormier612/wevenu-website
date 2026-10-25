# Serving image verification — combined Sandbox

**Verified at:** 2026-10-25 (this run)

| Field | Value |
|-------|--------|
| Serving image | `htc-sandbox-venue-app:d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Digest | `sha256:63e9cfdaf8f7f1c196deef86930675f4889022ca1119d02b4565a96f470c93c0` |
| Deploy run | https://github.com/jlcormier612/wevenu-website/actions/runs/40242707489 (`success`) |
| Deploy head SHA | `d9e25c77af78c5e46de46dc831eda8c190dab556` |
| Repo HEAD (docs after FP proof) | `4b12e27f…` (docs-only; not required on ECS) |

## Ancestry — both Event Order fixes are on the serving image

```
d9e25c77  floor-plan inventory identity (code)
e7f7178e  category-first EO template builder
20e9e316  package-led EO inclusion seeding
```

`git merge-base --is-ancestor 20e9e316 d9e25c77` and `e7f7178e` ⊆ `d9e25c77` — **both closed EO workstreams coexist** on the current serving image. Historical SHAs `20e9e316` / `e7f7178e` are superseded as *serving* tags but remain ancestors.

## Production

Untouched.
