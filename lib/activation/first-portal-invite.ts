/**
 * Venue onboarding: has this venue sent at least one portal invitation?
 *
 * Authoritative evidence = client_invitations.status in (pending, accepted)
 * for a booked client of this venue. Not engagement stamps, not sessions,
 * and not portal-open or three-couples activation timestamps.
 */
import type { ActivationChecklistItem } from "@/lib/activation/types";

export const FIRST_PORTAL_INVITE_KEY = "first_portal_invite" as const;

export type FirstPortalInviteInvitation = {
  clientId: string;
  venueId: string;
  status: string;
};

export function invitationQualifiesAsSent(status: string): boolean {
  return status === "pending" || status === "accepted";
}

/**
 * True when at least one booked client of this venue has a pending or accepted
 * invitation. Sessions and other-venue rows never satisfy this.
 */
export function isFirstPortalInviteComplete(args: {
  venueId: string;
  bookedClientIds: ReadonlySet<string> | readonly string[];
  invitations: readonly FirstPortalInviteInvitation[];
}): boolean {
  const booked = args.bookedClientIds instanceof Set
    ? args.bookedClientIds
    : new Set(args.bookedClientIds);
  for (const inv of args.invitations) {
    if (inv.venueId !== args.venueId) continue;
    if (!booked.has(inv.clientId)) continue;
    if (invitationQualifiesAsSent(inv.status)) return true;
  }
  return false;
}

/** Overlay checklist so Luv uses invitation rows, not first_portal_invite_sent_at. */
export function applyFirstPortalInviteToChecklist(
  checklist: readonly ActivationChecklistItem[],
  complete: boolean,
): ActivationChecklistItem[] {
  return checklist.map((item) => {
    if (item.key !== FIRST_PORTAL_INVITE_KEY) return item;
    return { ...item, completed: complete };
  });
}
