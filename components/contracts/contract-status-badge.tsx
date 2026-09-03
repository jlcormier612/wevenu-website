import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { Contract, ContractStatus } from "@/lib/contracts/types";

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

export function ContractStatusBadge({
  status,
  executionOrigin,
}: {
  status: ContractStatus;
  executionOrigin?: Contract["executionOrigin"];
}) {
  const label = status === "signed" && executionOrigin === "external"
    ? "Signed outside HTC"
    : STATUS_LABEL[status];
  return (
    <Badge variant={STATUS_VARIANT[status]}>
      {label}
    </Badge>
  );
}
