import { Badge } from "@/components/ui/badge";
import type { ClientListRowKind } from "@/lib/clients/list-filters";
import type { ClientStatus } from "@/lib/clients/types";

export type ClientStatusBadgeKind = "booked" | "past" | "cancelled" | "contact";

/**
 * Presentation for relationship status chips.
 *
 * Authoritative Booked membership is `leads.sales_stage = 'booked'` (see
 * classifyBookedMembership). Do not infer Booked from clients.status alone.
 */
export function clientStatusBadgeKind(input: {
  clientStatus: ClientStatus | string | null | undefined;
  membershipKind?: "current" | "past" | null;
}): ClientStatusBadgeKind {
  if (input.clientStatus === "cancelled") return "cancelled";
  if (input.membershipKind === "past") return "past";
  if (input.membershipKind === "current") return "booked";
  return "contact";
}

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

export function ClientStatusBadge({
  status,
  membershipKind = null,
}: {
  status: ClientStatus;
  /** Authoritative booked membership from classifyBookedMembership; required for Booked label. */
  membershipKind?: "current" | "past" | null;
}) {
  const kind = clientStatusBadgeKind({ clientStatus: status, membershipKind });
  if (kind === "cancelled") {
    return <Badge variant="destructive">Cancelled</Badge>;
  }
  if (kind === "past") {
    return <Badge variant="outline">Past</Badge>;
  }
  if (kind === "booked") {
    /* Eucalyptus chip — dark text on soft botanical wash (not green text). */
    return <Badge variant="accent">Booked</Badge>;
  }
  return <Badge variant="outline">Contact</Badge>;
}
