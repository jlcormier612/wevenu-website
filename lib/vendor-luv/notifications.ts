/**
 * Map vendor_notifications → VendorLuvExtras.notifications.
 *
 * Light touch only: assignment / document alerts that aren't already covered
 * by vendor-home message/task observations, plus an unread rollup that deep-
 * links into the bell feed. Not a duplicate notification center.
 */
import type { BriefingItem } from "@/lib/luv/briefing-types";
import type { VendorNotification } from "@/lib/vendor-notifications/types";

const LABEL: Record<string, string> = {
  assigned_to_event: "New assignment",
  document_shared: "Shared with you",
};

/** Types already observed from VendorHomeData — skip here. */
const HOME_COVERED = new Set(["new_message", "new_task"]);

export const VENDOR_NOTIFICATIONS_FEED_HREF = "/vendor/dashboard?notifications=1";

export function vendorNotificationsToBriefingItems(
  notifications: VendorNotification[],
): BriefingItem[] {
  const attention = notifications.filter(
    (n) => !n.readAt && !HOME_COVERED.has(n.type),
  );
  if (attention.length === 0) return [];

  const pick = attention.slice(0, 3);
  const items: BriefingItem[] = pick.map((n) => ({
    id: `notif-${n.id}`,
    eventId: n.eventId,
    eventName: null,
    eventDate: n.createdAt.slice(0, 10),
    label: LABEL[n.type] ?? "Alert",
    detail: (n.body?.trim() || n.title).slice(0, 140),
    link: n.link || VENDOR_NOTIFICATIONS_FEED_HREF,
  }));

  const more = attention.length - pick.length;
  if (more > 0) {
    items.push({
      id: "notif-unread-more",
      eventId: null,
      eventName: null,
      eventDate: null,
      label: "Recent alerts",
      detail:
        more === 1
          ? "1 more unread alert in your notification feed"
          : `${more} more unread alerts in your notification feed`,
      link: VENDOR_NOTIFICATIONS_FEED_HREF,
    });
  }

  return items;
}
