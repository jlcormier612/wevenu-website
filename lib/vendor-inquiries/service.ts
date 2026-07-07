import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getVendorUser } from "@/lib/vendor-auth/service";
import type {
  VendorActionResult,
  VendorInquiry,
  VendorInquiryInput,
  InquiryStatus,
} from "@/lib/vendors/types";

async function withVendor<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, vendorId: string) => Promise<T>,
): Promise<T | VendorActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const vendorUser = await getVendorUser();
  if (!vendorUser) return { ok: false, message: "No vendor account found." };
  const supabase = await createClient();
  return fn(supabase, vendorUser.vendorId);
}

function mapInquiry(r: Record<string, unknown>, venueName?: string | null): VendorInquiry {
  return {
    id:                      r.id as string,
    vendorId:                r.vendor_id as string,
    venueId:                 (r.venue_id as string | null) ?? null,
    venueName:               venueName ?? null,
    eventVendorAssignmentId: (r.event_vendor_assignment_id as string | null) ?? null,
    source:                  (r.source as string) ?? "manual",
    status:                  (r.status as InquiryStatus) ?? "new",
    contactName:             (r.contact_name as string | null) ?? null,
    contactEmail:            (r.contact_email as string | null) ?? null,
    eventDate:               (r.event_date as string | null) ?? null,
    eventType:               (r.event_type as string | null) ?? null,
    notes:                   (r.notes as string | null) ?? null,
    followUpAt:              (r.follow_up_at as string | null) ?? null,
    createdAt:               r.created_at as string,
    updatedAt:               r.updated_at as string,
  };
}

export async function getVendorInquiries(
  vendorId: string,
  status?: InquiryStatus,
): Promise<VendorInquiry[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();

  let query = supabase
    .from("vendor_inquiries")
    .select("*, venues(name)")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data } = await query;
  if (!data) return [];

  type Row = Record<string, unknown> & { venues: { name: string } | null };
  return (data as unknown as Row[]).map((r) =>
    mapInquiry(r, r.venues?.name ?? null),
  );
}

export async function getVendorInquiry(
  id: string,
  vendorId: string,
): Promise<VendorInquiry | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_inquiries")
    .select("*, venues(name)")
    .eq("id", id)
    .eq("vendor_id", vendorId)
    .maybeSingle();
  if (!data) return null;
  type Row = Record<string, unknown> & { venues: { name: string } | null };
  const row = data as unknown as Row;
  return mapInquiry(row, row.venues?.name ?? null);
}

export async function createVendorInquiry(
  input: VendorInquiryInput,
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase.from("vendor_inquiries").insert({
      vendor_id:    vendorId,
      venue_id:     input.venueId || null,
      source:       input.source || "manual",
      status:       "new",
      contact_name:  input.contactName || null,
      contact_email: input.contactEmail || null,
      event_date:   input.eventDate || null,
      event_type:   input.eventType || null,
      notes:        input.notes || null,
    });
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function updateVendorInquiry(
  id: string,
  input: Partial<VendorInquiryInput & { status: InquiryStatus; followUpAt: string }>,
): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.venueId !== undefined)      update.venue_id      = input.venueId || null;
    if (input.contactName !== undefined)  update.contact_name  = input.contactName || null;
    if (input.contactEmail !== undefined) update.contact_email = input.contactEmail || null;
    if (input.eventDate !== undefined)    update.event_date    = input.eventDate || null;
    if (input.eventType !== undefined)    update.event_type    = input.eventType || null;
    if (input.notes !== undefined)        update.notes         = input.notes || null;
    if (input.followUpAt !== undefined)   update.follow_up_at  = input.followUpAt || null;
    if (input.status !== undefined)       update.status        = input.status;

    const { error } = await supabase
      .from("vendor_inquiries")
      .update(update)
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function updateInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<VendorActionResult> {
  return updateVendorInquiry(id, { status });
}

export async function deleteVendorInquiry(id: string): Promise<VendorActionResult> {
  const result = await withVendor(async (supabase, vendorId) => {
    const { error } = await supabase
      .from("vendor_inquiries")
      .delete()
      .eq("id", id)
      .eq("vendor_id", vendorId);
    if (error) return { ok: false, message: error.message } as VendorActionResult;
    return { ok: true } as VendorActionResult;
  });
  return result as VendorActionResult;
}

export async function getInquiryCounts(
  vendorId: string,
): Promise<Record<InquiryStatus, number>> {
  if (!isSupabaseConfigured) return {} as Record<InquiryStatus, number>;
  const supabase = await createClient();
  const { data } = await supabase
    .from("vendor_inquiries")
    .select("status")
    .eq("vendor_id", vendorId);

  const counts = {} as Record<InquiryStatus, number>;
  for (const row of data ?? []) {
    const s = row.status as InquiryStatus;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}
