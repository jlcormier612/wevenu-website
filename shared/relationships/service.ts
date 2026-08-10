import { randomUUID } from "crypto";

import {
  looksLikeEmailLocalPart,
  normalizeEmail,
  normalizeVenueName,
  splitPersonName,
} from "./normalize";
import {
  deriveSalesStage,
  isCsAutoArrivalStage,
  isInCustomerSuccessView,
  isSalesAutoArrivalStage,
  markAutoArrival,
  clearAutoArrival,
  normalizeCustomerSuccessStage,
  normalizeSalesStage,
  promoteSalesStage,
  promoteToNeedsSupport,
  restoreFromNeedsSupport,
  type SalesStage,
} from "./sales-cs";
import { promoteStatus, stageLabelForStatus } from "./status";
import { withLiveStore } from "./store";
import type {
  Communication,
  FindOrCreateInput,
  LiveRelationshipStore,
  Notification,
  OpenFeedbackItem,
  Relationship,
  RelationshipFieldPatch,
  RelationshipStatus,
  RelationshipTask,
  Subscription,
  TimelineEvent,
  Walkthrough,
} from "./types";
import { ensureWhiteGloveChecklistInStore } from "./white-glove-checklist";

function recountOpenFeedback(relationship: Relationship): number {
  const items = relationship.openFeedbackItems ?? [];
  if (items.length === 0) return relationship.supportOpenCount || 0;
  return items.filter((i) => i.status === "open").length;
}

