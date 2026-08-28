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

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? "outline"}>
      {statusLabel(status)}
    </Badge>
  );
}
