/**
 * Display helpers for Business & Brand → Owners.
 * Clarity only — does not mutate membership, ownership, or invitations.
 */
import { ACCESS_TITLE_LABELS } from "@/lib/authorization/access-copy";
import type { AccessTitle } from "@/lib/authorization/types";
import type { StaffMember } from "@/lib/team/types";

export type OwnerStatusLabel = {
  line: string;
  isYou: boolean;
};

export function ownerStatusLabel(
  owner: Pick<StaffMember, "id" | "acceptedAt" | "ownerInvitePending" | "isOwner">,
  actorStaffId: string | null,
): OwnerStatusLabel {
  if (owner.acceptedAt) {
    const isYou = !!actorStaffId && owner.id === actorStaffId;
    return { line: isYou ? "You · Owner" : "Owner", isYou };
  }
  if (owner.ownerInvitePending) {
    return { line: "Invitation sent", isYou: false };
  }
  if (owner.isOwner) {
    return { line: "Owner access not yet invited", isYou: false };
  }
  return { line: "Owner", isYou: false };
}

export type ActorOwnersClarity = {
  staffId: string;
  name: string;
  accessTitle: AccessTitle | string;
  isOwner: boolean;
};

/** Role line for the current user when they are not an owner on this venue. */
export function currentActorNonOwnerLabel(accessTitle: AccessTitle | string): string {
  const key = accessTitle as AccessTitle;
  const label = ACCESS_TITLE_LABELS[key] ?? "Team member";
  return `You · ${label}`;
}

export function shouldShowCurrentActorOutsideOwnersList(
  actor: ActorOwnersClarity | null | undefined,
  listedOwnerIds: ReadonlySet<string>,
): actor is ActorOwnersClarity {
  if (!actor?.staffId) return false;
  if (actor.isOwner) return false;
  return !listedOwnerIds.has(actor.staffId);
}
