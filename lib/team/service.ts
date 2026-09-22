/**
 * Team management service. Server-only.
 * Authorization: Wave 1 access title + is_owner + capability_overrides.
 */
import {
  assertCanManageMember,
  coerceAccessTitle,
  coerceBasisTitle,
  getActiveTeamActor,
  getActiveVenueMembership,
  hasCapability,
  overridesAfterTitleChange,
  requireCapability,
  requireOwner,
  rowToMembershipAccess,
  type AccessTitle,
  type BasisTitle,
  type CapabilityOverrides,
} from "@/lib/authorization";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { sendEmail } from "@/lib/email/send";
import {
  buildOwnerInviteHtml,
  buildOwnerInviteText,
  buildTeamInviteHtml,
  buildTeamInviteText,
} from "@/lib/email/team-invite";
import { recordEngagementEvent } from "@/lib/activation/service";
import type {
  StaffAccessUpdate,
  StaffInviteInput,
  StaffMember,
  StaffRole,
  TeamActionResult,
} from "./types";

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | TeamActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };
  return fn(supabase, venue.id);
}

function parseOverrides(raw: unknown): CapabilityOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CapabilityOverrides = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") {
      (out as Record<string, boolean>)[k] = v;
    }
  }
  return out;
}

function rowToStaffMember(row: Record<string, unknown>): StaffMember {
  const accessTitle = coerceAccessTitle(
    (row.access_title as string | null) ?? (row.role as string | null),
  );
  const titleBasis = row.title_basis
    ? coerceBasisTitle(accessTitle, String(row.title_basis))
    : accessTitle === "custom"
      ? null
      : (accessTitle as BasisTitle);
  return {
    id: row.id as string,
    venueId: row.venue_id as string,
    userId: row.user_id as string | null,
    role: row.role as StaffRole,
    name: row.full_name as string,
    email: row.email as string | null,
    jobTitle: (row.title as string | null) ?? null,
    isOwner: Boolean(row.is_owner),
    isActive: Boolean(row.is_active),
    accessTitle,
    titleBasis,
    capabilityOverrides: parseOverrides(row.capability_overrides),
    ownerInvitePending: Boolean(row.owner_invite_pending),
    inviteToken: row.invite_token as string | null,
    invitedAt: row.invited_at as string | null,
    acceptedAt: row.accepted_at as string | null,
    lastActiveAt: (row.last_active_at ?? null) as string | null,
    createdAt: row.created_at as string,
  };
}

const STAFF_SELECT =
  "id, venue_id, user_id, role, full_name, email, title, is_owner, is_active, access_title, title_basis, capability_overrides, owner_invite_pending, invite_token, invited_at, accepted_at, last_active_at, created_at";

export async function getCurrentStaffMember(venueId: string): Promise<StaffMember | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("venue_staff")
    .select(STAFF_SELECT)
    .eq("venue_id", venueId)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  return data ? rowToStaffMember(data as Record<string, unknown>) : null;
}

export async function getTeamMembers(venueId: string): Promise<StaffMember[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_staff")
    .select(STAFF_SELECT)
    .eq("venue_id", venueId)
    .eq("is_active", true)
    .order("is_owner", { ascending: false })
    .order("full_name");
  return (data ?? []).map((row) => rowToStaffMember(row as Record<string, unknown>));
}

