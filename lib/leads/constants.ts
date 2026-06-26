/**
 * Leads reference data: statuses, event types, sources, and defaults.
 * Pure data — no imports beyond the types file.
 */
import type { ActivityType, Lead, LeadInput, LeadStatus, RelationshipInput } from "@/lib/leads/types";

export type StatusMeta = {
  value: LeadStatus;
  label: string;
  description: string;
};

export const LEAD_STATUSES: StatusMeta[] = [
  { value: "new",           label: "New",           description: "Inquiry just received" },
  { value: "contacted",     label: "Contacted",     description: "Reached out to the lead" },
  { value: "qualified",     label: "Qualified",     description: "Confirmed a good fit" },
  { value: "proposal_sent", label: "Proposal Sent", description: "Pricing / proposal sent" },
  { value: "won",           label: "Won",           description: "Booking confirmed" },
  { value: "lost",          label: "Lost",          description: "Did not book" },
  { value: "cancelled",     label: "Cancelled",     description: "Booking was cancelled" },
];

export const ACTIVE_STATUSES: LeadStatus[] = [
  "new", "contacted", "qualified", "proposal_sent",
];

export type Option = { value: string; label: string };

export const EVENT_TYPES: Option[] = [
  { value: "wedding",           label: "Wedding" },
  { value: "elopement",         label: "Elopement" },
  { value: "engagement_party",  label: "Engagement Party" },
  { value: "rehearsal_dinner",  label: "Rehearsal Dinner" },
  { value: "reception",         label: "Reception Only" },
  { value: "corporate",         label: "Corporate Event" },
  { value: "birthday",          label: "Birthday Party" },
  { value: "anniversary",       label: "Anniversary Celebration" },
  { value: "shower",            label: "Bridal / Baby Shower" },
  { value: "gala",              label: "Gala / Fundraiser" },
  { value: "other",             label: "Other" },
];

export const LEAD_SOURCES: Option[] = [
  { value: "website",      label: "Website" },
  { value: "referral",     label: "Referral" },
  { value: "the_knot",     label: "The Knot" },
  { value: "wedding_wire", label: "WeddingWire" },
  { value: "instagram",    label: "Instagram" },
  { value: "facebook",     label: "Facebook" },
  { value: "google",       label: "Google" },
  { value: "email",        label: "Direct Email" },
  { value: "phone",        label: "Phone Call" },
  { value: "walk_in",      label: "Walk-in" },
  { value: "other",        label: "Other" },
];

export function createInitialLeadInput(): LeadInput {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    partnerFirstName: "",
    partnerLastName: "",
    partnerEmail: "",
    eventType: "",
    eventDate: "",
    endDate: "",
    guestCount: "",
    estimatedBudget: "",
    source: "",
    inquiryMessage: "",
    inquiryDate: new Date().toISOString().slice(0, 10),
  };
}

/** Human-readable display name for a lead. */
export function leadDisplayName(
  firstName: string,
  lastName: string,
  partnerFirstName?: string | null,
  partnerLastName?: string | null,
): string {
  const primary = [firstName, lastName].filter(Boolean).join(" ");
  const partner =
    partnerFirstName || partnerLastName
      ? [partnerFirstName, partnerLastName].filter(Boolean).join(" ")
      : null;
  return partner ? `${primary} & ${partner}` : primary;
}

/** Look up a status label; falls back to the raw value. */
export function statusLabel(status: string): string {
  return LEAD_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function eventTypeLabel(value: string | null): string {
  if (!value) return "";
  return EVENT_TYPES.find((e) => e.value === value)?.label ?? value;
}

export function sourceLabel(value: string | null): string {
  if (!value) return "";
  return LEAD_SOURCES.find((s) => s.value === value)?.label ?? value;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Relative timestamp ("just now", "2 hours ago", "Jun 26") for activity feeds. */
export function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso.slice(0, 10));
}

/** True when a date string (ISO date or datetime) is before today. */
export function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(iso.slice(0, 10)) < today;
}

/** True when a date string is today. */
export function isDueToday(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

/** Build the initial RelationshipInput from an existing lead (or blank). */
export function createInitialRelationshipInput(lead?: Lead | null): RelationshipInput {
  return {
    nextActionText: lead?.nextActionText ?? "",
    nextActionDue: lead?.nextActionDue ?? "",
    followUpDate: lead?.followUpDate ?? "",
    lastContactedAt: lead?.lastContactedAt ?? "",
    tourDate: lead?.tourDate ?? "",
    tourTime: lead?.tourTime ?? "",
    tourCompleted: lead?.tourCompleted ?? false,
    tourNotes: lead?.tourNotes ?? "",
  };
}

/** Human-readable label for an activity type. */
const ACTIVITY_LABELS: Partial<Record<ActivityType | string, string>> = {
  lead_created: "Inquiry received",
  status_changed: "Status updated",
  note_added: "Note added",
  note_updated: "Note edited",
  task_created: "Task added",
  task_completed: "Task completed",
  tour_scheduled: "Tour scheduled",
  follow_up_set: "Follow-up set",
  last_contacted: "Marked as contacted",
  lead_updated: "Lead info updated",
  relationship_updated: "Relationship details updated",
};

export function activityLabel(type: string): string {
  return ACTIVITY_LABELS[type] ?? type;
}
