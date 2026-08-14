import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { clientDisplayName } from "@/lib/clients/constants";
import * as conversationsRepo from "@/lib/conversations/repository";
import { getVendorSharedFloorPlans } from "@/lib/floor-plans/repository";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { getVendorNotifications } from "@/lib/vendor-notifications/service";
import { vendorHasPendingLeaveRequest } from "@/lib/vendor-removal-requests/service";
import { deriveCompletionAuthority } from "@/lib/vendor-tasks/completion-authority";
import type { VendorNotification } from "@/lib/vendor-notifications/types";
import type {
  VendorActionResult,
  VendorEventDetail,
  VendorEventListItem,
  VendorActivityItem,
  VendorPersonalTask,
} from "@/lib/vendors/types";
import type {
  VendorTimelineEntry,
  VendorTask,
  VendorDocument,
  VendorDocumentsByEvent,
  VendorTimelineByEvent,
} from "@/lib/vendor-portal/types";

const ACTIVITY_FYI_MS = 72 * 60 * 60 * 1000;
const ACTIVITY_CAP = 5;

const ACTION_TYPE_RANK: Record<string, number> = {
  message_waiting: 0,
  new_task: 1,
  document_shared: 2,
};

function withinFyiWindow(iso: string, nowMs: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t) || t <= 0) return false;
  return nowMs - t <= ACTIVITY_FYI_MS;
}

function newestIso(isos: string[]): string | null {
  const valid = isos.filter((s) => {
    const t = Date.parse(s);
    return Number.isFinite(t) && t > 0;
  });
  if (valid.length === 0) return null;
  return valid.sort((a, b) => b.localeCompare(a))[0]!;
}

/** Soft-ack via notification read_at; missing notif older than 72h = addressed. */
function softAckState(
  notifs: VendorNotification[],
  assetOccurredAt: string | null | undefined,
  nowMs: number,
): { addressed: boolean; unreadIds: string[]; occurredAt: string | null } {
  if (notifs.length > 0) {
    const unread = notifs.filter((n) => !n.readAt);
    const stamp =
      newestIso(unread.map((n) => n.createdAt)) ??
      newestIso(notifs.map((n) => n.createdAt)) ??
      assetOccurredAt ??
      null;
    if (unread.length === 0) {
      return { addressed: true, unreadIds: [], occurredAt: stamp };
    }
    return {
      addressed: false,
      unreadIds: unread.map((n) => n.id),
      occurredAt: stamp,
    };
  }
  if (!assetOccurredAt || !Number.isFinite(Date.parse(assetOccurredAt)) || Date.parse(assetOccurredAt) <= 0) {
    return { addressed: true, unreadIds: [], occurredAt: null };
  }
  if (!withinFyiWindow(assetOccurredAt, nowMs)) {
    return { addressed: true, unreadIds: [], occurredAt: assetOccurredAt };
  }
  return { addressed: false, unreadIds: [], occurredAt: assetOccurredAt };
}

