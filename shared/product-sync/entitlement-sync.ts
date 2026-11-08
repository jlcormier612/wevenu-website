/**
 * Marketing / CRM → product entitlement sync (Stripe facts → HTC access).
 * Never mutates Stripe. Uses PRODUCT_API_BASE_URL + PRODUCT_SYNC_API_KEY.
 */

function getProductApiBase(): string | null {
  return process.env.PRODUCT_API_BASE_URL?.trim().replace(/\/$/, "") || null;
}

function getProductSyncApiKey(): string | null {
  return process.env.PRODUCT_SYNC_API_KEY?.trim() || null;
}

export type SyncStripeEntitlementInput = {
  venueId?: string | null;
  ownerEmail?: string | null;
  relationshipId?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeStatus: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  dunningStartedAt?: string | null;
  dunningClearedAt?: string | null;
  preferNonpaymentReason?: boolean;
  reason?: string | null;
};

export type SyncStripeEntitlementResult = {
  ok: boolean;
  applied: boolean;
  detail: string;
  entitled?: boolean;
  entitlementStatus?: string;
};

export async function syncStripeEntitlementToProduct(
  input: SyncStripeEntitlementInput,
): Promise<SyncStripeEntitlementResult> {
  const base = getProductApiBase();
  const apiKey = getProductSyncApiKey();
  if (!base || !apiKey) {
    return {
      ok: false,
      applied: false,
      detail: "PRODUCT_API_BASE_URL / PRODUCT_SYNC_API_KEY unset — entitlement sync skipped",
    };
  }

  try {
    const res = await fetch(`${base}/api/internal/product-access/entitlement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action: "sync_stripe",
        ...input,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      applied?: boolean;
      detail?: string;
      error?: string;
      decision?: { entitled?: boolean; entitlementStatus?: string };
    };
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        applied: false,
        detail: data.error || data.detail || `entitlement API ${res.status}`,
      };
    }
    return {
      ok: true,
      applied: Boolean(data.applied ?? true),
      detail: data.detail || "entitlement synced",
      entitled: data.decision?.entitled,
      entitlementStatus: data.decision?.entitlementStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, applied: false, detail: message };
  }
}

export type FounderOverrideRemoteInput = {
  venueId?: string | null;
  ownerEmail?: string | null;
  relationshipId?: string | null;
  actorId: string;
  actorLabel?: string | null;
  reason: string;
  accessOverrideUntil?: string | null;
  clearOverride?: boolean;
  pauseBillingSuspend?: boolean;
  retentionHold?: boolean;
  retentionHoldReason?: string | null;
  manualSecurityLock?: boolean;
  manualSecurityLockReason?: string | null;
  dunningStartedAt?: string | null;
  dunningClearedAt?: string | null;
  stripeCustomerId?: string | null;
};

export async function applyFounderOverrideRemote(
  input: FounderOverrideRemoteInput,
): Promise<SyncStripeEntitlementResult> {
  const base = getProductApiBase();
  const apiKey = getProductSyncApiKey();
  if (!base || !apiKey) {
    return {
      ok: false,
      applied: false,
      detail: "PRODUCT_API_BASE_URL / PRODUCT_SYNC_API_KEY unset",
    };
  }
  try {
    const res = await fetch(`${base}/api/internal/product-access/entitlement`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action: "founder_override",
        ...input,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      applied?: boolean;
      detail?: string;
      error?: string;
      decision?: { entitled?: boolean; entitlementStatus?: string };
    };
    if (!res.ok || data.ok === false) {
      return {
        ok: false,
        applied: false,
        detail: data.error || data.detail || `entitlement API ${res.status}`,
      };
    }
    return {
      ok: true,
      applied: Boolean(data.applied ?? true),
      detail: data.detail || "override applied",
      entitled: data.decision?.entitled,
      entitlementStatus: data.decision?.entitlementStatus,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, applied: false, detail: message };
  }
}
