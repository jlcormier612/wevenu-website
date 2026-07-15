import type { DisplayShape } from "@/lib/floor-plans/types";

// Portal context returned by get_portal_context()
export type PortalContext = {
  sessionId: string;
  accessLevel: "couple" | "planning" | "financial" | "view_only";
  label: string;         // "Emily & James", "Dad (Jim)" — human-readable session name
  client: {
    id: string;
    firstName: string;
    lastName: string | null;
    partnerFirstName: string | null;
    partnerLastName: string | null;
    eventType: string | null;
  };
  contact?: {
    id: string;
    firstName: string;
    lastName?: string | null;
    roleLabel?: string | null;
    portalRole?: string | null;
  } | null;
  event: {
    id: string;
    eventDate: string;
    eventType: string | null;
    name: string | null;
    guestCount: number | null;
  } | null;
  venue: {
    id: string;
    name: string;
    website: string | null;
  };
};

// A task as visible in the client portal
export type PortalTask = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  ownerType: string;
  visibility: "client_visible" | "client_owned";
  dueDate: string;
  daysOffset: number;
  milestoneName: string;
  milestoneKind: "event_day" | "final_stretch" | null;
  status: "pending" | "blocked" | "complete" | "overdue";
  isRequired: boolean;
  completedAt: string | null;
  canComplete: boolean;  // true only for client_owned tasks the couple can act on
};

export type PortalSection = "overview" | "guests" | "todos" | "budget" | "seating" | "people" | "website" | "story" | "journey" | "tasks" | "timeline" | "vendors" | "payments" | "documents" | "messages" | "ask" | "guide" | "account" | "requests";

// A Timeline item as visible in the client portal — same timeline_entries
// row the coordinator sees in the Booking Timeline, filtered to only what's
// marked visible to the client.
export type PortalTimelineLink = { id: string; url: string; label: string | null };
export type PortalTimelineAttachment = { id: string; name: string; url: string };
export type PortalTimelineSection = { id: string; name: string; sortOrder: number; clientCanAdd: boolean };

export type PortalTimelineEntry = {
  id: string;
  title: string;
  description: string | null;
  entryTime: string | null;
  sectionId: string | null;
  sortOrder: number;
  canEdit: boolean;
  links: PortalTimelineLink[];
  attachments: PortalTimelineAttachment[];
};

export type PortalTimeline = {
  sections: PortalTimelineSection[];
  entries: PortalTimelineEntry[];
};

export type BudgetContributor = {
  id: string;
  name: string;
  amount: number;
};

export type BudgetCategory = {
  id: string;
  categoryKey: string;
  customName: string | null;
  budgetedAmount: number;
  actualAmount: number;
  notes: string | null;
  displayOrder: number;
};

export type CoupleBudget = {
  id: string;
  totalBudget: number;
  notes: string | null;
  contributors: BudgetContributor[];
  categories: BudgetCategory[];
};

export type ClientMedia = {
  id: string;
  fileUrl: string;
  mediaType: string;
  category: string | null;
  visibility: "private" | "venue" | "website";
  caption: string | null;
  createdAt: string;
};

export type CoupleProfile = {
  weddingHashtag: string | null;
  ourStory: string | null;
  heroPhotoId: string | null;
  heroPhotoUrl: string | null;
  couplePhotoId: string | null;
  couplePhotoUrl: string | null;
  engagementPhotos: ClientMedia[];
  inspirationPhotos: ClientMedia[];
  memoryPhotos: ClientMedia[];
  latestJournalEntry: JournalEntry | null;
};

export type PortalParticipantRole =
  | "partner" | "parent" | "wedding_planner" | "maid_of_honor"
  | "best_man" | "family_member" | "friend" | "custom";

export type PortalPermissionLevel = "full" | "planning" | "financial" | "website" | "view_only";

export type PortalParticipant = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string;
  role: PortalParticipantRole;
  customRoleLabel: string | null;
  permissionLevel: PortalPermissionLevel;
  notifyPlanning: boolean;
  notifyPayments: boolean;
  notifyWebsite: boolean;
  notifyRsvps: boolean;
  inviteStatus: "pending" | "accepted" | "declined" | "revoked";
  invitedAt: string;
  acceptedAt: string | null;
};

