/**
 * Venue onboarding: has the first invited couple opened their portal?
 *
 * Eligibility for the incomplete gap requires authoritative invitation
 * evidence (pending|accepted for a booked client). Without that evidence,
 * the gap must not surface — its copy claims "You've sent the invite".
 *
 * Completion requires a booked client of this venue with
 * client_portal_sessions.last_accessed_at set at least once.
 */
import type { ActivationChecklistItem } from "@/lib/activation/types";
import { clientHasOpenedPortal } from "@/lib/activation/portal-open-milestone";

export const FIRST_PORTAL_OPEN_KEY = "first_portal_open" as const;

/**
 * True when at least one booked client of this venue has opened the portal.
 */
export function isFirstPortalOpenComplete(args: {
  bookedClientIds: ReadonlySet<string> | readonly string[];
  lastAccessedByClientId: ReadonlyMap<string, string | null | undefined>;
}): boolean {
  const booked = args.bookedClientIds instanceof Set
    ? args.bookedClientIds
    : new Set(args.bookedClientIds);
  for (const clientId of booked) {
    if (clientHasOpenedPortal(args.lastAccessedByClientId.get(clientId) ?? null)) {
      return true;
    }
  }
  return false;
}

/**
 * Incomplete gap only when an invitation was successfully sent and no
 * booked client has opened yet. Without invite evidence, mark completed so
 * the false "You've sent the invite" card cannot rank into Luv.
 */
export function applyFirstPortalOpenToChecklist(
  checklist: readonly ActivationChecklistItem[],
  args: { inviteSent: boolean; firstOpenComplete: boolean },
): ActivationChecklistItem[] {
  return checklist.map((item) => {
    if (item.key !== FIRST_PORTAL_OPEN_KEY) return item;
    const completed = !args.inviteSent || args.firstOpenComplete;
    return { ...item, completed };
  });
}

/**
 * three_couples_active is a later portal-engagement milestone. Without at
 * least one successful invite, do not push that later-stage gap.
 */
export function applyThreeCouplesPortalPrerequisite(
  checklist: readonly ActivationChecklistItem[],
  inviteSent: boolean,
): ActivationChecklistItem[] {
  if (inviteSent) return checklist as ActivationChecklistItem[];
  return checklist.map((item) => {
    if (item.key !== "three_couples_active") return item;
    return { ...item, completed: true };
  });
}
