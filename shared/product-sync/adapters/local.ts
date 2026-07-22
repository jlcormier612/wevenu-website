import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

import { getProductSyncDataDir } from "../paths";
import type {
  ProductProvisionContext,
  ProductProvisionResult,
  ProductSyncStepId,
} from "../types";
import type { ProductSyncAdapter } from "./types";

type LocalArtifact = {
  relationshipId: string;
  updatedAt: string;
  resources: Partial<Record<ProductSyncStepId, { id: string; detail?: string }>>;
  history: Array<{
    step: ProductSyncStepId;
    resourceId: string;
    at: string;
    detail?: string;
  }>;
};

function stableId(prefix: string, relationshipId: string, step: ProductSyncStepId): string {
  const hash = createHash("sha256")
    .update(`${relationshipId}:${step}`)
    .digest("hex")
    .slice(0, 12);
  return `${prefix}_${hash}`;
}

function existingIdForStep(
  step: ProductSyncStepId,
  ctx: ProductProvisionContext,
): string | null {
  switch (step) {
    case "venue":
      return ctx.existing.venueId ?? null;
    case "workspace":
      return ctx.existing.workspaceId ?? null;
    case "website":
      return ctx.existing.websiteId ?? null;
    case "subscription":
      return ctx.existing.subscriptionId ?? null;
    case "owner_account":
      return ctx.existing.ownerAccountId ?? null;
    case "onboarding":
      return ctx.existing.onboardingId ?? null;
    case "launch":
      return ctx.existing.venueId ? `launch_${ctx.existing.venueId}` : null;
  }
}

function prefixForStep(step: ProductSyncStepId): string {
  switch (step) {
    case "venue":
      return "ven";
    case "workspace":
      return "ws";
    case "website":
      return "web";
    case "subscription":
      return "sub";
    case "owner_account":
      return "acct";
    case "onboarding":
      return "onb";
    case "launch":
      return "launch";
  }
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

function detailForStep(step: ProductSyncStepId, ctx: ProductProvisionContext): string {
  switch (step) {
    case "venue":
      return `Simulated venue "${ctx.venueName}" (${ctx.city || "—"}, ${ctx.state || "—"})`;
    case "workspace":
      return `Simulated workspace for ${ctx.venueName}`;
    case "website":
      return ctx.website
        ? `Simulated website linked to ${ctx.website}`
        : `Simulated marketing website for ${ctx.venueName}`;
    case "subscription":
      return `Simulated product subscription ${ctx.planName} (Stripe ${ctx.stripeSubscriptionId || "n/a"})`;
    case "owner_account":
      return `Simulated owner account for ${ctx.ownerEmail}`;
    case "onboarding":
      return `Simulated ${ctx.onboardingType} onboarding start`;
    case "launch":
      return `Simulated venue launch — marked ready`;
  }
}

/**
 * Local/file adapter — records intended provisioning under
 * shared/product-sync/.data/{relationshipId}.json.
 *
 * Does NOT call Supabase or create real venues. Ids are stable per
 * relationship+step so re-runs never duplicate.
 */
export const localProductSyncAdapter: ProductSyncAdapter = {
  name: "local",

  async provision(
    step: ProductSyncStepId,
    ctx: ProductProvisionContext,
  ): Promise<ProductProvisionResult> {
    const fromState = existingIdForStep(step, ctx);
    const artifact = await loadArtifact(ctx.relationshipId);
    const fromFile = artifact.resources[step]?.id;
    const resourceId =
      fromState || fromFile || stableId(prefixForStep(step), ctx.relationshipId, step);
    const detail = detailForStep(step, ctx);

    artifact.resources[step] = { id: resourceId, detail };
    artifact.history.push({
      step,
      resourceId,
      at: new Date().toISOString(),
      detail,
    });
    await saveArtifact(artifact);

    return { resourceId, simulated: true, detail };
  },
};
