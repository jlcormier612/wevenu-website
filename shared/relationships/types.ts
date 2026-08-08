/**
 * Shared Relationship model — source of truth for marketing + workspace.
 *
 * Deduplication rule (findOrCreate):
 * 1. Match primary contact email (case-insensitive), OR
 * 2. Match stripeCustomerId / stripeCheckoutSessionId (checkout draft → purchase), OR
 * 3. Match normalized venue name (lowercase, trim, strip punctuation) when emails compatible
 * If email matches a different venue name, prefer the email match and update
 * venue name only when empty. Never create a second record for the same email.
 * Field updates merge: fill empties, ratchet booleans/status upward — never wipe stronger data.
 */

/**
 * Pipeline lifecycle (Customer Lifecycle Engine Phase 1).
 * Aliases: `live` / `active_customer` → `active`; onboarding+WG maps to
 * `white_glove_implementation` when White Glove is selected.
 * `support` is retained as an overlay (not a separate pipeline column).
 */
export type PipelineStatus =
  | "inquiry"
  | "walkthrough_requested"
  | "walkthrough_scheduled"
  | "walkthrough_completed"
  | "trial"
  | "subscribed"
  | "onboarding"
  | "white_glove_implementation"
  | "active"
  | "at_risk"
  | "suspended"
  | "reactivated"
  | "live"
  | "expansion"
  | "referral"
  | "renewal"
  | "former_customer";

export type RelationshipStatus = PipelineStatus | "active_customer" | "support";

export type RelationshipHealth = "excellent" | "good" | "needs_attention" | "at_risk";

/** Heuristic 0–100 score shown on Relationship Snapshot. */
export type RelationshipHealthScore = number;

/** Pre-customer Sales board stage (view field — not a second CRM). */
export type SalesStage =
  | "inquiry"
  | "personal_send"
  | "sequence_scheduled"
  | "responded"
  | "walkthrough_scheduled"
  | "proposal_sent"
  | "follow_up"
  | "closed_won"
  | "closed_lost";

/** Post-subscribe Customer Success lifecycle stage (view field). */
export type CustomerSuccessStage =
  | "onboarding"
  | "implementation"
  | "live"
  | "check_in_sequence"
  | "healthy"
  | "expansion"
  | "renewal"
  | "renewed"
  | "needs_support";

/** Payment / access flags for SaaS subscription lifecycle. */
export type PaymentStatus =
  | "none"
  | "pending"
  | "paid"
  | "past_due"
  | "failed"
  | "manual"
  | "refunded";

/** Dunning schedule day offsets after first payment_failed. */
export const DUNNING_DAYS = [0, 3, 7, 14, 21] as const;
export type DunningDay = (typeof DUNNING_DAYS)[number];

export type DunningState = {
  /** ISO when first past_due / payment_failed observed */
  startedAt: string;
  /** Last reminder day offset that was sent (0, 3, 7, 14, 21) */
  lastReminderDay: number | null;
  /** ISO of last dunning reminder */
  lastReminderAt?: string | null;
  /** When status moved to at_risk (day 14) */
  atRiskAt?: string | null;
  /** When access was suspended (day 21) */
  suspendedAt?: string | null;
  /** Cleared when payment succeeds */
  clearedAt?: string | null;
};

export type PlanId = "gather" | "celebrate" | "flourish" | "none";

export type OnboardingType = "self_guided" | "white_glove" | "none";

export type WelcomeBackVerifiedStatus = "none" | "pending" | "verified" | "rejected" | "expired";

export type TimelineEventType =
  | "inquiry_received"
  | "contact_form"
  | "walkthrough_requested"
  | "walkthrough_scheduled"
  | "walkthrough_completed"
  | "walkthrough_rescheduled"
  | "walkthrough_cancelled"
  | "proposal_requested"
  | "checkout_started"
  | "subscription_purchased"
  | "subscription_updated"
  | "subscription_cancelled"
  | "founder_status_assigned"
  | "welcome_back_requested"
  | "welcome_back_verified"
  | "welcome_back_rejected"
  | "welcome_back_follow_up"
  | "welcome_back_expired"
  | "white_glove_purchased"
  | "newsletter_signup"
  | "kickoff_scheduled"
  | "pricing_viewed"
  | "onboarding_milestone"
  | "onboarding_completed"
  | "support_request"
  | "support_resolved"
  | "feedback_received"
  | "feedback_resolved"
  | "referral_submitted"
  | "renewal"
  | "task_completed"
  | "note_added"
  | "email_sent"
  | "email_received"
  | "status_changed"
  | "document_uploaded"
  | "invoice_sent"
  | "payment_received"
  | "product_sync_started"
  | "product_sync_step_completed"
  | "product_sync_completed"
  | "product_sync_failed"
  | "subscription_link_sent"
  | "subscription_activated"
  | "welcome_workflow_started"
  | "onboarding_created"
  | "white_glove_implementation_started"
  | "implementation_complete"
  | "workspace_activated"
  | "account_activated"
  | "payment_failed"
  | "payment_reminder_sent"
  | "account_suspended"
  | "account_reactivated"
  | "manual_subscription"
  | "venue_profile_synced";

