/**
 * Venue onboarding milestone: 3 unique booked couples have opened their portal.
 *
 * Active = client_portal_sessions.last_accessed_at is set at least once.
 * Not invitation sent/accepted, not "recent", not currently logged in.
 */
import type { ActivationChecklistItem } from "@/lib/activation/types";
import type { ClientInvitationStatus } from "@/lib/client-auth/types";

export const THREE_COUPLES_PORTAL_KEY = "three_couples_active" as const;
export const THREE_COUPLES_PORTAL_TARGET = 3 as const;

/** Deep-link Clients handoff for this activation workflow (not a sticky list pill). */
export const PORTAL_ACTIVATION_CLIENTS_HREF = "/clients?filter=portal_activation" as const;

export type PortalActivationState = "not_invited" | "invited_not_opened" | "opened";

export function clientHasOpenedPortal(lastAccessedAt: string | null | undefined): boolean {
  return Boolean(lastAccessedAt);
}

/**
 * Count unique booked clients who have opened their portal at least once.
 * Sessions for non-booked clients are ignored. Repeat opens do not multiply.
 */
export function countUniqueBookedPortalOpens(args: {
  bookedClientIds: ReadonlySet<string> | readonly string[];
  /** client_id → last_accessed_at (null/undefined = never opened). */
  lastAccessedByClientId: ReadonlyMap<string, string | null | undefined>;
}): number {
  const booked = args.bookedClientIds instanceof Set
    ? args.bookedClientIds
    : new Set(args.bookedClientIds);
  let count = 0;
  for (const clientId of booked) {
    if (clientHasOpenedPortal(args.lastAccessedByClientId.get(clientId) ?? null)) {
      count += 1;
    }
  }
  return count;
}

export function isThreeCouplesPortalMilestoneComplete(uniqueOpenedCount: number): boolean {
  return uniqueOpenedCount >= THREE_COUPLES_PORTAL_TARGET;
}

export function portalActivationState(args: {
  lastAccessedAt: string | null | undefined;
  invitationStatus: ClientInvitationStatus | null | undefined;
}): PortalActivationState {
  if (clientHasOpenedPortal(args.lastAccessedAt)) return "opened";
  if (args.invitationStatus === "pending" || args.invitationStatus === "accepted") {
    return "invited_not_opened";
  }
  return "not_invited";
}

export function portalActivationStateLabel(state: PortalActivationState): string {
  switch (state) {
    case "opened":
      return "Opened";
    case "invited_not_opened":
      return "Invited — not opened";
    case "not_invited":
      return "Not invited";
  }
}

/** Overlay checklist so Luv/Getting Started use the locked portal-open definition. */
export function applyPortalOpenMilestoneToChecklist(
  checklist: readonly ActivationChecklistItem[],
  complete: boolean,
): ActivationChecklistItem[] {
  return checklist.map((item) => {
    if (item.key !== THREE_COUPLES_PORTAL_KEY) return item;
    return {
      ...item,
      completed: complete,
      href: PORTAL_ACTIVATION_CLIENTS_HREF,
    };
  });
}