export type PortalActivity = {
  id: string;
  activityType: string;
  actorName: string | null;
  detailText: string;
  createdAt: string;
};

export const DIETARY_TAGS = [
  "vegetarian", "vegan", "gluten_free", "dairy_free",
  "nut_allergy", "shellfish_allergy", "kosher", "halal",
] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const ACCESSIBILITY_TAGS = [
  "wheelchair", "limited_mobility", "hearing_assistance",
  "vision_assistance", "service_animal", "special_seating",
] as const;
export type AccessibilityTag = (typeof ACCESSIBILITY_TAGS)[number];

/** Shared display labels/emoji for the tag vocabularies above — used by the couple's Seating tab and the venue's Wedding Day Seating lookup alike, so the two surfaces never invent a second vocabulary. */
export const ACCESSIBILITY_LABELS: Record<string, string> = {
  wheelchair: "Wheelchair access", limited_mobility: "Limited mobility",
  hearing_assistance: "Hearing assistance", vision_assistance: "Vision assistance",
  service_animal: "Service animal", special_seating: "Special seating request",
};
export const DIETARY_EMOJI: Record<string, string> = {
  vegetarian: "🥦", vegan: "🌱", gluten_free: "🌾", dairy_free: "🥛",
  nut_allergy: "🥜", shellfish_allergy: "🦐", kosher: "✡️", halal: "☪️",
};
export const MEAL_EMOJI: Record<string, string> = {
  chicken: "🍗", beef: "🥩", fish: "🐟", vegetarian: "🥦", vegan: "🌱", kids: "🍕",
};

export type CoupleGuest = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  plusOne: boolean;
  plusOneName: string | null;
  rsvpStatus: "pending" | "attending" | "declined" | "maybe";
  rsvpNote: string | null;
  dietary: string | null;
  notes: string | null;
  mealChoice: string | null;
  plusOneMeal: string | null;
  isChild: boolean;
  /** A guest's organizational group (Guest & Household Foundation) — replaces the old free-text groupLabel. */
  householdId: string | null;
  householdName: string | null;
  rsvpToken: string | null;
  rsvpSentAt: string | null;
  /**
   * Invitation lifecycle (Guest Experience — Phase 2). Separate from
   * rsvpStatus: this tracks whether/how the invitation itself was sent,
   * not what the guest said. 'declined' here means the couple withdrew
   * the invitation — it is not a duplicate of rsvpStatus's 'declined'.
   */
  invitationStatus: "draft" | "ready" | "sent" | "delivered" | "opened" | "responded" | "declined";
  // Guest Experience — Phase 3
  dietaryTags: DietaryTag[];
  accessibilityTags: AccessibilityTag[];
  accessibilityNotes: string | null;
  /** Set once this guest is a real, converted plus-one record — points at who they're the plus-one of. */
  plusOneOfGuestId: string | null;
  age: number | null;
  highChairRequired: boolean;
  childNotes: string | null;
  /** A vendor's meal, modeled as an ordinary guest record — not a second meal-tracking system. */
  isVendorMeal: boolean;
  /** Seating Experience — Phase 1: a "Wedding Party" seating filter grouping, distinct from Households. */
  isWeddingParty: boolean;
};

/** A couple-owned organizational unit guests belong to (Guest & Household Foundation). */
export type CoupleHousehold = {
  id: string;
  name: string;
  notes: string | null;
  memberCount: number;
};

/** The couple's own meal-selection catalog (Guest Experience — Phase 3) — the one authoritative source of meal options. */
export type CoupleMealOption = {
  id: string;
  name: string;
  isActive: boolean;
};

/** Invitation & RSVP progress dashboard data (Guest Experience — Phase 2). */
export type InvitationProgress = {
  invitationStats: {
    draft: number; ready: number; sent: number;
    delivered: number; opened: number; responded: number; declined: number;
  };
  pendingCount: number;
  outstandingHouseholds: {
    id: string; name: string; totalMembers: number; respondedMembers: number;
  }[];
  recentlyResponded: {
    id: string; name: string; rsvpStatus: string; respondedAt: string; householdName: string | null;
  }[];
};

