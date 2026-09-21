/**
 * Wave 2 — Active venue context bootstrap (DB authoritative).
 * Does not change membership, role, ownership, or business data.
 */
import { cache } from "react";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import {
  clearActiveVenueCookie,
  syncActiveVenueCookieFromDb,
} from "@/lib/venue/active-context-cookie";
import { classifyActiveVenueCase } from "@/lib/venue/active-context-logic";

export type VenueMembershipSummary = {
  venueId: string;
  venueName: string;
  role: string;
  isOwner: boolean;
};

export type ActiveVenueBootstrap =
  | { status: "ready"; venueId: string; memberships: VenueMembershipSummary[] }
  | { status: "needs_selection"; memberships: VenueMembershipSummary[] }
  | { status: "no_memberships" }
  | { status: "unauthenticated" };

function mapMemberships(raw: unknown): VenueMembershipSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const row = m as Record<string, unknown>;
    return {
      venueId: String(row.venueId ?? row.venue_id ?? ""),
      venueName: String(row.venueName ?? row.venue_name ?? "Venue"),
      role: String(row.role ?? ""),
      isOwner: Boolean(row.isOwner ?? row.is_owner),
    };
  }).filter((m) => m.venueId);
}

export async function listMyVenueMemberships(): Promise<VenueMembershipSummary[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("list_my_venue_memberships");
  const payload = data as { ok?: boolean; memberships?: unknown } | null;
  if (!payload?.ok) return [];
  return mapMemberships(payload.memberships);
}

export async function setActiveVenue(venueId: string): Promise<
  { ok: true; venueId: string; venueName?: string } | { ok: false; error: string }
> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_active_venue", { p_venue_id: venueId });
  if (error) return { ok: false, error: error.message };
  const payload = data as { ok?: boolean; error?: string; venueId?: string; venueName?: string } | null;
  if (!payload?.ok || !payload.venueId) {
    return { ok: false, error: payload?.error ?? "set_failed" };
  }
  await syncActiveVenueCookieFromDb(payload.venueId);
  return { ok: true, venueId: payload.venueId, venueName: payload.venueName };
}

/**
 * Case A–E initialization. Cookie never establishes authorization.
 */
export const bootstrapActiveVenueContext = cache(async (): Promise<ActiveVenueBootstrap> => {
  if (!isSupabaseConfigured) return { status: "unauthenticated" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    await clearActiveVenueCookie();
    return { status: "unauthenticated" };
  }

  // Clear stale DB context when membership no longer valid (Case E cleanup).
  await supabase.rpc("clear_stale_active_venue_context");

  const memberships = await listMyVenueMemberships();
  const { data: venueId } = await supabase.rpc("current_user_venue_id");
  const activeId = (venueId as string | null) ?? null;
  const membershipValid = Boolean(activeId && memberships.some((m) => m.venueId === activeId));

  const classified = classifyActiveVenueCase({
    memberships,
    dbContextVenueId: activeId,
    dbContextMembershipValid: membershipValid,
  });

  if (classified === "D_none") {
    await clearActiveVenueCookie();
    return { status: "no_memberships" };
  }

  if (classified === "B_keep_valid" && activeId) {
    await syncActiveVenueCookieFromDb(activeId);
    return { status: "ready", venueId: activeId, memberships };
  }

  if (classified === "A_auto_single") {
    const only = memberships[0];
    const set = await setActiveVenue(only.venueId);
    if (!set.ok) {
      await clearActiveVenueCookie();
      return { status: "needs_selection", memberships };
    }
    return { status: "ready", venueId: set.venueId, memberships };
  }

  // C / E
  await clearActiveVenueCookie();
  return { status: "needs_selection", memberships };
});
