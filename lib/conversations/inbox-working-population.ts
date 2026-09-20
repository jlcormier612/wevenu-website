import { isOpenLeadLifecycle } from "@/lib/leads/open-lifecycle";

export type InboxWorkingCategory = "leads" | "clients" | "vendors" | "historical";

const VENDOR_KINDS = new Set(["venue_vendor", "couple_vendor", "couple_vendor_inquiry"]);

/**
 * Active Inbox category for one conversation.
 * A row with no messages is not an Inbox row; callers must not invent one.
 * Lost, cancelled, and relationship-only threads are historical: preserved, not active tabs.
 */
export function inboxWorkingCategory(input: {
  conversationKind?: string | null;
  salesStage?: string | null;
  hasLead: boolean;
  clientStatus?: string | null;
  lifecycleBookedAt?: string | null;
  hasBookedEvent?: boolean;
}): InboxWorkingCategory {
  if (input.conversationKind && VENDOR_KINDS.has(input.conversationKind)) return "vendors";
  if (input.hasLead && isOpenLeadLifecycle(input.salesStage)) return "leads";
  const booked =
    input.clientStatus !== "cancelled"
    && (Boolean(input.lifecycleBookedAt) || Boolean(input.hasBookedEvent));
  if (booked) return "clients";
  return "historical";
}
