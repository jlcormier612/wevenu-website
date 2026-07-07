import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
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

export async function getVendorEvents(
  vendorId: string,
): Promise<VendorEventListItem[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const today    = new Date().toISOString().slice(0, 10);

  type Row = {
    id: string;
    event_id: string;
    arrival_time: string | null;
    events: { id: string; name: string; event_date: string | null; venues: { name: string } | null } | null;
  };

  const { data } = await supabase
    .from("event_vendor_assignments")
    .select("id, event_id, arrival_time, events(id, name, event_date, venues(name))")
    .eq("vendor_id", vendorId)
    .order("events(event_date)", { ascending: false });

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    assignmentId: r.id,
    eventId:      r.event_id,
    eventName:    r.events?.name ?? "Unnamed Event",
    eventDate:    r.events?.event_date ?? null,
    venueName:    r.events?.venues?.name ?? "Unknown Venue",
    arrivalTime:  r.arrival_time,
    isUpcoming:   !!r.events?.event_date && r.events.event_date >= today,
  }));
}

export async function getVendorEventDetail(
  assignmentId: string,
  vendorId:     string,
): Promise<VendorEventDetail | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();

  // Fetch assignment + event + venue in one query
  type AssRow = {
    id: string;
    event_id: string;
    arrival_time: string | null;
    setup_location: string | null;
    load_in_notes: string | null;
    internal_notes: string | null;
    notes: string | null;
    checked_in_at: string | null;
    setup_complete_at: string | null;
    share_couple_email: boolean;
    share_couple_phone: boolean;
    events: {
      id: string;
      name: string;
      event_date: string | null;
      event_type: string | null;
      venues: { id: string; name: string } | null;
    } | null;
  };

  const { data: assRow } = await supabase
    .from("event_vendor_assignments")
    .select(`
      id, event_id, arrival_time, setup_location, load_in_notes,
      internal_notes, notes, checked_in_at, setup_complete_at,
      share_couple_email, share_couple_phone,
      events(id, name, event_date, event_type, venues(id, name))
    `)
    .eq("id", assignmentId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (!assRow) return null;
  const ass = assRow as unknown as AssRow;
  const event = ass.events;
  if (!event) return null;

  const eventId  = ass.event_id;
  const venueId  = event.venues?.id ?? "";

  // Parallel fetch all tab data
  type ClientRow = { id: string; partner1_name: string | null; partner2_name: string | null; email: string | null; phone: string | null };
  type TimelineRow = { id: string; time: string | null; title: string; description: string | null; audiences: string[] };
  type TaskRow = { id: string; title: string; description: string | null; category: string; visibility: string; due_date: string | null; status: string; is_required: boolean; completed_at: string | null };
  type PersonalTaskRow = Record<string, unknown>;
  type DocRow = { id: string; name: string; category: string; storage_url: string; mime_type: string | null; notes: string | null };
  type MsgThreadRow = { id: string; subject: string | null; updated_at: string; message_count: number };

  const [clientRes, timelineRes, taskRes, personalTaskRes, docRes, threadRes] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, partner1_name, partner2_name, email, phone")
        .eq("event_id", eventId)
        .maybeSingle(),
      supabase
        .from("timeline_entries")
        .select("id, time, title, description, audiences")
        .eq("event_id", eventId)
        .contains("audiences", ["vendor"])
        .order("time", { ascending: true, nullsFirst: true }),
      supabase
        .from("event_tasks")
        .select("id, title, description, category, visibility, due_date, status, is_required, completed_at")
        .eq("event_id", eventId)
        .in("visibility", ["vendor_visible", "vendor_owned"]),
      supabase
        .from("vendor_tasks")
        .select("*")
        .eq("vendor_id", vendorId)
        .eq("event_id", eventId)
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase
        .from("event_documents")
        .select("id, name, category, storage_url, mime_type, notes")
        .eq("event_id", eventId)
        .eq("shared_with_vendors", true),
      supabase
        .from("message_threads")
        .select("id, subject, updated_at")
        .eq("event_id", eventId)
        .eq("vendor_id", vendorId),
    ]);

  const clientData = clientRes.data as ClientRow | null;

  const timeline: VendorTimelineEntry[] = ((timelineRes.data ?? []) as TimelineRow[]).map((r) => ({
    id:          r.id,
    time:        r.time,
    title:       r.title,
    description: r.description,
    audiences:   r.audiences,
  }));

  const eventTasks: VendorTask[] = ((taskRes.data ?? []) as TaskRow[]).map((r) => ({
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

  const personalTasks: VendorPersonalTask[] = ((personalTaskRes.data ?? []) as PersonalTaskRow[]).map((r) => ({
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

  const documents: VendorDocument[] = ((docRes.data ?? []) as DocRow[]).map((r) => ({
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

  const coupleName =
    [clientData?.partner1_name, clientData?.partner2_name].filter(Boolean).join(" & ") || null;

  const threads = (threadRes.data ?? []) as MsgThreadRow[];
  void threads;

  return {
    assignmentId:    ass.id,
    eventId,
    eventName:       event.name,
    eventDate:       event.event_date,
    eventType:       event.event_type,
    venueName:       event.venues?.name ?? "Unknown Venue",
    venueId,
    arrivalTime:     ass.arrival_time,
    setupLocation:   ass.setup_location,
    loadInNotes:     ass.load_in_notes,
    internalNotes:   ass.internal_notes,
    coupleName,
    coupleEmail:     ass.share_couple_email ? (clientData?.email ?? null) : null,
    couplePhone:     ass.share_couple_phone ? (clientData?.phone ?? null) : null,
    checkedInAt:     ass.checked_in_at,
    setupCompleteAt: ass.setup_complete_at,
    timeline,
    eventTasks,
    personalTasks,
    documents,
    activityFeed,
  };
}

export async function updateAssignmentNotes(
  assignmentId: string,
  notes:        string,
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("event_vendor_assignments")
      .update({ internal_notes: notes || null })
      .eq("id", assignmentId)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function completeEventTask(
  taskId:   string,
  vendorId: string,
): Promise<VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const supabase = await createClient();
  // Only allow completing vendor_owned tasks
  const { error } = await supabase
    .from("event_tasks")
    .update({ status: "complete", completed_at: new Date().toISOString() })
    .eq("id", taskId)
    .eq("visibility", "vendor_owned");
  void vendorId;
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
