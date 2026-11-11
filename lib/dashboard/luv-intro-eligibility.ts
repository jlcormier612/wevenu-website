/**
 * Dashboard setup-guidance prompt eligibility.
 *
 * Owner-declared ready_to_invite_couples suppresses the Dashboard Luv intro
 * ("Let's finish setting up your venue"). It does not gate the workspace.
 */

export function shouldShowDashboardLuvIntro(input: {
  readyToInviteCouples: boolean;
  luvIntroSeenAt: string | null | undefined;
  activationPhase: string | null | undefined;
  venueCreatedAt: string;
  nowMs?: number;
}): boolean {
  // Authoritative readiness declaration stops setup guidance.
  if (input.readyToInviteCouples) return false;
  if (input.luvIntroSeenAt) return false;
  const now = input.nowMs ?? Date.now();
  return (
    input.activationPhase === "setup" ||
    now - new Date(input.venueCreatedAt).getTime() < 14 * 86_400_000
  );
}

/** Setup-gap Luv nudges are setup guidance; suppress when the owner declared ready. */
export function shouldIncludeDashboardSetupGapObservations(
  readyToInviteCouples: boolean,
): boolean {
  return !readyToInviteCouples;
}
