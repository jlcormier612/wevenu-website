import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { ContractStatus } from "@/lib/contracts/types";

const STATUS_VARIANT: Record<ContractStatus, BadgeVariant> = {
  draft:     "muted",
  sent:      "default",
  signed:    "success",
  cancelled: "destructive",
  expired:   "warning",
};

const STATUS_LABEL: Record<ContractStatus, string> = {
  draft:     "Draft",
  sent:      "Sent",
  signed:    "Signed",
  cancelled: "Cancelled",
  expired:   "Expired",
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
