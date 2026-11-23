/**
 * Wave 2 — Active venue context bootstrap (DB authoritative).
 * Does not change membership, role, ownership, or business data.
 */
import { cache } from "react";

import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { layoutFbExtra, layoutFbTime } from "@/lib/shell/layout-first-byte-timing";
import {
  clearActiveVenueCookie,
  syncActiveVenueCookieFromDb,
} from "@/lib/venue/active-context-cookie";
import { classifyActiveVenueCase } from "@/lib/venue/active-context-logic";
import { consumeOnboardingHandoff } from "@/lib/venue/onboarding-handoff";

/**
 * Local A/B only: HTC_LAYOUT_BOOTSTRAP_SERIAL=1 restores pre–Wave 6 serial
 * membership + venue-id reads after clear_stale (for before/after timing).
 */
function bootstrapReadsSerial(): boolean {
  return process.env.HTC_LAYOUT_BOOTSTRAP_SERIAL === "1";
}

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
  // Clear HTC support override first — otherwise current_user_venue_id() keeps
  // returning the support venue and membership bootstrap stays invalid.
  try {
    await supabase.rpc("htc_end_support_context");
  } catch {
    // ignore — RPC may be absent before migration
  }
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
  } = await layoutFbTime("bootstrap_get_user", () => supabase.auth.getUser());
  if (!user) {
    await clearActiveVenueCookie();
    return { status: "unauthenticated" };
  }

  // Stage 1F — active HTC support context (HQ admin) takes precedence over
  // ordinary membership bootstrap so staff can open a customer venue without
  // creating a venue_staff row.
  const supportCtx = await layoutFbTime("bootstrap_support_context", async () => {
    const { data } = await supabase.rpc("htc_get_support_context");
    return data as {
      ok?: boolean;
      active?: boolean;
      venue_id?: string | null;
      mode?: string | null;
      portal?: string | null;
    } | null;
  });
  if (supportCtx?.ok && supportCtx.active && supportCtx.venue_id) {
    const venueId = String(supportCtx.venue_id);
    // If the support target venue row is missing, drop the stuck session and
    // continue ordinary membership bootstrap (do not trap HQ staff on
    // select-venue with an unresolvable support override).
    const { data: supportVenue } = await supabase
      .from("venues")
      .select("id")
      .eq("id", venueId)
      .maybeSingle();
    if (!supportVenue) {
      await supabase.rpc("htc_end_support_context");
    } else {
      await syncActiveVenueCookieFromDb(venueId);
      layoutFbExtra("bootstrap_case", "F_support_context");
      return {
        status: "ready",
        venueId,
        memberships: [
          {
            venueId,
            venueName: "Support session",
            role: supportCtx.mode === "assist" ? "owner" : "viewer",
            isOwner: supportCtx.mode === "assist",
          },
        ],
      };
    }
  }

  // One-time onboarding handoff (purchase activation) — establish the
  // intended venue before ordinary classification. No-op when none exists.
  // Does not change B_keep_valid for users without a pending handoff.
  // MUST remain before clear_stale and before venue-id / membership reads.
  await layoutFbTime("bootstrap_consume_handoff", () => consumeOnboardingHandoff());

  // Clear stale DB context when membership no longer valid (Case E cleanup).
  // MUST remain after handoff and before membership / venue-id reads.
  await layoutFbTime("bootstrap_clear_stale", () =>
    supabase.rpc("clear_stale_active_venue_context"),
  );

  // After clear_stale: membership list and active venue id are independent reads.
  let memberships: VenueMembershipSummary[];
  let activeId: string | null;
  if (bootstrapReadsSerial()) {
    layoutFbExtra("bootstrap_reads_mode", "serial");
    memberships = await layoutFbTime("bootstrap_list_memberships", () => listMyVenueMemberships());
    const { data: venueId } = await layoutFbTime("bootstrap_current_user_venue_id", () =>
      supabase.rpc("current_user_venue_id"),
    );
    activeId = (venueId as string | null) ?? null;
  } else {
    layoutFbExtra("bootstrap_reads_mode", "parallel");
    const [membershipsResult, venueIdResult] = await layoutFbTime(
      "bootstrap_memberships_and_venue_id_parallel",
      () =>
        Promise.all([
          listMyVenueMemberships(),
          supabase.rpc("current_user_venue_id"),
        ]),
    );
    memberships = membershipsResult;
    activeId = ((venueIdResult.data as string | null) ?? null);
  }
  const membershipValid = Boolean(activeId && memberships.some((m) => m.venueId === activeId));

  const classified = classifyActiveVenueCase({
    memberships,
    dbContextVenueId: activeId,
    dbContextMembershipValid: membershipValid,
  });
  layoutFbExtra("bootstrap_case", classified);

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
    const set = await layoutFbTime("bootstrap_set_active_venue", () => setActiveVenue(only.venueId));
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
