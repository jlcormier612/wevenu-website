/**
 * HTTP adapter stub — documents future product API URLs.
 *
 * When PRODUCT_API_BASE_URL is set, logs the intended request and still
 * simulates locally (no real product write path exists yet without an
 * authenticated venue-owner session). Flip to real HTTP once a service-role
 * or signed provisioning API ships in the product app.
 *
 * Planned endpoints (product app, not yet implemented):
 *
 *   POST {BASE}/api/internal/product-sync/venues
 *   POST {BASE}/api/internal/product-sync/workspaces
 *   POST {BASE}/api/internal/product-sync/websites
 *   POST {BASE}/api/internal/product-sync/subscriptions
 *   POST {BASE}/api/internal/product-sync/owner-accounts
 *   POST {BASE}/api/internal/product-sync/onboarding
 *   POST {BASE}/api/internal/product-sync/launch
 *
 * Auth: PRODUCT_SYNC_API_KEY (Bearer) — reserved for future use.
 */

import { localProductSyncAdapter } from "./local";
import type {
  ProductProvisionContext,
  ProductProvisionResult,
  ProductSyncStepId,
} from "../types";
import type { ProductSyncAdapter } from "./types";

const STEP_PATH: Record<ProductSyncStepId, string> = {
  venue: "/api/internal/product-sync/venues",
  workspace: "/api/internal/product-sync/workspaces",
  website: "/api/internal/product-sync/websites",
  subscription: "/api/internal/product-sync/subscriptions",
  owner_account: "/api/internal/product-sync/owner-accounts",
  onboarding: "/api/internal/product-sync/onboarding",
  launch: "/api/internal/product-sync/launch",
};

function getBaseUrl(): string | null {
  return process.env.PRODUCT_API_BASE_URL?.trim().replace(/\/$/, "") || null;
}

/**
 * Until a real internal API exists, this adapter:
 * 1. Documents the intended URL + payload
 * 2. Delegates to the local adapter for durable, idempotent ids
 */
export const httpProductSyncAdapter: ProductSyncAdapter = {
  name: "http",

  async provision(
    step: ProductSyncStepId,
    ctx: ProductProvisionContext,
  ): Promise<ProductProvisionResult> {
    const base = getBaseUrl();
    const path = STEP_PATH[step];
    const url = base ? `${base}${path}` : `(set PRODUCT_API_BASE_URL)${path}`;

    const payload = {
      relationshipId: ctx.relationshipId,
      venueName: ctx.venueName,
      ownerEmail: ctx.ownerEmail,
      planId: ctx.planId,
      planName: ctx.planName,
      onboardingType: ctx.onboardingType,
      stripeCustomerId: ctx.stripeCustomerId,
      stripeSubscriptionId: ctx.stripeSubscriptionId,
      existing: ctx.existing,
      step,
    };

    console.info("[product-sync:http] intended provision (stub — not calling product yet)", {
      url,
      step,
      relationshipId: ctx.relationshipId,
      hasApiKey: Boolean(process.env.PRODUCT_SYNC_API_KEY?.trim()),
      payload,
    });

    // Real fetch reserved for when product internal APIs exist:
    // if (base && process.env.PRODUCT_SYNC_LIVE === "1") { ... fetch ... }

    const local = await localProductSyncAdapter.provision(step, ctx);
    return {
      ...local,
      simulated: true,
      detail: `${local.detail ?? step} · http stub → ${url}`,
    };
  },
};
