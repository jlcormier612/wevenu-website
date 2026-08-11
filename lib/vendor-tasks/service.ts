import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { offsetDate } from "@/lib/playbooks/due-dates";
import { getVendorEvents } from "@/lib/vendor-events/service";
import { parseDaysOffsetInput } from "@/lib/vendor-task-templates/presets";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { deriveCompletionAuthority } from "@/lib/vendor-tasks/completion-authority";
import type {
  VendorActionResult,
  VendorPersonalTask,
  VendorPersonalTaskInput,
  VendorTaskCoupleVisibility,
} from "@/lib/vendors/types";

function parseDaysOffset(value: unknown): number | null {
  return parseDaysOffsetInput(value as string | number | null | undefined);
}

const VISIBILITIES: VendorTaskCoupleVisibility[] = ["private", "visible", "owned"];

function normalizeVisibility(value: unknown): VendorTaskCoupleVisibility {
  return VISIBILITIES.includes(value as VendorTaskCoupleVisibility)
    ? (value as VendorTaskCoupleVisibility)
    : "private";
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

function mapCompletionAuthority(
  r: Record<string, unknown>,
  coupleVisibility: VendorTaskCoupleVisibility,
  actionType: "share_timeline" | null,
): VendorPersonalTask["completionAuthority"] {
  const stored = r.completion_authority;
  if (
    stored === "couple_acknowledge" ||
    stored === "vendor_confirm" ||
    stored === "action_verified"
  ) {
    return stored;
  }
  return deriveCompletionAuthority({ coupleVisibility, actionType });
}

function mapTask(r: Record<string, unknown>): VendorPersonalTask {
  const coupleVisibility = normalizeVisibility(r.couple_visibility);
  const actionType = r.action_type === "share_timeline" ? "share_timeline" : null;
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
    completionAuthority: mapCompletionAuthority(r, coupleVisibility, actionType),
    coupleAcknowledgedAt: (r.couple_acknowledged_at as string | null) ?? null,
    vendorReturnNote: (r.vendor_return_note as string | null) ?? null,
    returnedAt:       (r.returned_at as string | null) ?? null,
    completedBy:      (r.completed_by as "couple" | "vendor" | null) ?? null,
    completedAt:      (r.completed_at as string | null) ?? null,
    createdAt:        r.created_at as string,
  };
}

export async function getVendorTasks(
  vendorId: string,
  filter?: { status?: "pending" | "complete"; eventId?: string },
): Promise<VendorPersonalTask[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from("vendor_tasks")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("due_date", { ascending: true, nullsFirst: false });

  if (filter?.status)  query = query.eq("status", filter.status);
  if (filter?.eventId) query = query.eq("event_id", filter.eventId);

  const { data } = await query;
  return ((data ?? []) as Record<string, unknown>[]).map(mapTask);
}

