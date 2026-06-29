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
  status: "pending" | "blocked" | "complete" | "overdue";
  isRequired: boolean;
  completedAt: string | null;
  canComplete: boolean;  // true only for client_owned tasks the couple can act on
};

export type PortalSection = "overview" | "guests" | "todos" | "people" | "tasks" | "payments" | "documents" | "messages";

export type CoupleGuest = {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  plusOne: boolean;
  plusOneName: string | null;
  rsvpStatus: "pending" | "attending" | "declined" | "maybe";
  rsvpNote: string | null;
  dietary: string | null;
  groupLabel: string | null;
  notes: string | null;
};

export type GuestStats = {
  total: number;
  attending: number;
  declined: number;
  pending: number;
  withPlusOnes: number;
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
