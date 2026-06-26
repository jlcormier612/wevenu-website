import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { eventStatusLabel } from "@/lib/events/constants";
import type { EventStatus } from "@/lib/events/types";

const STATUS_VARIANT: Record<EventStatus, BadgeVariant> = {
  draft:       "muted",
  confirmed:   "default",
  in_progress: "accent",
  complete:    "success",
  cancelled:   "destructive",
};

export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{eventStatusLabel(status)}</Badge>;
}
