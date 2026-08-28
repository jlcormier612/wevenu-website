/**
 * Leads domain types (Sprint 5 + Sprint 6 — Relationships module).
 * Pure types — no framework or database imports.
 */

import type { SalesStage } from "@/lib/leads/sales-stages";

/** @deprecated Use SalesStage — leads.status is retired as lifecycle truth. */
export type LeadStatus = SalesStage;

export type ActivityType =
  | "lead_created"
  | "status_changed"
  | "sales_stage_changed"
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
  /** Authoritative Sales Pipeline stage (seven fixed stages). */
  salesStage: SalesStage;
  /**
   * @deprecated Alias of salesStage for transitional call sites.
   * Prefer salesStage.
   */
  status: SalesStage;
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
  /** 0-100, set only for assisted/extracted sources (e.g. email-parsed) — Lead Intake architecture. Null for directly-submitted or manually-entered leads. */
  intakeConfidence: number | null;
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
  /** ID of the Event booked for the converted client, if one exists. */
  linkedEventId: string | null;
  /** Count of other Leads sharing this Lead's Relationship — Lead Intake architecture: Relationships persist, Opportunities don't, so a repeat inquiry is a returning relationship with a fresh Lead, not a reopened one. 0 when this is the only Lead on the Relationship (or it has none). */
  otherLeadsOnRelationship: number;
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
  /** Set by CSV import when the spreadsheet's source text didn't match a registered source — preserves the original label since `source` itself falls back to "other". */
  originalSourceLabel?: string | null;
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
