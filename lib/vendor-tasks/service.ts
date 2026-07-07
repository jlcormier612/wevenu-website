import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type { VendorActionResult, VendorPersonalTask, VendorPersonalTaskInput } from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

function mapTask(r: Record<string, unknown>): VendorPersonalTask {
  return {
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
    const { data, error } = await supabase
      .from("vendor_tasks")
      .insert({
        vendor_id:          vendorId,
        vendor_inquiry_id:  input.vendorInquiryId || null,
        event_id:           input.eventId || null,
        title:              input.title.trim(),
        due_date:           input.dueDate || null,
        notes:              input.notes || null,
        source:             "manual",
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
    const { error } = await supabase
      .from("vendor_tasks")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function uncompleteVendorTask(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_tasks")
      .update({ status: "pending", completed_at: null })
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
  const { count } = await supabase
    .from("vendor_tasks")
    .select("id", { count: "exact", head: true })
    .eq("vendor_id", vendorId)
    .eq("status", "pending")
    .lte("due_date", weekFromNow);
  return count ?? 0;
}
