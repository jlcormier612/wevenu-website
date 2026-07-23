import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordEngagementEvent } from "@/lib/activation/service";
import type { PortalContext, PortalKeyDate, PortalSession, PortalTask, PortalTimeline, PortalTimelineEntry, PortalTimelineSection } from "@/lib/portal/types";

// ---- Token resolution (uses server Supabase client; SECURITY DEFINER functions
//      validate the portal token internally so no coordinator session is needed) -

export async function resolvePortalContext(token: string): Promise<PortalContext | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_context", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return null;
  const ctx = data as PortalContext;

  // Fire engagement event (write-once in DB via COALESCE so this is idempotent)
  if (ctx.venue?.id) {
    void recordEngagementEvent({
      venueId:   ctx.venue.id,
      eventType: "couple.portal_opened",
      actorType: "couple",
      entityType: "client",
      entityId:  ctx.client?.id ?? undefined,
    });
  }

  return ctx;
}

export async function resolvePortalTasks(token: string): Promise<PortalTask[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_tasks", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return [];
  return ((data as Record<string, unknown>).tasks ?? []) as PortalTask[];
}

// Program 4, Initiative C, Phase 3 (2026-07-23) — Key Dates the venue has
// already set (rehearsal, tasting, final headcount, etc.) so the couple
// feels the venue has already prepared everything for them.
export async function resolvePortalKeyDates(token: string): Promise<PortalKeyDate[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_key_dates", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return [];
  return ((data as Record<string, unknown>).keyDates ?? []) as PortalKeyDate[];
}

export async function completePortalTask(token: string, taskId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_portal_task", { p_token: token, p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not complete task." };
  return { ok: true };
}

// The Client Timeline — the couple's own always-live view (their own
// draft + the venue's live structural framework), through
// get_portal_run_of_show. Never gated by the couple's own submission
// state (docs/client-workspace-product-architecture.md §12, refined
// 2026-07-17).
export async function resolvePortalTimeline(token: string): Promise<PortalTimeline> {
  const empty: PortalTimeline = { sections: [], entries: [], lastSubmittedAt: null, hasUnpublishedChanges: false };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_run_of_show", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return empty;
  const d = data as Record<string, unknown>;
  return {
    sections: (d.sections ?? []) as PortalTimelineSection[],
    entries: (d.entries ?? []) as PortalTimelineEntry[],
    lastSubmittedAt: (d.lastSubmittedAt as string | null) ?? null,
    hasUnpublishedChanges: (d.hasUnpublishedChanges as boolean) ?? false,
  };
}

export async function updatePortalTimelineEntry(
  token: string, entryId: string, title: string, description: string, entryTime: string, sectionId?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_portal_timeline_entry", {
    p_token: token, p_entry_id: entryId, p_title: title, p_description: description, p_entry_time: entryTime,
    p_section_id: sectionId ?? null,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not save this item." };
  return { ok: true };
}

// The couple adds a new item to a section the venue marked addable —
// always owner='client', always private (audiences={}) until the couple
// deliberately sets Visibility on it themselves.
export async function addPortalTimelineEntry(
  token: string, sectionId: string, title: string, description: string, entryTime: string,
): Promise<{ ok: boolean; entry?: PortalTimelineEntry; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_portal_timeline_entry", {
    p_token: token, p_section_id: sectionId, p_title: title, p_description: description, p_entry_time: entryTime,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not add this item." };
  return { ok: true, entry: d.entry as PortalTimelineEntry };
}

export async function deletePortalTimelineEntry(token: string, entryId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_portal_timeline_entry", { p_token: token, p_entry_id: entryId });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not delete this item." };
  return { ok: true };
}

// Visibility follows Ownership (2026-07-17) — rejected server-side for
// anything the couple doesn't own, independent of Submission.
export async function setPortalTimelineEntryVisibility(
  token: string, entryId: string, audiences: string[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_portal_timeline_entry_visibility", {
    p_token: token, p_entry_id: entryId, p_audiences: audiences,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not update visibility." };
  return { ok: true };
}

// The couple's whole-timeline Submit action — the Timeline planning
// Task's commit point. Creates a new immutable snapshot; does not freeze
// the couple's own workspace (they keep editing; a later submit creates
// another snapshot, and the venue always reads the latest one).
export async function submitPortalTimeline(
  token: string, clientId: string,
): Promise<{ ok: boolean; entryCount?: number; submittedAt?: string; error?: string; celebrated?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_timeline", { p_access_token: token, p_client_id: clientId });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not submit your timeline." };
  return { ok: true, entryCount: d.entryCount as number, submittedAt: d.submittedAt as string, celebrated: d.celebrated === true };
}

// ---- Coordinator actions (authenticated) ------------------------------------

export async function getPortalSessions(clientId: string): Promise<PortalSession[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_portal_sessions")
    .select("*")
    .eq("client_id", clientId)
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false });
  if (!data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    venueId: r.venue_id as string,
    clientId: r.client_id as string,
    eventId: (r.event_id ?? null) as string | null,
    accessToken: r.access_token as string,
    accessLevel: r.access_level as PortalSession["accessLevel"],
    label: (r.label ?? null) as string | null,
    lastAccessedAt: (r.last_accessed_at ?? null) as string | null,
    expiresAt: (r.expires_at ?? null) as string | null,
    createdAt: r.created_at as string,
  }));
}

export async function createPortalSession(
  clientId: string,
  label: string | null,
  accessLevel: PortalSession["accessLevel"] = "couple",
): Promise<PortalSession | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_portal_sessions")
    .insert({ client_id: clientId, venue_id: venue.id, label, access_level: accessLevel })
    .select("*")
    .single<Record<string, unknown>>();
  if (error) { console.error("[portal] createPortalSession error:", error.message, error.code); return null; }
  if (!data) return null;
  return {
    id: data.id as string,
    venueId: data.venue_id as string,
    clientId: data.client_id as string,
    eventId: (data.event_id ?? null) as string | null,
    accessToken: data.access_token as string,
    accessLevel: data.access_level as PortalSession["accessLevel"],
    label: (data.label ?? null) as string | null,
    lastAccessedAt: null,
    expiresAt: null,
    createdAt: data.created_at as string,
  };
}

export async function revokePortalSession(sessionId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const venue = await getCurrentVenue();
  if (!venue) return;
  const supabase = await createClient();
  await supabase
    .from("client_portal_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("venue_id", venue.id);
}
