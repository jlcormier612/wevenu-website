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
  accessToken: string;
  accessLevel: PortalContext["accessLevel"];
  label: string | null;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};
