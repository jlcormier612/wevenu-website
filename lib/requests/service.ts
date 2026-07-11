/**
 * Request Framework — server-only. See lib/requests/types.ts for the domain
 * shape and lib/requests/hooks.ts for the lifecycle-event seam. Nothing in
 * this file knows about Planning, Documents, Contracts, Guest Management,
 * Floor Plans, Timeline, Website, or Budget — those features will call
 * these functions once they're ready to reuse this framework; none do yet.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { TERMINAL_STATUS_TIMESTAMP_COLUMN } from "./constants";
import { emitRequestLifecycleEvent } from "./hooks";
import type {
  Request, RequestActionResult, RequestInput, RequestLifecycleEventRecord, RequestStatus,
} from "./types";

function rowToRequest(r: Record<string, unknown>): Request {
  return {
    id: r.id as string,
    venueId: r.venue_id as string,
    clientId: r.client_id as string,
    eventId: (r.event_id ?? null) as string | null,
    title: r.title as string,
    description: (r.description ?? null) as string | null,
    requestType: r.request_type as Request["requestType"],
    status: r.status as RequestStatus,
    visibility: r.visibility as Request["visibility"],
    dueDate: (r.due_date ?? null) as string | null,
    requestedByUserId: (r.requested_by_user_id ?? null) as string | null,
    assignedToStaffId: (r.assigned_to_staff_id ?? null) as string | null,
    sourceFeature: (r.source_feature ?? null) as Request["sourceFeature"],
    sourceId: (r.source_id ?? null) as string | null,
    responseText: (r.response_text ?? null) as string | null,
    responseFileUrl: (r.response_file_url ?? null) as string | null,
    clientActionEnabled: (r.client_action_enabled ?? true) as boolean,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    completedAt: (r.completed_at ?? null) as string | null,
    reviewedAt: (r.reviewed_at ?? null) as string | null,
  };
}

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, userId: string) => Promise<T>,
): Promise<T | RequestActionResult> {
  if (!isSupabaseConfigured) return { ok: false, error: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Session expired." };
  return fn(supabase, venue.id, user.id);
}

export async function getRequests(
  filters?: { clientId?: string; eventId?: string; status?: RequestStatus; requestType?: Request["requestType"]; assignedToStaffId?: string },
): Promise<Request[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  let query = supabase.from("requests").select("*").eq("venue_id", venue.id);
  if (filters?.clientId) query = query.eq("client_id", filters.clientId);
  if (filters?.eventId) query = query.eq("event_id", filters.eventId);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.requestType) query = query.eq("request_type", filters.requestType);
  if (filters?.assignedToStaffId) query = query.eq("assigned_to_staff_id", filters.assignedToStaffId);
  const { data } = await query.order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  return (data ?? []).map(rowToRequest);
}

/** Batch lookup for callers (e.g. Planning) that hold a set of request ids and need current status/due date/etc. Keyed by request id. */
export async function getRequestsByIds(requestIds: string[]): Promise<Record<string, Request>> {
  if (!isSupabaseConfigured || requestIds.length === 0) return {};
  const venue = await getCurrentVenue();
  if (!venue) return {};
  const supabase = await createClient();
  const { data } = await supabase.from("requests").select("*")
    .eq("venue_id", venue.id).in("id", requestIds);
  const byId: Record<string, Request> = {};
  for (const row of data ?? []) {
    const request = rowToRequest(row);
    byId[request.id] = request;
  }
  return byId;
}

export async function getRequest(requestId: string): Promise<Request | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("requests").select("*")
    .eq("id", requestId).eq("venue_id", venue.id).maybeSingle();
  return data ? rowToRequest(data) : null;
}

/** Request Detail's History (Requirement 3/5) — every transition, staff- or client-initiated. */
export async function getRequestHistory(requestId: string): Promise<RequestLifecycleEventRecord[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("request_lifecycle_events").select("*, requests!inner(venue_id)")
    .eq("request_id", requestId).eq("requests.venue_id", venue.id).order("created_at", { ascending: true });
  return (data ?? []).map((r) => ({
    id: r.id as string, requestId: r.request_id as string,
    eventType: r.event_type as RequestLifecycleEventRecord["eventType"],
    fromStatus: (r.from_status ?? null) as RequestStatus | null,
    toStatus: (r.to_status ?? null) as RequestStatus | null,
    actorUserId: (r.actor_user_id ?? null) as string | null,
    createdAt: r.created_at as string,
  }));
}

