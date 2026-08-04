/**
 * Product-app access lock bridge (CRM Suspend ↔ venue hard lock).
 *
 * Prefer updating a real Supabase venue when productSync.venueId is a UUID
 * (or owner email matches a venue). Always records intent on the local
 * product-sync artifact so simulated provision still has an audit trail.
 *
 * Never deletes venue data.
 */

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { getProductSyncDataDir } from "./paths";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProductAccessLockInput = {
  relationshipId: string;
  venueId?: string | null;
  ownerEmail?: string | null;
  stripeCustomerId?: string | null;
  locked: boolean;
  reason?: string;
};

export type ProductAccessLockResult = {
  ok: boolean;
  appliedToProduct: boolean;
  simulatedOnly: boolean;
  venueId: string | null;
  detail: string;
};

type LocalArtifact = {
  relationshipId: string;
  updatedAt: string;
  resources?: Record<string, unknown>;
  history?: Array<Record<string, unknown>>;
  accessLock?: {
    locked: boolean;
    updatedAt: string;
    venueId?: string | null;
    stripeCustomerId?: string | null;
    reason?: string;
    appliedToProduct?: boolean;
    detail?: string;
  };
};

export function isRealVenueUuid(venueId: string | null | undefined): boolean {
  return Boolean(venueId && UUID_RE.test(venueId.trim()));
}

async function loadArtifact(relationshipId: string): Promise<LocalArtifact> {
  const dir = getProductSyncDataDir();
  const filePath = path.join(dir, `${relationshipId}.json`);
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw) as LocalArtifact;
  } catch {
    return {
      relationshipId,
      updatedAt: new Date().toISOString(),
      resources: {},
      history: [],
    };
  }
}

async function saveArtifact(artifact: LocalArtifact): Promise<void> {
  const dir = getProductSyncDataDir();
  await mkdir(dir, { recursive: true });
  const filePath = path.join(dir, `${artifact.relationshipId}.json`);
  artifact.updatedAt = new Date().toISOString();
  await writeFile(filePath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
}

function getProductApiBase(): string | null {
  return process.env.PRODUCT_API_BASE_URL?.trim().replace(/\/$/, "") || null;
}

function getProductSyncApiKey(): string | null {
  return process.env.PRODUCT_SYNC_API_KEY?.trim() || null;
}

async function persistLocalLock(
  input: ProductAccessLockInput,
  meta: { appliedToProduct: boolean; detail: string },
): Promise<void> {
  const artifact = await loadArtifact(input.relationshipId);
  const now = new Date().toISOString();
  artifact.accessLock = {
    locked: input.locked,
    updatedAt: now,
    venueId: input.venueId ?? null,
    stripeCustomerId: input.stripeCustomerId ?? null,
    reason: input.reason,
    appliedToProduct: meta.appliedToProduct,
    detail: meta.detail,
  };
  artifact.history = artifact.history ?? [];
  artifact.history.push({
    step: "access_lock",
    resourceId: input.venueId || input.relationshipId,
    at: now,
    detail: meta.detail,
  });
  await saveArtifact(artifact);
}

async function callProductLockApi(
  input: ProductAccessLockInput,
): Promise<{ ok: boolean; venueId: string | null; detail: string }> {
  const base = getProductApiBase();
  const apiKey = getProductSyncApiKey();
  if (!base) {
    return {
      ok: false,
      venueId: null,
      detail: "PRODUCT_API_BASE_URL unset — cannot call product lock API",
    };
  }
  if (!apiKey) {
    return {
      ok: false,
      venueId: null,
      detail: "PRODUCT_SYNC_API_KEY unset — cannot call product lock API",
    };
  }

  const url = `${base}/api/internal/product-access/lock`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        venueId: input.venueId ?? null,
        ownerEmail: input.ownerEmail ?? null,
        stripeCustomerId: input.stripeCustomerId ?? null,
        locked: input.locked,
        reason: input.reason ?? null,
        relationshipId: input.relationshipId,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      venueId?: string | null;
      error?: string;
      detail?: string;
    };
    if (!res.ok || !data.ok) {
      return {
        ok: false,
        venueId: data.venueId ?? null,
        detail:
          data.error ||
          data.detail ||
          `Product lock API returned ${res.status}`,
      };
    }
    return {
      ok: true,
      venueId: data.venueId ?? null,
      detail: data.detail || `Product venue lock ${input.locked ? "set" : "cleared"}`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      venueId: null,
      detail: `Product lock API request failed: ${message}`,
    };
  }
}

/**
 * Apply or clear the product-side venue lock for a Relationship.
 * CRM suspend/reactivate always succeeds regardless of this result.
 */
export async function applyProductAccessLock(
  input: ProductAccessLockInput,
): Promise<ProductAccessLockResult> {
  const hasUuid = isRealVenueUuid(input.venueId);
  const hasEmail = Boolean(input.ownerEmail?.trim());

  if (!hasUuid && !hasEmail) {
    const detail =
      "No productSync.venueId (UUID) and no owner email — CRM suspend recorded; product lock skipped";
    console.warn("[product-access-lock]", {
      relationshipId: input.relationshipId,
      locked: input.locked,
      detail,
    });
    await persistLocalLock(input, { appliedToProduct: false, detail });
    return {
      ok: true,
      appliedToProduct: false,
      simulatedOnly: true,
      venueId: input.venueId ?? null,
      detail,
    };
  }

  const remote = await callProductLockApi(input);

  if (remote.ok) {
    await persistLocalLock(input, {
      appliedToProduct: true,
      detail: remote.detail,
    });
    console.info("[product-access-lock]", {
      relationshipId: input.relationshipId,
      locked: input.locked,
      venueId: remote.venueId,
      appliedToProduct: true,
    });
    return {
      ok: true,
      appliedToProduct: true,
      simulatedOnly: false,
      venueId: remote.venueId,
      detail: remote.detail,
    };
  }

  // Product API unavailable — still write local artifact (simulated venue ids).
  const detail = `${remote.detail}. Recorded local accessLock only (simulated productSync venueId=${input.venueId || "none"}).`;
  console.warn("[product-access-lock]", {
    relationshipId: input.relationshipId,
    locked: input.locked,
    venueId: input.venueId ?? null,
    detail,
  });
  await persistLocalLock(input, { appliedToProduct: false, detail });
  return {
    ok: true,
    appliedToProduct: false,
    simulatedOnly: true,
    venueId: input.venueId ?? null,
    detail,
  };
}

/** Convenience from a Relationship-shaped object after suspend/reactivate. */
export async function applyProductAccessLockFromRelationship(
  relationship: {
    id: string;
    productSync?: { venueId?: string | null } | null;
    owner?: { email?: string | null } | null;
    stripeCustomerId?: string | null;
  },
  locked: boolean,
  reason?: string,
): Promise<ProductAccessLockResult> {
  return applyProductAccessLock({
    relationshipId: relationship.id,
    venueId: relationship.productSync?.venueId ?? null,
    ownerEmail: relationship.owner?.email ?? null,
    stripeCustomerId: relationship.stripeCustomerId ?? null,
    locked,
    reason,
  });
}
