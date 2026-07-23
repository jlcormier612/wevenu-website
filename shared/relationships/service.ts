import { randomUUID } from "crypto";

import { normalizeEmail, normalizeVenueName, splitPersonName } from "./normalize";
import { promoteStatus, stageLabelForStatus } from "./status";
import { withLiveStore } from "./store";
import type {
  Communication,
  FindOrCreateInput,
  LiveRelationshipStore,
  Notification,
  Relationship,
  RelationshipFieldPatch,
  RelationshipStatus,
  RelationshipTask,
  Subscription,
  TimelineEvent,
  Walkthrough,
} from "./types";
import { ensureWhiteGloveChecklistInStore } from "./white-glove-checklist";

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

  if (input.firstName?.trim() && !relationship.owner.firstName) {
    relationship.owner.firstName = input.firstName.trim();
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
  if (!firstName && !lastName && email) {
    const local = email.split("@")[0] || "Contact";
    firstName = local;
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

/**
 * Merge patch into relationship. Never wipe stronger data with weaker values:
 * - booleans ratchet true-only (foundingMember, welcomeBackRequested)
 * - plan / onboarding / welcomeBackVerified only advance in rank
 * - venue / owner / referral fill empties only
 * - status uses promoteStatus
 * - Stripe ids fill when provided (authoritative when set)
 */
function applyFieldPatch(relationship: Relationship, patch: RelationshipFieldPatch): void {
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
  if (patch.subscribedAt !== undefined) relationship.subscribedAt = patch.subscribedAt;
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

  // Venue / owner: fill empties only — never overwrite established identity.
  if (patch.venueName?.trim() && !relationship.venue.name.trim()) {
    relationship.venue.name = patch.venueName.trim();
  }
  if (patch.city?.trim() && !relationship.venue.city) {
    relationship.venue.city = patch.city.trim();
  }
  if (patch.state?.trim() && !relationship.venue.state) {
    relationship.venue.state = patch.state.trim();
  }
  if (patch.website?.trim() && !relationship.venue.website) {
    relationship.venue.website = patch.website.trim();
  }
  if (patch.ownerFirstName?.trim() && !relationship.owner.firstName) {
    relationship.owner.firstName = patch.ownerFirstName.trim();
  }
  if (patch.ownerLastName?.trim() && !relationship.owner.lastName) {
    relationship.owner.lastName = patch.ownerLastName.trim();
  }
  if (patch.ownerPhone?.trim() && !relationship.owner.phone) {
    relationship.owner.phone = patch.ownerPhone.trim();
  }
  if (patch.ownerEmail?.trim() && !normalizeEmail(relationship.owner.email)) {
    relationship.owner.email = normalizeEmail(patch.ownerEmail);
  }
}

export async function updateRelationshipFields(
  relationshipId: string,
  patch: RelationshipFieldPatch,
): Promise<Relationship | null> {
  const { result } = await withLiveStore((store) => {
    const relationship = store.relationships.find((r) => r.id === relationshipId);
    if (!relationship) return null;
    applyFieldPatch(relationship, patch);
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
    };
    store.notifications.push(row);
    return row;
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

    if (opts.bumpSupportOpenCount) {
      relationship.supportOpenCount = (relationship.supportOpenCount || 0) + 1;
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
      store.notifications.push({
        id: `ntf_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        type: opts.notification.type,
        relationshipId: relationship.id,
        title: opts.notification.title,
        body: opts.notification.body,
        createdAt: opts.notification.createdAt || occurredAt,
        read: opts.notification.read ?? false,
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
            nextMilestone: "Send proposal / follow up",
          }
        : status === "rescheduled"
          ? {
              type: "walkthrough_rescheduled" as const,
              title: "Walkthrough rescheduled",
              body: reason || (nextScheduled ? `New time: ${nextScheduled}` : undefined),
              relationshipStatus: "walkthrough_scheduled" as const,
              nextMilestone: "Upcoming walkthrough",
              nextMilestoneAt: nextScheduled || walkthrough.scheduledAt,
            }
          : {
              type: "walkthrough_cancelled" as const,
              title: "Walkthrough cancelled",
              body: reason,
              relationshipStatus: undefined,
              nextMilestone: "Reschedule walkthrough",
            };

    if (eventSpec.relationshipStatus) {
      applyFieldPatch(relationship, {
        status: eventSpec.relationshipStatus,
        nextMilestone: eventSpec.nextMilestone,
        nextMilestoneAt:
          "nextMilestoneAt" in eventSpec
            ? eventSpec.nextMilestoneAt
            : relationship.nextMilestoneAt,
      });
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
