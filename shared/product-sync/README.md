# Product Sync (Project 10)

When a Relationship is ready (**subscribed** / onboarding / live), automatically drive product provisioning:

```
Relationship (subscribed)
        │
        ▼
   ┌─────────┐
   │  Venue  │
   └────┬────┘
        ▼
   ┌───────────┐
   │ Workspace │
   └─────┬─────┘
         ▼
   ┌──────────┐
   │ Website  │
   └────┬─────┘
        ▼
   ┌──────────────┐
   │ Subscription │
   └──────┬───────┘
          ▼
   ┌───────────────┐
   │ Owner Account │
   └───────┬───────┘
           ▼
   ┌────────────┐
   │ Onboarding │
   └─────┬──────┘
         ▼
   ┌────────┐
   │ Launch │  ← final step / mark ready
   └────────┘
```

## What is live vs simulated

| Layer | Status |
|-------|--------|
| Trigger after Stripe `checkout.session.completed` → Relationship upsert | **Live** (wired in `marketing/lib/crm/service.ts`) |
| Persist `productSync` on Relationship + timeline events | **Live** (shared JSONL store) |
| Workspace Product Sync panel + Owner/Admin **Provision product** | **Live** |
| Create real Supabase Venue / Auth user / website | **Simulated** — product setup requires an authenticated owner session (`lib/venue/service.ts` `submitVenueSetup`); there is no service-role provisioning API yet |
| Local adapter file artifacts | **Live simulation** under `shared/product-sync/.data/` |
| HTTP adapter | **Stub** — logs intended URLs; still writes local artifacts |

Honest default: **`PRODUCT_SYNC_ADAPTER=local`** (or unset). All resource ids are stable hashes of `relationshipId + step`, so re-runs never duplicate venues.

## Architecture

```
marketing Stripe webhook
        │
        ▼
 createVenueEnrollment
        │
        ├── syncEnrollmentToRelationship
        ├── sendEnrollmentProductEmails
        └── enqueueProductSync(relationshipId)
                │
                ▼
         shared/product-sync/
           pipeline.ts     syncRelationshipToProduct (idempotent)
           adapters/local  file-backed simulation
           adapters/http   documents future PRODUCT_API_BASE_URL routes
                │
                ├──► relationship.productSync  (shared/relationships)
                └──► timeline: product_sync_* events
```

### Adapters

- **local** — records intended provisioning in `.data/{relationshipId}.json`
- **http** — logs planned endpoints under `{PRODUCT_API_BASE_URL}/api/internal/product-sync/...`, then delegates to local until a real product API exists

Env:

| Variable | Purpose |
|----------|---------|
| `PRODUCT_SYNC_ADAPTER` | `local` (default) or `http` |
| `PRODUCT_API_BASE_URL` | Base URL for future product internal APIs |
| `PRODUCT_SYNC_API_KEY` | Reserved Bearer token for future HTTP calls |
| `PRODUCT_SYNC_DATA_PATH` | Override local adapter data dir |

## Idempotency

- Completed steps with a `resourceId` are skipped on re-run
- Venue / workspace / etc. ids are deterministic per relationship
- “Already provisioned” returns without rewriting when status is `completed`
- **Force re-run** (Owner/Admin) resumes from incomplete steps; completed steps stay unless force clears… actually force only bypasses the early no-op / status gate — completed steps with ids still skip. To fully re-simulate, delete the relationship’s `productSync` or the `.data/{id}.json` file first.

## How to retry

1. Open **Relationship Workspace** → Relationship detail (`/relationships/[id]`)
2. Find the **Product Sync** panel (below Status move)
3. Owner / Administrator: **Provision product** (or **Retry** / **Force re-run**)
4. Timeline shows `Product Sync Started` / step completed / completed or failed

API: `POST /api/relationships/product-sync` with `{ relationshipId, force?: boolean }` (permission `manage_product_sync`).

## How to test

### Smoke (no Stripe)

```bash
cd "…"   # repo root
npx tsx shared/product-sync/_smoke.mts
```

Creates a temp Relationship, runs the pipeline twice (second run must be idempotent), prints venue/workspace ids.

### Stripe path

1. Complete a test-mode checkout (marketing)
2. Confirm webhook logs enrollment + `[product-sync]` with `status: completed`
3. In workspace, open the Relationship — Product Sync checklist should be all completed (sim badges)
4. Click **Force re-run** — steps stay completed, no duplicate venue id

### Manual only

Create/find a subscribed Relationship, sign in as Owner, hit **Provision product**.

## UI location

**Workspace** → **Relationships** → open a venue → **Product Sync** panel (checklist + Provision button for Owner/Admin).

## Future product APIs

When the product app exposes signed internal routes, implement them under:

- `POST /api/internal/product-sync/venues`
- `…/workspaces`, `…/websites`, `…/subscriptions`, `…/owner-accounts`, `…/onboarding`, `…/launch`

Then set `PRODUCT_SYNC_ADAPTER=http`, `PRODUCT_API_BASE_URL`, `PRODUCT_SYNC_API_KEY`, and flip the http adapter from stub → real `fetch` (guarded by `PRODUCT_SYNC_LIVE=1`).
