/**
 * Vendor domain types — Sprint 104.5 global vendor model.
 *
 * vendors is now a global entity; venue-specific state lives in
 * VenueVendorRelationship. The flat Vendor type (used by venue UI) merges
 * both for convenience — components don't need to drill into a nested object.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type VendorPreferenceLevel = "featured" | "preferred" | "recommended";
export type VendorPricingTier     = "budget" | "mid_range" | "premium" | "luxury";
export type VendorRole            = "owner" | "manager" | "staff" | "contractor";
// Relationship is the sole authoritative owner of the vendor lifecycle (ADR-0001,
// docs/vendor-relationship-lifecycle.md). "Preferred" is a ranking carried by
// preferenceLevel, not a lifecycle stage — see the migration's note on why a
// 4th 'preferred' status value would recreate the two-fields-one-concept
// problem this model exists to remove.
export type VendorRelationshipStatus = "invited" | "active" | "inactive";
export type VendorSubscriptionTier   = "free" | "starter" | "pro" | "marketplace";
export type VendorSubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "none";

// ── Global vendor profile (no venue-specific fields) ─────────────────────────

export type VendorProfile = {
  id:                   string;
  businessName:         string;
  category:             string | null;
  description:          string | null;
  contactName:          string | null;
  email:                string | null;
  phone:                string | null;
  websiteUrl:           string | null;
  instagramUrl:         string | null;
  facebookUrl:          string | null;
  pinterestUrl:         string | null;
  tiktokUrl:            string | null;
  logoUrl:              string | null;
  heroImageUrl:         string | null;
  coverImageUrl:        string | null;
  serviceArea:          string | null;
  insuranceExpiry:      string | null;
  pricingTier:          VendorPricingTier | null;
  profileSlug:          string | null;
  isMarketplaceListed:  boolean;
  averageRating:        number | null;
  reviewCount:          number;
  subscriptionTier:     VendorSubscriptionTier | null;
  subscriptionStatus:   VendorSubscriptionStatus | null;
  trialEndsAt:          string | null;
  isClaimed:            boolean;
  acceptingInquiries:   boolean;
  availabilityNotes:    string | null;
  luvIntroSeenAt:       string | null;
  createdAt:            string;
  updatedAt:            string;
};

// ── Venue-specific relationship data ─────────────────────────────────────────

export type VenueVendorRelationship = {
  id:                 string;
  venueId:            string;
  vendorId:           string;
  status:             VendorRelationshipStatus;
  preferenceLevel:    VendorPreferenceLevel;
  displayOrder:       number;
  notes:              string | null;
  specialPricingNote: string | null;
  addedAt:            string;
  updatedAt:          string;
};

// ── Flat vendor type used by venue UI ─────────────────────────────────────────
// Merges VendorProfile + VenueVendorRelationship fields.
// venueId, status, preferenceLevel, displayOrder, notes, specialPricingNote come
// from the relationship. isPreferred is a computed convenience (Standard #1),
// not a second independently-writable fact — see toVVRRow/mapVVR.

export type Vendor = VendorProfile & {
  venueId:            string;
  status:             VendorRelationshipStatus;
  isPreferred:         boolean;
  preferenceLevel:    VendorPreferenceLevel;
  displayOrder:       number;
  notes:              string | null;
  specialPricingNote: string | null;
};

// ── Vendor user / team member ─────────────────────────────────────────────────

export type VendorUser = {
  id:          string;
  vendorId:    string;
  userId:      string;
  role:        VendorRole;
  invitedBy:   string | null;
  invitedAt:   string;
  acceptedAt:  string | null;
  isActive:    boolean;
  createdAt:   string;
};

// ── Invitation ────────────────────────────────────────────────────────────────

export type VendorInvitation = {
  id:         string;
  venueId:    string;
  vendorId:   string | null;
  email:      string;
  token:      string;
  status:     "pending" | "accepted" | "expired" | "revoked";
  message:    string | null;
  expiresAt:  string;
  createdAt:  string;
  acceptedAt: string | null;
};

// ── Packages ──────────────────────────────────────────────────────────────────

export type VendorPackage = {
  id:          string;
  vendorId:    string;
  name:        string;
  description: string | null;
  price:       number | null;
  priceType:   "fixed" | "starting_at" | "custom" | "contact";
  isActive:    boolean;
  sortOrder:   number;
  createdAt:   string;
  updatedAt:   string;
};

// Program 4, Initiative C, Phase 16 (2026-07-23) — a claimed vendor's own
// FAQs, shown on their expanded profile (Phase 8).
export type VendorFaq = {
  id:         string;
  vendorId:   string;
  question:   string;
  answer:     string;
  sortOrder:  number;
  createdAt:  string;
  updatedAt:  string;
};

export type VendorFaqInput = {
  question: string;
  answer:   string;
};

// ── Availability ──────────────────────────────────────────────────────────────

export type VendorAvailabilitySource = "manual" | "event";

export type VendorAvailability = {
  id:        string;
  vendorId:  string;
  date:      string;
  isBlocked: boolean;
  note:      string | null;
  /** manual = vendor toggle; event = secured assignment write-through (Booked). */
  source:    VendorAvailabilitySource;
  /** event_vendor_assignments.id when source=event. */
  sourceId:  string | null;
  createdAt: string;
};

