import { Badge } from "@/components/ui/badge";
import type { ClientListRowKind } from "@/lib/clients/list-filters";
import type { ClientStatus } from "@/lib/clients/types";

export function ClientListStatusBadge({ kind }: { kind: ClientListRowKind }) {
  if (kind === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  if (kind === "past") {
    return <Badge variant="outline">Past</Badge>;
  }
  if (kind === "contact") {
    return <Badge variant="outline">Contact</Badge>;
  }
  return <Badge variant="accent">Booked</Badge>;
}

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  if (status === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  /* Eucalyptus chip — dark text on soft botanical wash (not green text). */
  return <Badge variant="accent">Booked</Badge>;
}
