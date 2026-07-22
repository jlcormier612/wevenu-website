/**
 * Project 10 — Product Sync types.
 *
 * Pipeline: Relationship (subscribed) → Venue → Workspace → Website →
 * Subscription → Owner Account → Onboarding → Launch.
 */

export const PRODUCT_SYNC_STEPS = [
  "venue",
  "workspace",
  "website",
  "subscription",
  "owner_account",
  "onboarding",
  "launch",
] as const;

export type ProductSyncStepId = (typeof PRODUCT_SYNC_STEPS)[number];

export type ProductSyncStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "skipped"
  | "failed";

export type ProductSyncStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "partial";

export type ProductSyncStepRecord = {
  id: ProductSyncStepId;
  label: string;
  status: ProductSyncStepStatus;
  resourceId?: string | null;
  completedAt?: string | null;
  error?: string | null;
  simulated?: boolean;
};

export type ProductSyncState = {
  status: ProductSyncStatus;
  steps: ProductSyncStepRecord[];
  venueId?: string | null;
  workspaceId?: string | null;
  websiteId?: string | null;
  subscriptionId?: string | null;
  ownerAccountId?: string | null;
  onboardingId?: string | null;
  launchedAt?: string | null;
  adapter: "local" | "http";
  lastError?: string | null;
  lastRunAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
};

export const PRODUCT_SYNC_STEP_LABELS: Record<ProductSyncStepId, string> = {
  venue: "Venue",
  workspace: "Workspace",
  website: "Website",
  subscription: "Subscription",
  owner_account: "Owner Account",
  onboarding: "Onboarding",
  launch: "Launch",
};

export function emptyProductSyncSteps(): ProductSyncStepRecord[] {
  return PRODUCT_SYNC_STEPS.map((id) => ({
    id,
    label: PRODUCT_SYNC_STEP_LABELS[id],
    status: "pending" as const,
  }));
}

export function emptyProductSyncState(
  adapter: "local" | "http" = "local",
): ProductSyncState {
  return {
    status: "idle",
    steps: emptyProductSyncSteps(),
    adapter,
    lastError: null,
  };
}

export type ProductProvisionContext = {
  relationshipId: string;
  venueName: string;
  ownerEmail: string;
  ownerFirstName: string;
  ownerLastName: string;
  city?: string;
  state?: string;
  website?: string;
  planId: string;
  planName: string;
  onboardingType: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  /** Existing ids from a prior partial sync — adapters must reuse, never duplicate. */
  existing: {
    venueId?: string | null;
    workspaceId?: string | null;
    websiteId?: string | null;
    subscriptionId?: string | null;
    ownerAccountId?: string | null;
    onboardingId?: string | null;
  };
};

export type ProductProvisionResult = {
  resourceId: string;
  simulated: boolean;
  detail?: string;
};
