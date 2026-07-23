/**
 * White-Glove Customer Success Workspace — Onboarding Engagement lifecycle
 * (Hospitality Success Platform §2.2a, Phase 2). Server-only.
 *
 * Managed through the HQ admin's own authenticated session, not
 * service_role — unlike the migration/import writes (§2.2's shipped
 * create_client_atomic/create_vendor_atomic override), this table isn't
 * something a venue session could ever legitimately touch, so ordinary
 * is_hq_admin()-gated RLS (see the migration) is the right, simplest
 * mechanism. Every status change is also logged via recordEngagementEvent
 * (actor_type 'hq_admin') — the same audit trail View-As already writes
 * through, not a new mechanism.
 */
import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { recordEngagementEvent } from "@/lib/activation/service";
import { requireAdminUser } from "@/lib/hq/crm-service";
import type {
  OnboardingActionResult, OnboardingEngagement, OnboardingEngagementStatus, OnboardingEngagementSummary,
} from "@/lib/hq/onboarding-types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type EngagementRow = {
  id: string; venue_id: string; assigned_hq_admin_id: string | null;
  status: OnboardingEngagementStatus; current_focus: string | null;
  started_at: string | null; paused_at: string | null; resumed_at: string | null; completed_at: string | null;
  created_at: string; updated_at: string;
};

const mapEngagement = (r: EngagementRow): OnboardingEngagement => ({
  id: r.id, venueId: r.venue_id, assignedHqAdminId: r.assigned_hq_admin_id,
  status: r.status, currentFocus: r.current_focus,
  startedAt: r.started_at, pausedAt: r.paused_at, resumedAt: r.resumed_at, completedAt: r.completed_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export async function getOnboardingEngagement(venueId: string): Promise<OnboardingEngagement | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("venue_onboarding_engagements").select("*")
    .eq("venue_id", venueId).maybeSingle<EngagementRow>();
  return data ? mapEngagement(data) : null;
}

/** Every venue in Wevenu HQ's onboarding view — the cross-account dashboard's own read (§2.2a step 3) builds on this. */
export async function getOnboardingEngagements(): Promise<OnboardingEngagement[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("venue_onboarding_engagements").select("*").order("updated_at", { ascending: false });
  if (error) return [];
  return (data as EngagementRow[]).map(mapEngagement);
}

/**
 * The cross-account dashboard's own read (§2.2a step 3) — every engagement,
 * joined with the venue name, resolved specialist name, and open-blocker
 * count each row is always shown alongside. Three flat queries + JS
 * grouping, not a PostgREST embedded select or a view — matches this
 * codebase's own established preference (see e.g.
 * getTemplatesWithStats) after prior embedded-select bugs elsewhere.
 *
 * Specialist name resolution needs `auth.admin.listUsers()` (there's no
 * `hq_admins`-joined-to-a-name view yet — the roster page itself is still
 * "Coming soon" per docs/wevenu-hq-architecture.md §1) — that's an
 * admin-API call, not a table read, so it's the one piece of this dashboard
 * that goes through `createAdminClient()` rather than the caller's own
 * RLS-protected session. Everything else stays on the normal session client
 * since `venue_onboarding_engagements`/`venue_hq_tasks` are already
 * `is_hq_admin()`-gated by RLS — this function adds no new authorization
 * surface of its own, it's still protected by the same `AdminLayout` gate
 * every other HQ page relies on.
 */
export async function getOnboardingDashboard(): Promise<OnboardingEngagementSummary[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data: engagementRows, error } = await supabase
    .from("venue_onboarding_engagements").select("*").order("updated_at", { ascending: false });
  if (error || !engagementRows || engagementRows.length === 0) return [];

  const engagements = (engagementRows as EngagementRow[]).map(mapEngagement);
  const venueIds = engagements.map((e) => e.venueId);
  const adminIds = [...new Set(engagements.map((e) => e.assignedHqAdminId).filter((id): id is string => !!id))];

  const [{ data: venueRows }, { data: blockerRows }] = await Promise.all([
    supabase.from("venues").select("id, name").in("id", venueIds),
    supabase.from("venue_hq_tasks").select("venue_id").eq("kind", "blocker").is("completed_at", null).in("venue_id", venueIds),
  ]);

  const venueNames = new Map((venueRows ?? []).map((v: { id: string; name: string }) => [v.id, v.name]));
  const blockerCounts = new Map<string, number>();
  for (const row of (blockerRows ?? []) as { venue_id: string }[]) {
    blockerCounts.set(row.venue_id, (blockerCounts.get(row.venue_id) ?? 0) + 1);
  }

  const adminNames = new Map<string, string>();
  if (adminIds.length > 0) {
    try {
      const admin = createAdminClient();
      const { data: userList } = await admin.auth.admin.listUsers();
      for (const id of adminIds) {
        const user = userList?.users.find((u) => u.id === id);
        if (user) adminNames.set(id, user.email ?? "HQ team member");
      }
    } catch {
      // Name resolution is a display nicety — an admin-API hiccup shouldn't take the whole dashboard down.
    }
  }

  return engagements.map((e) => ({
    ...e,
    venueName: venueNames.get(e.venueId) ?? "Unknown venue",
    assignedName: e.assignedHqAdminId ? adminNames.get(e.assignedHqAdminId) ?? "HQ team member" : null,
    openBlockerCount: blockerCounts.get(e.venueId) ?? 0,
  }));
}