/** subscribedAt + 1 UTC calendar year (keeps renewalDate in sync on subscribe). */
function renewalDateFromSubscribedAt(subscribedAt: string): string {
  const d = new Date(subscribedAt);
  return new Date(
    Date.UTC(
      d.getUTCFullYear() + 1,
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  ).toISOString();
}

function syncSupportOpenCountFromItems(relationship: Relationship): void {
  relationship.supportOpenCount = recountOpenFeedback(relationship);
}

const DEFAULT_ASSIGNEE = "tm_jen";

const PLAN_RANK: Record<Relationship["planId"], number> = {
  none: 0,
  gather: 1,
  celebrate: 2,
  flourish: 3,
};

const ONBOARDING_RANK: Record<Relationship["onboardingType"], number> = {
  none: 0,
  self_guided: 1,
  white_glove: 2,
};

const WELCOME_BACK_VERIFIED_RANK: Record<
  Relationship["welcomeBackVerified"],
  number
> = {
  none: 0,
  pending: 1,
  expired: 2,
  rejected: 3,
  verified: 3,
};

export type FindOrCreateResult = {
  relationship: Relationship;
  created: boolean;
};

function findExisting(
  store: LiveRelationshipStore,
  input: FindOrCreateInput,
): Relationship | undefined {
  const email = normalizeEmail(input.email);
  const venueKey = normalizeVenueName(input.venueName);
  const stripeCustomerId = input.stripeCustomerId?.trim() || "";
  const stripeCheckoutSessionId = input.stripeCheckoutSessionId?.trim() || "";
  const stripeSubscriptionId = input.stripeSubscriptionId?.trim() || "";

  // 1. Email is the strongest identity signal — never duplicate by email.
  if (email) {
    const byEmail = store.relationships.find(
      (r) => normalizeEmail(r.owner.email) === email,
    );
    if (byEmail) return byEmail;
  }

  // 2. Stripe ids link checkout-start drafts → completed purchase / lifecycle.
  if (stripeCustomerId) {
    const byCustomer = store.relationships.find(
      (r) => r.stripeCustomerId?.trim() === stripeCustomerId,
    );
    if (byCustomer) return byCustomer;
  }
  if (stripeSubscriptionId) {
    const bySubOnRel = store.relationships.find(
      (r) => r.stripeSubscriptionId?.trim() === stripeSubscriptionId,
    );
    if (bySubOnRel) return bySubOnRel;
    const bySubRecord = store.subscriptions.find(
      (s) => s.stripeSubscriptionId?.trim() === stripeSubscriptionId,
    );
    if (bySubRecord) {
      return store.relationships.find((r) => r.id === bySubRecord.relationshipId);
    }
  }
  if (stripeCheckoutSessionId) {
    const bySession = store.relationships.find(
      (r) => r.stripeCheckoutSessionId?.trim() === stripeCheckoutSessionId,
    );
    if (bySession) return bySession;
  }

  // 3. Venue name only when emails are compatible (empty or equal).
  if (venueKey) {
    return store.relationships.find((r) => {
      if (normalizeVenueName(r.venue.name) !== venueKey) return false;
      const existingEmail = normalizeEmail(r.owner.email);
      if (!email || !existingEmail || existingEmail === email) return true;
      return false;
    });
  }

  return undefined;
}

/**
 * If email (or venue) matched one relationship but a checkout-session / customer
 * draft exists as a separate row, fold the draft into the survivor and remove it.
 * Keeps Pricing checkout-start → purchase from leaving orphans.
 */
function absorbStripeDrafts(
  store: LiveRelationshipStore,
  survivor: Relationship,
  input: FindOrCreateInput,
): void {
  const stripeCustomerId = input.stripeCustomerId?.trim() || "";
  const stripeCheckoutSessionId = input.stripeCheckoutSessionId?.trim() || "";
  if (!stripeCustomerId && !stripeCheckoutSessionId) return;

  const drafts = store.relationships.filter((r) => {
    if (r.id === survivor.id) return false;
    if (stripeCustomerId && r.stripeCustomerId?.trim() === stripeCustomerId) {
      return true;
    }
    if (
      stripeCheckoutSessionId &&
      r.stripeCheckoutSessionId?.trim() === stripeCheckoutSessionId
    ) {
      return true;
    }
    return false;
  });

  for (const draft of drafts) {
    applyOwnerVenueDefaults(survivor, {
      email: draft.owner.email,
      venueName: draft.venue.name,
      firstName: draft.owner.firstName,
      lastName: draft.owner.lastName,
      phone: draft.owner.phone,
      city: draft.venue.city,
      state: draft.venue.state,
      website: draft.venue.website,
      referralSource: draft.referralSource,
    });
    applyFieldPatch(survivor, {
      planId: draft.planId !== "none" ? draft.planId : undefined,
      planName: draft.planName !== "—" ? draft.planName : undefined,
      foundingMember: draft.foundingMember ? true : undefined,
      welcomeBackRequested: draft.welcomeBackRequested ? true : undefined,
      welcomeBackVerified:
        draft.welcomeBackVerified !== "none" ? draft.welcomeBackVerified : undefined,
      onboardingType: draft.onboardingType !== "none" ? draft.onboardingType : undefined,
      status: draft.status,
      stripeCustomerId: draft.stripeCustomerId,
      stripeSubscriptionId: draft.stripeSubscriptionId,
      stripeCheckoutSessionId: draft.stripeCheckoutSessionId,
      notes: draft.notes,
    });

    const reassign = <T extends { relationshipId: string }>(rows: T[]) => {
      for (const row of rows) {
        if (row.relationshipId === draft.id) row.relationshipId = survivor.id;
      }
    };
    reassign(store.timelineEvents);
    reassign(store.communications);
    reassign(store.walkthroughs);
    reassign(store.subscriptions);
    reassign(store.notifications);

    store.relationships = store.relationships.filter((r) => r.id !== draft.id);
  }
}

function applyOwnerVenueDefaults(
  relationship: Relationship,
  input: FindOrCreateInput,
): void {
  const email = normalizeEmail(input.email);
  if (email && !relationship.owner.email) {
    relationship.owner.email = email;
  }

  const venueName = input.venueName?.trim();
  if (venueName && !relationship.venue.name.trim()) {
    relationship.venue.name = venueName;
  }

  const incomingFirst = input.firstName?.trim() || "";
  if (
    incomingFirst &&
    !looksLikeEmailLocalPart(incomingFirst) &&
    (!relationship.owner.firstName ||
      looksLikeEmailLocalPart(relationship.owner.firstName))
  ) {
    relationship.owner.firstName = incomingFirst;
  }
  if (input.lastName?.trim() && !relationship.owner.lastName) {
    relationship.owner.lastName = input.lastName.trim();
  }
  if (input.phone?.trim() && !relationship.owner.phone) {
    relationship.owner.phone = input.phone.trim();
  }
  if (input.city?.trim() && !relationship.venue.city) {
    relationship.venue.city = input.city.trim();
  }
  if (input.state?.trim() && !relationship.venue.state) {
    relationship.venue.state = input.state.trim();
  }
  if (input.website?.trim() && !relationship.venue.website) {
    relationship.venue.website = input.website.trim();
  }
  if (input.referralSource?.trim() && !relationship.referralSource) {
    relationship.referralSource = input.referralSource.trim();
  }
}

function createRelationship(input: FindOrCreateInput, now: string): Relationship {
  const email = normalizeEmail(input.email);
  let firstName = input.firstName?.trim() || "";
  let lastName = input.lastName?.trim() || "";
  // Never invent a person name from an email local-part (e.g. emma.carter).
  if (firstName && looksLikeEmailLocalPart(firstName)) {
    firstName = "";
  }

  const venueName =
    input.venueName?.trim() ||
    (email ? `${email.split("@")[0]} venue` : "Unknown venue");

  return {
    id: `rel_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
    venue: {
      name: venueName,
      city: input.city?.trim() || "",
      state: input.state?.trim() || "",
      website: input.website?.trim() || undefined,
    },
    owner: {
      id: `c_${randomUUID().replace(/-/g, "").slice(0, 10)}`,
      firstName,
      lastName,
      email: email || "",
      phone: input.phone?.trim() || undefined,
    },
    status: "inquiry",
    health: "good",
    salesStage: "inquiry",
    assignedTeamMemberId: input.assignedTeamMemberId?.trim() || DEFAULT_ASSIGNEE,
    planId: "none",
    planName: "—",
    foundingMember: false,
    welcomeBackRequested: false,
    welcomeBackVerified: "none",
    onboardingType: "none",
    currentStageLabel: stageLabelForStatus("inquiry"),
    lastContactAt: now,
    createdAt: now,
    updatedAt: now,
    referralSource: input.referralSource?.trim() || undefined,
    supportOpenCount: 0,
  };
}

/**
 * Find an existing relationship by email (preferred), Stripe ids, or normalized
 * venue name — or create a new one. Never creates a duplicate for the same email.
 */
export async function findOrCreateRelationship(
  input: FindOrCreateInput,
): Promise<FindOrCreateResult> {
  const email = normalizeEmail(input.email);
  const venueKey = normalizeVenueName(input.venueName);
  const stripeCustomerId = input.stripeCustomerId?.trim() || "";
  const stripeCheckoutSessionId = input.stripeCheckoutSessionId?.trim() || "";
  const stripeSubscriptionId = input.stripeSubscriptionId?.trim() || "";
  if (
    !email &&
    !venueKey &&
    !stripeCustomerId &&
    !stripeCheckoutSessionId &&
    !stripeSubscriptionId
  ) {
    throw new Error(
      "findOrCreateRelationship requires an email, venue name, or Stripe id.",
    );
  }

  const { result } = await withLiveStore((store) => {
    const now = new Date().toISOString();
    const existing = findExisting(store, input);
    if (existing) {
      applyOwnerVenueDefaults(existing, input);
      if (stripeCustomerId && !existing.stripeCustomerId) {
        existing.stripeCustomerId = stripeCustomerId;
      }
      if (stripeCheckoutSessionId && !existing.stripeCheckoutSessionId) {
        existing.stripeCheckoutSessionId = stripeCheckoutSessionId;
      }
      existing.lastContactAt = now;
      existing.updatedAt = now;
      return { relationship: existing, created: false };
    }

    const relationship = createRelationship(input, now);
    if (stripeCustomerId) relationship.stripeCustomerId = stripeCustomerId;
    if (stripeCheckoutSessionId) {
      relationship.stripeCheckoutSessionId = stripeCheckoutSessionId;
    }
    store.relationships.push(relationship);
    return { relationship, created: true };
  });

  return result;
}

type ApplyFieldPatchOpts = {
  /**
   * Direct sales/CS stage writes (workspace board drag).
   * Default soft path promotes salesStage and skips regressing CS customers.
   */
  forceViewStages?: boolean;
  /**
   * Product → CRM write-back: overwrite venue/owner identity fields when
   * the product supplies a non-empty value. Default merge still fills empties only.
   */
  syncFromProduct?: boolean;
};

/**
 * Merge patch into relationship. Never wipe stronger data with weaker values:
 * - booleans ratchet true-only (foundingMember, welcomeBackRequested)
 * - plan / onboarding / welcomeBackVerified only advance in rank
 * - venue / owner / referral fill empties only (unless syncFromProduct)
 * - status uses promoteStatus
 * - salesStage uses promoteSalesStage unless forceViewStages
 * - Stripe ids fill when provided (authoritative when set)
 */
function applyFieldPatch(
  relationship: Relationship,
  patch: RelationshipFieldPatch,
  opts?: ApplyFieldPatchOpts,
): void {
  if (patch.status) {
    const before = relationship.status;
    relationship.status = promoteStatus(relationship.status, patch.status);
    if (relationship.status !== before || patch.currentStageLabel?.trim()) {
      relationship.currentStageLabel =
        patch.currentStageLabel?.trim() || stageLabelForStatus(relationship.status);
    }
  } else if (patch.currentStageLabel?.trim()) {
    relationship.currentStageLabel = patch.currentStageLabel.trim();
  }

  if (patch.health) relationship.health = patch.health;
  if (typeof patch.healthScore === "number") {
    relationship.healthScore = Math.max(0, Math.min(100, Math.round(patch.healthScore)));
  }
  if (patch.salesStage) {
    const previousSales = normalizeSalesStage(relationship.salesStage);
    if (opts?.forceViewStages) {
      relationship.salesStage =
        normalizeSalesStage(patch.salesStage) ?? patch.salesStage;
    } else if (
      isInCustomerSuccessView(relationship) &&
      normalizeSalesStage(patch.salesStage) !== "closed_won"
    ) {
      // Subscribed / CS customers stay on Closed Won (or current); ingest must not re-open Sales.
    } else {
      relationship.salesStage = promoteSalesStage(
        relationship.salesStage,
        patch.salesStage,
      );
      const nextSales = normalizeSalesStage(relationship.salesStage);
      if (
        nextSales &&
        nextSales !== previousSales &&
        isSalesAutoArrivalStage(nextSales)
      ) {
        markAutoArrival(relationship, nextSales, "sales");
      }
    }
  }
  if (patch.customerSuccessStage) {
    const previousCs =
      normalizeCustomerSuccessStage(relationship.customerSuccessStage, {
        onboardingType: patch.onboardingType ?? relationship.onboardingType,
        status: patch.status ?? relationship.status,
      }) ?? relationship.customerSuccessStage;
    const next = normalizeCustomerSuccessStage(patch.customerSuccessStage, {
      onboardingType: patch.onboardingType ?? relationship.onboardingType,
      status: patch.status ?? relationship.status,
    });
    if (next) {
      // While support is open, remember the intended post-resolve stage and stay pinned.
      if ((relationship.supportOpenCount || 0) > 0 && next !== "needs_support") {
        relationship.customerSuccessStageBeforeSupport = next;
        relationship.customerSuccessStage = "needs_support";
      } else {
        relationship.customerSuccessStage = next;
        if (
          !opts?.forceViewStages &&
          next !== previousCs &&
          isCsAutoArrivalStage(next)
        ) {
          markAutoArrival(relationship, next, "cs");
        }
      }
    }
  }
  if (patch.customerSuccessStageBeforeSupport !== undefined) {
    relationship.customerSuccessStageBeforeSupport =
      patch.customerSuccessStageBeforeSupport;
  }
  if (patch.lastAutoArrival !== undefined) {
    relationship.lastAutoArrival = patch.lastAutoArrival;
  }

  if (patch.planId && PLAN_RANK[patch.planId] > PLAN_RANK[relationship.planId]) {
    relationship.planId = patch.planId;
    if (patch.planName != null && patch.planName.trim()) {
      relationship.planName = patch.planName.trim();
    }
  } else if (
    patch.planName != null &&
    patch.planName.trim() &&
    (!relationship.planName.trim() || relationship.planName === "—")
  ) {
    relationship.planName = patch.planName.trim();
  }

  // Ratchet: once founding / Welcome Back requested, never clear via ingest.
  if (patch.foundingMember === true) relationship.foundingMember = true;
  if (patch.welcomeBackRequested === true) relationship.welcomeBackRequested = true;

  if (
    patch.welcomeBackVerified &&
    WELCOME_BACK_VERIFIED_RANK[patch.welcomeBackVerified] >
      WELCOME_BACK_VERIFIED_RANK[relationship.welcomeBackVerified]
  ) {
    relationship.welcomeBackVerified = patch.welcomeBackVerified;
  }

  if (
    patch.onboardingType &&
    ONBOARDING_RANK[patch.onboardingType] > ONBOARDING_RANK[relationship.onboardingType]
  ) {
    relationship.onboardingType = patch.onboardingType;
  }

  // White Glove: once subscribed/onboarding, prefer Implementation stage.
  if (relationship.onboardingType === "white_glove") {
    const normalized = relationship.status;
    if (
      normalized === "subscribed" ||
      normalized === "onboarding" ||
      normalized === "white_glove_implementation"
    ) {
      const promoted = promoteStatus(
        relationship.status,
        "white_glove_implementation",
      );
      if (promoted !== relationship.status) {
        relationship.status = promoted;
        relationship.currentStageLabel =
          patch.currentStageLabel?.trim() || "White Glove Implementation";
      }
    }
  }

  if (patch.paymentStatus) relationship.paymentStatus = patch.paymentStatus;
  if (patch.subscribedAt !== undefined) {
    relationship.subscribedAt = patch.subscribedAt;
    if (patch.subscribedAt && !relationship.renewalDate && !patch.renewalDate) {
      relationship.renewalDate = renewalDateFromSubscribedAt(patch.subscribedAt);
    }
  }
  if (patch.renewalDate !== undefined) relationship.renewalDate = patch.renewalDate;
  if (patch.accessDisabled !== undefined) {
    relationship.accessDisabled = patch.accessDisabled;
  }
  if (patch.activationToken !== undefined) {
    relationship.activationToken = patch.activationToken;
  }
  if (patch.activationTokenCreatedAt !== undefined) {
    relationship.activationTokenCreatedAt = patch.activationTokenCreatedAt;
  }
  if (patch.activationCompletedAt !== undefined) {
    relationship.activationCompletedAt = patch.activationCompletedAt;
  }
  if (patch.lastLoginAt !== undefined) relationship.lastLoginAt = patch.lastLoginAt;
  if (typeof patch.loginCount30d === "number") {
    relationship.loginCount30d = patch.loginCount30d;
  }
  if (patch.lastCustomerActivityAt !== undefined) {
    relationship.lastCustomerActivityAt = patch.lastCustomerActivityAt;
  }
  if (patch.lastTeamActivityAt !== undefined) {
    relationship.lastTeamActivityAt = patch.lastTeamActivityAt;
  }
  if (patch.websitePublished !== undefined) {
    relationship.websitePublished = patch.websitePublished;
  }
  if (patch.dunning !== undefined) relationship.dunning = patch.dunning;
  if (patch.implementationNotes !== undefined) {
    relationship.implementationNotes = patch.implementationNotes;
  }
  if (patch.implementationAssets !== undefined) {
    relationship.implementationAssets = {
      ...(relationship.implementationAssets ?? {}),
      ...patch.implementationAssets,
    };
  }

  if (patch.nextMilestone !== undefined && patch.nextMilestone) {
    if (
      patch.nextMilestone === "Self-guided setup" &&
      relationship.onboardingType === "white_glove"
    ) {
      relationship.nextMilestone = "Kickoff Call";
    } else {
      relationship.nextMilestone = patch.nextMilestone;
    }
  }
  if (patch.nextMilestoneAt !== undefined && patch.nextMilestoneAt) {
    relationship.nextMilestoneAt = patch.nextMilestoneAt;
  }
  if (patch.notes != null && patch.notes.trim()) {
    const incoming = patch.notes.trim();
    if (!relationship.notes?.trim()) {
      relationship.notes = incoming;
    } else if (!relationship.notes.includes(incoming)) {
      relationship.notes = `${relationship.notes.trim()}\n\n${incoming}`;
    }
  }
  if (patch.referralSource != null && patch.referralSource.trim() && !relationship.referralSource) {
    relationship.referralSource = patch.referralSource.trim();
  }
  if (patch.supportOpenCount != null) {
    relationship.supportOpenCount = Math.max(
      relationship.supportOpenCount || 0,
      patch.supportOpenCount,
    );
  }
  if (patch.assignedTeamMemberId) {
    relationship.assignedTeamMemberId = patch.assignedTeamMemberId;
  }

  if (patch.stripeCustomerId) {
    relationship.stripeCustomerId = patch.stripeCustomerId;
  }
  if (patch.stripeSubscriptionId) {
    relationship.stripeSubscriptionId = patch.stripeSubscriptionId;
  }
  if (patch.stripeCheckoutSessionId) {
    relationship.stripeCheckoutSessionId = patch.stripeCheckoutSessionId;
  }

  // Venue / owner: fill empties only — unless product write-back forces overwrite.
  const forceVenueOwner = Boolean(opts?.syncFromProduct);
  const takeStr = (
    incoming: string | null | undefined,
    current: string | undefined,
  ): string | undefined => {
    const next = incoming?.trim();
    if (!next) return current;
    if (forceVenueOwner || !current?.trim()) return next;
    return current;
  };

  if (patch.venueName !== undefined) {
    relationship.venue.name =
      takeStr(patch.venueName, relationship.venue.name) ?? relationship.venue.name;
  }
  if (patch.city !== undefined) {
    relationship.venue.city =
      takeStr(patch.city, relationship.venue.city) ?? relationship.venue.city;
  }
  if (patch.state !== undefined) {
    relationship.venue.state =
      takeStr(patch.state, relationship.venue.state) ?? relationship.venue.state;
  }
  if (patch.website !== undefined) {
    relationship.venue.website = takeStr(patch.website, relationship.venue.website);
  }
  if (patch.address !== undefined) {
    relationship.venue.address = takeStr(patch.address, relationship.venue.address);
  }
  if (patch.venueType !== undefined) {
    relationship.venue.venueType = takeStr(
      patch.venueType,
      relationship.venue.venueType,
    );
  }
  if (typeof patch.capacity === "number" && Number.isFinite(patch.capacity)) {
    if (forceVenueOwner || relationship.venue.capacity == null) {
      relationship.venue.capacity = Math.max(0, Math.round(patch.capacity));
    }
  }
  if (patch.ownerFirstName !== undefined) {
    const incoming = patch.ownerFirstName?.trim() || "";
    if (incoming && !looksLikeEmailLocalPart(incoming)) {
      if (
        forceVenueOwner ||
        !relationship.owner.firstName?.trim() ||
        looksLikeEmailLocalPart(relationship.owner.firstName)
      ) {
        relationship.owner.firstName = incoming;
      }
    }
  }
  if (patch.ownerLastName !== undefined) {
    relationship.owner.lastName =
      takeStr(patch.ownerLastName, relationship.owner.lastName) ??
      relationship.owner.lastName;
  }
  if (patch.ownerPhone !== undefined) {
    relationship.owner.phone = takeStr(patch.ownerPhone, relationship.owner.phone);
  }
  if (patch.ownerTitle !== undefined) {
    relationship.owner.title = takeStr(patch.ownerTitle, relationship.owner.title);
  }
  if (patch.ownerEmail?.trim()) {
    if (forceVenueOwner || !normalizeEmail(relationship.owner.email)) {
      relationship.owner.email = normalizeEmail(patch.ownerEmail);
    }
  }
}

export type SyncFromProductMatchBy =
  | "product_venue_id"
  | "email"
  | "stripe_customer";

export type SyncRelationshipFromProductResult = {
  relationship: Relationship;
  changed: boolean;
  eventAppended: boolean;
  matchedBy: SyncFromProductMatchBy;
};

/**
 * Product → CRM write-back for Venue / Owner Details.
 * Prefers `productSync.venueId`, then owner email, then Stripe customer id.
 * Never creates a Relationship. Overwrites venue/owner identity fields when
 * the product supplies non-empty values.
 */
export async function syncRelationshipFromProduct(opts: {
  productVenueId: string;
  email?: string | null;
  stripeCustomerId?: string | null;
  patch: RelationshipFieldPatch;
  /**
   * When matched by email/stripe (or sim venue id), bind the real product
   * venue id onto `productSync.venueId` for stable future lookups.
   */
  bindProductVenueId?: boolean;
  timeline?: {
    title?: string;
    body?: string;
    /** Skip appending when a recent venue_profile_synced event exists. */
    debounceMs?: number;
    skip?: boolean;
  };
}): Promise<SyncRelationshipFromProductResult | null> {
  const productVenueId = opts.productVenueId.trim();
  if (!productVenueId) return null;

  const email = normalizeEmail(opts.email);
  const stripeCustomerId = opts.stripeCustomerId?.trim() || "";

  const { result } = await withLiveStore((store) => {
    let matchedBy: SyncFromProductMatchBy | null = null;
    let relationship = store.relationships.find(
      (r) => r.productSync?.venueId?.trim() === productVenueId,
    );
    if (relationship) matchedBy = "product_venue_id";

    if (!relationship && email) {
      relationship = store.relationships.find(
        (r) => normalizeEmail(r.owner.email) === email,
      );
      if (relationship) matchedBy = "email";
    }

    if (!relationship && stripeCustomerId) {
      relationship = store.relationships.find(
        (r) => r.stripeCustomerId?.trim() === stripeCustomerId,
      );
      if (relationship) matchedBy = "stripe_customer";
    }

    if (!relationship || !matchedBy) return null;

    const before = snapshotVenueOwner(relationship);
    applyFieldPatch(relationship, opts.patch, { syncFromProduct: true });
    const after = snapshotVenueOwner(relationship);
    const changed = before !== after;

    const now = new Date().toISOString();
    if (changed) {
      relationship.updatedAt = now;
      relationship.lastCustomerActivityAt = now;
    }

    if (
      opts.bindProductVenueId !== false &&
      relationship.productSync?.venueId?.trim() !== productVenueId
    ) {
      relationship.productSync = {
        status: relationship.productSync?.status ?? "idle",
        steps: relationship.productSync?.steps ?? [],
        adapter: relationship.productSync?.adapter ?? "local",
        ...relationship.productSync,
        venueId: productVenueId,
      };
      relationship.updatedAt = now;
    }

    let eventAppended = false;
    const timeline = opts.timeline;
    if (changed && timeline && !timeline.skip) {
      const debounceMs = timeline.debounceMs ?? 0;
      const recent =
        debounceMs > 0
          ? store.timelineEvents
              .filter(
                (e) =>
                  e.relationshipId === relationship!.id &&
                  e.type === "venue_profile_synced",
              )
              .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]
          : undefined;
      const recentAt = recent ? Date.parse(recent.occurredAt) : NaN;
      const withinDebounce =
        Number.isFinite(recentAt) && Date.now() - recentAt < debounceMs;

      if (!withinDebounce) {
        store.timelineEvents.push({
          id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          relationshipId: relationship.id,
          type: "venue_profile_synced",
          title: timeline.title?.trim() || "Venue profile updated from product",
          body: timeline.body,
          occurredAt: now,
          meta: {
            source: "product",
            matched_by: matchedBy,
            product_venue_id: productVenueId,
          },
        });
        relationship.lastContactAt = now;
        eventAppended = true;
      }
    }

    return {
      relationship,
      changed,
      eventAppended,
      matchedBy,
    } as const;
  });

  return result;
}

function snapshotVenueOwner(relationship: Relationship): string {
  const v = relationship.venue;
  const o = relationship.owner;
  return JSON.stringify({
    name: v.name,
    city: v.city,
    state: v.state,
    website: v.website ?? "",
    address: v.address ?? "",
    venueType: v.venueType ?? "",
    capacity: v.capacity ?? null,
    firstName: o.firstName,
    lastName: o.lastName,
    email: o.email,
    phone: o.phone ?? "",
    title: o.title ?? "",
  });
}

export async function updateRelationshipFields(
  relationshipId: string,
  patch: RelationshipFieldPatch,
): Promise<Relationship | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    // Workspace board moves may go backward — force view stages.
    applyFieldPatch(relationship, patch, { forceViewStages: true });
    const now = new Date().toISOString();
    relationship.updatedAt = now;
    relationship.lastContactAt = now;
    if (relationship.onboardingType === "white_glove") {
      ensureWhiteGloveChecklistInStore(store, relationship.id, { now });
    }
    return relationship;
  });
  return result;
}

/**
 * Clear unacked auto-arrival highlight for one relationship (detail page open).
 */
export async function clearRelationshipAutoArrival(
  relationshipId: string,
): Promise<Relationship | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    if (!relationship.lastAutoArrival) return relationship;
    clearAutoArrival(relationship);
    relationship.updatedAt = new Date().toISOString();
    return relationship;
  });
  return result;
}

/**
 * Acknowledge all unacked auto-arrivals for a board stage (filter chip / column).
 * Returns how many relationships were cleared.
 */
export async function acknowledgeStageAutoArrivals(
  board: "sales" | "cs",
  stage: string,
): Promise<number> {
  const { result } = await withLiveStore((store) => {
    let cleared = 0;
    const now = new Date().toISOString();
    for (const relationship of store.relationships) {
      const hit = relationship.lastAutoArrival;
      if (hit && hit.board === board && hit.stage === stage) {
        clearAutoArrival(relationship);
        relationship.updatedAt = now;
        cleared += 1;
      }
    }
    return cleared;
  });
  return result ?? 0;
}

/**
 * Set pipeline status directly (workspace ops). Unlike updateRelationshipFields,
 * this does not use promoteStatus — moves can go backward on the board.
 */
export async function setRelationshipStatus(
  relationshipId: string,
  status: RelationshipStatus,
  opts?: { currentStageLabel?: string; assignedTeamMemberId?: string },
): Promise<Relationship | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    const now = new Date().toISOString();
    relationship.status =
      status === "active_customer" || status === "live" ? "active" : status;
    relationship.currentStageLabel =
      opts?.currentStageLabel?.trim() || stageLabelForStatus(relationship.status);
    if (opts?.assignedTeamMemberId) {
      relationship.assignedTeamMemberId = opts.assignedTeamMemberId;
    }
    relationship.updatedAt = now;
    return relationship;
  });
  return result;
}

export async function appendTimelineEvent(
  relationshipId: string,
  event: Omit<TimelineEvent, "id" | "relationshipId"> & {
    id?: string;
    relationshipId?: string;
  },
): Promise<TimelineEvent | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;

    const row: TimelineEvent = {
      id: event.id ?? `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      type: event.type,
      title: event.title,
      body: event.body,
      occurredAt: event.occurredAt || new Date().toISOString(),
      actorId: event.actorId,
      meta: event.meta,
    };
    store.timelineEvents.push(row);
    relationship.lastContactAt = row.occurredAt;
    relationship.updatedAt = row.occurredAt;
    return row;
  });
  return result;
}