export type CommunicationChannel =
  | "email"
  | "contact_form"
  | "walkthrough_request"
  | "newsletter"
  | "support"
  | "manual_note"
  | "internal_comment";

export type WalkthroughStatus = "upcoming" | "completed" | "rescheduled" | "cancelled";

export type NotificationType =
  | "new_inquiry"
  | "walkthrough_scheduled"
  | "subscription_purchased"
  | "white_glove_purchased"
  | "welcome_back_requested"
  | "founder_spot_filled"
  | "support_request_submitted"
  | "feedback_received"
  | "newsletter_signup"
  | "white_glove_implementation"
  | "payment_failed"
  | "account_at_risk"
  | "account_suspended"
  | "account_reactivated"
  | "workspace_launched"
  | "prospect_responded";

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "paused";

/** Project 10 — product provisioning progress (persisted on Relationship). */
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
  id:
    | "venue"
    | "workspace"
    | "website"
    | "subscription"
    | "owner_account"
    | "onboarding"
    | "launch";
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

export type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
};

export type VenueInfo = {
  name: string;
  city: string;
  state: string;
  website?: string;
  capacity?: number;
  venueType?: string;
  address?: string;
};

export type TimelineEvent = {
  id: string;
  relationshipId: string;
  type: TimelineEventType;
  title: string;
  body?: string;
  occurredAt: string;
  actorId?: string;
  meta?: Record<string, string | number | boolean | null>;
};

export type Communication = {
  id: string;
  relationshipId: string;
  channel: CommunicationChannel;
  subject: string;
  body: string;
  direction: "inbound" | "outbound" | "internal";
  occurredAt: string;
  actorId?: string;
  authorName?: string;
};

export type Subscription = {
  id: string;
  relationshipId: string;
  planId: PlanId;
  planName: string;
  status: SubscriptionStatus;
  mrrCents: number;
  startedAt: string;
  cancelledAt?: string;
  foundingMember: boolean;
  stripeSubscriptionId?: string | null;
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  /** Owner/Admin entered without Stripe */
  manual?: boolean;
};

export type Walkthrough = {
  id: string;
  relationshipId: string;
  scheduledAt: string;
  assignedTeamMemberId: string;
  status: WalkthroughStatus;
  notes?: string;
  location?: string;
};

