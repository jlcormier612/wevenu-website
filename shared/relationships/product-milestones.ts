/**
 * Thin product → CRM milestone sync for White Glove / provisioning.
 * Does not mirror product onboarding state machines — only meaningful events.
 * Idempotent via timeline meta.product_event_key.
 */
import { randomUUID } from "crypto";

import { computeRelationshipHealth, applyHealthSnapshot } from "./health";
import { withLiveStore, loadLiveStore } from "./store";
import type { Relationship, TimelineEventType } from "./types";

function shortId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function findByVenueOrEmail(
  relationships: Relationship[],
  opts: { productVenueId?: string | null; ownerEmail?: string | null },
): Relationship | undefined {
  const venueId = opts.productVenueId?.trim();
  if (venueId) {
    const byVenue = relationships.find(
      (r) => r.productSync?.venueId?.trim() === venueId,
    );
    if (byVenue) return byVenue;
  }
  const email = opts.ownerEmail?.trim().toLowerCase();
  if (email) {
    return relationships.find((r) => r.owner.email?.trim().toLowerCase() === email);
  }
  return undefined;
}

function hasEventKey(
  events: { relationshipId: string; meta?: Record<string, string | number | boolean | null> }[],
  relationshipId: string,
  key: string,
): boolean {
  return events.some(
    (e) =>
      e.relationshipId === relationshipId &&
      String(e.meta?.product_event_key ?? "") === key,
  );
}

/**
 * Bind product venue id onto the CRM Relationship (idempotent).
 */
export async function bindCrmProductVenueId(input: {
  productVenueId: string;
  ownerEmail?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}): Promise<{ ok: true; relationshipId: string; alreadyBound: boolean } | { ok: false; reason: string }> {
  const productVenueId = input.productVenueId.trim();
  if (!productVenueId) return { ok: false, reason: "missing_venue_id" };

  const { result } = await withLiveStore((store) => {
    let relationship =
      store.relationships.find((r) => r.productSync?.venueId?.trim() === productVenueId) ??
      null;

    if (!relationship && input.ownerEmail?.trim()) {
      const email = input.ownerEmail.trim().toLowerCase();
      relationship =
        store.relationships.find((r) => r.owner.email?.trim().toLowerCase() === email) ?? null;
    }
    if (!relationship && input.stripeCustomerId?.trim()) {
      const cid = input.stripeCustomerId.trim();
      relationship =
        store.relationships.find((r) => r.stripeCustomerId?.trim() === cid) ?? null;
    }
    if (!relationship && input.stripeSubscriptionId?.trim()) {
      const sid = input.stripeSubscriptionId.trim();
      relationship =
        store.relationships.find((r) => r.stripeSubscriptionId?.trim() === sid) ?? null;
    }

    if (!relationship) return null;

    const alreadyBound = relationship.productSync?.venueId?.trim() === productVenueId;
    if (!alreadyBound) {
      relationship.productSync = {
        status: relationship.productSync?.status ?? "idle",
        steps: relationship.productSync?.steps ?? [],
        adapter: relationship.productSync?.adapter ?? "local",
        ...relationship.productSync,
        venueId: productVenueId,
      };
      relationship.updatedAt = new Date().toISOString();
    }
    return { relationshipId: relationship.id, alreadyBound };
  });

  if (!result) return { ok: false, reason: "relationship_not_found" };
  return { ok: true, ...result };
}

type MilestoneInput = {
  productVenueId?: string | null;
  ownerEmail?: string | null;
  eventKey: string;
  type: TimelineEventType;
  title: string;
  body?: string;
  /** Optional CRM field updates when the milestone is first recorded. */
  onFirstWrite?: (relationship: Relationship, now: string) => void;
};

async function appendProductMilestone(
  input: MilestoneInput,
): Promise<{ ok: true; relationshipId: string; created: boolean } | { ok: false; reason: string }> {
  const { result } = await withLiveStore((store) => {
    const relationship = findByVenueOrEmail(store.relationships, {
      productVenueId: input.productVenueId,
      ownerEmail: input.ownerEmail,
    });
    if (!relationship) return null;

    if (hasEventKey(store.timelineEvents, relationship.id, input.eventKey)) {
      return { relationshipId: relationship.id, created: false };
    }

    const now = new Date().toISOString();
    input.onFirstWrite?.(relationship, now);
    relationship.updatedAt = now;
    relationship.lastTeamActivityAt = now;

    store.timelineEvents.push({
      id: shortId("evt"),
      relationshipId: relationship.id,
      type: input.type,
      title: input.title,
      body: input.body,
      occurredAt: now,
      meta: {
        product_event_key: input.eventKey,
        product_venue_id: input.productVenueId?.trim() || null,
        source: "product",
      },
    });

    applyHealthSnapshot(relationship, computeRelationshipHealth(relationship, store));
    return { relationshipId: relationship.id, created: true };
  });

  if (!result) return { ok: false, reason: "relationship_not_found" };
  return { ok: true, ...result };
}