/**
 * §2.2a step 4 — the per-venue workspace's own read: the engagement plus
 * the assigned specialist's resolved display name, mirroring the
 * cross-account dashboard's own name resolution (there's no
 * hq_admins-joined-to-a-name view yet) but scoped to one venue instead of
 * every engagement.
 */
export async function getOnboardingEngagementWithName(venueId: string): Promise<{ engagement: OnboardingEngagement | null; assignedName: string | null }> {
  const engagement = await getOnboardingEngagement(venueId);
  if (!engagement?.assignedHqAdminId) return { engagement, assignedName: null };
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.getUserById(engagement.assignedHqAdminId);
    return { engagement, assignedName: data.user?.email ?? "HQ team member" };
  } catch {
    return { engagement, assignedName: "HQ team member" };
  }
}

/** Get-or-create — opening a venue's workspace for the first time starts its case file rather than requiring a separate "begin onboarding" step. */
export async function ensureOnboardingEngagement(venueId: string): Promise<OnboardingEngagement | null> {
  const existing = await getOnboardingEngagement(venueId);
  if (existing) return existing;
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("venue_onboarding_engagements")
    .insert({ venue_id: venueId }).select("*").single<EngagementRow>();
  if (error) return null;
  return mapEngagement(data);
}

async function updateEngagement(
  supabase: DbClient, venueId: string, patch: Record<string, unknown>,
): Promise<OnboardingActionResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("venue_onboarding_engagements") as any)
    .update(patch).eq("venue_id", venueId);
  if (error) return { ok: false, message: "Could not update this engagement." };
  return { ok: true };
}

async function logEngagementAction(venueId: string, eventType: string, actorId: string): Promise<void> {
  void recordEngagementEvent({ venueId, eventType, actorType: "hq_admin", actorId });
}

export async function startOnboardingEngagement(venueId: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  await ensureOnboardingEngagement(venueId);
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, {
    status: "in_progress", started_at: new Date().toISOString(), assigned_hq_admin_id: actor.userId,
  });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_started", actor.userId);
  return result;
}

export async function pauseOnboardingEngagement(venueId: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, { status: "paused", paused_at: new Date().toISOString() });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_paused", actor.userId);
  return result;
}

export async function resumeOnboardingEngagement(venueId: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, { status: "in_progress", resumed_at: new Date().toISOString() });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_resumed", actor.userId);
  return result;
}

export async function markOnboardingBlocked(venueId: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, { status: "blocked" });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_blocked", actor.userId);
  return result;
}

export async function completeOnboardingEngagement(venueId: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, { status: "complete", completed_at: new Date().toISOString() });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_completed", actor.userId);
  return result;
}

export async function assignOnboardingSpecialist(venueId: string, hqAdminId: string | null): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  await ensureOnboardingEngagement(venueId);
  const supabase = await createClient();
  const result = await updateEngagement(supabase, venueId, { assigned_hq_admin_id: hqAdminId });
  if (result.ok) await logEngagementAction(venueId, "hq.onboarding_reassigned", actor.userId);
  return result;
}

export async function setOnboardingCurrentFocus(venueId: string, currentFocus: string): Promise<OnboardingActionResult> {
  const actor = await requireAdminUser();
  if (!actor) return { ok: false, message: "Not signed in as an HQ admin." };
  const supabase = await createClient();
  return updateEngagement(supabase, venueId, { current_focus: currentFocus.trim() || null });
}
