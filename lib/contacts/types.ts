export type ContactRelationship =
  | "partner" | "parent" | "planner" | "maid_of_honor"
  | "best_man" | "sibling" | "family" | "other";

export type ContactPortalRole =
  | "full_access" | "planning" | "financial" | "view_only" | "reminders_only";

export type ClientContact = {
  id: string;
  venueId: string;
  clientId: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  relationship: ContactRelationship | null;
  roleLabel: string | null;   // "Dad", "MOH", "Lisa (Planner)"
  portalRole: ContactPortalRole | null;
  receivesReminders: boolean;
  isPrimary: boolean;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type ClientContactInput = {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  relationship?: ContactRelationship;
  roleLabel?: string;
  portalRole?: ContactPortalRole | null;
  receivesReminders?: boolean;
  isPrimary?: boolean;
  notes?: string;
};

export const RELATIONSHIP_LABELS: Record<ContactRelationship, string> = {
  partner:       "Partner",
  parent:        "Parent",
  planner:       "Wedding Planner",
  maid_of_honor: "Maid of Honor / Bridesmaid",
  best_man:      "Best Man / Groomsman",
  sibling:       "Sibling",
  family:        "Family",
  other:         "Other",
};

export const PORTAL_ROLE_LABELS: Record<ContactPortalRole, string> = {
  full_access:    "Full access",
  planning:       "Planning only (tasks, documents)",
  financial:      "Financial only (invoices, payments)",
  view_only:      "View only",
  reminders_only: "Reminders only (no portal login)",
};

export const PORTAL_ROLE_DESCRIPTIONS: Record<ContactPortalRole, string> = {
  full_access:    "Can see and do everything the couple can do.",
  planning:       "Can see and complete planning tasks and documents. No financial info.",
  financial:      "Can see invoices and make payments only.",
  view_only:      "Can view their permitted sections. Cannot complete tasks or pay.",
  reminders_only: "Receives email/SMS reminders only. No portal access.",
};
