import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordEngagementEvent } from "@/lib/activation/service";
import type { PortalContext, PortalSession, PortalTask, PortalTimeline, PortalTimelineEntry, PortalTimelineSection } from "@/lib/portal/types";

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

export async function completePortalTask(token: string, taskId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_portal_task", { p_token: token, p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not complete task." };
  return { ok: true };
}

// The Client Timeline — the same Booking Timeline (timeline_entries), read
// through get_portal_run_of_show's visibility filter. No second Timeline.
export async function resolvePortalTimeline(token: string): Promise<PortalTimeline> {
  if (!isSupabaseConfigured) return { sections: [], entries: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_run_of_show", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return { sections: [], entries: [] };
  const d = data as Record<string, unknown>;
  return {
    sections: (d.sections ?? []) as PortalTimelineSection[],
    entries: (d.entries ?? []) as PortalTimelineEntry[],
  };
}

export async function updatePortalTimelineEntry(
  token: string, entryId: string, title: string, description: string, entryTime: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_portal_timeline_entry", {
    p_token: token, p_entry_id: entryId, p_title: title, p_description: description, p_entry_time: entryTime,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not save this item." };
  return { ok: true };
}

// The couple adds a new item to a section the venue marked addable — a
// normal timeline_entries row, not a separate store (Client-Added Timeline
// Items task).
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
