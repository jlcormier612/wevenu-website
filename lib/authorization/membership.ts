/**
 * Load active-venue membership for capability checks (Wave 2 context).
 * Server-only — do not import from client components.
 */
import { cache } from "react";

import {
  hasCapability,
  isAccessTitle,
  isBasisTitle,
  resolveEffectiveAccess,
} from "@/lib/authorization/resolve";
import type {
  AccessTitle,
  BasisTitle,
  CapabilityKey,
  CapabilityOverrides,
  MembershipAccessInput,
  TeamActor,
} from "@/lib/authorization/types";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type VenueMembershipRow = MembershipAccessInput & {
  staffId: string;
  venueId: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  legacyRole: string;
  ownerInvitePending: boolean;
};

function parseOverrides(raw: unknown): CapabilityOverrides {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Partial<Record<CapabilityKey, boolean>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k as CapabilityKey] = v;
  }
  return out;
}

export function rowToMembershipAccess(row: Record<string, unknown>): MembershipAccessInput {
  const accessTitle = String(row.access_title ?? row.role ?? "staff");
  const titleBasisRaw = row.title_basis != null ? String(row.title_basis) : null;
  return {
    isActive: row.is_active !== false && row.accepted_at != null,
    isOwner: Boolean(row.is_owner),
    accessTitle,
    titleBasis: titleBasisRaw,
    overrides: parseOverrides(row.capability_overrides),
  };
}

/**
 * Current user's membership in the active venue (Wave 2). Cached per request.
 */
export const getActiveVenueMembership = cache(async (): Promise<VenueMembershipRow | null> => {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("venue_staff")
    .select(
      "id, venue_id, full_name, email, title, role, is_owner, is_active, accepted_at, access_title, title_basis, capability_overrides, owner_invite_pending",
    )
    .eq("venue_id", venue.id)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return null;
  const access = rowToMembershipAccess(data as Record<string, unknown>);
  return {
    ...access,
    staffId: data.id as string,
    venueId: data.venue_id as string,
    fullName: (data.full_name as string) ?? "",
    email: (data.email as string | null) ?? null,
    jobTitle: (data.title as string | null) ?? null,
    legacyRole: String(data.role ?? ""),
    ownerInvitePending: Boolean(data.owner_invite_pending),
  };
});

export async function getActiveTeamActor(): Promise<TeamActor | null> {
  const membership = await getActiveVenueMembership();
  if (!membership) return null;
  const resolved = resolveEffectiveAccess(membership);
  return {
    isOwner: membership.isOwner,
    accessTitle: isAccessTitle(membership.accessTitle)
      ? membership.accessTitle
      : "staff",
    effectiveCapabilities: resolved.ok ? resolved.capabilities : new Set(),
  };
}

export type RequireCapabilityResult =
  | { ok: true; membership: VenueMembershipRow }
  | { ok: false; error: string; status: 401 | 403 | 404 | 503 };

export async function requireCapability(
  capability: CapabilityKey,
  deniedMessage = "You do not have permission to do that.",
): Promise<RequireCapabilityResult> {
  if (!isSupabaseConfigured) {
    return { ok: false, error: "Backend not configured.", status: 503 };
  }
  const membership = await getActiveVenueMembership();
  if (!membership) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Unauthorized", status: 401 };
    return { ok: false, error: "No venue found.", status: 404 };
  }
  if (!hasCapability(membership, capability)) {
    return { ok: false, error: deniedMessage, status: 403 };
  }
  return { ok: true, membership };
}

export async function requireOwner(
  deniedMessage = "Only an Owner can do that.",
): Promise<RequireCapabilityResult> {
  const membership = await getActiveVenueMembership();
  if (!membership) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Unauthorized", status: 401 };
    return { ok: false, error: "No venue found.", status: 404 };
  }
  if (!membership.isOwner || !membership.isActive) {
    return { ok: false, error: deniedMessage, status: 403 };
  }
  return { ok: true, membership };
}

export function coerceAccessTitle(value: string | null | undefined): AccessTitle {
  if (value && isAccessTitle(value)) return value;
  return "staff";
}

export function coerceBasisTitle(
  accessTitle: AccessTitle,
  titleBasis: string | null | undefined,
): BasisTitle {
  if (accessTitle === "custom") {
    return titleBasis && isBasisTitle(titleBasis) ? titleBasis : "staff";
  }
  if (isBasisTitle(accessTitle)) return accessTitle;
  return titleBasis && isBasisTitle(titleBasis) ? titleBasis : "staff";
}