/**
 * Mark a Relationship task completed and append a timeline row.
 * Used by workspace Complete (White Glove checklist and other live tasks).
 */
export async function completeRelationshipTask(
  taskId: string,
  opts?: { actorId?: string; completedAt?: string },
): Promise<
  | { ok: true; task: RelationshipTask; timelineEvent: TimelineEvent }
  | { ok: false; error: string }
> {
  const id = taskId.trim();
  if (!id) return { ok: false, error: "taskId required" };

  const { result } = await withLiveStore((store) => {
    if (!store.tasks) store.tasks = [];
    const task = store.tasks.find((t) => t.id === id);
    if (!task) return { ok: false as const, error: "Task not found" };
    if (task.status === "completed") {
      return { ok: false as const, error: "Task already completed" };
    }
    if (task.status === "cancelled") {
      return { ok: false as const, error: "Task is cancelled" };
    }

    const relationship = store.relationships.find((r) => r.id === task.relationshipId);
    const completedAt = opts?.completedAt ?? new Date().toISOString();
    task.status = "completed";
    task.completedAt = completedAt;

    const timelineEvent: TimelineEvent = {
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId: task.relationshipId,
      type: "task_completed",
      title: `Task completed: ${task.title}`,
      body: task.description,
      occurredAt: completedAt,
      actorId: opts?.actorId,
      meta: {
        task_id: task.id,
        checklist: task.meta?.checklist ?? null,
      },
    };
    store.timelineEvents.push(timelineEvent);
    if (relationship) {
      relationship.lastContactAt = completedAt;
      relationship.updatedAt = completedAt;
    }

    return { ok: true as const, task, timelineEvent };
  });

  return result;
}

