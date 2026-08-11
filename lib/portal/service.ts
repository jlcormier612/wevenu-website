import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { recordEngagementEvent } from "@/lib/activation/service";
import type { PortalContext, PortalKeyDate, PortalSession, PortalTask, PortalTaskLink, PortalTimeline, PortalTimelineEntry, PortalTimelineSection, PortalVendorTask } from "@/lib/portal/types";

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
  const rows = ((data as Record<string, unknown>).tasks ?? []) as Record<string, unknown>[];
  return rows.map((r) => {
    const trigger = (r.autoCompleteTrigger as string | null | undefined) ?? null;
    // Defense in depth: never allow couple manual complete when a domain trigger owns it
    // (covers pre-migration RPC responses that still omit the policy).
    const canComplete = Boolean(r.canComplete) && !trigger;
    const canUndo = Boolean(r.canUndo) && !trigger && (r.status as string) === "complete";
    const rawLinks = Array.isArray(r.links) ? (r.links as Record<string, unknown>[]) : [];
    const links: PortalTaskLink[] = rawLinks
      .map((l) => ({
        id: String(l.id ?? ""),
        url: String(l.url ?? "").trim(),
        label: typeof l.label === "string" && l.label.trim() ? l.label.trim() : null,
      }))
      .filter((l) => l.id && l.url);
    return {
      id: r.id as string,
      title: r.title as string,
      description: (r.description as string | null) ?? null,
      category: (r.category as string) ?? "planning",
      ownerType: (r.ownerType as string) ?? "couple",
      visibility: (r.visibility === "client_visible" ? "client_visible" : "client_owned") as PortalTask["visibility"],
      dueDate: (r.dueDate as string) ?? "",
      daysOffset: Number(r.daysOffset ?? 0) || 0,
      milestoneName: (r.milestoneName as string) ?? "",
      milestoneKind: (r.milestoneKind as PortalTask["milestoneKind"]) ?? null,
      status: (r.status as PortalTask["status"]) ?? "pending",
      isRequired: Boolean(r.isRequired),
      completedAt: (r.completedAt as string | null) ?? null,
      autoCompleteTrigger: trigger,
      canComplete,
      canUndo,
      links,
    };
  });
}

export async function resolvePortalVendorTasks(token: string): Promise<PortalVendorTask[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_vendor_tasks", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return [];
  const rows = ((data as Record<string, unknown>).vendorTasks ?? []) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    notes: (r.notes as string | null) ?? null,
    dueDate: (r.dueDate as string | null) ?? null,
    status: ((r.status as string) === "complete" ? "complete" : "pending") as "pending" | "complete",
    coupleVisibility: (r.coupleVisibility === "owned" ? "owned" : "visible") as "visible" | "owned",
    completedAt: (r.completedAt as string | null) ?? null,
    completedBy: (r.completedBy as "couple" | "vendor" | null) ?? null,
    vendorId: r.vendorId as string,
    vendorName: (r.vendorName as string) || "Vendor",
    actionType: (r.actionType === "share_timeline" ? "share_timeline" : null) as
      | "share_timeline"
      | null,
    completionAuthority: (
      r.completionAuthority === "couple_acknowledge" ||
      r.completionAuthority === "vendor_confirm" ||
      r.completionAuthority === "action_verified"
        ? r.completionAuthority
        : undefined
    ) as PortalVendorTask["completionAuthority"],
    coupleAcknowledgedAt: (r.coupleAcknowledgedAt as string | null | undefined) ?? null,
    vendorReturnNote: (r.vendorReturnNote as string | null | undefined) ?? null,
    returnedAt: (r.returnedAt as string | null | undefined) ?? null,
    canComplete: Boolean(r.canComplete),
    canAcknowledge: Boolean(r.canAcknowledge),
    attachments: ((r.attachments as PortalVendorTask["attachments"]) ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      storageUrl: a.storageUrl,
      mimeType: a.mimeType ?? null,
    })),
  }));
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

/** Reopen a couple-completed manual/ack task (null autoCompleteTrigger only). */
export async function undoPortalTask(token: string, taskId: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("undo_portal_task", { p_token: token, p_task_id: taskId });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not undo task." };
  return { ok: true };
}

export async function completePortalVendorTask(
  token: string,
  taskId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_portal_vendor_task", {
    p_token: token,
    p_task_id: taskId,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not complete task." };
  return { ok: true };
}