function buildVendorActivityFeed(input: {
  assignmentId: string;
  eventId: string;
  eventTasks: VendorTask[];
  documents: VendorDocument[];
  notifications: VendorNotification[];
  conversations: Awaited<ReturnType<typeof conversationsRepo.getVendorConversationInbox>>["conversations"];
  floorPlans: { id: string; name: string; updatedAt: string }[];
}): VendorActivityItem[] {
  const nowMs = Date.now();
  const scoped = input.notifications.filter(
    (n) => n.assignmentId === input.assignmentId || n.eventId === input.eventId,
  );
  const taskNotifs = scoped.filter((n) => n.type === "new_task");
  const docNotifs = scoped.filter((n) => n.type === "document_shared");
  const items: VendorActivityItem[] = [];

  // message_waiting — prefer conversation unread over notification read_at
  for (const thread of input.conversations.filter((c) => c.eventId === input.eventId)) {
    if (thread.contactUnread <= 0) continue;
    const occurredAt = thread.lastMessageAt ?? newestIso(
      scoped.filter((n) => n.type === "new_message").map((n) => n.createdAt),
    );
    if (!occurredAt) continue;
    const actor = thread.counterpartyLabel === "Couple" ? "couple" as const : "venue" as const;
    items.push({
      id: `msg-${thread.conversationId}`,
      type: "message_waiting",
      description: `${thread.counterpartyLabel} is waiting on a reply`,
      occurredAt,
      actor,
      needsAction: true,
      hrefTab: "messages",
      thread: thread.conversationKind === "couple_vendor" ? "couple" : "venue",
    });
  }

  // new_task — open tasks; soft-ack via new_task notification read_at
  for (const task of input.eventTasks) {
    if (task.status === "complete") continue;
    const matches = taskNotifs.filter((n) => n.body === task.title);
    // No matching notif and no task created_at in this RPC → treat as addressed (no ghosts)
    if (matches.length === 0) continue;
    const { addressed, unreadIds, occurredAt } = softAckState(matches, null, nowMs);
    if (addressed || !occurredAt) continue;
    items.push({
      id: `task-${task.id}`,
      type: "new_task",
      description: `New task: ${task.title}`,
      occurredAt,
      actor: "venue",
      needsAction: true,
      hrefTab: "tasks",
      notificationIds: unreadIds,
    });
  }

  // document_shared — venue docs + floor plans; soft-ack via notif read_at
  const claimedDocNotifIds = new Set<string>();

  for (const doc of input.documents) {
    const matches = docNotifs.filter((n) => n.body === doc.name);
    matches.forEach((n) => claimedDocNotifIds.add(n.id));
    const { addressed, unreadIds, occurredAt } = softAckState(matches, doc.createdAt ?? null, nowMs);
    if (addressed || !occurredAt) continue;
    items.push({
      id: `doc-${doc.id}`,
      type: "document_shared",
      description: `Document shared: ${doc.name}`,
      occurredAt,
      actor: "venue",
      needsAction: true,
      hrefTab: "documents",
      notificationIds: unreadIds,
    });
  }

  for (const plan of input.floorPlans) {
    const matches = docNotifs.filter(
      (n) => n.body === plan.name || n.body === (plan.name.trim() || "Floor plan"),
    );
    matches.forEach((n) => claimedDocNotifIds.add(n.id));
    const { addressed, unreadIds, occurredAt } = softAckState(matches, plan.updatedAt, nowMs);
    if (addressed || !occurredAt) continue;
    items.push({
      id: `fp-${plan.id}`,
      type: "document_shared",
      description: `Floor plan shared: ${plan.name.trim() || "Floor plan"}`,
      occurredAt,
      actor: "venue",
      needsAction: true,
      hrefTab: "documents",
      notificationIds: unreadIds,
    });
  }

  // Unmatched document_shared notifs (rename / race) — still action-needed while unread
  for (const n of docNotifs) {
    if (claimedDocNotifIds.has(n.id) || n.readAt) continue;
    items.push({
      id: `docnotif-${n.id}`,
      type: "document_shared",
      description: n.body?.trim()
        ? `${n.title.includes("Floor plan") ? "Floor plan" : "Document"} shared: ${n.body.trim()}`
        : (n.title || "Document shared"),
      occurredAt: n.createdAt,
      actor: "venue",
      needsAction: true,
      hrefTab: "documents",
      notificationIds: [n.id],
    });
  }

  // task_complete — FYI only within 72h; skip vendor-owned (self) completes
  for (const task of input.eventTasks) {
    if (!task.completedAt || task.status !== "complete") continue;
    if (!withinFyiWindow(task.completedAt, nowMs)) continue;
    if (task.visibility === "vendor_owned") continue;
    items.push({
      id: `done-${task.id}`,
      type: "task_complete",
      description: `Completed: ${task.title}`,
      occurredAt: task.completedAt,
      actor: "venue",
      needsAction: false,
      hrefTab: "tasks",
    });
  }

  const action = items
    .filter((i) => i.needsAction)
    .sort((a, b) => {
      const ra = ACTION_TYPE_RANK[a.type] ?? 9;
      const rb = ACTION_TYPE_RANK[b.type] ?? 9;
      if (ra !== rb) return ra - rb;
      return b.occurredAt.localeCompare(a.occurredAt);
    });
  const fyi = items
    .filter((i) => !i.needsAction)
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

  return [...action, ...fyi].slice(0, ACTIVITY_CAP);
}

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
    event_end_date: string | null;
    venue_id: string; venue_name: string; arrival_time: string | null; is_upcoming: boolean;
  };

  const { data, error } = await supabase.rpc("get_vendor_events");
  // Soft-fail: layout + home call this on every vendor navigation / server-action
  // refresh. Throwing a raw PostgREST/Kong object surfaces as opaque
  // `{message: ...}` Runtime Errors even when the triggering mutation succeeded.
  if (error) {
    console.error("[getVendorEvents]", error.message);
    return [];
  }
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignment_id,
    eventId:      r.event_id,
    eventName:    r.event_name,
    eventDate:    r.event_date,
    eventEndDate: r.event_end_date,
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
    event: { id: string; name: string; event_date: string | null; event_end_date: string | null; event_type: string | null; venue_id: string; venue_name: string } | null;
    client: { first_name: string | null; last_name: string | null; partner_first_name: string | null; partner_last_name: string | null; email: string | null; phone: string | null } | null;
    timeline: { id: string; entry_time: string | null; day_offset?: number; title: string; description: string | null; audiences: string[] }[];
    event_tasks: { id: string; title: string; description: string | null; category: string; visibility: string; due_date: string | null; days_offset: number | null; due_date_locked?: boolean; status: string; is_required: boolean; completed_at: string | null }[];
    documents: { id: string; name: string; category: string; storage_url: string; mime_type: string | null; notes: string | null; created_at?: string | null }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_event_detail", { p_assignment_id: assignmentId });
  if (error) throw new Error(error.message);
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

  const timeline: VendorTimelineEntry[] = (payload.timeline ?? []).map((r) => ({
    id:          r.id,
    time:        r.entry_time,
    dayOffset:   r.day_offset ?? 0,
    title:       r.title,
    description: r.description,
    audiences:   r.audiences ?? [],
  }));

  const eventTasks: VendorTask[] = payload.event_tasks.map((r) => ({
    id:          r.id,
    title:       r.title,
    description: r.description,
    category:    r.category,
    visibility:  r.visibility as VendorTask["visibility"],
    dueDate:     r.due_date,
    daysOffset:  r.days_offset ?? null,
    dueDateLocked: r.due_date_locked ?? false,
    status:      r.status,
    isRequired:  r.is_required,
    completedAt: r.completed_at,
    canComplete: r.visibility === "vendor_owned",
  }));

  const personalTaskRows = (personalTaskData ?? []) as PersonalTaskRow[];
  const personalTaskIds = personalTaskRows.map((r) => r.id as string);
  const attachmentsByTask = new Map<string, { id: string; name: string; storageUrl: string; mimeType: string | null }[]>();
  if (personalTaskIds.length > 0) {
    const { data: attData } = await supabase
      .from("vendor_task_attachments")
      .select("id, vendor_task_id, name, storage_url, mime_type")
      .in("vendor_task_id", personalTaskIds)
      .order("sort_order", { ascending: true });
    for (const a of (attData ?? []) as {
      id: string; vendor_task_id: string; name: string; storage_url: string; mime_type: string | null;
    }[]) {
      const list = attachmentsByTask.get(a.vendor_task_id) ?? [];
      list.push({
        id: a.id,
        name: a.name,
        storageUrl: a.storage_url,
        mimeType: a.mime_type,
      });
      attachmentsByTask.set(a.vendor_task_id, list);
    }
  }

  const personalTasks: VendorPersonalTask[] = personalTaskRows.map((r) => {
    const coupleVisibility = (
      ["private", "visible", "owned"].includes(r.couple_visibility as string)
        ? r.couple_visibility
        : "private"
    ) as VendorPersonalTask["coupleVisibility"];
    const actionType = (
      r.action_type === "share_timeline" ? "share_timeline" : null
    ) as VendorPersonalTask["actionType"];
    const completionAuthority = (
      r.completion_authority === "couple_acknowledge" ||
      r.completion_authority === "vendor_confirm" ||
      r.completion_authority === "action_verified"
        ? r.completion_authority
        : deriveCompletionAuthority({ coupleVisibility, actionType })
    ) as VendorPersonalTask["completionAuthority"];
    return {
      id:               r.id as string,
      vendorId:         r.vendor_id as string,
      vendorInquiryId:  (r.vendor_inquiry_id as string | null) ?? null,
      eventId:          (r.event_id as string | null) ?? null,
      title:            r.title as string,
      dueDate:          (r.due_date as string | null) ?? null,
      daysOffset:       (r.days_offset as number | null) ?? null,
      templateId:       (r.template_id as string | null) ?? null,
      templateItemId:   (r.template_item_id as string | null) ?? null,
      status:           (r.status as "pending" | "complete") ?? "pending",
      source:           (r.source as VendorPersonalTask["source"]) ?? "manual",
      notes:            (r.notes as string | null) ?? null,
      coupleVisibility,
      actionType,
      completionAuthority,
      coupleAcknowledgedAt: (r.couple_acknowledged_at as string | null) ?? null,
      vendorReturnNote: (r.vendor_return_note as string | null) ?? null,
      returnedAt:       (r.returned_at as string | null) ?? null,
      completedBy:      (r.completed_by as "couple" | "vendor" | null) ?? null,
      completedAt:      (r.completed_at as string | null) ?? null,
      createdAt:        r.created_at as string,
      attachments:      attachmentsByTask.get(r.id as string) ?? [],
    };
  });

  const documents: VendorDocument[] = payload.documents.map((r) => ({
    id:         r.id,
    name:       r.name,
    category:   r.category,
    storageUrl: r.storage_url,
    mimeType:   r.mime_type,
    notes:      r.notes,
    createdAt:  r.created_at ?? null,
  }));

  // Hybrid Recent Activity: action-needed (unread / soft-ack) + FYI ≤72h.
  // Reuses conversation unread + vendor_notifications — no separate ack table.
  const [{ notifications }, inbox, floorPlans, hasPendingLeaveRequest] = await Promise.all([
    getVendorNotifications(80),
    conversationsRepo.getVendorConversationInbox(supabase),
    getVendorSharedFloorPlans(supabase, eventId).catch((err) => {
      console.error("[getVendorEventDetail] floor plans for activity:", err);
      return [] as Awaited<ReturnType<typeof getVendorSharedFloorPlans>>;
    }),
    vendorHasPendingLeaveRequest(assignmentId),
  ]);

  const activityFeed = buildVendorActivityFeed({
    assignmentId,
    eventId,
    eventTasks,
    documents,
    notifications,
    conversations: inbox.conversations,
    floorPlans,
  });

  const coupleName = clientDisplayName(
    payload.client?.first_name ?? "", payload.client?.last_name ?? "",
    payload.client?.partner_first_name, payload.client?.partner_last_name,
  ) || null;

  return {
    assignmentId:    ass.id,
    eventId,
    eventName:       event.name,
    eventDate:       event.event_date,
    eventEndDate:    event.event_end_date,
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
    hasPendingLeaveRequest,
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
 * Vendor self check-in / setup complete. Writes the same
 * checked_in_at / setup_complete_at columns the venue wedding-day board
 * toggles — via SECURITY DEFINER RPC because assignment RLS is venue-only.
 */
export async function toggleAssignmentCheckin(
  assignmentId: string,
  field: "checked_in" | "setup_complete",
): Promise<VendorActionResult & {
  checkedInAt?: string | null;
  setupCompleteAt?: string | null;
}> {
  const result = await withVendor(async (supabase) => {
    const { data, error } = await supabase.rpc("vendor_toggle_assignment_checkin", {
      p_assignment_id: assignmentId,
      p_field: field,
    });
    if (error) {
      return { ok: false, message: error.message } as VendorActionResult;
    }
    if (!data?.ok) {
      const err = typeof data?.error === "string" ? data.error : "Could not update day-of status.";
      return {
        ok: false,
        message:
          err === "unauthorized"
            ? "No vendor account found."
            : err === "not_found"
              ? "Assignment not found."
              : err === "invalid_field"
                ? "Invalid status field."
                : "Could not update day-of status.",
      } as VendorActionResult;
    }
    return {
      ok: true,
      checkedInAt: data.checkedInAt ?? undefined,
      setupCompleteAt: data.setupCompleteAt ?? undefined,
    };
  });
  return result as VendorActionResult & {
    checkedInAt?: string | null;
    setupCompleteAt?: string | null;
  };
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
    assignmentId: string; eventId: string; eventName: string; eventDate: string | null; eventEndDate: string | null; venueName: string;
    documents: { id: string; name: string; category: string; storageUrl: string; mimeType: string | null; notes: string | null }[];
    floorPlans: { id: string; name: string }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_documents");
  if (error) {
    console.error("[getVendorDocumentsAcrossEvents]", error.message);
    return [];
  }
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignmentId, eventId: r.eventId, eventName: r.eventName,
    eventDate: r.eventDate, eventEndDate: r.eventEndDate ?? null, venueName: r.venueName,
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
    assignmentId: string; eventId: string; eventName: string; eventDate: string | null; eventEndDate: string | null; venueName: string;
    entries: { id: string; time: string | null; dayOffset?: number; title: string; description: string | null }[];
  };

  const { data, error } = await supabase.rpc("get_vendor_timeline");
  if (error) {
    console.error("[getVendorTimelineAcrossEvents]", error.message);
    return [];
  }
  if (!data || "error" in data) return [];

  return ((data.events ?? []) as Row[]).map((r) => ({
    assignmentId: r.assignmentId, eventId: r.eventId, eventName: r.eventName,
    eventDate: r.eventDate, eventEndDate: r.eventEndDate ?? null, venueName: r.venueName,
    entries: r.entries.map((e) => ({
      id: e.id, time: e.time, dayOffset: e.dayOffset ?? 0,
      title: e.title, description: e.description, audiences: ["vendors"],
    })),
  }));
}
