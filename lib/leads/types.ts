/**
 * Leads domain types (Sprint 5 — Relationships module).
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
  inquiryDate: string; // ISO "YYYY-MM-DD"
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

/** Lead record with its associated notes and tasks, for the detail page. */
export type LeadWithDetails = Lead & {
  notes: LeadNote[];
  tasks: LeadTask[];
};

/** Form model for creating a new lead. All fields are strings (controlled inputs). */
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