export async function createVendorTask(
  input: VendorPersonalTaskInput,
): Promise<VendorActionResult & { id?: string }> {
  const result = await withVendor(async (supabase, vendorId) => {
    const daysOffset = parseDaysOffset(input.daysOffset);
    let dueDate: string | null = input.dueDate || null;

    // Event-scoped tasks prefer relative offsets (same as template apply).
    // Vendors cannot SELECT events via RLS — resolve date through the
    // assignment-backed list RPC used elsewhere in the vendor portal.
    if (daysOffset != null && input.eventId) {
      const events = await getVendorEvents();
      const eventDate =
        events.find((e) => e.eventId === input.eventId)?.eventDate ?? null;
      dueDate = eventDate ? offsetDate(eventDate, daysOffset) : null;
    } else if (daysOffset != null) {
      // Relative offset without an event can't resolve a calendar day.
      dueDate = null;
    }

    const coupleVisibility = normalizeVisibility(input.coupleVisibility);
    const actionType = input.actionType === "share_timeline" ? "share_timeline" : null;
    const requireVendorConfirmation =
      Boolean(input.requireVendorConfirmation)
      && coupleVisibility === "owned"
      && actionType == null;
    const completionAuthority = requireVendorConfirmation
      ? "vendor_confirm"
      : deriveCompletionAuthority({ coupleVisibility, actionType });

    const { data, error } = await supabase
      .from("vendor_tasks")
      .insert({
        vendor_id:          vendorId,
        vendor_inquiry_id:  input.vendorInquiryId || null,
        event_id:           input.eventId || null,
        title:              input.title.trim(),
        due_date:           dueDate,
        days_offset:        daysOffset,
        notes:              input.notes || null,
        source:             "manual",
        couple_visibility:  coupleVisibility,
        action_type:        actionType,
        completion_authority: completionAuthority,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: (data as { id: string }).id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function completeVendorTask(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { data: row, error: fetchError } = await supabase
      .from("vendor_tasks")
      .select("id, vendor_id, couple_visibility, completion_authority, couple_acknowledged_at, status")
      .eq("id", id)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (fetchError) return { ok: false, message: fetchError.message } as VendorActionResult;
    if (!row) return { ok: false, message: "Task not found." } as VendorActionResult;

    const r = row as {
      couple_visibility: string;
      completion_authority: string;
      couple_acknowledged_at: string | null;
      status: string;
    };

    // Owned + vendor_confirm: require couple ack via confirm_vendor_task RPC.
    if (
      r.completion_authority === "vendor_confirm"
      && r.couple_visibility === "owned"
    ) {
      const { data, error } = await supabase.rpc("confirm_vendor_task", { p_task_id: id });
      if (error) return { ok: false, message: error.message } as VendorActionResult;
      const payload = (data ?? {}) as { ok?: boolean; error?: string };
      if (!payload.ok) {
        if (payload.error === "ack_required") {
          return {
            ok: false,
            message: "Wait until the couple says this is done before confirming.",
          } as VendorActionResult;
        }
        return { ok: false, message: payload.error ?? "Could not confirm task." } as VendorActionResult;
      }
      return { ok: true } as VendorActionResult;
    }

    const { error } = await supabase
      .from("vendor_tasks")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        completed_by: "vendor",
      })
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

/** Needs-changes v1: return acked vendor_confirm task to couple (never completes). */
export async function returnVendorTask(
  id: string,
  note: string,
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const trimmed = note.trim();
    if (!trimmed) {
      return { ok: false, message: "Please tell the couple what needs to change." } as VendorActionResult;
    }
    const { data, error } = await supabase.rpc("return_vendor_task", {
      p_task_id: id,
      p_note: trimmed,
    });
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    const payload = (data ?? {}) as { ok?: boolean; error?: string };
    if (!payload.ok) {
      const err = payload.error ?? "could_not_return";
      if (err === "ack_required") {
        return {
          ok: false,
          message: "The couple has not said this is done yet.",
        } as VendorActionResult;
      }
      if (err === "note_required") {
        return {
          ok: false,
          message: "Please tell the couple what needs to change.",
        } as VendorActionResult;
      }
      return { ok: false, message: err } as VendorActionResult;
    }
    // Silence unused vendorId — auth is inside the RPC via current_user_vendor_id.
    void vendorId;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function uncompleteVendorTask(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_tasks")
      .update({ status: "pending", completed_at: null, completed_by: null })
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function updateVendorTaskCoupleVisibility(
  id: string,
  coupleVisibility: VendorTaskCoupleVisibility,
  opts?: { requireVendorConfirmation?: boolean },
): Promise<VendorActionResult> {
  const visibility = normalizeVisibility(coupleVisibility);
  const result = await withVendor(async (supabase, vendorId) => {
    const { data: row, error: fetchError } = await supabase
      .from("vendor_tasks")
      .select("id, event_id, action_type")
      .eq("id", id)
      .eq("vendor_id", vendorId)
      .maybeSingle();
    if (fetchError) return { ok: false, message: fetchError.message } as VendorActionResult;
    if (!row) return { ok: false, message: "Task not found." } as VendorActionResult;
    // Sharing requires an event-scoped task (never eventless personal tasks).
    if (visibility !== "private" && !(row as { event_id: string | null }).event_id) {
      return { ok: false, message: "Only event tasks can be shared with the couple." } as VendorActionResult;
    }
    let actionType =
      (row as { action_type: string | null }).action_type === "share_timeline"
        ? "share_timeline" as const
        : null;
    const requireVendorConfirmation =
      Boolean(opts?.requireVendorConfirmation)
      && visibility === "owned";
    if (requireVendorConfirmation) {
      actionType = null;
    }
    const completionAuthority = requireVendorConfirmation
      ? "vendor_confirm"
      : deriveCompletionAuthority({ coupleVisibility: visibility, actionType });

    const patch: Record<string, unknown> = {
      couple_visibility: visibility,
      action_type: actionType,
      completion_authority: completionAuthority,
    };
    // Leaving the owned vendor_confirm lane clears intermediate ack.
    const staysOwnedVendorConfirm =
      completionAuthority === "vendor_confirm" && visibility === "owned";
    if (!staysOwnedVendorConfirm) {
      patch.couple_acknowledged_at = null;
      patch.vendor_return_note = null;
      patch.returned_at = null;
    }

    const { error } = await supabase
      .from("vendor_tasks")
      .update(patch)
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function deleteVendorTask(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_tasks")
      .delete()
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function getPendingTaskCount(vendorId: string): Promise<number> {
  if (!isSupabaseConfigured) return 0;
  const supabase = await createClient();
  const today = new Date();
  const weekFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  // Exclude orphan personal tasks (no event_id) — hidden from UI.
  const { count } = await supabase
    .from("vendor_tasks")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .eq("status", "pending")
    .not("event_id", "is", null)
    .lte("due_date", weekFromNow);
  return count ?? 0;
}