export async function appendCommunication(
  relationshipId: string,
  communication: Omit<Communication, "id" | "relationshipId"> & { id?: string },
): Promise<Communication | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    const row: Communication = {
      id: communication.id ?? `com_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      channel: communication.channel,
      subject: communication.subject,
      body: communication.body,
      direction: communication.direction,
      occurredAt: communication.occurredAt || new Date().toISOString(),
      actorId: communication.actorId,
      authorName: communication.authorName,
    };
    store.communications.push(row);
    relationship.lastContactAt = row.occurredAt;
    relationship.updatedAt = row.occurredAt;
    return row;
  });
  return result;
}

export async function upsertWalkthrough(
  walkthrough: Omit<Walkthrough, "id"> & { id?: string },
): Promise<Walkthrough | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find(
      (r) => r.id === walkthrough.relationshipId,
    );
    if (!relationship) return null;

    const existing = walkthrough.id
      ? store.walkthroughs.find((w) => w.id === walkthrough.id)
      : undefined;

    if (existing) {
      Object.assign(existing, walkthrough);
      return existing;
    }

    const row: Walkthrough = {
      id: walkthrough.id ?? `wt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId: walkthrough.relationshipId,
      scheduledAt: walkthrough.scheduledAt,
      assignedTeamMemberId: walkthrough.assignedTeamMemberId || DEFAULT_ASSIGNEE,
      status: walkthrough.status,
      notes: walkthrough.notes,
      location: walkthrough.location,
    };
    store.walkthroughs.push(row);
    return row;
  });
  return result;
}

