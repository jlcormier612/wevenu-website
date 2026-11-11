/**
 * first_team_login copy claims an invited teammate has not logged in yet.
 * Without invitation evidence, that gap must not surface.
 */
import type { ActivationChecklistItem } from "@/lib/activation/types";

export const FIRST_TEAM_LOGIN_KEY = "first_team_login" as const;
export const FIRST_TEAM_INVITE_KEY = "first_team_invite" as const;

/**
 * Incomplete only when a team invite has been recorded and no first
 * non-owner login stamp exists. Uses the checklist's first_team_invite
 * completion (stamp-backed today) as the invite prerequisite.
 */
export function applyFirstTeamLoginPrerequisite(
  checklist: readonly ActivationChecklistItem[],
): ActivationChecklistItem[] {
  const inviteSent =
    checklist.find((item) => item.key === FIRST_TEAM_INVITE_KEY)?.completed === true;
  if (inviteSent) return checklist as ActivationChecklistItem[];
  return checklist.map((item) => {
    if (item.key !== FIRST_TEAM_LOGIN_KEY) return item;
    return { ...item, completed: true };
  });
}
