/**
 * Message Template Library constants — Communication Platform Phase 1.
 * See docs/communication-platform-next-phase.md §2.2 (Categories), §2.3 (Variables).
 */
import type { MessageTemplateCategory } from "@/lib/message-templates/types";

// A category is a hint for where a template surfaces as a suggestion (e.g.
// Payment Reminder templates surface when composing from a payment-linked
// task, once that connection point exists in a later phase) — not a hard
// restriction on where a template can be used.
export const MESSAGE_TEMPLATE_CATEGORIES: { value: MessageTemplateCategory; label: string }[] = [
  { value: "inquiry_follow_up",   label: "Inquiry Follow-Up" },
  { value: "tour",                label: "Tour" },
  { value: "booking_confirmation", label: "Booking Confirmation" },
  { value: "planning_reminder",   label: "Planning Reminder" },
  { value: "payment_reminder",    label: "Payment Reminder" },
  { value: "vendor_coordination", label: "Vendor Coordination" },
  { value: "post_event",          label: "Post-Event" },
  { value: "general",             label: "General" },
];

export function categoryLabel(category: MessageTemplateCategory): string {
  return MESSAGE_TEMPLATE_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

export type MergeFieldMeta = {
  key: string;
  label: string;
  description: string;
};

// Shared across Email and SMS (§2.5, decided 2026-07-13) — the vocabulary a
// coordinator writes with is consistent regardless of channel, even though
// the written content itself never is.
export const MESSAGE_MERGE_FIELDS: MergeFieldMeta[] = [
  { key: "venue_name",        label: "Venue Name",         description: "Your venue's name" },
  { key: "client_name",       label: "Client Name",        description: "Full client name (e.g., Emily & James Carter)" },
  { key: "coordinator_name",  label: "Coordinator Name",   description: "The team member sending this message" },
  { key: "event_date",        label: "Event Date",         description: "Formatted event date (e.g., June 12, 2027)" },
  { key: "event_name",        label: "Event Name",         description: "The event's name, when available" },
  { key: "days_until_event",  label: "Days Until Event",   description: "Number of days remaining before the event" },
  { key: "tour_datetime",     label: "Tour Date & Time",   description: "The couple's scheduled tour, in your venue timezone" },
  { key: "payment_label",     label: "Payment Label",      description: "The payment plan line (e.g., Deposit)" },
  { key: "payment_amount",    label: "Payment Amount",     description: "Amount due on that payment line" },
  { key: "payment_due_date",  label: "Payment Due Date",   description: "Due date on that payment line" },
  { key: "task_name",         label: "Task Name",          description: "The Planning task this message relates to, when sent from one" },
];
