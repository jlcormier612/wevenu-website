# Hello to Cheers — Starter Package Library Implementation

**Status:** Finished product on the existing Packages catalog (not a second Package system).  
**Keys:** `PKG-01` Essential Wedding · `PKG-02` Signature Wedding · `PKG-03` Full-Service Wedding  
**Product name (customer-facing):** Hello to Cheers  
**Stop condition:** Packages only — FAQs and further Contract/EO/financial work not started in this pass.

---

## 1. Capability findings (inspected first)

### Existing Package system (reused)

| Concern | Finding |
|---|---|
| Data model | `public.packages` + `public.package_items` (inclusions). Flat catalog; no separate package-template table. |
| CRUD | `lib/packages/{repository,service}.ts`, UI at `/packages`, `/packages/new`, `/packages/[id]`, Library at `/library/packages` |
| Preview / selection | Invoice catalog pick + Event Order “From a package” (one bundled line at catalog `base_price`) |
| Pricing | Single `base_price` on the package. Inclusions are descriptive (`package_items`) — **not** a second priced add-on catalog. |
| Add-ons | Invoice line `type = 'addon'` already exists. **No second add-on system invented.** |
| Availability | `is_active` (active vs archived). No separate “draft” enum. |
| Status | Active / archived only. |
| Templates | Packages **are** the reusable Catalog records (Template Library pattern), not Working Documents. |
| RLS | `venue_id = current_user_venue_id()` for Owner/Manager/Coordinator/Staff membership; restrictive delete gate Owner/Manager. |
| Prior starters | None for venue packages before this work. |

### Pricing / unpriced starters

| Before | Gap | Smallest safe fix |
|---|---|---|
| `base_price numeric not null default 0` | Empty UI price silently became **$0** (`parseFloat \|\| 0`) | Make `base_price` **nullable**; empty input → `null`; UI shows **“Set your price”**; never seed `$0` or fake amounts |

Unpriced catalog rows are allowed. They are not financial commitments.

### Catalog vs Commitment boundary

Documented in `docs/booking-financial-architecture-sections-and-catalogs.md` and proven in BFA release assessment:

| Layer | Role |
|---|---|
| **Package (Catalog)** | Reusable venue offering. Safe to edit. |
| **Event Order line** | Commitment: copies `description` + `unit_price` at add time (`addLineFromPackage` → `insertLineFromPackage`). |
| **Invoice line** | Commitment: copies description + unit price when picked; draft lines editable until send freeze. |
| **Contract (D4)** | Existing `package_section` merge field is built from **Event Order package lines** in `lib/contracts/service.ts` — **no new contract path**. |

Editing a Package after EO/invoice use does **not** rewrite already-copied lines.

### Package → money handoffs (existing only)

```
Package (catalog)
  → EO line (copy-at-commitment price)   [optional]
  → Invoice line (copy-at-commitment)    [optional]
  → Payment Plan / payments              [invoice-driven — not package-driven]
```

Provisioning writes **only** `packages` + `package_items`. Zero invoices, schedules, or revenue.

---

## 2. What was implemented

### Content (exactly three differentiated starters)

| Key | Name | Tier feel | Inclusion count |
|---|---|---|---|
| PKG-01 | Essential Wedding | Venue-focused foundation | 5 |
| PKG-02 | Signature Wedding | Essential + convenience (linens, coordination, timeline guidance) | 6 |
| PKG-03 | Full-Service Wedding | Highest-touch (place-setting support, expanded coordination, vendor load-in/out, check-ins) | 8 |

Customer-facing names use **Essential / Signature / Full-Service Wedding** (not “Package Entity”). Descriptions are the Hello to Cheers customize language from the product request (not invented capacity/catering/alcohol/legal claims).

Category uses existing `Venue` from `PACKAGE_CATEGORIES`.

### Files

| Path | Role |
|---|---|
| `supabase/migrations/20261275000000_package_starter_library.sql` | `source_master_key`, unique `(venue_id, source_master_key)`, nullable `base_price`, service_role grants |
| `lib/packages/starters.ts` | Protected masters (code fixtures) |
| `lib/packages/provision.ts` | Idempotent provision / seed / ensure / restore |
| `lib/packages/starters.test.ts` | Differentiation, no prices, skip rules |
| `lib/packages/{types,constants,repository,service}.ts` | Nullable price + `sourceMasterKey` + validate/parse |
| `lib/venue/service.ts` | Venue-create `seedPackageStarters` |
| `app/(app)/library/packages/{page.tsx,actions.ts}` | Ensure + Restore starters |
| `app/(app)/packages/page.tsx` | Ensure + list with inclusions |
| `app/(app)/packages/[id]/page.tsx` | Catalog vs commitment copy |
| `app/(app)/packages/actions.ts` | Revalidate Library paths |
| `components/packages/package-list.tsx` | Starter badge, preview sheet, Restore menu |
| `components/packages/package-form.tsx` | Optional price (“Set your price”) |
| `components/event-orders/add-line-sheet.tsx` | Block unpriced package → EO with clear message |
| `components/invoices/invoice-line-items-editor.tsx` | Unpriced label; empty unit price prefill |
| Brochure page + PDF + types/service | Null-safe price display (“Pricing available from the venue”) |
| `docs/hello-to-cheers-starter-package-implementation.md` | This report |

