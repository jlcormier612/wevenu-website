/**
 * Idempotent product provisioning pipeline.
 *
 * syncRelationshipToProduct(relationshipId) walks typed stages, persists
 * productSync on the Relationship, and appends timeline events per step.
 */

import {
  appendTimelineEvent,
  loadLiveStore,
  withLiveStore,
  type Relationship,
} from "../relationships";

import { getProductSyncAdapter } from "./adapters";
import {
  emptyProductSyncState,
  PRODUCT_SYNC_STEP_LABELS,
  PRODUCT_SYNC_STEPS,
  type ProductProvisionContext,
  type ProductSyncState,
  type ProductSyncStepId,
  type ProductSyncStepRecord,
} from "./types";

export type SyncRelationshipResult = {
  relationshipId: string;
  status: ProductSyncState["status"];
  productSync: ProductSyncState;
  ran: boolean;
  message: string;
};

const READY_STATUSES = new Set([
  "subscribed",
  "onboarding",
  "live",
  "expansion",
  "referral",
  "renewal",
]);

function cloneSteps(state: ProductSyncState | undefined): ProductSyncStepRecord[] {
  const base = emptyProductSyncState().steps;
  if (!state?.steps?.length) return base;
  return base.map((step) => {
    const existing = state.steps.find((s) => s.id === step.id);
    return existing ? { ...existing } : { ...step };
  });
}

function applyResourceIds(
  state: ProductSyncState,
  step: ProductSyncStepId,
  resourceId: string,
): void {
  switch (step) {
    case "venue":
      state.venueId = resourceId;
      break;
    case "workspace":
      state.workspaceId = resourceId;
      break;
    case "website":
      state.websiteId = resourceId;
      break;
    case "subscription":
      state.subscriptionId = resourceId;
      break;
    case "owner_account":
      state.ownerAccountId = resourceId;
      break;
    case "onboarding":
      state.onboardingId = resourceId;
      break;
    case "launch":
      state.launchedAt = new Date().toISOString();
      break;
  }
}

function buildContext(relationship: Relationship): ProductProvisionContext {
  const sync = relationship.productSync;
  return {
    relationshipId: relationship.id,
    venueName: relationship.venue.name,
    ownerEmail: relationship.owner.email,
    ownerFirstName: relationship.owner.firstName,
    ownerLastName: relationship.owner.lastName,
    city: relationship.venue.city,
    state: relationship.venue.state,
    website: relationship.venue.website,
    planId: relationship.planId,
    planName: relationship.planName,
    onboardingType: relationship.onboardingType,
    stripeCustomerId: relationship.stripeCustomerId,
    stripeSubscriptionId: relationship.stripeSubscriptionId,
    stripeCheckoutSessionId: relationship.stripeCheckoutSessionId,
    existing: {
      venueId: sync?.venueId,
      workspaceId: sync?.workspaceId,
      websiteId: sync?.websiteId,
      subscriptionId: sync?.subscriptionId,
      ownerAccountId: sync?.ownerAccountId,
      onboardingId: sync?.onboardingId,
    },
  };
}

async function persistProductSync(
  relationshipId: string,
  productSync: ProductSyncState,
  opts?: { promoteOnboarding?: boolean },
): Promise<Relationship | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    const now = new Date().toISOString();
    relationship.productSync = productSync;
    relationship.updatedAt = now;

    if (opts?.promoteOnboarding && relationship.status === "subscribed") {
      relationship.status = "onboarding";
      relationship.currentStageLabel =
        relationship.onboardingType === "white_glove"
          ? "White Glove Onboarding"
          : "Product onboarding";
      relationship.nextMilestone =
        relationship.onboardingType === "white_glove"
          ? "Kickoff Call"
          : "Complete venue setup";
    }

    if (productSync.status === "completed") {
      relationship.nextMilestone =
        relationship.onboardingType === "white_glove"
          ? relationship.nextMilestone || "Go Live"
          : "Venue ready";
      if (!relationship.currentStageLabel?.includes("Launch")) {
        relationship.currentStageLabel =
          productSync.launchedAt && relationship.onboardingType === "self_guided"
            ? "Live — product ready"
            : relationship.currentStageLabel;
      }
    }

    return relationship;
  });
  return result;
}

function stepAlreadyDone(step: ProductSyncStepRecord): boolean {
  return step.status === "completed" || step.status === "skipped";
}

/**
 * Run (or resume) product provisioning for a Relationship.
 * Idempotent: completed steps with resource ids are not re-created.
 */