// ── Reviews ───────────────────────────────────────────────────────────────────

export type VendorReview = {
  id:           string;
  vendorId:     string;
  reviewerType: "venue" | "couple";
  venueId:      string | null;
  eventId:      string | null;
  clientId:     string | null;
  rating:       number;
  body:         string | null;
  isPublic:     boolean;
  createdAt:    string;
  eventName:    string | null;
};

export type VendorReviewInput = {
  eventId:  string;
  rating:   number;
  body:     string;
  isPublic: boolean;
};

// ── Notification preferences ──────────────────────────────────────────────────

export type VendorNotificationPreferences = {
  id:                 string;
  vendorId:           string;
  emailEnabled:       boolean;
  smsEnabled:         boolean;
  pushEnabled:        boolean;
  inAppEnabled:       boolean;
  digestMode:         "instant" | "daily" | "weekly" | "none";
  digestHour:         number;
  notifyNewInquiry:   boolean;
  notifyNewMessage:   boolean;
  notifyTaskDue:      boolean;
  notifyEventUpdate:  boolean;
  notifyReview:       boolean;
  createdAt:          string;
  updatedAt:          string;
};

// ── Actor context ─────────────────────────────────────────────────────────────

export type ActorType = "venue_owner" | "vendor" | "unknown";

export type ActorContext = {
  actor_type: ActorType;
  entity_id?: string;
  role?:      string;
};

// ── Event vendor assignment ───────────────────────────────────────────────────

export type EventVendorAssignment = {
  id:              string;
  venueId:         string;
  eventId:         string;
  vendorId:        string;
  vendorName:      string;
  vendorCategory:  string | null;
  vendorPhone:     string | null;
  arrivalTime:     string | null;
  setupLocation:   string | null;
  loadInNotes:     string | null;
  notes:           string | null;
  checkedInAt:     string | null;
  setupCompleteAt: string | null;
  createdAt:       string;
  // RC2, Milestone 3 — auto-provisioned the moment the assignment is
  // created; never null in practice, but typed nullable defensively like
  // every other Conversation lookup in this codebase.
  conversationId:  string | null;
  // Sprint 2 — Vendor Payment Visibility. Deliberately a summary only: what
  // the venue owes the vendor, and whether it's been paid. No installments,
  // no refunds — that's the couple-side payment system's shape, not this.
  agreedFee:       number | null;
  paymentStatus:   "pending" | "paid";
  /** Pending remove asks from couple and/or vendor — venue confirms Remove. */
  pendingRemovalRequests?: import("@/lib/vendor-removal-requests/types").EventVendorRemovalRequest[];
};

export type VendorWithEvents = Vendor & {
  assignments: VendorEventSummary[];
  // RC2, Milestone 3 — this venue's own venue_vendor_relationships id, needed
  // to fetch the conversation history rollup. Null only if the vendor
  // somehow has no relationship row for this venue (shouldn't happen).
  vendorRelationshipId: string | null;
};

export type VendorEventSummary = {
  id:          string;
  eventId:     string;
  eventName:   string;
  eventDate:   string | null;
  arrivalTime: string | null;
};

// ── Portal vendor (couple portal — shape returned by get_portal_vendors RPC) ──
// RPC maps business_name → name and logo_url → photoUrl for this legacy shape.

export type PortalVendor = {
  id:              string;
  name:            string;
  category:        string | null;
  preferenceLevel: VendorPreferenceLevel;
  description:     string | null;
  photoUrl:        string | null;
  websiteUrl:      string | null;
  instagramUrl:    string | null;
  pricingTier:     VendorPricingTier | null;
  email:           string | null;
  phone:           string | null;
  contactName:     string | null;
};

// ── Input / form types ────────────────────────────────────────────────────────

export type VendorInput = {
  businessName:       string;
  category:           string;
  contactName:        string;
  email:              string;
  phone:              string;
  websiteUrl:         string;
  instagramUrl:       string;
  facebookUrl:        string;
  pinterestUrl:       string;
  tiktokUrl:          string;
  preferenceLevel:    VendorPreferenceLevel;
  description:        string;
  logoUrl:            string;
  pricingTier:        string;
  notes:              string;
  specialPricingNote: string;
};

