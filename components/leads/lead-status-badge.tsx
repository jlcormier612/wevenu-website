import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { statusLabel } from "@/lib/leads/constants";
import type { LeadStatus } from "@/lib/leads/types";

const STATUS_VARIANT: Record<LeadStatus, BadgeVariant> = {
  new_inquiry: "accent",
  outreach_sent: "muted",
  enrolled_in_sequence: "default",
  tour_scheduled: "default",
  proposal_sent: "secondary",
  booked: "success",
  lost: "destructive",
};

/** Quiet positive lifecycle chips use eucalyptus Active treatment. */
const EUCALYPTUS_STATUSES = new Set<LeadStatus>(["tour_scheduled", "booked", "enrolled_in_sequence"]);

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "outline"}
      className={EUCALYPTUS_STATUSES.has(status) ? "htc-badge-active" : undefined}
    >
      {statusLabel(status)}
    </Badge>
  );
}