export async function upsertSubscription(
  subscription: Omit<Subscription, "id"> & { id?: string },
): Promise<Subscription | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find(
      (r) => r.id === subscription.relationshipId,
    );
    if (!relationship) return null;

    const byStripe = subscription.stripeSubscriptionId
      ? store.subscriptions.find(
          (s) => s.stripeSubscriptionId === subscription.stripeSubscriptionId,
        )
      : undefined;
    const existing =
      byStripe ||
      (subscription.id
        ? store.subscriptions.find((s) => s.id === subscription.id)
        : undefined);

    if (existing) {
      Object.assign(existing, subscription, { id: existing.id });
      return existing;
    }

    const row: Subscription = {
      id: subscription.id ?? `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId: subscription.relationshipId,
      planId: subscription.planId,
      planName: subscription.planName,
      status: subscription.status,
      mrrCents: subscription.mrrCents,
      startedAt: subscription.startedAt,
      cancelledAt: subscription.cancelledAt,
      foundingMember: subscription.foundingMember,
      stripeSubscriptionId: subscription.stripeSubscriptionId,
      stripeCustomerId: subscription.stripeCustomerId,
      stripeCheckoutSessionId: subscription.stripeCheckoutSessionId,
    };
    store.subscriptions.push(row);
    return row;
  });
  return result;
}

export async function appendNotification(
  notification: Omit<Notification, "id" | "read"> & { id?: string; read?: boolean },
): Promise<Notification> {
  const { result } = await withLiveStore((store) => {
    const row: Notification = {
      id: notification.id ?? `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      type: notification.type,
      relationshipId: notification.relationshipId,
      title: notification.title,
      body: notification.body,
      createdAt: notification.createdAt || new Date().toISOString(),
      read: notification.read ?? false,
      href: notification.href ?? null,
      meta: notification.meta,
    };
    store.notifications.push(row);
    return row;
  });
  return result;
}

/** Mark one or more workspace CRM notifications as read. */
export async function markNotificationsRead(
  ids: string[],
): Promise<{ marked: number }> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return { marked: 0 };
  const { result } = await withLiveStore((store) => {
    let marked = 0;
    for (const id of unique) {
      const row = store.notifications.find((n) => n.id === id);
      if (row && !row.read) {
        row.read = true;
        marked += 1;
      }
    }
    return { marked };
  });
  return result;
}

export type WelcomeBackAction = "approve" | "reject" | "needs_follow_up";

export type WelcomeBackResolveResult = {
  relationship: Relationship;
  action: WelcomeBackAction;
  timelineEvent: TimelineEvent;
};

/**
 * Ops Welcome Back verification (Project 5).
 * - approve → verified + foundingMember (Founding pricing eligibility)
 * - reject → rejected
 * - needs_follow_up → stays pending (caller creates Task)
 *
 * Only acts on relationships with welcomeBackRequested && pending.
 * Writes directly (not rank-merge) so ops decisions are explicit.
 */
