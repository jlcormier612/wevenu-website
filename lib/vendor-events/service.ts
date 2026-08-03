import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { clientDisplayName } from "@/lib/clients/constants";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type {
  VendorActionResult,
  VendorEventDetail,
  VendorEventListItem,
  VendorActivityItem,
} from "@/lib/vendors/types";
import type {
  VendorTimelineEntry,
  VendorTask,
  VendorDocument,
  VendorDocumentsByEvent,
  VendorTimelineByEvent,
} from "@/lib/vendor-portal/types";
import type { VendorPersonalTask } from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

/**
 * Sprint 2 — Vendor Certification Pass. Previously read event_vendor_
 * assignments directly through the caller's own RLS-scoped session; that
 * table's RLS only recognizes venue_id = current_user_venue_id() (null for
 * a vendor), so this returned an empty list for every real vendor login —
 * confirmed live with a signed vendor JWT before this fix. Now goes through
 * get_vendor_events, a SECURITY DEFINER RPC validated against
 * current_user_vendor_id(), the same pattern every other vendor read uses.
 */
export async function getVendorEvents(): Promise<VendorEventListItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  type Row = {
    assignment_id: string; event_id: string; event_name: string; event_date: string | null;
    venue_id: string; venue_name: string; arrival_time: string | null; is_upcoming: boolean;
  };

  const { data, error } = await supabase.rpc("get_vendor_events");
  if (error) throw error;
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignment_id,
    eventId:      r.event_id,
    eventName:    r.event_name,
    eventDate:    r.event_date,
    venueId:      r.venue_id,
    venueName:    r.venue_name,
    arrivalTime:  r.arrival_time,
    isUpcoming:   r.is_upcoming,
  }));
}