export async function setClientActionEnabled(requestId: string, enabled: boolean): Promise<RequestActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const { error } = await supabase.from("requests")
      .update({ client_action_enabled: enabled } as never).eq("id", requestId).eq("venue_id", venueId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
  return result as RequestActionResult;
}

export async function createRequest(
  input: RequestInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  const result = await withVenue(async (supabase, venueId, userId) => {
    const { data, error } = await supabase.from("requests").insert({
      venue_id: venueId,
      client_id: input.clientId,
      event_id: input.eventId ?? null,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      request_type: input.requestType,
      visibility: input.visibility ?? "venue_only",
      due_date: input.dueDate || null,
      assigned_to_staff_id: input.assignedToStaffId ?? null,
      requested_by_user_id: userId,
      source_feature: input.sourceFeature ?? null,
      source_id: input.sourceId ?? null,
      client_action_enabled: input.clientActionEnabled ?? true,
    }).select("*").single();
    if (error) return { ok: false, error: error.message } as const;

    const request = rowToRequest(data);
    await supabase.from("request_lifecycle_events").insert({
      request_id: request.id, event_type: "created", to_status: request.status, actor_user_id: userId,
    });
    await emitRequestLifecycleEvent({ type: "created", request });
    return { ok: true, id: request.id } as const;
  });
  return result as { ok: true; id: string } | { ok: false; error: string };
}

export async function updateRequestStatus(
  requestId: string, toStatus: RequestStatus,
): Promise<RequestActionResult> {
  const result = await withVenue(async (supabase, venueId, userId) => {
    const { data: existing } = await supabase.from("requests").select("*")
      .eq("id", requestId).eq("venue_id", venueId).maybeSingle();
    if (!existing) return { ok: false, error: "Request not found." };
    const fromStatus = existing.status as RequestStatus;

    const patch: Record<string, unknown> = { status: toStatus, updated_at: new Date().toISOString() };
    const timestampColumn = TERMINAL_STATUS_TIMESTAMP_COLUMN[toStatus];
    if (timestampColumn) patch[timestampColumn] = new Date().toISOString();

    const { error } = await supabase.from("requests").update(patch).eq("id", requestId).eq("venue_id", venueId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("request_lifecycle_events").insert({
      request_id: requestId, event_type: "status_changed",
      from_status: fromStatus, to_status: toStatus, actor_user_id: userId,
    });
    const request = rowToRequest({ ...existing, ...patch });
    await emitRequestLifecycleEvent({ type: "status_changed", request, fromStatus, toStatus });
    return { ok: true };
  });
  return result as RequestActionResult;
}

export async function assignRequest(
  requestId: string, staffId: string,
): Promise<RequestActionResult> {
  const result = await withVenue(async (supabase, venueId, userId) => {
    const { data: existing } = await supabase.from("requests").select("*")
      .eq("id", requestId).eq("venue_id", venueId).maybeSingle();
    if (!existing) return { ok: false, error: "Request not found." };
    const previousStaffId = existing.assigned_to_staff_id as string | null;

    const { error } = await supabase.from("requests")
      .update({ assigned_to_staff_id: staffId, updated_at: new Date().toISOString() })
      .eq("id", requestId).eq("venue_id", venueId);
    if (error) return { ok: false, error: error.message };

    await supabase.from("request_lifecycle_events").insert({
      request_id: requestId, event_type: previousStaffId ? "reassigned" : "assigned", actor_user_id: userId,
    });
    const request = rowToRequest({ ...existing, assigned_to_staff_id: staffId });
    if (previousStaffId) {
      await emitRequestLifecycleEvent({ type: "reassigned", request, fromStaffId: previousStaffId, toStaffId: staffId });
    } else {
      await emitRequestLifecycleEvent({ type: "assigned", request, staffId });
    }
    return { ok: true };
  });
  return result as RequestActionResult;
}
