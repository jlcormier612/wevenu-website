import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { clientStatusLabel } from "@/lib/clients/constants";
import type { ClientStatus } from "@/lib/clients/types";

const STATUS_VARIANT: Record<ClientStatus, BadgeVariant> = {
  planning:  "muted",
  confirmed: "default",
  complete:  "success",
  cancelled: "destructive",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{clientStatusLabel(status)}</Badge>;
}
