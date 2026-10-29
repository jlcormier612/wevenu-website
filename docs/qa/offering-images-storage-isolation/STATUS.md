# Offering images + inventory storage isolation

| Field | Value |
| --- | --- |
| **Status** | **NOT ACCEPTED** — waiting on Sandbox deploy of product commit |
| **Product commit** | `2acd44412036e1682b70d95d960e15181053c8e1` |
| **Harness commit** | `73bc0f5f55449d1865ce2648af9fa7021b8f4d6f` |
| **Branch** | `feat/spaces-booking-e1-smart-fields` |
| **Migration** | `20261425900000_offering_images_inventory_storage_isolation.sql` — **applied** ([run 40808767308](https://github.com/jlcormier612/wevenu-website/actions/runs/40808767308)) |
| **Deploy** | [run 40808769549](https://github.com/jlcormier612/wevenu-website/actions/runs/40808769549) — venue-app build in progress |
| **Baseline serving (pre-deploy)** | `f07b838f9f0a6dc51d5fe47c85f687eafe1420c8` |
| **Production** | Untouched |

## Storage security (confirmed live post-migration)

`npx tsx docs/qa/offering-images-storage-isolation/probe-storage.mts` → **GREEN 7/7**

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

`lib/catalog-images`, option-catalog, EO choice-logic / package-builder / selection-definition, inventory client-image-visibility, template-catalog-integration: **pass** (see chat report). Pre-existing unrelated failure: `lib/event-order-templates/starters.test.ts` (`pricingModel === "per_person"`).

## Remaining for acceptance

```bash
# After deploy serves 2acd4441…
EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/offering-images-storage-isolation/verify-browser.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-browser.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/event-order-template-builder-ux/verify-portal-finalize.mts

EXPECTED_SHA=2acd44412036e1682b70d95d960e15181053c8e1 \
  npx tsx docs/qa/inventory-eo-document-lifecycle/verify-lifecycle-full.mts
```
