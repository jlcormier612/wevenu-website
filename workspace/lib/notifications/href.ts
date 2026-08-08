import { typeLabel } from "@/components/relationships/support-preview";
import type { Notification } from "@/lib/types";

const SUPPORT_TYPES = new Set([
  "support_request_submitted",
  "feedback_received",
]);

export function isSupportNotification(n: Notification): boolean {
  return (
    SUPPORT_TYPES.has(n.type) ||
    n.meta?.panel === "support" ||
    Boolean(n.meta?.feedback_item_id) ||
    Boolean(n.meta?.support_inbox_item_id)
  );
}

/** Build deep-link from notification meta (prefer over stored href). */
export function notificationHref(n: Notification): string {
  const inboxId = n.meta?.support_inbox_item_id?.trim();
  if (inboxId) {
    return `/support?item=${encodeURIComponent(inboxId)}`;
  }

  if (isSupportNotification(n)) {
    const params = new URLSearchParams({ panel: "support" });
    const itemId = n.meta?.feedback_item_id?.trim();
    if (itemId) params.set("item", itemId);
    return `/relationships/${n.relationshipId}?${params.toString()}`;
  }

  return `/relationships/${n.relationshipId}`;
}

/** Short destination cue for notification rows. */
export function notificationDestinationLabel(
  n: Notification,
  venueName?: string | null,
): string {
  const type = n.meta?.feedback_type
    ? typeLabel(String(n.meta.feedback_type))
    : null;
  const venue = n.meta?.venue_name?.trim() || venueName?.trim() || null;

  if (n.meta?.support_inbox_item_id) {
    const surface =
      n.meta.surface === "client"
        ? "Client"
        : n.meta.surface === "vendor"
          ? "Vendor"
          : "Partner";
    const bits = [surface, type].filter(Boolean);
    return bits.length > 0
      ? `Open ${bits.join(" · ")} →`
      : "Open in Support inbox →";
  }

  if (isSupportNotification(n)) {
    const bits = [type || "feedback", venue].filter(Boolean);
    return bits.length > 0
      ? `Open ${bits.join(" · ")} →`
      : "Open feedback →";
  }

  return venue ? `View ${venue} →` : "Open →";
}
