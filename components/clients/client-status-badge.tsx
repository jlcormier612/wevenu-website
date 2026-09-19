import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/lib/clients/types";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  return <Badge variant="default">Booked</Badge>;
}