/** Phase 2 — couple acknowledgement for owned vendor_confirm (not final complete). */
export async function acknowledgePortalVendorTask(
  token: string,
  taskId: string,
): Promise<{ ok: boolean; error?: string; alreadyAcknowledged?: boolean }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("acknowledge_portal_vendor_task", {
    p_token: token,
    p_task_id: taskId,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not acknowledge task." };
  return {
    ok: true,
    alreadyAcknowledged: Boolean(d.alreadyAcknowledged),
  };
}

/** Couple commits a timeline share to one assigned vendor (Impl 6). */
export async function sharePortalTimelineWithVendor(
  token: string,
  vendorId: string,
): Promise<{
  ok: boolean;
  error?: string;
  celebrated?: boolean;
  alreadyShared?: boolean;
  completedTaskIds?: string[];
  vendorName?: string;
  shareId?: string;
}> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("share_portal_timeline_with_vendor", {
    p_token: token,
    p_vendor_id: vendorId,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not share timeline." };
  return {
    ok: true,
    celebrated: Boolean(d.celebrated),
    alreadyShared: Boolean(d.alreadyShared),
    completedTaskIds: Array.isArray(d.completedTaskIds)
      ? (d.completedTaskIds as string[])
      : [],
    vendorName: typeof d.vendorName === "string" ? d.vendorName : undefined,
    shareId: typeof d.shareId === "string" ? d.shareId : undefined,
  };
}

// The Client Timeline — the couple's own always-live view (their own
// draft + venue items tagged wedding_party), through get_portal_run_of_show.
// Never gated by the couple's own submission state. Venue staff-only
// framework items (no wedding_party audience) stay out of the portal.
export async function resolvePortalTimeline(token: string): Promise<PortalTimeline> {
  const empty: PortalTimeline = { sections: [], entries: [], lastSubmittedAt: null, hasUnpublishedChanges: false };
  if (!isSupabaseConfigured) return empty;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_portal_run_of_show", { p_token: token });
  if (error || !data || (data as Record<string, unknown>).error) return empty;
  const d = data as Record<string, unknown>;
  return {
    sections: (d.sections ?? []) as PortalTimelineSection[],
    entries: ((d.entries ?? []) as PortalTimelineEntry[]).map((e) => ({
      ...e,
      dayOffset: Number(e.dayOffset ?? 0) || 0,
      entryTime: e.entryTime ? String(e.entryTime).slice(0, 5) : null,
      endTime: e.endTime ? String(e.endTime).slice(0, 5) : null,
    })),
    lastSubmittedAt: (d.lastSubmittedAt as string | null) ?? null,
    hasUnpublishedChanges: (d.hasUnpublishedChanges as boolean) ?? false,
  };
}

export async function updatePortalTimelineEntry(
  token: string, entryId: string, title: string, description: string, entryTime: string,
  sectionId?: string | null, dayOffset = 0, endTime = "",
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_portal_timeline_entry", {
    p_token: token, p_entry_id: entryId, p_title: title, p_description: description, p_entry_time: entryTime,
    p_section_id: sectionId ?? null, p_day_offset: dayOffset, p_end_time: endTime || null,
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
  token: string, sectionId: string, title: string, description: string, entryTime: string, dayOffset = 0, endTime = "",
): Promise<{ ok: boolean; entry?: PortalTimelineEntry; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("add_portal_timeline_entry", {
    p_token: token, p_section_id: sectionId, p_title: title, p_description: description, p_entry_time: entryTime,
    p_day_offset: dayOffset, p_end_time: endTime || null,
  });
  if (error) return { ok: false, error: error.message };
  const d = data as Record<string, unknown>;
  if (!d?.ok) return { ok: false, error: (d?.error as string) ?? "Could not add this item." };
  const entry = d.entry as PortalTimelineEntry | undefined;
  return {
    ok: true,
    entry: entry
      ? {
          ...entry,
          dayOffset: Number(entry.dayOffset ?? dayOffset) || 0,
          entryTime: entry.entryTime ? String(entry.entryTime).slice(0, 5) : (entryTime || null),
          endTime: entry.endTime ? String(entry.endTime).slice(0, 5) : (endTime || null),
        }
      : undefined,
  };
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