export async function inviteStaffMember(input: StaffInviteInput): Promise<TeamActionResult> {
  return withVenue(async (supabase, venueId) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Session expired." };

    const actor = await getActiveTeamActor();
    if (!actor) return { ok: false, error: "Session expired." };

    const designateOwner = input.isOwner === true;
    if (designateOwner) {
      const ownerGate = await requireOwner("Only an Owner can invite another Owner.");
      if (!ownerGate.ok) return { ok: false, error: ownerGate.error };
    } else {
      const inviteGate = await requireCapability(
        "team.invite",
        "You do not have permission to invite team members.",
      );
      if (!inviteGate.ok && !actor.isOwner) {
        return { ok: false, error: inviteGate.error };
      }
    }

    const accessTitle = input.accessTitle;
    const titleBasis =
      accessTitle === "custom"
        ? (input.titleBasis ?? "manager")
        : (input.titleBasis ?? (accessTitle as BasisTitle));
    const overrides = input.capabilityOverrides ?? {};

    const scope = assertCanManageMember(actor, {
      accessTitle,
      titleBasis,
      overrides,
      isOwner: designateOwner,
    });
    if (!scope.ok) return { ok: false, error: scope.message };

    const { data, error } = await supabase
      .from("venue_staff")
      .insert({
        venue_id: venueId,
        user_id: null,
        full_name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        title: input.jobTitle?.trim() || null,
        is_owner: false,
        is_active: true,
        invited_by: user.id,
        invited_at: new Date().toISOString(),
        access_title: accessTitle,
        title_basis: titleBasis,
        capability_overrides: overrides,
        owner_invite_pending: designateOwner,
      })
      .select(STAFF_SELECT)
      .single();

    if (error) return { ok: false, error: error.message };

    const staff = rowToStaffMember(data as Record<string, unknown>);

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const acceptUrl = `${appUrl}/join?token=${staff.inviteToken}`;

    const { data: venue } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();
    const venueName = venue?.name ?? "Your venue";

    const actorMembership = await getActiveVenueMembership();
    const adminName = actorMembership?.fullName ?? "Your team";

    if (designateOwner) {
      await sendEmail({
        to: input.email,
        subject: `You're invited as an Owner of ${venueName} on Hello to Cheers`,
        text: buildOwnerInviteText({
          memberName: input.name,
          venueName,
          acceptUrl,
          administratorName: adminName,
        }),
        html: buildOwnerInviteHtml({
          memberName: input.name,
          venueName,
          acceptUrl,
          administratorName: adminName,
        }),
      });
    } else {
      await sendEmail({
        to: input.email,
        subject: `You're invited to join ${venueName} on Hello to Cheers`,
        text: buildTeamInviteText({
          memberName: input.name,
          venueName,
          acceptUrl,
          accessTitleLabel: accessTitle,
        }),
        html: buildTeamInviteHtml({
          memberName: input.name,
          venueName,
          acceptUrl,
          accessTitleLabel: accessTitle,
        }),
      });
    }

    void recordEngagementEvent({
      venueId,
      eventType: designateOwner ? "team.owner_invited" : "team.member_invited",
      actorType: "venue_user",
      actorId: user.id,
      entityType: "venue_staff",
      entityId: staff.id,
    });

    return { ok: true, staffId: staff.id };
  }) as Promise<TeamActionResult>;
}

export async function acceptTeamInvitation(
  token: string,
): Promise<{ ok: boolean; venueId?: string; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_team_invitation", { p_token: token });
  if (error) return { ok: false };
  if (!data?.ok) return { ok: false, error: data?.error };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  void recordEngagementEvent({
    venueId: data.venueId,
    eventType: "team.member_accepted",
    actorType: "team_member",
    actorId: user?.id,
  });

  return { ok: true, venueId: data.venueId };
}

export async function removeStaffMember(staffId: string): Promise<TeamActionResult> {
  return withVenue(async (supabase) => {
    const actor = await getActiveTeamActor();
    if (!actor) return { ok: false, error: "Session expired." };

    const { data: target } = await supabase
      .from("venue_staff")
      .select(STAFF_SELECT)
      .eq("id", staffId)
      .maybeSingle();
    if (!target) return { ok: false, error: "Team member not found." };

    const targetMember = rowToStaffMember(target as Record<string, unknown>);

    if (targetMember.isOwner) {
      const ownerGate = await requireOwner("Only an Owner can remove another Owner.");
      if (!ownerGate.ok) return { ok: false, error: ownerGate.error };
    } else {
      const removeGate = await requireCapability(
        "team.remove",
        "You do not have permission to remove team members.",
      );
      if (!removeGate.ok && !actor.isOwner) {
        return { ok: false, error: removeGate.error };
      }
      const scope = assertCanManageMember(actor, {
        accessTitle: targetMember.accessTitle,
        titleBasis: targetMember.titleBasis,
        overrides: targetMember.capabilityOverrides,
        isOwner: false,
      });
      if (!scope.ok) return { ok: false, error: scope.message };
    }

    const { data, error } = await supabase
      .from("venue_staff")
      .update({ is_active: false, owner_invite_pending: false })
      .eq("id", staffId)
      .select("id");
    if (error) {
      if (error.message.includes("last_owner") || error.message.includes("P0001")) {
        return {
          ok: false,
          error: "This venue must keep at least one Owner. Add another Owner first, or transfer ownership.",
        };
      }
      return { ok: false, error: error.message };
    }
    if (!data || data.length === 0) {
      return { ok: false, error: "This team member couldn't be removed — the change wasn't permitted." };
    }
    return { ok: true };
  }) as Promise<TeamActionResult>;
}