export type Notification = {
  id: string;
  type: NotificationType;
  relationshipId: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

/** Relationship-scoped work item (White Glove checklist, Welcome Back follow-up, etc.). */
export type RelationshipTask = {
  id: string;
  relationshipId: string;
  title: string;
  description?: string;
  ownerId: string;
  dueDate: string;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  meta?: Record<string, string | number | boolean | null>;
};

/** Product / marketing customer input mirrored on the Relationship for CS queue. */
export type ProductFeedbackType =
  | "support"
  | "bug"
  | "feature"
  | "nps"
  | "general";

export type OpenFeedbackItemStatus = "open" | "acknowledged" | "resolved";

export type OpenFeedbackItem = {
  id: string;
  type: ProductFeedbackType;
  subject: string;
  /** Full customer message when available (product Get Help / support form). */
  body?: string;
  createdAt: string;
  status: OpenFeedbackItemStatus;
  /** Supabase venue_feedback.id when sourced from product Get Help. */
  productFeedbackId?: string;
  resolvedAt?: string | null;
  source?: "product" | "marketing_support" | "manual";
};

export type Relationship = {
  id: string;
  venue: VenueInfo;
  owner: Contact;
  status: RelationshipStatus;
  health: RelationshipHealth;
  /** Heuristic 0–100; recomputed on lifecycle ticks / snapshot load */
  healthScore?: RelationshipHealthScore;
  /**
   * Sales board stage (pre-customer). Separate from Customer Success stage —
   * one Relationship record, two views.
   */
  salesStage?: SalesStage;
  /** Customer Success lifecycle stage (post-subscribe). */
  customerSuccessStage?: CustomerSuccessStage;
  /**
   * Prior CS stage before soft-promote to `needs_support`.
   * Restored when all open feedback items are resolved.
   */
  customerSuccessStageBeforeSupport?: CustomerSuccessStage | null;
  /**
   * Unacknowledged auto-arrival into a Sales/CS highlight stage.
   * Set by ingest / subscribe / inbound reply / feedback — not board drag.
   * Cleared when the relationship is opened from that board or the stage is acknowledged.
   */
  lastAutoArrival?: {
    stage: string;
    at: string;
    board: "sales" | "cs";
  } | null;
  assignedTeamMemberId: string;
  planId: PlanId;
  planName: string;
  foundingMember: boolean;
  welcomeBackRequested: boolean;
  welcomeBackVerified: WelcomeBackVerifiedStatus;
  onboardingType: OnboardingType;
  currentStageLabel: string;
  lastContactAt: string;
  /** ISO when the latest inbound owner email was recorded (reply automation / Luv urgency). */
  lastInboundAt?: string | null;
  nextMilestone?: string;
  nextMilestoneAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  /** Internal White Glove implementation notes (team-only) */
  implementationNotes?: string;
  /** Branding / contracts / packages / questionnaires placeholders for WG */
  implementationAssets?: {
    brandingNotes?: string;
    contractsNotes?: string;
    packagesNotes?: string;
    questionnairesNotes?: string;
    websiteProgressNotes?: string;
  };
  referralSource?: string;
  supportOpenCount: number;
  /**
   * Open / resolved product + marketing feedback items.
   * `supportOpenCount` stays derived from items with status `open` (kept in lockstep).
   */
  openFeedbackItems?: OpenFeedbackItem[];
  /** Stripe ids for ops / dedupe across checkout retries */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  /** SaaS payment status (separate from Stripe subscription.status) */
  paymentStatus?: PaymentStatus;
  /** ISO when subscription became active (purchase or manual) */
  subscribedAt?: string | null;
  /**
   * Next (or current-cycle) subscription anniversary — subscribedAt + N years.
   * Kept in sync on subscribe / renewal ticks; prefer compute from subscribedAt when missing.
   */
  renewalDate?: string | null;
  /** When true, product access is disabled (suspended) — data preserved */
  accessDisabled?: boolean;
  /** Activation token for Launch Yourself / Welcome Home */
  activationToken?: string | null;
  activationTokenCreatedAt?: string | null;
  activationCompletedAt?: string | null;
  /** Last known customer product login (ISO); optional until product sync reports */
  lastLoginAt?: string | null;
  loginCount30d?: number;
  lastCustomerActivityAt?: string | null;
  lastTeamActivityAt?: string | null;
  /** Website published flag from product sync / ops */
  websitePublished?: boolean;
  /** Failed-payment dunning schedule state */
  dunning?: DunningState | null;
  /** Project 10 — idempotent product provisioning state */
  productSync?: ProductSyncState;
};

/**
 * Partner (vendor / client) product feedback — Support queue only.
 * Not attached to Relationship.openFeedbackItems; does not bump supportOpenCount.
 */
export type SupportInboxSurface = "vendor" | "client";

export type SupportInboxItemStatus = "open" | "acknowledged" | "resolved";

export type SupportInboxItem = {
  id: string;
  surface: SupportInboxSurface;
  type: ProductFeedbackType;
  subject: string;
  body?: string;
  rating?: number | null;
  allowPublicShare?: boolean;
  actorName?: string | null;
  actorEmail?: string | null;
  vendorId?: string | null;
  clientId?: string | null;
  /** Product venues.id when known. */
  relatedVenueId?: string | null;
  /** CRM Relationship.id when matched via productSync.venueId. */
  relatedRelationshipId?: string | null;
  relatedVenueName?: string | null;
  productFeedbackId?: string | null;
  sourceUrl?: string | null;
  status: SupportInboxItemStatus;
  createdAt: string;
  resolvedAt?: string | null;
};

/** Full live snapshot used by the workspace data layer. */
export type LiveRelationshipStore = {
  relationships: Relationship[];
  timelineEvents: TimelineEvent[];
  communications: Communication[];
  walkthroughs: Walkthrough[];
  subscriptions: Subscription[];
  notifications: Notification[];
  tasks: RelationshipTask[];
  /** Vendor + client product feedback inbox (not venue Relationship support). */
  supportInboxItems?: SupportInboxItem[];
};

export type FindOrCreateInput = {
  email?: string | null;
  venueName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  referralSource?: string | null;
  assignedTeamMemberId?: string | null;
  /** Prefer email; these link checkout-start drafts → purchase without duplicating. */
  stripeCustomerId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeSubscriptionId?: string | null;
};

export type RelationshipFieldPatch = Partial<
  Pick<
    Relationship,
    | "status"
    | "health"
    | "healthScore"
    | "salesStage"
    | "customerSuccessStage"
    | "customerSuccessStageBeforeSupport"
    | "lastAutoArrival"
    | "planId"
    | "planName"
    | "foundingMember"
    | "welcomeBackRequested"
    | "welcomeBackVerified"
    | "onboardingType"
    | "currentStageLabel"
    | "nextMilestone"
    | "nextMilestoneAt"
    | "notes"
    | "implementationNotes"
    | "implementationAssets"
    | "referralSource"
    | "supportOpenCount"
    | "assignedTeamMemberId"
    | "stripeCustomerId"
    | "stripeSubscriptionId"
    | "stripeCheckoutSessionId"
    | "paymentStatus"
    | "subscribedAt"
    | "renewalDate"
    | "accessDisabled"
    | "activationToken"
    | "activationTokenCreatedAt"
    | "activationCompletedAt"
    | "lastLoginAt"
    | "loginCount30d"
    | "lastCustomerActivityAt"
    | "lastTeamActivityAt"
    | "websitePublished"
    | "dunning"
  >
> & {
  venueName?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  /** Street address (city/state live in dedicated fields). */
  address?: string | null;
  venueType?: string | null;
  capacity?: number | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
  ownerTitle?: string | null;
};