export type VendorAssignmentInput = {
  vendorId:      string;
  arrivalTime:   string;
  setupLocation: string;
  loadInNotes:   string;
  notes:         string;
};

export type VendorErrors = Record<string, string>;

// ── Vendor self-edit profile input ────────────────────────────────────────────

export type VendorProfileInput = {
  businessName:        string;
  category:            string;
  description:         string;
  contactName:         string;
  email:               string;
  phone:               string;
  websiteUrl:          string;
  instagramUrl:        string;
  facebookUrl:         string;
  pinterestUrl:        string;
  tiktokUrl:           string;
  logoUrl:             string;
  serviceArea:         string;
  pricingTier:         string;
  insuranceExpiry:     string;
  isMarketplaceListed: boolean;
  acceptingInquiries:  boolean;
  availabilityNotes:   string;
};

// ── Package input ─────────────────────────────────────────────────────────────

export type VendorPackageInput = {
  name:        string;
  description: string;
  price:       string;
  priceType:   "fixed" | "starting_at" | "custom" | "contact";
  isActive:    boolean;
};

// ── Vendor dashboard data ─────────────────────────────────────────────────────

export type VendorDashboardEvent = {
  id:          string;
  eventId:     string;
  eventName:   string;
  eventDate:   string | null;
  eventEndDate: string | null;
  venueName:   string;
  arrivalTime: string | null;
};

export type VendorDashboardVenue = {
  id:          string;
  venueId:     string;
  venueName:   string;
  status:      string;
  addedAt:     string;
};

// Program 4, Initiative C, Phase 10 (2026-07-23) — every venue relationship
// this vendor has, with the venue-specific promotion they may edit and
// whether they've become an Event Vendor for at least one booked event
// with this venue.
export type VendorPartnership = {
  id:                 string;
  venueId:            string;
  venueName:          string;
  venueLogoUrl:       string | null;
  status:             string;
  preferenceLevel:    string;
  addedAt:            string;
  promotionHeadline:  string | null;
  promotionDetails:   string | null;
  activeEventCount:   number;
};

// Venue-First Vendor Dashboard (2026-07-24) — "The vendor should always
// feel like they are working with a venue, not browsing a marketplace."
// The hero/immersion data for the vendor's active (usually singular) venue
// relationship — branding, their own partnership status, and the venue's
// contact team.
export type VendorActiveVenue = {
  id:              string;
  name:            string;
  logoUrl:         string | null;
  heroImageUrl:    string | null;
  primaryColor:    string | null;
  secondaryColor:  string | null;
  accentColor:     string | null;
  neutralColor:    string | null;
  story:           string | null;
};

export type VendorActiveVenueContact = {
  id:       string;
  fullName: string;
  title:    string | null;
  role:     string;
  isOwner:  boolean;
  email:    string | null;
};

export type VendorActiveVenueContext = {
  venue:       VendorActiveVenue;
  partnership: Pick<VendorPartnership, "id" | "venueId" | "status" | "preferenceLevel" | "addedAt" | "promotionHeadline" | "promotionDetails" | "activeEventCount">;
  contacts:    VendorActiveVenueContact[];
} | null;

export type VendorDashboardData = {
  vendor:           VendorProfile;
  upcomingEvents:   VendorDashboardEvent[];
  venues:           VendorDashboardVenue[];
  packageCount:     number;
  blockedDateCount: number;
  // Sprint 106 additions
  newInquiryCount:  number;
  pendingTaskCount: number;
  healthScore:      VendorHealthScore | null;
};

export type VendorActionResult =
  | { ok: true; message?: string }
  | { ok: false; errors?: VendorErrors; message?: string };

export type CreateVendorResult =
  | { ok: true; vendorId: string }
  | { ok: false; errors?: VendorErrors; message?: string };

// ── Sprint 106: Inquiry CRM ───────────────────────────────────────────────────

export type InquiryStatus =
  | "new" | "contacted" | "consultation_scheduled"
  | "proposal_sent" | "booked" | "declined" | "lost";

export type VendorInquiry = {
  id:                       string;
  vendorId:                 string;
  venueId:                  string | null;
  venueName:                string | null;
  eventVendorAssignmentId:  string | null;
  source:                   string;
  status:                   InquiryStatus;
  contactName:              string | null;
  contactEmail:             string | null;
  eventDate:                string | null;
  eventType:                string | null;
  notes:                    string | null;
  followUpAt:               string | null;
  createdAt:                string;
  updatedAt:                string;
};

export type VendorInquiryInput = {
  venueId:      string;
  contactName:  string;
  contactEmail: string;
  eventDate:    string;
  eventType:    string;
  notes:        string;
  source:       string;
};

// ── Sprint 106: Personal tasks ────────────────────────────────────────────────

export type VendorTaskCoupleVisibility = "private" | "visible" | "owned";

