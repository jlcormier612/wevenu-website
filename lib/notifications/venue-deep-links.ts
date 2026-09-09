/**
 * Venue notification deep links — keep action CTAs on the surface where
 * the work happens (Conversation tab, Planning, Documents, etc.).
 *
 * Mirrors the SQL trigger contract in
 * supabase/migrations/20261360000000_notification_action_deep_links.sql.
 */

export type VenueMessageNotificationTarget = {
  conversationId: string;
  clientId: string | null;
  leadId: string | null;
};

/**
 * Where "Reply to message" should land for a venue↔couple Conversation.
 * Booking/Lead records that own a Conversation tab open that tab.
 * Otherwise Inbox opens with the exact conversation selected.
 */
export function venueMessageNotificationHref(target: VenueMessageNotificationTarget): string {
  const { conversationId, clientId, leadId } = target;
  if (clientId) return `/clients/${clientId}#messages`;
  if (leadId) return `/leads/${leadId}#messages`;
  return `/messaging?conversation=${encodeURIComponent(conversationId)}`;
}

/** Map legacy `?tab=` query links onto Booking Workspace hash tabs. */
const LEGACY_TAB_TO_HASH: Record<string, string> = {
  playbook: "playbook",
  messages: "messages",
  conversation: "messages",
  documents: "documents",
  feedback: "feedback",
  vendors: "vendors",
  timeline: "timeline",
  floorplan: "floorplan",
  invoice: "invoice",
  inventory: "inventory",
  activity: "activity",
  notes: "notes",
  team: "team",
  overview: "overview",
  // Historical RSVP / final-details links — form lives with Documents.
  "final-details": "documents",
};

/** Notification type → default Booking hash when the stored link has no surface. */
const TYPE_DEFAULT_HASH: Record<string, string> = {
  message_received: "messages",
  task_completed_couple: "playbook",
  task_completed_vendor: "playbook",
  questionnaire_submitted: "playbook",
  final_guest_count_submitted: "playbook",
  feedback_received: "feedback",
  referral_received: "feedback",
  rsvp_received: "documents",
  contract_signed: "documents",
};

function formatPath(pathname: string, searchParams: URLSearchParams, hashName: string | null): string {
  const search = searchParams.toString();
  const q = search ? `?${search}` : "";
  const hash = hashName ? (hashName.startsWith("#") ? hashName : `#${hashName}`) : "";
  return `${pathname}${q}${hash}`;
}

/**
 * Normalize a stored venue_notifications.link for navigation.
 * Does not invent destinations — only upgrades known incomplete/legacy shapes.
 */
export function normalizeVenueNotificationHref(
  link: string | null | undefined,
  type?: string | null,
): string | null {
  if (!link) return null;
  const trimmed = link.trim();
  if (!trimmed.startsWith("/")) return trimmed;

  try {
    const url = new URL(trimmed, "https://venue.local");
    const path = url.pathname;
    const tab = url.searchParams.get("tab");
    const conversation = url.searchParams.get("conversation");
    const hasHash = Boolean(url.hash && url.hash !== "#");

    // Message replies: open Conversation on the record when the link is bare.
    if (type === "message_received") {
      if (path.startsWith("/clients/") || path.startsWith("/leads/")) {
        url.searchParams.delete("tab");
        return formatPath(path, url.searchParams, hasHash ? url.hash.slice(1) : "messages");
      }
      if ((path === "/messaging" || path === "/messages") && conversation) {
        return `/messaging?conversation=${encodeURIComponent(conversation)}`;
      }
    }

    // Legacy ?tab=foo → #foo (Booking Workspace reads hash).
    if (tab && LEGACY_TAB_TO_HASH[tab]) {
      const hash = LEGACY_TAB_TO_HASH[tab];
      url.searchParams.delete("tab");
      return formatPath(path, url.searchParams, hasHash ? url.hash.slice(1) : hash);
    }

    // Action types that landed on the record overview without a surface.
    const defaultHash = type ? TYPE_DEFAULT_HASH[type] : undefined;
    if (
      defaultHash &&
      !hasHash &&
      (path.startsWith("/clients/") || path.startsWith("/leads/") || path.startsWith("/events/"))
    ) {
      return formatPath(path, url.searchParams, defaultHash);
    }

    return formatPath(path, url.searchParams, hasHash ? url.hash.slice(1) : null);
  } catch {
    return trimmed;
  }
}
