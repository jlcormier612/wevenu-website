import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { EventStatus } from "@/lib/events/types";

/**
 * Customer-facing event state is Booked or Cancelled.
 * Draft / In Progress / Complete are not a planning lifecycle.
 */
export function EventStatusBadge({
  status,
  bookedAt,
}: {
  status: EventStatus;
  bookedAt?: string | null;
}) {
  if (status === "cancelled") {
    return <Badge variant={"destructive" satisfies BadgeVariant}>Cancelled</Badge>;
  }
  if (bookedAt) {
    return <Badge variant={"default" satisfies BadgeVariant}>Booked</Badge>;
  }
  return null;
}