export async function resolveWelcomeBackVerification(
  relationshipId: string,
  action: WelcomeBackAction,
  opts?: { actorId?: string; note?: string | null },
): Promise<WelcomeBackResolveResult | { error: string }> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return { error: "Relationship not found" } as const;
    if (!relationship.welcomeBackRequested) {
      return { error: "Welcome Back was not requested for this relationship" } as const;
    }
    if (relationship.welcomeBackVerified !== "pending") {
      return {
        error: `Welcome Back is already ${relationship.welcomeBackVerified}`,
      } as const;
    }

    const now = new Date().toISOString();
    const note = opts?.note?.trim() || undefined;

    if (action === "approve") {
      relationship.welcomeBackVerified = "verified";
      relationship.foundingMember = true;
      for (const sub of store.subscriptions) {
        if (sub.relationshipId === relationship.id) {
          sub.foundingMember = true;
        }
      }
    } else if (action === "reject") {
      relationship.welcomeBackVerified = "rejected";
    }
    // needs_follow_up: keep pending

    relationship.updatedAt = now;
    relationship.lastContactAt = now;

    const eventSpec =
      action === "approve"
        ? {
            type: "welcome_back_verified" as const,
            title: "Welcome Back Approved",
            body:
              note ||
              "Welcome Back verified. Founding Member pricing eligibility confirmed.",
          }
        : action === "reject"
          ? {
              type: "welcome_back_rejected" as const,
              title: "Welcome Back Rejected",
              body: note || "Welcome Back verification was not approved.",
            }
          : {
              type: "welcome_back_follow_up" as const,
              title: "Welcome Back Needs Follow Up",
              body:
                note ||
                "Verification needs more information before approve or reject.",
            };

    const timelineEvent: TimelineEvent = {
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      type: eventSpec.type,
      title: eventSpec.title,
      body: eventSpec.body,
      occurredAt: now,
      actorId: opts?.actorId,
      meta: {
        action,
        welcome_back_verified: relationship.welcomeBackVerified,
        founding_member: relationship.foundingMember,
      },
    };
    store.timelineEvents.push(timelineEvent);

    return { relationship, action, timelineEvent } as const;
  });

  return result;
}

export type ResolveOpenFeedbackResult = {
  relationship: Relationship;
  resolvedIds: string[];
  timelineEvent: TimelineEvent;
  supportOpenCount: number;
};

/**
 * Mark open feedback/support item(s) resolved, recount supportOpenCount,
 * clear status overlay when no open items remain, append support_resolved.
 */
export async function resolveOpenFeedback(opts: {
  relationshipId: string;
  /** Resolve this item; omit with `all: true` to clear every open item. */
  itemId?: string;
  all?: boolean;
  actorId?: string;
  note?: string | null;
}): Promise<ResolveOpenFeedbackResult | { error: string }> {
  const relationshipId = opts.relationshipId.trim();
  if (!relationshipId) return { error: "relationshipId required" };

  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return { error: "Relationship not found" } as const;

    const now = new Date().toISOString();
    const note = opts.note?.trim() || undefined;
    if (!relationship.openFeedbackItems) relationship.openFeedbackItems = [];

    const resolvedIds: string[] = [];

    if (opts.all) {
      for (const item of relationship.openFeedbackItems) {
        if (item.status === "open") {
          item.status = "resolved";
          item.resolvedAt = now;
          resolvedIds.push(item.id);
        }
      }
      if (
        resolvedIds.length === 0 &&
        (relationship.supportOpenCount || 0) > 0
      ) {
        relationship.supportOpenCount = 0;
        resolvedIds.push("legacy");
      } else if (resolvedIds.length === 0) {
        return { error: "No open feedback to resolve" } as const;
      }
    } else if (opts.itemId?.trim()) {
      const item = relationship.openFeedbackItems.find(
        (i) => i.id === opts.itemId!.trim(),
      );
      if (!item) return { error: "Feedback item not found" } as const;
      if (item.status === "resolved") {
        return { error: "Feedback item already resolved" } as const;
      }
      item.status = "resolved";
      item.resolvedAt = now;
      resolvedIds.push(item.id);
    } else if ((relationship.supportOpenCount || 0) > 0) {
      // Legacy rows bumped supportOpenCount without openFeedbackItems.
      relationship.supportOpenCount = Math.max(
        0,
        (relationship.supportOpenCount || 0) - 1,
      );
      resolvedIds.push("legacy");
    } else {
      return { error: "No open feedback to resolve" } as const;
    }

    if (resolvedIds[0] !== "legacy") {
      syncSupportOpenCountFromItems(relationship);
    }

    if (
      relationship.supportOpenCount === 0 &&
      relationship.status === "support"
    ) {
      relationship.status = "active";
      relationship.currentStageLabel = stageLabelForStatus("active");
    }

    if (relationship.supportOpenCount === 0) {
      restoreFromNeedsSupport(relationship);
    }

    relationship.updatedAt = now;
    relationship.lastContactAt = now;
    relationship.lastTeamActivityAt = now;

    const countLabel =
      resolvedIds.length === 1
        ? "1 item"
        : `${resolvedIds.length} items`;
    const timelineEvent: TimelineEvent = {
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId,
      type: "support_resolved",
      title: "Support / feedback resolved",
      body:
        note ||
        `Resolved ${countLabel}. Open count is now ${relationship.supportOpenCount}.`,
      occurredAt: now,
      actorId: opts.actorId,
      meta: {
        resolved_ids: resolvedIds.join(","),
        support_open_count: relationship.supportOpenCount,
        cleared_support_overlay:
          relationship.status === "active" && relationship.supportOpenCount === 0,
      },
    };
    store.timelineEvents.push(timelineEvent);

    return {
      relationship,
      resolvedIds,
      timelineEvent,
      supportOpenCount: relationship.supportOpenCount,
    } as const;
  });

  return result;
}

/**
 * Single locked transaction: find/create, patch fields, append timeline (+ optional extras).
 * Preferred for ingest paths to avoid race conditions across multiple helpers.
 */
