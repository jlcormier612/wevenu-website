/**
 * Product provisioning adapter interface.
 *
 * Real product venue creation today requires an authenticated Supabase user
 * (see lib/venue/service.ts submitVenueSetup). There is no service-role
 * provisioning API yet — so adapters either simulate (local) or document
 * future HTTP endpoints (http stub).
 */

import type {
  ProductProvisionContext,
  ProductProvisionResult,
  ProductSyncStepId,
} from "../types";

export type ProductSyncAdapterName = "local" | "http";

export type ProductSyncAdapter = {
  name: ProductSyncAdapterName;
  /**
   * Provision (or return existing) resource for a pipeline step.
   * Must be idempotent when ctx.existing.* ids are already set.
   */
  provision(
    step: ProductSyncStepId,
    ctx: ProductProvisionContext,
  ): Promise<ProductProvisionResult>;
};