---

## 3. Pricing approach chosen (and why)

**Choice: seed `base_price = null` (unpriced). Never seed example dollars. Never seed `$0`.**

Why:

1. Product rule forbids fake prices and forbids `$0` unless `$0` has legitimate meaning — existing `$0` default was a **parser fallback**, not meaningful free pricing.
2. Matches inventory starter posture (null `unit_price`).
3. Catalog may exist without financial commitment; money only appears when the venue sets a price and uses existing EO/invoice handoffs.
4. Smallest schema change: nullable column + check `(base_price is null or base_price >= 0)`.

UI: **“Set your price”** in Library; form hint that blank is preferred over `$0`.

---

## 4. Financial side-effect validation

Local DB (`supabase_db_wevenu-website`), venue *The Pretty Platypus*:

| Metric | Before provision | After 3 starters + 19 inclusions |
|---|---|---|
| invoices | 0 | 0 |
| invoice_line_items | 0 | 0 |
| payment_schedules | 0 | 0 |
| payment_line_items | 0 | 0 |

Starters verified: all three `base_price IS NULL`, `is_active = true`, inclusion counts 5 / 6 / 8.  
Second provision pass created **0** rows (idempotent skip by key/name).

---

## 5. Catalog vs commitment validation

Live on local DB:

1. Created temporary open Event Order on an existing event.
2. Inserted EO line with `unit_price = 1234.56` and `package_id` → PKG-01 (mirrors copy-at-commitment).
3. Raised catalog `packages.base_price` to `7777`.
4. EO line remained **`1234.56`** (`HELD=t`).
5. Cleaned up temporary EO/line; restored starter to unpriced.

Contract D4: still uses existing `package_section` built from EO package lines in `lib/contracts/service.ts` + merge token `{{package_section}}` — **no new merge path**.

EO: still one bundled line at package price via existing `addLineFromPackage`; unpriced packages are refused until priced (prevents silent `$0` commitments). No independent pricing engine.

---

## 6. Migration apply status

| Item | Status |
|---|---|
| File | `supabase/migrations/20261275000000_package_starter_library.sql` |
| Applied locally | **Yes** — via `docker exec … psql` to `supabase_db_wevenu-website` |
| Verified | `base_price` nullable; `source_master_key` present; unique index `packages_venue_source_master_key_uidx` |

---

## 7. Gaps (honest)

| Gap | Notes |
|---|---|
| No separate “draft/unpublished” status beyond active/archived | Starters ship **active + unpriced** with Starter badge; brochures can still list them with soft “Pricing available from the venue” until priced |
| Package inclusions are not independently priced lines | Existing architecture (bundled `base_price`); itemized inclusion pricing remains future BFA Phase 6 territory |
| No package ↔ contract/EO automatic wizard | Correct — existing handoffs only |
| STARTER-LIBRARY.md §5.B still lists old names/example prices | This implementation follows the **approved Essential / Signature / Full-Service** brief with **no prices**, not the older Ceremony & Reception / $8500 examples |
| Automated RLS role matrix (Owner vs Staff) not re-run end-to-end in browser | Policies already venue-scoped via `current_user_venue_id()` + delete gates; not re-proved interactively here |
| Live TypeScript `provisionPackageStarters` not executed via service-role Node (credential loading blocked in this environment) | Equivalent SQL insert path + unit tests + schema grants validated; app ensure/seed paths match other starter families |

---

## 8. Tests

```bash
npx tsx --test lib/packages/starters.test.ts
```

**Result:** 8/8 passed (names/descriptions, no price seeding, tier differentiation, banned claims, idempotent skip rules).

---

## 9. Permissions & isolation

- RLS: venue membership for all / delete restricted to Owner/Manager (existing gates).
- Cross-venue: PKG-01 rows on two venues have **distinct IDs**; unique index is per `(venue_id, source_master_key)`.
- Duplicate package does **not** copy `source_master_key` (venue custom, not starter).

---

## 10. STOP confirmation

**Stopped after Packages.** FAQs, additional Contract work, Event Order template work, and financial default provisioning were **not** started in this implementation.
