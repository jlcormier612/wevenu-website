/**
 * Leads reference data: statuses, event types, sources, and defaults.
 * Pure data — no imports beyond the types file.
 */
import type { LeadInput, LeadStatus } from "@/lib/leads/types";

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
