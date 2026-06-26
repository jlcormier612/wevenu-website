import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { statusLabel } from "@/lib/leads/constants";
import type { LeadStatus } from "@/lib/leads/types";

const STATUS_VARIANT: Record<LeadStatus, BadgeVariant> = {
  new:           "accent",
  contacted:     "muted",
  qualified:     "default",
  proposal_sent: "secondary",
  won:           "success",
  lost:          "destructive",
  cancelled:     "outline",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {statusLabel(status)}
    </Badge>
  );
}