/** A seated guest, as embedded in a SeatingTable or the unassigned/needsReassignment buckets (Seating Experience — Phase 1). */
export type SeatingGuest = {
  guestId: string;
  name: string;
  mealChoice: string | null;
  dietaryTags: DietaryTag[];
  accessibilityTags: AccessibilityTag[];
  isChild: boolean;
  isVendorMeal: boolean;
  isWeddingParty: boolean;
  householdId: string | null;
  householdName: string | null;
  plusOneOfGuestId: string | null;
};

/**
 * A table for seating purposes — this IS a floor_plan_objects row, read
 * live off the shared Floor Plan. Nothing here is a second table model:
 * geometry/label/capacity are the Floor Plan's own fields, and "guests" is
 * just guest_seat_assignments filtered by this table's id.
 */
export type SeatingTable = {
  id: string;
  label: string | null;
  capacity: number | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  /** Copied from floor_plan_objects.display_shape — null on tables placed before the shape library existed; renderer falls back to "round". */
  displayShape: DisplayShape | null;
  guests: SeatingGuest[];
};

export type SeatingFloorPlan = {
  id: string;
  name: string;
  roomWidthFt: number;
  roomDepthFt: number;
  backgroundImageUrl: string | null;
  backgroundImageOpacity: number;
};

export type SeatingStats = {
  totalAttending: number;
  totalAssigned: number;
  tableCount: number;
  totalCapacity: number;
};

/** Seating Experience — Phase 1. Null floorPlan means the venue hasn't shared one yet (client_access still 'hidden' on every plan). */
export type SeatingData = {
  floorPlan: SeatingFloorPlan | null;
  tables: SeatingTable[];
  unassignedGuests: SeatingGuest[];
  /** A table this guest was seated at got deleted in the Floor Plan editor — the assignment survives, pointing nowhere. */
  needsReassignment: SeatingGuest[];
  /** True if this couple has ever seated a guest, even if no floor plan is currently shared — lets the empty state say "your venue paused sharing" instead of implying prior work was lost. */
  hadPriorWork: boolean;
  stats: SeatingStats;
};

/** Household-aware auto-assign suggestions (Seating Experience — Phase 1), reusing the same packing idea as Guest Households. */
export type SeatingSuggestionHousehold = {
  householdKey: string;
  guestIds: string[];
  names: string[];
  size: number;
};

export type SeatingSuggestions = {
  households: SeatingSuggestionHousehold[];
};

export type GuestStats = {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  children: number;
  withPlusOnes: number;
  /** Vendor meals (Guest Experience — Phase 3) are excluded from every other stat above — a caterer isn't a social guest. */
  vendorMeals: number;
};

export type RsvpQuestion = {
  id: string;
  questionKey: string;
  questionText: string;
  inputType: "text" | "textarea" | "select" | "boolean";
  options: string[] | null;
  appliesToPlusOne: boolean;
  isRequired: boolean;
  displayOrder: number;
  isActive?: boolean;
};

export type RsvpInsights = {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  maybe: number;
  responded: number;
  withPlusOnes: number;
  childCount: number;
  sentCount: number;
  mealCounts: Record<string, number>;
  recentRsvps: { name: string; status: string; respondedAt: string }[];
  milestones: string[];
};

export type TodoCategory = "venue" | "attire" | "florals" | "music" | "catering" | "photography" | "travel" | "invitations" | "beauty" | "other";

export type CoupleTodo = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  category: TodoCategory | null;
  completed: boolean;
  completedAt: string | null;
};

export type JournalEntry = {
  id: string;
  entryDate: string;
  title: string | null;
  body: string;
  milestone: string | null;
  source: "manual" | "auto";
  mediaId: string | null;
  mediaUrl: string | null;
  createdAt: string;
};

export type ActivityItem = {
  type: string;
  emoji: string;
  label: string;
  occurredAt: string;
};

export type RecentActivity = {
  activity: ActivityItem[];
  totalThisWeek: number;
};

export type PortalSession = {
  id: string;
  venueId: string;
  clientId: string;
  /** The booking this session resolves to — stable, set at creation, never re-derived (Seating Release Completion). Null only for legacy rows this venue hasn't loaded since the backfill. */
  eventId: string | null;
  accessToken: string;
  accessLevel: PortalContext["accessLevel"];
  label: string | null;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};
