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
 * Pipeline lifecycle (Program 3). Legacy `active_customer` normalizes to `live`.
 * `support` is retained as an overlay status (not a separate record / pipeline column).
 */
export type PipelineStatus =
  | "inquiry"
  | "walkthrough_requested"
  | "walkthrough_scheduled"
  | "walkthrough_completed"
  | "trial"
  | "subscribed"
  | "onboarding"
  | "live"
  | "expansion"
  | "referral"
  | "renewal"
  | "former_customer";

export type RelationshipStatus = PipelineStatus | "active_customer" | "support";

export type RelationshipHealth = "excellent" | "good" | "needs_attention" | "at_risk";

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
  | "product_sync_failed";

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
  | "newsletter_signup";

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

export type Relationship = {
  id: string;
  venue: VenueInfo;
  owner: Contact;
  status: RelationshipStatus;
  health: RelationshipHealth;
  assignedTeamMemberId: string;
  planId: PlanId;
  planName: string;
  foundingMember: boolean;
  welcomeBackRequested: boolean;
  welcomeBackVerified: WelcomeBackVerifiedStatus;
  onboardingType: OnboardingType;
  currentStageLabel: string;
  lastContactAt: string;
  nextMilestone?: string;
  nextMilestoneAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  referralSource?: string;
  supportOpenCount: number;
  /** Stripe ids for ops / dedupe across checkout retries */
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  /** Project 10 — idempotent product provisioning state */
  productSync?: ProductSyncState;
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
    | "referralSource"
    | "supportOpenCount"
    | "assignedTeamMemberId"
    | "stripeCustomerId"
    | "stripeSubscriptionId"
    | "stripeCheckoutSessionId"
  >
> & {
  venueName?: string | null;
  city?: string | null;
  state?: string | null;
  website?: string | null;
  ownerFirstName?: string | null;
  ownerLastName?: string | null;
  ownerPhone?: string | null;
  ownerEmail?: string | null;
};
