import { Badge } from "@/components/ui/badge";
import type { ClientStatus } from "@/lib/clients/types";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  /* Eucalyptus chip — dark text on soft botanical wash (not green text). */
  return <Badge variant="accent">Booked</Badge>;
}
