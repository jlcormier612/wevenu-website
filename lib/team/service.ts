/**
 * Team management service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue, getCurrentUserRole } from "@/lib/venue/service";
import { sendEmail } from "@/lib/email/send";
import { buildTeamInviteHtml, buildTeamInviteText } from "@/lib/email/team-invite";
import { recordEngagementEvent } from "@/lib/activation/service";
import type { StaffMember, StaffInput, TeamActionResult, StaffRole } from "./types";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | TeamActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };
  return fn(supabase, venue.id);
}

function rowToStaffMember(row: Record<string, unknown>): StaffMember {
  return {
    id:           row.id as string,
    venueId:      row.venue_id as string,
    userId:       row.user_id as string | null,
    role:         row.role as StaffRole,
    name:         row.full_name as string,
    email:        row.email as string | null,
    isOwner:      row.is_owner as boolean,
    isActive:     row.is_active as boolean,
    inviteToken:  row.invite_token as string | null,
    invitedAt:    row.invited_at as string | null,
    acceptedAt:   row.accepted_at as string | null,
    lastActiveAt: (row.last_active_at ?? null) as string | null,
    createdAt:    row.created_at as string,
  };
}

/**
 * TR-G1: team/role management is Owner-only, except a Manager may invite,
 * remove, or re-role Staff/Coordinator members — never another Manager or
 * the Owner. `targetCurrentRole` is the role the target row has today (pass
 * null when inviting a brand-new member); `targetNewRole` is the role being
 * assigned. RLS enforces the same rule as a backstop — this just gives a
 * clear message instead of a raw policy-violation error.
 */
function canManageStaff(
  actingRole: string | null,
  targetNewRole: StaffRole,
  targetCurrentRole: StaffRole | null = null,
): boolean {
  if (actingRole === "owner") return true;
  if (actingRole === "manager") {
    const currentOk = targetCurrentRole === null || targetCurrentRole === "staff" || targetCurrentRole === "coordinator";
    const newOk = targetNewRole === "staff" || targetNewRole === "coordinator";
    return currentOk && newOk;
  }
  return false;
}

/**
 * The logged-in user's own venue_staff row — the prerequisite every "My —"
 * view needs and, until now, nothing in the codebase resolved (confirmed
 * absent during the Calendar Experience Completion audit; Planning
 * Execution's own "My Tasks" is the first real consumer). Reuses the exact
 * `venue_staff.user_id = auth.uid()` relationship `current_user_role()`
 * already reads at the SQL layer — identity resolution, not a new
 * permission or ownership concept. Owners have a real venue_staff row too
 * (role='owner', is_owner=true, user_id = venues.owner_user_id — confirmed
 * directly against live data), so one query covers every role.
 */
export async function getCurrentStaffMember(venueId: string): Promise<StaffMember | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("venue_staff")
    .select("*")
    .eq("venue_id", venueId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return data ? rowToStaffMember(data) : null;
}

export async function getTeamMembers(venueId: string): Promise<StaffMember[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_staff")
    .select("*")
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("is_owner", { ascending: false })
    .order("role")
    .order("full_name");
  return (data ?? []).map(rowToStaffMember);
}

export async function inviteStaffMember(input: StaffInput): Promise<TeamActionResult> {
  return withVenue(async (supabase, venueId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Session expired." };

    const actingRole = await getCurrentUserRole();
    if (!canManageStaff(actingRole, input.role)) {
      return { ok: false, error: "Only an Owner can invite a Manager. Managers can invite Staff or Coordinator members." };
    }

    // Create pending venue_staff row with invite_token
    const { data, error } = await supabase
      .from("venue_staff")
      .insert({
        venue_id:   venueId,
        user_id:    null,
        full_name:  input.name.trim(),
        email:      input.email.trim().toLowerCase(),
        role:       input.role,
        is_owner:   false,
        is_active:  true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) return { ok: false, error: error.message };

    const staff = rowToStaffMember(data);

    // Send invitation email
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const acceptUrl = `${appUrl}/join?token=${staff.inviteToken}`;

    // Fetch venue name for email
    const { data: venue } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();

    const venueName = venue?.name ?? "Your venue";

    await sendEmail({
      to:      input.email,
      subject: `You're invited to join ${venueName} on Wevenu`,
      text:    buildTeamInviteText({ memberName: input.name, venueName, acceptUrl }),
      html:    buildTeamInviteHtml({ memberName: input.name, venueName, acceptUrl }),
    });

    void recordEngagementEvent({
      venueId,
      eventType: "team.member_invited",
      actorType: "venue_user",
      actorId:   user.id,
      entityType: "venue_staff",
      entityId:   staff.id,
    });

    return { ok: true, staffId: staff.id };
  }) as Promise<TeamActionResult>;
}

export async function acceptTeamInvitation(
  token: string,
): Promise<{ ok: boolean; venueId?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("accept_team_invitation", { p_token: token });
  if (error || !data?.ok) return { ok: false };

  const { data: { user } } = await supabase.auth.getUser();
  void recordEngagementEvent({
    venueId:    data.venueId,
    eventType:  "team.member_accepted",
    actorType:  "team_member",
    actorId:    user?.id,
  });

  return { ok: true, venueId: data.venueId };
}

export async function removeStaffMember(staffId: string): Promise<TeamActionResult> {
  return withVenue(async (supabase) => {
    const actingRole = await getCurrentUserRole();
    const { data: target } = await supabase
      .from("venue_staff").select("role").eq("id", staffId).maybeSingle<{ role: StaffRole }>();
    if (!canManageStaff(actingRole, target?.role ?? "staff", target?.role ?? null)) {
      return { ok: false, error: "Only an Owner can remove a Manager. Managers can remove Staff or Coordinator members." };
    }
    // Soft delete — cannot remove owner
    const { error } = await supabase
      .from("venue_staff")
      .update({ is_active: false })
      .eq("id", staffId)
      .eq("is_owner", false);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }) as Promise<TeamActionResult>;
}

export async function updateStaffRole(
  staffId: string,
  role: StaffRole,
): Promise<TeamActionResult> {
  return withVenue(async (supabase) => {
    const actingRole = await getCurrentUserRole();
    const { data: target } = await supabase
      .from("venue_staff").select("role").eq("id", staffId).maybeSingle<{ role: StaffRole }>();
    if (!canManageStaff(actingRole, role, target?.role ?? null)) {
      return { ok: false, error: "Only an Owner can assign or change a Manager. Managers can only manage Staff/Coordinator roles." };
    }
    const { error } = await supabase
      .from("venue_staff")
      .update({ role })
      .eq("id", staffId)
      .eq("is_owner", false);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }) as Promise<TeamActionResult>;
}