export type VendorPersonalTaskAttachment = {
  id:         string;
  name:       string;
  storageUrl: string;
  mimeType:   string | null;
};

export type VendorPersonalTask = {
  id:                string;
  vendorId:          string;
  vendorInquiryId:   string | null;
  eventId:           string | null;
  title:             string;
  dueDate:           string | null;
  daysOffset:        number | null;
  templateId:        string | null;
  templateItemId:    string | null;
  status:            "pending" | "complete";
  source:            "manual" | "venue" | "luv" | "automation" | "template";
  notes:             string | null;
  coupleVisibility:  VendorTaskCoupleVisibility;
  /** Couple-portal typed action; share_timeline = verified timeline share. */
  actionType:        "share_timeline" | null;
  /** Durable completion gate — stamped at write from visibility×action_type. */
  completionAuthority: "couple_acknowledge" | "vendor_confirm" | "action_verified";
  /** Phase 2 vendor_confirm: couple ack timestamp (status stays pending). */
  coupleAcknowledgedAt: string | null;
  /** Needs-changes v1: last return note from vendor (cleared when couple re-acks). */
  vendorReturnNote: string | null;
  returnedAt: string | null;
  completedBy:       "couple" | "vendor" | null;
  completedAt:       string | null;
  createdAt:         string;
  attachments?:      VendorPersonalTaskAttachment[];
};

export type VendorPersonalTaskInput = {
  title:             string;
  dueDate:           string;
  /** Relative to event_date when eventId is set; takes precedence over dueDate. */
  daysOffset?:       string | number | null;
  vendorInquiryId:   string;
  eventId:           string;
  notes:             string;
  coupleVisibility?: VendorTaskCoupleVisibility;
  actionType?:       "share_timeline" | null;
  /**
   * Phase 2: when true with coupleVisibility=owned (and not share_timeline),
   * stamps completion_authority=vendor_confirm (dual-state). Existing owned
   * default remains couple_acknowledge.
   */
  requireVendorConfirmation?: boolean;
};

// ── Sprint 106: Health score ──────────────────────────────────────────────────

export type VendorHealthScore = {
  score:      number;
  tier:       "thriving" | "growing" | "needs_attention";
  dimensions: Record<string, { score: number; label: string; weight: number }>;
  strengths:  string[];
  gaps:       string[];
  luvTip:     string | null;
  computedAt: string;
};

// ── Sprint 106: Event detail (authenticated vendor workspace) ─────────────────

export type VendorEventListItem = {
  assignmentId: string;
  eventId:      string;
  eventName:    string;
  eventDate:    string | null;
  eventEndDate: string | null;
  venueId:      string;
  venueName:    string;
  arrivalTime:  string | null;
  isUpcoming:   boolean;
};

/** Hybrid attention feed on vendor event Overview (not an audit log). */
export type VendorActivityType =
  | "message_waiting"
  | "new_task"
  | "document_shared"
  | "task_complete";

export type VendorActivityItem = {
  id:          string;
  type:        VendorActivityType;
  description: string;
  occurredAt:  string;
  actor:       "vendor" | "venue" | "couple";
  /** Action-needed stays until addressed; FYI falls off after 72h. */
  needsAction: boolean;
  /** Deep-link into the event workspace tab. */
  hrefTab?:    "messages" | "tasks" | "documents";
  thread?:     "venue" | "couple";
  /** Soft-ack: mark these vendor_notifications read on row click / Documents navigate. */
  notificationIds?: string[];
};

export type VendorEventDetail = {
  assignmentId:   string;
  eventId:        string;
  eventName:      string;
  eventDate:      string | null;
  eventEndDate:   string | null;
  eventType:      string | null;
  venueName:      string;
  venueId:        string;
  arrivalTime:    string | null;
  setupLocation:  string | null;
  loadInNotes:    string | null;
  internalNotes:  string | null;
  coupleName:     string | null;
  coupleEmail:    string | null;
  couplePhone:    string | null;
  checkedInAt:    string | null;
  setupCompleteAt: string | null;
  // Agreed fee for coordination only — shown on vendor Overview as amount
  // + helper copy, never as paid/pending. Null means hide the card.
  // paymentStatus is still loaded from the assignment row but unused on
  // the vendor surface (payments happen outside Hello to Cheers).
  agreedFee:      number | null;
  paymentStatus:  "pending" | "paid";
  /** True when this vendor already asked the venue to remove them. */
  hasPendingLeaveRequest: boolean;
  timeline:       import("@/lib/vendor-portal/types").VendorTimelineEntry[];
  eventTasks:     import("@/lib/vendor-portal/types").VendorTask[];
  personalTasks:  VendorPersonalTask[];
  documents:      import("@/lib/vendor-portal/types").VendorDocument[];
  activityFeed:   VendorActivityItem[];
};