export async function mutateRelationship(opts: {
  find: FindOrCreateInput;
  patch?: RelationshipFieldPatch;
  /**
   * Bypass promoteStatus (e.g. cancel → former_customer).
   * Applied after patch merge.
   */
  forceStatus?: RelationshipStatus;
  /** Increment supportOpenCount by 1 after find/create. */
  bumpSupportOpenCount?: boolean;
  /**
   * Append an open feedback item and keep supportOpenCount in lockstep.
   * Prefer this over bumping the count alone for typed CS queues.
   */
  openFeedbackItem?: Omit<OpenFeedbackItem, "id" | "createdAt" | "status"> & {
    id?: string;
    createdAt?: string;
    status?: OpenFeedbackItem["status"];
  };
  /** Bind product venue id onto productSync for stable future lookups. */
  productVenueId?: string | null;
  /** When true, return null instead of creating a new Relationship. */
  updateOnly?: boolean;
  event?: Omit<TimelineEvent, "id" | "relationshipId">;
  /** Additional timeline rows written in the same locked transaction. */
  extraEvents?: Array<Omit<TimelineEvent, "id" | "relationshipId">>;
  communication?: Omit<Communication, "id" | "relationshipId">;
  walkthrough?: Omit<Walkthrough, "id" | "relationshipId"> & { id?: string };
  subscription?: Partial<Omit<Subscription, "id" | "relationshipId">> & { id?: string };
  notification?: Omit<Notification, "id" | "relationshipId" | "read" | "createdAt"> & {
    createdAt?: string;
    read?: boolean;
  };
}): Promise<FindOrCreateResult | null> {
  const email = normalizeEmail(opts.find.email);
  const venueKey = normalizeVenueName(opts.find.venueName);
  const stripeCustomerId = opts.find.stripeCustomerId?.trim() || "";
  const stripeCheckoutSessionId = opts.find.stripeCheckoutSessionId?.trim() || "";
  const stripeSubscriptionId = opts.find.stripeSubscriptionId?.trim() || "";
  if (
    !email &&
    !venueKey &&
    !stripeCustomerId &&
    !stripeCheckoutSessionId &&
    !stripeSubscriptionId
  ) {
    throw new Error(
      "mutateRelationship requires an email, venue name, or Stripe id.",
    );
  }

  const { result } = await withLiveStore((store) => {
    const now = new Date().toISOString();
    let created = false;
    let relationship = findExisting(store, opts.find);
    if (!relationship) {
      if (opts.updateOnly) return null;
      relationship = createRelationship(opts.find, now);
      if (stripeCustomerId) relationship.stripeCustomerId = stripeCustomerId;
      if (stripeCheckoutSessionId) {
        relationship.stripeCheckoutSessionId = stripeCheckoutSessionId;
      }
      if (stripeSubscriptionId) {
        relationship.stripeSubscriptionId = stripeSubscriptionId;
      }
      store.relationships.push(relationship);
      created = true;
    } else {
      applyOwnerVenueDefaults(relationship, opts.find);
      if (stripeCustomerId && !relationship.stripeCustomerId) {
        relationship.stripeCustomerId = stripeCustomerId;
      }
      if (stripeCheckoutSessionId && !relationship.stripeCheckoutSessionId) {
        relationship.stripeCheckoutSessionId = stripeCheckoutSessionId;
      }
      if (stripeSubscriptionId && !relationship.stripeSubscriptionId) {
        relationship.stripeSubscriptionId = stripeSubscriptionId;
      }
      absorbStripeDrafts(store, relationship, opts.find);
    }

    if (opts.patch) {
      applyFieldPatch(relationship, opts.patch);
    }

    // New relationships created into a highlightable Sales stage (contact / walkthrough ingest).
    if (created) {
      const sales = normalizeSalesStage(relationship.salesStage) ?? "inquiry";
      if (isSalesAutoArrivalStage(sales) && !relationship.lastAutoArrival) {
        markAutoArrival(relationship, sales, "sales");
      }
    }

    if (opts.forceStatus) {
      const forced =
        opts.forceStatus === "active_customer" || opts.forceStatus === "live"
          ? "active"
          : opts.forceStatus;
      relationship.status = forced;
      relationship.currentStageLabel =
        opts.patch?.currentStageLabel?.trim() ||
        stageLabelForStatus(relationship.status);
    }

    let mintedFeedbackItemId: string | undefined;
    let mintedFeedbackType: OpenFeedbackItem["type"] | undefined;
    if (opts.openFeedbackItem) {
      if (!relationship.openFeedbackItems) relationship.openFeedbackItems = [];
      const item: OpenFeedbackItem = {
        id:
          opts.openFeedbackItem.id ??
          `fb_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        type: opts.openFeedbackItem.type,
        subject: opts.openFeedbackItem.subject.trim() || "Feedback",
        body: opts.openFeedbackItem.body?.trim() || undefined,
        createdAt: opts.openFeedbackItem.createdAt || now,
        status: opts.openFeedbackItem.status ?? "open",
        productFeedbackId: opts.openFeedbackItem.productFeedbackId,
        resolvedAt: opts.openFeedbackItem.resolvedAt,
        source: opts.openFeedbackItem.source,
      };
      relationship.openFeedbackItems.push(item);
      mintedFeedbackItemId = item.id;
      mintedFeedbackType = item.type;
      syncSupportOpenCountFromItems(relationship);
      if (item.status === "open") {
        promoteToNeedsSupport(relationship);
      }
    } else if (opts.bumpSupportOpenCount) {
      relationship.supportOpenCount = (relationship.supportOpenCount || 0) + 1;
      promoteToNeedsSupport(relationship);
    }

    const bindVenueId = opts.productVenueId?.trim();
    if (bindVenueId) {
      relationship.productSync = {
        status: relationship.productSync?.status ?? "idle",
        steps: relationship.productSync?.steps ?? [],
        adapter: relationship.productSync?.adapter ?? "local",
        ...relationship.productSync,
        venueId: bindVenueId,
      };
    }

    const occurredAt = opts.event?.occurredAt || now;

    if (opts.event) {
      store.timelineEvents.push({
        id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        relationshipId: relationship.id,
        type: opts.event.type,
        title: opts.event.title,
        body: opts.event.body,
        occurredAt,
        actorId: opts.event.actorId,
        meta: opts.event.meta,
      });
    }

    if (opts.extraEvents?.length) {
      for (const extra of opts.extraEvents) {
        store.timelineEvents.push({
          id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          relationshipId: relationship.id,
          type: extra.type,
          title: extra.title,
          body: extra.body,
          occurredAt: extra.occurredAt || occurredAt,
          actorId: extra.actorId,
          meta: extra.meta,
        });
      }
    }

    if (opts.communication) {
      store.communications.push({
        id: `com_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        relationshipId: relationship.id,
        channel: opts.communication.channel,
        subject: opts.communication.subject,
        body: opts.communication.body,
        direction: opts.communication.direction,
        occurredAt: opts.communication.occurredAt || occurredAt,
        actorId: opts.communication.actorId,
        authorName: opts.communication.authorName,
      });
    }

    if (opts.walkthrough) {
      store.walkthroughs.push({
        id: opts.walkthrough.id ?? `wt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        relationshipId: relationship.id,
        scheduledAt: opts.walkthrough.scheduledAt,
        assignedTeamMemberId:
          opts.walkthrough.assignedTeamMemberId || relationship.assignedTeamMemberId,
        status: opts.walkthrough.status,
        notes: opts.walkthrough.notes,
        location: opts.walkthrough.location,
      });
    }

    if (opts.subscription) {
      const existing = opts.subscription.stripeSubscriptionId
        ? store.subscriptions.find(
            (s) => s.stripeSubscriptionId === opts.subscription!.stripeSubscriptionId,
          )
        : store.subscriptions.find((s) => s.relationshipId === relationship.id);
      if (existing) {
        const next = opts.subscription;
        if (next.planId) existing.planId = next.planId;
        if (next.planName != null && next.planName.trim()) existing.planName = next.planName;
        if (next.status) existing.status = next.status;
        if (typeof next.mrrCents === "number") existing.mrrCents = next.mrrCents;
        if (next.startedAt) existing.startedAt = next.startedAt;
        if (next.cancelledAt !== undefined) existing.cancelledAt = next.cancelledAt;
        if (next.foundingMember === true) existing.foundingMember = true;
        if (next.stripeSubscriptionId) {
          existing.stripeSubscriptionId = next.stripeSubscriptionId;
        }
        if (next.stripeCustomerId) existing.stripeCustomerId = next.stripeCustomerId;
        if (next.stripeCheckoutSessionId) {
          existing.stripeCheckoutSessionId = next.stripeCheckoutSessionId;
        }
        if (next.manual === true) existing.manual = true;
        existing.relationshipId = relationship.id;
      } else {
        store.subscriptions.push({
          id: opts.subscription.id ?? `sub_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
          relationshipId: relationship.id,
          planId: opts.subscription.planId ?? relationship.planId,
          planName: opts.subscription.planName ?? relationship.planName,
          status: opts.subscription.status ?? "active",
          mrrCents: opts.subscription.mrrCents ?? 0,
          startedAt: opts.subscription.startedAt ?? now,
          cancelledAt: opts.subscription.cancelledAt,
          foundingMember:
            opts.subscription.foundingMember ?? relationship.foundingMember,
          stripeSubscriptionId: opts.subscription.stripeSubscriptionId,
          stripeCustomerId: opts.subscription.stripeCustomerId,
          stripeCheckoutSessionId: opts.subscription.stripeCheckoutSessionId,
          manual: opts.subscription.manual === true ? true : undefined,
        });
      }
    }

    if (opts.notification) {
      const feedbackMeta =
        mintedFeedbackItemId != null
          ? {
              feedback_item_id: mintedFeedbackItemId,
              panel: "support" as const,
              feedback_type: mintedFeedbackType,
              surface: "venue" as const,
              venue_name: relationship.venue.name,
            }
          : undefined;
      store.notifications.push({
        id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        type: opts.notification.type,
        relationshipId: relationship.id,
        title: opts.notification.title,
        body: opts.notification.body,
        createdAt: opts.notification.createdAt || occurredAt,
        read: opts.notification.read ?? false,
        href: null,
        meta: {
          ...feedbackMeta,
          ...opts.notification.meta,
        },
      });
    }

    relationship.lastContactAt = occurredAt;
    relationship.updatedAt = occurredAt;

    return { relationship, created };
  });

  return result;
}

