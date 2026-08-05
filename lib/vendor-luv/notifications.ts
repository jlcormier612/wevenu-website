/**
 * Map vendor_notifications → VendorLuvExtras.notifications.
 *
 * Light touch only: assignment / document alerts that aren't already covered
 * by vendor-home message/task observations, plus an unread rollup that deep-
 * links into the bell feed. Not a duplicate notification center.
 *
 * Detail must state the *what* (new assignment, document shared) — never the
 * bare couple·venue string from notification bodies. That context belongs in
 * eventName so the briefing row reads like venue Today.
 */
import type { BriefingItem } from "@/lib/luv/briefing-types";
import type { VendorNotification } from "@/lib/vendor-notifications/types";

/** Types already observed from VendorHomeData — skip here. */
const HOME_COVERED = new Set(["new_message", "new_task"]);

export const VENDOR_NOTIFICATIONS_FEED_HREF = "/vendor/dashboard?notifications=1";

function eventLink(n: VendorNotification, tab: "overview" | "documents"): string {
  if (n.assignmentId) {
    return `/vendor/events/${n.assignmentId}?tab=${tab}${tab === "documents" ? "&highlight=documents" : ""}`;
  }
  return n.link || VENDOR_NOTIFICATIONS_FEED_HREF;
}

/**
 * Prefer an actionable sentence. Notification `body` is often just
 * "Emma & Jordan · Sweet Daisy Barn" — useful as event context, not as the
 * primary briefing line.
 */
function notificationCopy(n: VendorNotification): {
  label: string;
  detail: string;
  eventName: string | null;
  link: string;
} {
  const context = n.body?.trim() || null;

  switch (n.type) {
    case "assigned_to_event":
      return {
        label: "New assignment",
        detail: "New event assignment — review details",
        eventName: context,
        link: eventLink(n, "overview"),
      };
    case "document_shared": {
      // Prefer a specific title when the system wrote one; otherwise state the action.
      const title = n.title?.trim() ?? "";
      const specific =
        title &&
        !/^document shared/i.test(title) &&
        !/^shared with you/i.test(title)
          ? title
          : null;
      return {
        label: "Shared with you",
        detail: specific ?? "New document shared with you",
        eventName: context,
        link: eventLink(n, "documents"),
      };
    }
    default:
      return {
        label: "Alert",
        detail: (n.title?.trim() || "Unread alert").slice(0, 140),
        eventName: context,
        link: n.link || VENDOR_NOTIFICATIONS_FEED_HREF,
      };
  }
}

function dedupeKey(n: VendorNotification): string {
  const scope = n.assignmentId ?? n.eventId ?? n.id;
  return `${n.type}:${scope}`;
}

export function vendorNotificationsToBriefingItems(
  notifications: VendorNotification[],
): BriefingItem[] {
  const attention = notifications.filter(
    (n) => !n.readAt && !HOME_COVERED.has(n.type),
  );
  if (attention.length === 0) return [];

  // Merge indistinguishable same-type alerts for one event into a single row.
  const groups = new Map<string, VendorNotification[]>();
  for (const n of attention) {
    const key = dedupeKey(n);
    const list = groups.get(key) ?? [];
    list.push(n);
    groups.set(key, list);
  }

  const grouped = [...groups.values()];
  const pick = grouped.slice(0, 3);
  const items: BriefingItem[] = pick.map((group) => {
    const newest = group[0]!;
    const copy = notificationCopy(newest);
    const extra = group.length - 1;
    return {
      id: `notif-${newest.id}`,
      eventId: newest.eventId,
      eventName: copy.eventName,
      eventDate: newest.createdAt.slice(0, 10),
      label: copy.label,
      detail: extra > 0 ? `${copy.detail} (${group.length} unread)` : copy.detail,
      link: copy.link,
    };
  });

  const remaining = grouped.slice(3).reduce((sum, g) => sum + g.length, 0);
  if (remaining > 0) {
    items.push({
      id: "notif-unread-more",
      eventId: null,
      eventName: null,
      eventDate: null,
      label: "Recent alerts",
      detail:
        remaining === 1
          ? "1 more unread alert in your notification feed"
          : `${remaining} more unread alerts in your notification feed`,
      link: VENDOR_NOTIFICATIONS_FEED_HREF,
    });
  }

  return items;
}