export async function updateStaffAccess(
  staffId: string,
  update: StaffAccessUpdate,
): Promise<TeamActionResult> {
  return withVenue(async (supabase) => {
    const actor = await getActiveTeamActor();
    if (!actor) return { ok: false, error: "Session expired." };

    const { data: target } = await supabase
      .from("venue_staff")
      .select(STAFF_SELECT)
      .eq("id", staffId)
      .maybeSingle();
    if (!target) return { ok: false, error: "Team member not found." };

    const current = rowToStaffMember(target as Record<string, unknown>);
    const nextIsOwner = update.isOwner !== undefined ? update.isOwner : current.isOwner;

    if (nextIsOwner !== current.isOwner) {
      const ownerGate = await requireOwner("Only an Owner can change ownership.");
      if (!ownerGate.ok) return { ok: false, error: ownerGate.error };
    } else if (!actor.isOwner) {
      const changeGate = await requireCapability(
        "team.change_access",
        "You do not have permission to change team access.",
      );
      if (!changeGate.ok) return { ok: false, error: changeGate.error };
    }

    let nextOverrides = update.capabilityOverrides;
    if (update.accessTitle !== current.accessTitle) {
      nextOverrides = overridesAfterTitleChange(
        current.accessTitle,
        update.accessTitle,
        current.capabilityOverrides,
      );
      // Preserve explicit billing grant across title change only when still grantable
      // (title-change resets overrides per Wave 1 — do not silently keep overrides).
      if (update.capabilityOverrides) {
        nextOverrides = update.capabilityOverrides;
      }
    } else if (nextOverrides === undefined) {
      nextOverrides = current.capabilityOverrides;
    }

    const titleBasis =
      update.accessTitle === "custom"
        ? (update.titleBasis ?? current.titleBasis ?? "manager")
        : (update.titleBasis ?? (update.accessTitle as BasisTitle));

    const scope = assertCanManageMember(actor, {
      accessTitle: update.accessTitle,
      titleBasis,
      overrides: nextOverrides ?? {},
      isOwner: nextIsOwner,
    });
    if (!scope.ok) return { ok: false, error: scope.message };

    const patch: Record<string, unknown> = {
      access_title: update.accessTitle,
      title_basis: titleBasis,
      capability_overrides: nextOverrides ?? {},
    };
    if (update.jobTitle !== undefined) {
      patch.title = update.jobTitle?.trim() || null;
    }
    if (update.isOwner !== undefined) {
      patch.is_owner = update.isOwner;
      if (update.isOwner) {
        patch.owner_invite_pending = false;
      }
    }

    const { data, error } = await supabase
      .from("venue_staff")
      .update(patch)
      .eq("id", staffId)
      .select("id");
    if (error) {
      if (error.message.includes("last_owner") || error.message.includes("ownership_only")) {
        return { ok: false, error: error.message };
      }
      return { ok: false, error: error.message };
    }
    if (!data || data.length === 0) {
      return { ok: false, error: "This access change couldn't be made — it wasn't permitted." };
    }
    return { ok: true };
  }) as Promise<TeamActionResult>;
}

/**
 * @deprecated Use updateStaffAccess. Maps legacy role labels without touching ownership.
 */
export async function updateStaffRole(
  staffId: string,
  role: StaffRole,
): Promise<TeamActionResult> {
  if (role === "owner") {
    return updateStaffAccess(staffId, {
      accessTitle: "administrator",
      titleBasis: "administrator",
      isOwner: true,
      capabilityOverrides: {},
    });
  }
  const map: Record<Exclude<StaffRole, "owner">, AccessTitle> = {
    manager: "manager",
    coordinator: "coordinator",
    staff: "staff",
  };
  return updateStaffAccess(staffId, {
    accessTitle: map[role],
    titleBasis: map[role] as BasisTitle,
    capabilityOverrides: {},
  });
}

export async function transferVenueOwnership(
  fromStaffId: string,
  toStaffId: string,
): Promise<TeamActionResult> {
  const ownerGate = await requireOwner("Only an Owner can transfer ownership.");
  if (!ownerGate.ok) return { ok: false, error: ownerGate.error };
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_venue_ownership", {
    p_from_staff_id: fromStaffId,
    p_to_staff_id: toStaffId,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export function memberHasBilling(member: StaffMember): boolean {
  return hasCapability(
    {
      isActive: true,
      isOwner: member.isOwner,
      accessTitle: member.accessTitle,
      titleBasis: member.titleBasis,
      overrides: member.capabilityOverrides,
    },
    "account.billing",
  );
}

export { rowToMembershipAccess };