export type WalkthroughStatusUpdateResult = {
  walkthrough: Walkthrough;
  relationship: Relationship;
  timelineEvent: TimelineEvent;
};

/**
 * Persist Complete / Reschedule / Cancel on a walkthrough and append timeline.
 */
export async function setWalkthroughStatus(
  walkthroughId: string,
  status: Walkthrough["status"],
  opts?: {
    scheduledAt?: string | null;
    reason?: string | null;
    notes?: string | null;
    actorId?: string;
    sourceId?: string;
  },
): Promise<WalkthroughStatusUpdateResult | { error: string }> {
  const { result } = await withLiveStore((store) => {
    const walkthrough = store.walkthroughs.find((w) => w.id === walkthroughId);
    if (!walkthrough) return { error: "Walkthrough not found" } as const;

    const relationship = store.relationships.find(
      (r) => r.id === walkthrough.relationshipId,
    );
    if (!relationship) return { error: "Relationship not found" } as const;

    const now = new Date().toISOString();
    const reason = opts?.reason?.trim() || opts?.notes?.trim() || undefined;
    const nextScheduled = opts?.scheduledAt?.trim()
      ? new Date(opts.scheduledAt).toISOString()
      : undefined;

    walkthrough.status = status;
    if (nextScheduled) walkthrough.scheduledAt = nextScheduled;
    if (reason) {
      walkthrough.notes = walkthrough.notes?.trim()
        ? `${walkthrough.notes.trim()}\n${reason}`
        : reason;
    }

    const eventSpec =
      status === "completed"
        ? {
            type: "walkthrough_completed" as const,
            title: "Walkthrough completed",
            body: reason,
            relationshipStatus: "walkthrough_completed" as const,
            salesStage: "walkthrough_scheduled" as SalesStage,
            nextMilestone: "Send proposal / follow up",
          }
        : status === "rescheduled"
          ? {
              type: "walkthrough_rescheduled" as const,
              title: "Walkthrough rescheduled",
              body: reason || (nextScheduled ? `New time: ${nextScheduled}` : undefined),
              relationshipStatus: "walkthrough_scheduled" as const,
              salesStage: "walkthrough_scheduled" as SalesStage,
              nextMilestone: "Upcoming walkthrough",
              nextMilestoneAt: nextScheduled || walkthrough.scheduledAt,
            }
          : {
              type: "walkthrough_cancelled" as const,
              title: "Walkthrough cancelled",
              body: reason,
              relationshipStatus: undefined,
              // Still in early pipeline → Personal Send (needs rebook). Later stages untouched.
              salesStage: undefined as SalesStage | undefined,
              nextMilestone: "Reschedule walkthrough",
            };

    if (status === "cancelled" && !isInCustomerSuccessView(relationship)) {
      const currentSales = deriveSalesStage(relationship);
      if (
        currentSales === "inquiry" ||
        currentSales === "personal_send" ||
        currentSales === "sequence_scheduled" ||
        currentSales === "walkthrough_scheduled"
      ) {
        eventSpec.salesStage = "personal_send";
      }
    }

    if (eventSpec.relationshipStatus || eventSpec.salesStage) {
      const forceCancelStage =
        status === "cancelled" && eventSpec.salesStage === "personal_send";
      applyFieldPatch(
        relationship,
        {
          status: eventSpec.relationshipStatus,
          salesStage: eventSpec.salesStage,
          nextMilestone: eventSpec.nextMilestone,
          nextMilestoneAt:
            "nextMilestoneAt" in eventSpec
              ? eventSpec.nextMilestoneAt
              : relationship.nextMilestoneAt,
        },
        forceCancelStage ? { forceViewStages: true } : undefined,
      );
    } else if (eventSpec.nextMilestone) {
      relationship.nextMilestone = eventSpec.nextMilestone;
    }

    relationship.updatedAt = now;
    relationship.lastContactAt = now;

    const timelineEvent: TimelineEvent = {
      id: `evt_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
      relationshipId: relationship.id,
      type: eventSpec.type,
      title: eventSpec.title,
      body: eventSpec.body,
      occurredAt: now,
      actorId: opts?.actorId,
      meta: {
        walkthroughId,
        status,
        scheduledAt: walkthrough.scheduledAt,
        sourceId: opts?.sourceId ?? null,
      },
    };
    store.timelineEvents.push(timelineEvent);

    return { walkthrough, relationship, timelineEvent } as const;
  });

  return result;
}

export type ResolveSupportInboxResult = {
  item: import("./types").SupportInboxItem;
};

/**
 * Mark a vendor/client Support inbox item resolved.
 * Does not touch Relationship.supportOpenCount / openFeedbackItems.
 */
export async function resolveSupportInboxItem(opts: {
  itemId: string;
  note?: string | null;
}): Promise<ResolveSupportInboxResult | { error: string }> {
  const itemId = opts.itemId.trim();
  if (!itemId) return { error: "itemId required" };

  const { result } = await withLiveStore((store) => {
    if (!store.supportInboxItems) store.supportInboxItems = [];
    const item = store.supportInboxItems.find((i) => i.id === itemId);
    if (!item) return { error: "Support inbox item not found" } as const;
    if (item.status === "resolved") {
      return { item } as const;
    }
    const now = new Date().toISOString();
    item.status = "resolved";
    item.resolvedAt = now;
    if (opts.note?.trim()) {
      item.body = [item.body, `Resolved note: ${opts.note.trim()}`]
        .filter(Boolean)
        .join("\n\n");
    }
    return { item } as const;
  });

  return result;
}

/** Parse a freeform name into first/last when marketing only sends `name`. */
export function personFromFields(fields: {
  name?: string;
  firstName?: string;
  lastName?: string;
}): { firstName: string; lastName: string } {
  if (fields.firstName || fields.lastName) {
    return {
      firstName: fields.firstName?.trim() || "",
      lastName: fields.lastName?.trim() || "",
    };
  }
  return splitPersonName(fields.name);
}
