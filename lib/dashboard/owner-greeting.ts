/**
 * Resolve the Dashboard greeting first name from venue_staff owner rows.
 * Uses the same multi-owner preference as message coordinator selection:
 * accepted/linked owners beat pending owner invitations.
 */
import { pickOwnerStaffForCoordinator } from "@/lib/scheduled-messages/coordinator-display";

export type DashboardOwnerStaffRow = {
  full_name: string | null;
  title?: string | null;
  accepted_at?: string | null;
  owner_invite_pending?: boolean | null;
  user_id?: string | null;
};

export function resolveDashboardOwnerFirstName(
  rows: DashboardOwnerStaffRow[] | null | undefined,
): string | null {
  if (!rows?.length) return null;
  const preferred = pickOwnerStaffForCoordinator(
    rows.map((r) => ({
      full_name: r.full_name?.trim() || "",
      title: r.title ?? null,
      accepted_at: r.accepted_at,
      owner_invite_pending: r.owner_invite_pending,
      user_id: r.user_id,
    })).filter((r) => r.full_name.length > 0),
  );
  const fullName = preferred?.full_name?.trim();
  if (!fullName) return null;
  const first = fullName.split(/\s+/)[0];
  return first || null;
}