export async function recordCrmWhiteGloveIntakeSubmitted(input: {
  productVenueId: string;
  ownerEmail?: string | null;
}): Promise<{ ok: boolean; created?: boolean; reason?: string }> {
  const r = await appendProductMilestone({
    productVenueId: input.productVenueId,
    ownerEmail: input.ownerEmail,
    eventKey: `wg_intake_submitted:${input.productVenueId}`,
    type: "onboarding_milestone",
    title: "White Glove intake submitted",
    body: "Customer submitted White Glove intake in the product onboarding flow.",
    onFirstWrite: (relationship, now) => {
      relationship.nextMilestone = "Review intake and configure workspace";
      relationship.lastCustomerActivityAt = now;
    },
  });
  return r.ok ? { ok: true, created: r.created } : { ok: false, reason: r.reason };
}

export async function recordCrmWhiteGloveMaterialsReceived(input: {
  productVenueId: string;
  ownerEmail?: string | null;
  fileCount: number;
}): Promise<{ ok: boolean; created?: boolean; reason?: string }> {
  const count = Math.max(0, input.fileCount);
  // One milestone per venue materials "batch wave" keyed by total count bucket
  // so retries of the same upload don't spam; new files bump the key.
  const r = await appendProductMilestone({
    productVenueId: input.productVenueId,
    ownerEmail: input.ownerEmail,
    eventKey: `wg_materials_received:${input.productVenueId}:count:${count}`,
    type: "document_uploaded",
    title: "White Glove materials received",
    body:
      count === 1
        ? "1 file uploaded for White Glove setup."
        : `${count} files uploaded for White Glove setup.`,
    onFirstWrite: (relationship, now) => {
      relationship.lastCustomerActivityAt = now;
    },
  });
  return r.ok ? { ok: true, created: r.created } : { ok: false, reason: r.reason };
}

/**
 * Product HQ Finish White Glove Setup succeeded — CRM learns handoff completed.
 * This is when CRM moves to Active / Live (not CRM Mark Implementation Complete).
 */
export async function recordCrmWhiteGloveHandoffComplete(input: {
  productVenueId: string;
  ownerEmail?: string | null;
}): Promise<{ ok: boolean; created?: boolean; reason?: string }> {
  const r = await appendProductMilestone({
    productVenueId: input.productVenueId,
    ownerEmail: input.ownerEmail,
    eventKey: `wg_handoff_complete:${input.productVenueId}`,
    type: "onboarding_completed",
    title: "White Glove setup completed / customer handoff completed",
    body:
      "Product HQ Finish White Glove Setup succeeded. Secure customer activation email was sent. Customer access is pending activation.",
    onFirstWrite: (relationship, now) => {
      relationship.status = "active";
      relationship.currentStageLabel = "Active";
      relationship.salesStage = "closed_won";
      relationship.customerSuccessStage = "live";
      relationship.accessDisabled = false;
      relationship.nextMilestone = "Customer activation";
      relationship.paymentStatus = relationship.paymentStatus || "paid";
      relationship.lastContactAt = now;
    },
  });
  return r.ok ? { ok: true, created: r.created } : { ok: false, reason: r.reason };
}

export async function recordCrmProductAccountActivated(input: {
  productVenueId: string;
  ownerEmail?: string | null;
}): Promise<{ ok: boolean; created?: boolean; reason?: string }> {
  const r = await appendProductMilestone({
    productVenueId: input.productVenueId,
    ownerEmail: input.ownerEmail,
    eventKey: `account_activated:${input.productVenueId}`,
    type: "account_activated",
    title: "Account Activated",
    body: "Owner set up their login and activated access to Hello to Cheers.",
    onFirstWrite: (relationship, now) => {
      relationship.activationCompletedAt = relationship.activationCompletedAt || now;
      relationship.accessDisabled = false;
      relationship.lastCustomerActivityAt = now;
      if (
        !relationship.nextMilestone ||
        relationship.nextMilestone === "Customer activation" ||
        relationship.nextMilestone === "Workspace activated"
      ) {
        relationship.nextMilestone = "Getting started in Setup Hub";
      }
      if (relationship.status === "onboarding" || relationship.status === "white_glove_implementation") {
        relationship.status = "active";
        relationship.currentStageLabel = "Active";
      }
      if (relationship.onboardingType === "white_glove") {
        relationship.customerSuccessStage = "live";
      }
    },
  });
  return r.ok ? { ok: true, created: r.created } : { ok: false, reason: r.reason };
}

/** Resolve product venue URL for CRM Configure Workspace (read-only helper). */
export function productConfigureWorkspaceUrl(productVenueId: string): string {
  const base = (
    process.env.NEXT_PUBLIC_PRODUCT_APP_URL?.trim() ||
    process.env.PRODUCT_API_BASE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  return `${base}/admin/onboarding/${encodeURIComponent(productVenueId.trim())}`;
}

export async function getCrmProductVenueId(
  relationshipId: string,
): Promise<string | null> {
  const store = await loadLiveStore();
  const rel = store.relationships.find((r) => r.id === relationshipId);
  return rel?.productSync?.venueId?.trim() || null;
}
