/**
 * Leads domain types (Sprint 5 + Sprint 6 — Relationships module).
 * Pure types — no framework or database imports.
 */

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal_sent"
  | "won"
  | "lost"
  | "cancelled";

export type ActivityType =
  | "lead_created"
  | "status_changed"
  | "note_added"
  | "note_updated"
  | "task_created"
  | "task_completed"
  | "tour_scheduled"
  | "follow_up_set"
  | "last_contacted"
  | "lead_updated"
  | "relationship_updated";

export type Lead = {
  id: string;
  venueId: string;
  status: LeadStatus;
  source: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerEmail: string | null;
  eventType: string | null;
  eventDate: string | null; // ISO "YYYY-MM-DD"
  endDate: string | null;
  guestCount: number | null;
  estimatedBudget: number | null;
  inquiryMessage: string | null;
  inquiryDate: string;
  // Sprint 6 — relationship fields
  nextActionText: string | null;
  nextActionDue: string | null;
  followUpDate: string | null;
  lastContactedAt: string | null;
  tourDate: string | null;
  tourTime: string | null;
  tourCompleted: boolean;
  tourNotes: string | null;
  commitmentScore: number;      // 0–100, computed from milestone data
  responsivenessScore: number;  // 0–100, computed from message reply patterns
  interestScore: number;        // 0–100, computed from time-decayed signal events
  scoresUpdatedAt: string | null;
  sourceData: Record<string, unknown> | null;
  relationshipId: string | null; // Program 2 Phase 2 — the enduring customer identity this Opportunity belongs to
  createdAt: string;
  updatedAt: string;
};

export type LeadNote = {
  id: string;
  venueId: string;
  leadId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type LeadTask = {
  id: string;
  venueId: string;
  leadId: string;
  title: string;
  dueDate: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
};

export type LeadActivity = {
  id: string;
  venueId: string;
  leadId: string;
  type: ActivityType | string;
  title: string;
  description: string | null;
  createdAt: string;
};

/** Lead record with its full context for the detail page. */
export type LeadWithDetails = Lead & {
  notes: LeadNote[];
  tasks: LeadTask[];
  activities: LeadActivity[];
  /** ID of the client record converted from this lead, if one exists. */
  linkedClientId: string | null;
};

/** Form model for creating or editing a lead. All fields are strings for controlled inputs. */
export type LeadInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  partnerFirstName: string;
  partnerLastName: string;
  partnerEmail: string;
  eventType: string;
  eventDate: string;
  endDate: string;
  guestCount: string;
  estimatedBudget: string;
  source: string;
  inquiryMessage: string;
  inquiryDate: string;
};

/** Form model for the relationship management card (Sprint 6). */
export type RelationshipInput = {
  nextActionText: string;
  nextActionDue: string;
  followUpDate: string;
  lastContactedAt: string;
  tourDate: string;
  tourTime: string;
  tourCompleted: boolean;
  tourNotes: string;
};

export type LeadErrors = Record<string, string>;

export type TaskInput = {
  title: string;
  dueDate: string;
};

export type LeadActionResult =
  | { ok: true }
  | { ok: false; errors?: LeadErrors; message?: string };

export type CreateLeadResult =
  | { ok: true; leadId: string }
  | { ok: false; errors?: LeadErrors; message?: string };