export async function syncRelationshipToProduct(
  relationshipId: string,
  opts?: { force?: boolean; trigger?: string },
): Promise<SyncRelationshipResult> {
  const store = await loadLiveStore();
  const relationship = store.relationships.find((r) => r.id === relationshipId);
  if (!relationship) {
    throw new Error(`Relationship not found: ${relationshipId}`);
  }

  const adapter = getProductSyncAdapter();
  const trigger = opts?.trigger ?? "manual";

  if (!opts?.force && !READY_STATUSES.has(relationship.status)) {
    const idle = relationship.productSync ?? emptyProductSyncState(adapter.name);
    return {
      relationshipId,
      status: idle.status,
      productSync: idle,
      ran: false,
      message: `Skipped — relationship status is ${relationship.status} (need subscribed+).`,
    };
  }

  if (
    !opts?.force &&
    relationship.productSync?.status === "completed" &&
    relationship.productSync.steps.every(stepAlreadyDone)
  ) {
    return {
      relationshipId,
      status: "completed",
      productSync: relationship.productSync,
      ran: false,
      message: "Already provisioned — idempotent no-op.",
    };
  }

  const now = new Date().toISOString();
  const productSync: ProductSyncState = {
    ...(relationship.productSync ?? emptyProductSyncState(adapter.name)),
    steps: cloneSteps(relationship.productSync),
    adapter: adapter.name,
    status: "running",
    lastError: null,
    lastRunAt: now,
    startedAt: relationship.productSync?.startedAt ?? now,
  };

  await persistProductSync(relationshipId, productSync);
  await appendTimelineEvent(relationshipId, {
    type: "product_sync_started",
    title: "Product Sync Started",
    body: `Provisioning pipeline (${adapter.name} adapter) · trigger: ${trigger}`,
    occurredAt: now,
    meta: {
      adapter: adapter.name,
      trigger,
      simulated: true,
    },
  });

  let failedStep: ProductSyncStepId | null = null;
  let lastError: string | null = null;

  for (const stepId of PRODUCT_SYNC_STEPS) {
    const step = productSync.steps.find((s) => s.id === stepId)!;
    const existingId = (() => {
      switch (stepId) {
        case "venue":
          return productSync.venueId;
        case "workspace":
          return productSync.workspaceId;
        case "website":
          return productSync.websiteId;
        case "subscription":
          return productSync.subscriptionId;
        case "owner_account":
          return productSync.ownerAccountId;
        case "onboarding":
          return productSync.onboardingId;
        case "launch":
          return productSync.launchedAt ? `launch_${productSync.venueId}` : null;
      }
    })();

    if (stepAlreadyDone(step) && existingId) {
      continue;
    }

    step.status = "running";
    await persistProductSync(relationshipId, productSync);

    try {
      // Refresh existing ids into context each step (prior steps may have filled them).
      const latest = (await loadLiveStore()).relationships.find(
        (r) => r.id === relationshipId,
      );
      if (!latest) throw new Error("Relationship disappeared mid-sync");
      latest.productSync = productSync;
      const ctx = buildContext(latest);

      const result = await adapter.provision(stepId, ctx);
      const completedAt = new Date().toISOString();

      step.status = "completed";
      step.resourceId = result.resourceId;
      step.completedAt = completedAt;
      step.error = null;
      step.simulated = result.simulated;
      applyResourceIds(productSync, stepId, result.resourceId);

      await persistProductSync(relationshipId, productSync, {
        promoteOnboarding: stepId === "onboarding",
      });

      await appendTimelineEvent(relationshipId, {
        type: "product_sync_step_completed",
        title: `${PRODUCT_SYNC_STEP_LABELS[stepId]} Provisioned`,
        body: result.detail || `${PRODUCT_SYNC_STEP_LABELS[stepId]} ready`,
        occurredAt: completedAt,
        meta: {
          step: stepId,
          resource_id: result.resourceId,
          simulated: result.simulated,
          adapter: adapter.name,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failedStep = stepId;
      lastError = message;
      step.status = "failed";
      step.error = message;
      productSync.status = "failed";
      productSync.lastError = message;
      await persistProductSync(relationshipId, productSync);
      await appendTimelineEvent(relationshipId, {
        type: "product_sync_failed",
        title: "Product Sync Failed",
        body: `${PRODUCT_SYNC_STEP_LABELS[stepId]}: ${message}`,
        occurredAt: new Date().toISOString(),
        meta: {
          step: stepId,
          adapter: adapter.name,
          error: message,
        },
      });
      break;
    }
  }

  if (!failedStep) {
    productSync.status = "completed";
    productSync.completedAt = new Date().toISOString();
    productSync.lastError = null;
    await persistProductSync(relationshipId, productSync);
    await appendTimelineEvent(relationshipId, {
      type: "product_sync_completed",
      title: "Product Sync Completed",
      body: `Venue ${productSync.venueId ?? "—"} · Workspace ${productSync.workspaceId ?? "—"} · Launch ready`,
      occurredAt: productSync.completedAt,
      meta: {
        venue_id: productSync.venueId ?? null,
        workspace_id: productSync.workspaceId ?? null,
        adapter: adapter.name,
        simulated: true,
      },
    });
  }

  const final =
    (await loadLiveStore()).relationships.find((r) => r.id === relationshipId)
      ?.productSync ?? productSync;

  return {
    relationshipId,
    status: final.status,
    productSync: final,
    ran: true,
    message: failedStep
      ? `Failed at ${failedStep}: ${lastError}`
      : "Product sync completed.",
  };
}

/**
 * Fire-and-forget safe wrapper for Stripe / ingest paths.
 * Never throws — logs and returns null on failure.
 */
export async function enqueueProductSync(
  relationshipId: string,
  trigger = "checkout.session.completed",
): Promise<SyncRelationshipResult | null> {
  try {
    const result = await syncRelationshipToProduct(relationshipId, { trigger });
    console.info("[product-sync]", {
      relationshipId,
      status: result.status,
      ran: result.ran,
      message: result.message,
      trigger,
    });
    return result;
  } catch (error) {
    console.error("[product-sync] enqueue failed", relationshipId, error);
    return null;
  }
}
