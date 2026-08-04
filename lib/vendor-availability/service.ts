/**
 * Vendor availability service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import { reconcileVendorEventAvailability } from "@/lib/vendor-availability/sync";
import type { VendorActionResult, VendorAvailability } from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

function mapAvailability(d: Record<string, unknown>): VendorAvailability {
  const source = d.source === "event" ? "event" : "manual";
  return {
    id:        d.id as string,
    vendorId:  d.vendor_id as string,
    date:      d.date as string,
    isBlocked: Boolean(d.is_blocked),
    note:      (d.note as string | null) ?? null,
    source,
    sourceId:  (d.source_id as string | null) ?? null,
    createdAt: d.created_at as string,
  };
}

export async function getVendorAvailability(
  vendorId: string,
  year: number,
  month: number,
): Promise<VendorAvailability[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 0);
  const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  // Safety net: repair missing/orphaned event-sourced Booked rows before read.
  await reconcileVendorEventAvailability(vendorId, start, end);

  const { data } = await supabase
    .from("vendor_availability")
    .select("*")
    .eq("vendor_id", vendorId)
    .eq("is_blocked", true)
    .gte("date", start)
    .lte("date", end)
    .order("date");
  return (data ?? []).map(mapAvailability);
}

export async function blockDate(date: string, note?: string): Promise<VendorActionResult & { id?: string }> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { data: existing } = await supabase
      .from("vendor_availability")
      .select("id")
      .eq("vendor_id", vendorId)
      .eq("date", date)
      .eq("source", "manual")
      .maybeSingle<{ id: string }>();

    if (existing) {
      const { error } = await supabase
        .from("vendor_availability")
        .update({ is_blocked: true, note: note ?? null })
        .eq("id", existing.id);
      if (error) return { ok: false, message: error.message } as VendorActionResult;
      return { ok: true, id: existing.id } as VendorActionResult & { id: string };
    }

    const { data, error } = await supabase
      .from("vendor_availability")
      .insert({
        vendor_id:  vendorId,
        date,
        is_blocked: true,
        note:       note ?? null,
        source:     "manual",
        source_id:  null,
      })
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: data.id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function unblockDate(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    // Event-sourced Booked rows are locked — only manual blocks may be cleared.
    const { error, count } = await supabase
      .from("vendor_availability")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("source", "manual");
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    if (count === 0) {
      return { ok: false, message: "Booked dates from events cannot be unblocked here." } as VendorActionResult;
    }
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function updateAvailabilitySettings(
  settings: { acceptingInquiries: boolean; availabilityNotes: string },
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendors")
      .update({
        accepting_inquiries: settings.acceptingInquiries,
        availability_notes:  settings.availabilityNotes || null,
      })
      .eq("id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}
