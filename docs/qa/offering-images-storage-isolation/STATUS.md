# Offering images + inventory storage isolation

| Field | Value |
| --- | --- |
| **Status** | **NOT ACCEPTED** — Sandbox deploy of fix tip in progress; browser harnesses not yet run against serving tip |
| **Product commit** | `2acd44412036e1682b70d95d960e15181053c8e1` |
| **Harness commit** | `73bc0f5f55449d1865ce2648af9fa7021b8f4d6f` |
| **Build-fix tip (intended serving)** | `914d7d96e447ecee8bcc816151a2deeb907f0e88` (ChoicesTemplateOption `imageUrl` type fix) |
| **Branch** | `feat/spaces-booking-e1-smart-fields` |
| **Migration** | `20261425900000_offering_images_inventory_storage_isolation.sql` — **applied** ([run 40808767308](https://github.com/jlcormier612/wevenu-website/actions/runs/40808767308)) |
| **Deploy (product tip `2acd4441`)** | [run 40808769549](https://github.com/jlcormier612/wevenu-website/actions/runs/40808769549) — **failed** (venue-app TypeScript: ChoicesTemplateOption missing `imageUrl`) |
| **Deploy (fix tip `914d7d96`)** | [run 40811968481](https://github.com/jlcormier612/wevenu-website/actions/runs/40811968481) — **in progress** |
| **Baseline / last verified serving** | `f07b838f9f0a6dc51d5fe47c85f687eafe1420c8` (still serving until 40811968481 finishes) |
| **Production** | Untouched |

## Storage security (confirmed live post-migration)

`npx tsx docs/qa/offering-images-storage-isolation/probe-storage.mts` → **GREEN 7/7** (re-confirmed while awaiting tip deploy)

| Check | Result |
| --- | --- |
| `offerings.image_url` column | ok |
| `event_order_template_options.image_url` column | ok |
| Public inventory read retained | HTTP 200 |
| Fancy staff upload under Fancy path | allowed |
| Fancy staff upload under Meadow path | **denied** (RLS) |
| Fancy staff delete Meadow object | object still HTTP 200 |
| Fancy staff delete own object | ok |

Root cause (pre-fix): `inventory` bucket insert/update/delete policies allowed any authenticated user bucket-wide. Fix: path first segment must equal `current_user_venue_id()`; SELECT stays public.

## Focused unit tests

`lib/catalog-images`, option-catalog, EO choice-logic / package-builder / selection-definition, inventory client-image-visibility: **56/56 pass**.

Pre-existing unrelated failure (baseline `1e640cdf` already lacks `per_person` in starters; Offering Images did not change `starters.ts`): `lib/event-order-templates/starters.test.ts`.

## Remaining for acceptance

After ECS serves `914d7d96…` (image tag includes product `2acd4441` ancestry + build fix):

```bash
EXPECTED_SHA=914d7d96e447ecee8bcc816151a2deeb907f0e88 \
  npx tsx docs/qa/offering-images-storage-isolation/verify-browser.mts

EXPECTED_SHA=914d7d96e447ecee8bcc816151a2deeb907f0e88 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts

EXPECTED_SHA=914d7d96e447ecee8bcc816151a2deeb907f0e88 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts

EXPECTED_SHA=914d7d96e447ecee8bcc816151a2deeb907f0e88 \
  npx tsx docs/qa/inventory-eo-document-lifecycle/verify-lifecycle-full.mts
```

Note: harnesses match the **ECS image tag** tip SHA (`image.includes(EXPECTED.slice(0, 12))`), so use `914d7d96…`, not the older product-only SHA `2acd4441`.
