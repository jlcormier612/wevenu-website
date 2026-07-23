/**
 * Relationship Workspace — data model.
 *
 * Philosophy: one venue relationship, one timeline, one source of truth.
 * Status changes; the relationship record remains.
 *
 * Naming aligns with marketing enrollment where useful:
 * onboarding_type, welcome_back_*, founding_member.
 *
 * Program 3 pipeline: Inquiry → … → Live → Expansion → Referral → Renewal.
 * Legacy `active_customer` normalizes to `live`. `support` is an overlay.
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
  | "product_sync_failed"
  | "subscription_link_sent"
  | "subscription_activated"
  | "welcome_workflow_started"
  | "onboarding_created"
  | "white_glove_implementation_started"
  | "implementation_complete"
  | "workspace_activated"
  | "payment_failed"
  | "payment_reminder_sent"
  | "account_suspended"
  | "account_reactivated"
  | "manual_subscription";

export type CommunicationChannel =
  | "email"
  | "contact_form"
  | "walkthrough_request"
  | "newsletter"
  | "support"
  | "manual_note"
  | "internal_comment";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "open" | "in_progress" | "completed" | "cancelled";

export type WalkthroughStatus = "upcoming" | "completed" | "rescheduled" | "cancelled";

export type OnboardingMilestoneStatus = "pending" | "in_progress" | "completed" | "skipped";

export type NotificationType =
  | "new_inquiry"
  | "walkthrough_scheduled"
  | "subscription_purchased"
  | "white_glove_purchased"
  | "welcome_back_requested"
  | "founder_spot_filled"
  | "support_request_submitted"
  | "newsletter_signup";

export type InvoiceStatus = "draft" | "sent" | "paid" | "void" | "overdue";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled" | "paused";

/** Project 10 — product provisioning progress (from shared relationships). */
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

/** Lightweight roster shape used across Programs 1–3. Program 4 extends via TeamMemberProfile. */
export type TeamMember = {
  id: string;
  name: string;
  email: string;
  /** Display title (e.g. "Success Lead"). RBAC role lives on Program 4 profiles. */
  role: string;
  initials: string;
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

export type Task = {
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

export type Document = {
  id: string;
  relationshipId: string;
  name: string;
  kind: string;
  uploadedAt: string;
  uploadedById?: string;
};

export type Invoice = {
  id: string;
  relationshipId: string;
  number: string;
  amountCents: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt?: string;
  paidAt?: string;
  description: string;
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

export type OnboardingMilestone = {
  id: string;
  relationshipId: string;
  title: string;
  status: OnboardingMilestoneStatus;
  dueAt?: string;
  completedAt?: string;
  sortOrder: number;
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

export type Relationship = {
  id: string;
  venue: VenueInfo;
  owner: Contact;
  status: RelationshipStatus;
  health: RelationshipHealth;
  healthScore?: number;
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
  implementationNotes?: string;
  implementationAssets?: {
    brandingNotes?: string;
    contractsNotes?: string;
    packagesNotes?: string;
    questionnairesNotes?: string;
    websiteProgressNotes?: string;
  };
  referralSource?: string;
  supportOpenCount: number;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripeCheckoutSessionId?: string | null;
  paymentStatus?: string;
  subscribedAt?: string | null;
  accessDisabled?: boolean;
  activationToken?: string | null;
  activationTokenCreatedAt?: string | null;
  activationCompletedAt?: string | null;
  lastLoginAt?: string | null;
  loginCount30d?: number;
  lastCustomerActivityAt?: string | null;
  lastTeamActivityAt?: string | null;
  websitePublished?: boolean;
  dunning?: {
    startedAt: string;
    lastReminderDay: number | null;
    lastReminderAt?: string | null;
    atRiskAt?: string | null;
    suspendedAt?: string | null;
    clearedAt?: string | null;
  } | null;
  /** Project 10 — idempotent product provisioning state */
  productSync?: ProductSyncState;
};

export type FounderProgramStats = {
  totalSpots: number;
  currentCount: number;
  remainingSpots: number;
  newThisWeek: number;
  welcomeBackRequests: number;
  pendingVerification: number;
  verified: number;
  rejected: number;
  expired: number;
};

export type ReportSnapshot = {
  founderGrowth: { label: string; value: number }[];
  subscriptionGrowth: { label: string; value: number }[];
  welcomeBackConversions: number;
  welcomeBackConversionRate: number;
  whiteGloveAdoption: number;
  whiteGloveAdoptionRate: number;
  walkthroughConversionRate: number;
  mrrCents: number;
  arrCents: number;
  customerHealth: { health: RelationshipHealth; count: number }[];
};

export type WorkspaceData = {
  teamMembers: TeamMember[];
  relationships: Relationship[];
  timelineEvents: TimelineEvent[];
  tasks: Task[];
  communications: Communication[];
  documents: Document[];
  invoices: Invoice[];
  subscriptions: Subscription[];
  walkthroughs: Walkthrough[];
  onboardingMilestones: OnboardingMilestone[];
  notifications: Notification[];
  founderProgram: FounderProgramStats;
  reports: ReportSnapshot;
};