export async function getVendorEventDetail(
  assignmentId: string,
  vendorId:     string,
): Promise<VendorEventDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  // Sprint 1 — every field below used to come from direct RLS-scoped reads
  // against event_vendor_assignments/timeline_entries/event_tasks/clients/
  // documents. None of those tables' RLS policies recognize a vendor
  // session (only venue_id = current_user_venue_id()), so every one of
  // those reads silently returned nothing for a real vendor login — the
  // assignment fetch coming back empty made this whole function (and the
  // page above it) 404 unconditionally. get_vendor_event_detail is a
  // SECURITY DEFINER RPC that does the same joins server-side, validated
  // against current_user_vendor_id(), the same pattern every other
  // vendor-facing read in this codebase already uses. It also fixes two
  // bugs that were riding along in the old direct reads: "event_documents"
  // was never a real table (the real one is "documents"), and the client
  // lookup used three columns clients has never had (event_id,
  // partner1_name, partner2_name — the couple is reached via
  // events.client_id, and the real name columns are first_name/last_name/
  // partner_first_name/partner_last_name).
  type DetailPayload = {
    assignment: {
      id: string; event_id: string; arrival_time: string | null;
      setup_location: string | null; load_in_notes: string | null; internal_notes: string | null;
      notes: string | null; checked_in_at: string | null; setup_complete_at: string | null;
      share_couple_email: boolean; share_couple_phone: boolean;
      agreed_fee: number | null; payment_status: "pending" | "paid";
    } | null;
    event: { id: string; name: string; event_date: string | null; event_type: string | null; venue_id: string; venue_name: string } | null;
    client: { first_name: string | null; last_name: string | null; partner_first_name: string | null; partner_last_name: string | null; email: string | null; phone: string | null } | null;
    timeline: { id: string; entry_time: string | null; title: string; description: string | null; audiences: string[] }[];
    event_tasks: { id: string; title: string; description: string | null; category: string; visibility: string; due_date: string | null; status: string; is_required: boolean; completed_at: string | null }[];
    documents: { id: string; name: string; category: string; storage_url: string; mime_type: string | null; notes: string | null }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_event_detail", { p_assignment_id: assignmentId });
  if (error) throw error;
  if (!data) return null;
  const payload = data as DetailPayload;
  if (!payload.assignment || !payload.event) return null;
  const ass = payload.assignment;
  const event = payload.event;
  const eventId = ass.event_id;

  type PersonalTaskRow = Record<string, unknown>;
  const { data: personalTaskData } = await supabase
    .from("vendor_tasks")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("event_id", eventId)
    .order("due_date", { ascending: true, nullsFirst: false });

  const timeline: VendorTimelineEntry[] = payload.timeline.map((r) => ({
    id:          r.id,
    time:        r.entry_time,
    title:       r.title,
    description: r.description,
    audiences:   r.audiences,
  }));

  const eventTasks: VendorTask[] = payload.event_tasks.map((r) => ({
    id:          r.id,
    title:       r.title,
    description: r.description,
    category:    r.category,
    visibility:  r.visibility as VendorTask["visibility"],
    dueDate:     r.due_date,
    status:      r.status,
    isRequired:  r.is_required,
    completedAt: r.completed_at,
    canComplete: r.visibility === "vendor_owned",
  }));

  const personalTasks: VendorPersonalTask[] = ((personalTaskData ?? []) as PersonalTaskRow[]).map((r) => ({
    id:              r.id as string,
    vendorId:        r.vendor_id as string,
    vendorInquiryId: (r.vendor_inquiry_id as string | null) ?? null,
    eventId:         (r.event_id as string | null) ?? null,
    title:           r.title as string,
    dueDate:         (r.due_date as string | null) ?? null,
    status:          (r.status as "pending" | "complete") ?? "pending",
    source:          (r.source as VendorPersonalTask["source"]) ?? "manual",
    notes:           (r.notes as string | null) ?? null,
    completedAt:     (r.completed_at as string | null) ?? null,
    createdAt:       r.created_at as string,
  }));

  const documents: VendorDocument[] = payload.documents.map((r) => ({
    id:         r.id,
    name:       r.name,
    category:   r.category,
    storageUrl: r.storage_url,
    mimeType:   r.mime_type,
    notes:      r.notes,
  }));

  // Activity feed: derive from tasks + docs sorted by time
  const activityFeed: VendorActivityItem[] = [
    ...eventTasks
      .filter((t) => t.completedAt)
      .map((t) => ({
        id:          t.id,
        type:        "task_complete" as const,
        description: `Completed: ${t.title}`,
        occurredAt:  t.completedAt!,
        actor:       "venue" as const,
      })),
    ...documents.map((d) => ({
      id:          d.id,
      type:        "document_upload" as const,
      description: `Document shared: ${d.name}`,
      occurredAt:  new Date(0).toISOString(),
      actor:       "venue" as const,
    })),
  ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  const coupleName = clientDisplayName(
    payload.client?.first_name ?? "", payload.client?.last_name ?? "",
    payload.client?.partner_first_name, payload.client?.partner_last_name,
  ) || null;

  return {
    assignmentId:    ass.id,
    eventId,
    eventName:       event.name,
    eventDate:       event.event_date,
    eventType:       event.event_type,
    venueName:       event.venue_name,
    venueId:         event.venue_id,
    arrivalTime:     ass.arrival_time,
    setupLocation:   ass.setup_location,
    loadInNotes:     ass.load_in_notes,
    internalNotes:   ass.internal_notes,
    coupleName,
    coupleEmail:     ass.share_couple_email ? (payload.client?.email ?? null) : null,
    couplePhone:     ass.share_couple_phone ? (payload.client?.phone ?? null) : null,
    checkedInAt:     ass.checked_in_at,
    setupCompleteAt: ass.setup_complete_at,
    agreedFee:       ass.agreed_fee != null ? Number(ass.agreed_fee) : null,
    paymentStatus:   ass.payment_status,
    timeline,
    eventTasks,
    personalTasks,
    documents,
    activityFeed,
  };
}

/**
 * Sprint 2 — Vendor Certification Pass. Previously updated event_vendor_
 * assignments directly through the caller's RLS-scoped session; confirmed
 * live that this returned HTTP 204 (success) while silently writing
 * nothing — the same "reports success but did nothing" shape as TR-B3/
 * TR-M2/TR-L4. Now goes through update_vendor_assignment_notes, a
 * SECURITY DEFINER RPC that actually validates and performs the write.
 */
export async function updateAssignmentNotes(
  assignmentId: string,
  notes:        string,
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    const { data, error } = await supabase.rpc("update_vendor_assignment_notes", {
      p_assignment_id: assignmentId,
      p_notes: notes,
    });
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    if (!data?.ok) return { ok: false, message: "Could not save notes." } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

/**
 * Sprint 2 — Vendor Certification Pass. Two bugs fixed in one pass:
 * (1) the same RLS-blocks-silently-succeeds defect as updateAssignmentNotes
 * above, and (2) this never actually verified the task's event belonged to
 * an assignment the calling vendor owns — it received vendorId but never
 * used it (`void vendorId`). Latent only because RLS happened to block the
 * write anyway; fixing RLS without fixing this too would have let any
 * vendor complete any other vendor's task. complete_vendor_event_task
 * checks both.
 */
export async function completeEventTask(taskId: string): Promise<VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_vendor_event_task", { p_task_id: taskId });
  if (error) return { ok: false, message: error.message };
  if (!data?.ok) return { ok: false, message: "Could not complete this task." };
  return { ok: true };
}

/**
 * Vendor Workspace Realignment, Phase 8 (2026-07-22) — the top-level
 * Documents destination: every document/floor plan shared across every
 * event the vendor is booked on, grouped by event, so the vendor never has
 * to open each event individually to find what was shared. Reuses the same
 * `documents`/`floor_plans` rows the per-event Documents tab already reads,
 * fanned out via get_vendor_documents (same RPC pattern as get_vendor_events).
 */
export async function getVendorDocumentsAcrossEvents(): Promise<VendorDocumentsByEvent[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  type Row = {
    assignmentId: string; eventId: string; eventName: string; eventDate: string | null; venueName: string;
    documents: { id: string; name: string; category: string; storageUrl: string; mimeType: string | null; notes: string | null }[];
    floorPlans: { id: string; name: string }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_documents");
  if (error) throw error;
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignmentId, eventId: r.eventId, eventName: r.eventName, eventDate: r.eventDate, venueName: r.venueName,
    documents: r.documents.map((d) => ({
      id: d.id, name: d.name, category: d.category, storageUrl: d.storageUrl, mimeType: d.mimeType, notes: d.notes,
    })),
    floorPlans: r.floorPlans,
  }));
}

/**
 * Vendor Workspace Realignment, Phase 7 (2026-07-22) — the top-level
 * Timeline destination: the vendor-visible timeline entries across every
 * booked event, grouped by event. Reuses the same collaborative Timeline
 * (timeline_entries, audiences @> array['vendors']) the per-event Timeline
 * tab already reads.
 */
export async function getVendorTimelineAcrossEvents(): Promise<VendorTimelineByEvent[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  type Row = {
    assignmentId: string; eventId: string; eventName: string; eventDate: string | null; venueName: string;
    entries: { id: string; time: string | null; title: string; description: string | null }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_timeline");
  if (error) throw error;
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignmentId, eventId: r.eventId, eventName: r.eventName, eventDate: r.eventDate, venueName: r.venueName,
    entries: r.entries.map((e) => ({ id: e.id, time: e.time, title: e.title, description: e.description, audiences: ["vendors"] })),
  }));
}
