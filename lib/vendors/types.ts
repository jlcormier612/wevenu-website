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

// ── Availability ──────────────────────────────────────────────────────────────

export type VendorAvailability = {
  id:        string;
  vendorId:  string;
  date:      string;
  isBlocked: boolean;
  note:      string | null;
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
};

export type VendorWithEvents = Vendor & {
  assignments: VendorEventSummary[];
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

export type VendorPersonalTask = {
  id:              string;
  vendorId:        string;
  vendorInquiryId: string | null;
  eventId:         string | null;
  title:           string;
  dueDate:         string | null;
  status:          "pending" | "complete";
  source:          "manual" | "venue" | "luv" | "automation";
  notes:           string | null;
  completedAt:     string | null;
  createdAt:       string;
};

export type VendorPersonalTaskInput = {
  title:           string;
  dueDate:         string;
  vendorInquiryId: string;
  eventId:         string;
  notes:           string;
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
  venueName:    string;
  arrivalTime:  string | null;
  isUpcoming:   boolean;
};

export type VendorActivityItem = {
  id:          string;
  type:        "task_complete" | "document_upload" | "message" | "status_change";
  description: string;
  occurredAt:  string;
  actor:       "vendor" | "venue";
};

export type VendorEventDetail = {
  assignmentId:   string;
  eventId:        string;
  eventName:      string;
  eventDate:      string | null;
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
  timeline:       import("@/lib/vendor-portal/types").VendorTimelineEntry[];
  eventTasks:     import("@/lib/vendor-portal/types").VendorTask[];
  personalTasks:  VendorPersonalTask[];
  documents:      import("@/lib/vendor-portal/types").VendorDocument[];
  activityFeed:   VendorActivityItem[];
};
