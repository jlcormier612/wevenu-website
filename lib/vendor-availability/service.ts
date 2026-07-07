/**
 * Vendor availability service. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
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
  return {
    id:        d.id as string,
    vendorId:  d.vendor_id as string,
    date:      d.date as string,
    isBlocked: Boolean(d.is_blocked),
    note:      (d.note as string | null) ?? null,
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
    const { data, error } = await supabase
      .from("vendor_availability")
      .upsert(
        { vendor_id: vendorId, date, is_blocked: true, note: note ?? null },
        { onConflict: "vendor_id,date" },
      )
      .select("id")
      .single();
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true, id: data.id } as VendorActionResult & { id: string };
  });
  return result as VendorActionResult & { id?: string };
}

export async function unblockDate(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase) => {
    const { error } = await supabase.from("vendor_availability").delete().eq("id", id);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
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
