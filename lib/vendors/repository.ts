/**
 * Vendor data access layer. Server-only.
 */
import { createClient } from "@/integrations/supabase/server";
import type {
  EventVendorAssignment,
  Vendor,
  VendorAssignmentInput,
  VendorEventSummary,
  VendorInput,
  VendorWithEvents,
} from "@/lib/vendors/types";

type DbClient = Awaited<ReturnType<typeof createClient>>;

type VendorRow = {
  id: string; venue_id: string; name: string; category: string | null;
  contact_name: string | null; email: string | null; phone: string | null;
  website: string | null;
  instagram_url: string | null; facebook_url: string | null;
  pinterest_url: string | null; tiktok_url: string | null;
  is_preferred: boolean; notes: string | null;
  created_at: string; updated_at: string;
};

type EVARow = {
  id: string; venue_id: string; event_id: string; vendor_id: string;
  arrival_time: string | null; notes: string | null; created_at: string;
  vendors: { name: string; category: string | null; contact_name: string | null; phone: string | null } | null;
};

type EVAEventRow = {
  id: string; event_id: string; arrival_time: string | null;
  events: { name: string; event_date: string | null } | null;
};

function mapVendor(r: VendorRow): Vendor {
  return {
    id: r.id, venueId: r.venue_id, name: r.name, category: r.category,
    contactName: r.contact_name, email: r.email, phone: r.phone,
    website: r.website,
    instagramUrl: r.instagram_url, facebookUrl: r.facebook_url,
    pinterestUrl: r.pinterest_url, tiktokUrl: r.tiktok_url,
    isPreferred: r.is_preferred, notes: r.notes,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapEVA(r: EVARow): EventVendorAssignment {
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id, vendorId: r.vendor_id,
    vendorName: r.vendors?.name ?? "Unknown vendor",
    vendorCategory: r.vendors?.category ?? null,
    vendorPhone: r.vendors?.phone ?? null,
    arrivalTime: r.arrival_time?.slice(0, 5) ?? null,
    notes: r.notes, createdAt: r.created_at,
  };
}

// ---- vendor directory -------------------------------------------------------

export async function getVendors(client: DbClient, venueId: string): Promise<Vendor[]> {
  const { data, error } = await client.from("vendors").select("*")
    .eq("venue_id", venueId)
    .order("is_preferred", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data as VendorRow[]).map(mapVendor);
}

export async function getVendor(client: DbClient, venueId: string, vendorId: string): Promise<VendorWithEvents | null> {
  const [vRes, aRes] = await Promise.all([
    client.from("vendors").select("*").eq("id", vendorId).eq("venue_id", venueId).maybeSingle<VendorRow>(),
    client.from("event_vendor_assignments")
      .select("id, event_id, arrival_time, events(name, event_date)")
      .eq("vendor_id", vendorId).eq("venue_id", venueId)
      .order("created_at", { ascending: false }).limit(20),
  ]);
  if (vRes.error) throw vRes.error;
  if (aRes.error) throw aRes.error;
  if (!vRes.data) return null;
  const assignments: VendorEventSummary[] = (aRes.data as unknown as EVAEventRow[]).map((r) => ({
    id: r.id, eventId: r.event_id,
    eventName: (r.events as { name: string } | null)?.name ?? "Unknown event",
    eventDate: (r.events as { event_date: string | null } | null)?.event_date ?? null,
    arrivalTime: r.arrival_time?.slice(0, 5) ?? null,
  }));
  return { ...mapVendor(vRes.data), assignments };
}

function toVendorRow(venueId: string, input: VendorInput): Record<string, unknown> {
  return {
    venue_id: venueId, name: input.name.trim(),
    category: input.category || null, contact_name: input.contactName.trim() || null,
    email: input.email.trim() || null, phone: input.phone.trim() || null,
    website: input.website.trim() || null,
    instagram_url: input.instagramUrl.trim() || null,
    facebook_url: input.facebookUrl.trim() || null,
    pinterest_url: input.pinterestUrl.trim() || null,
    tiktok_url: input.tiktokUrl.trim() || null,
    is_preferred: input.isPreferred,
    notes: input.notes.trim() || null,
  };
}

export async function insertVendor(client: DbClient, venueId: string, input: VendorInput): Promise<string> {
  const { data, error } = await client.from("vendors").insert(toVendorRow(venueId, input))
    .select("id").single<{ id: string }>();
  if (error) throw error;
  return data.id;
}

export async function updateVendor(client: DbClient, venueId: string, vendorId: string, input: VendorInput): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (client.from("vendors") as any)
    .update(toVendorRow(venueId, input)).eq("id", vendorId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function deleteVendor(client: DbClient, venueId: string, vendorId: string): Promise<void> {
  const { error } = await client.from("vendors").delete().eq("id", vendorId).eq("venue_id", venueId);
  if (error) throw error;
}

// ---- event vendor assignments -----------------------------------------------

export async function getEventVendorAssignments(
  client: DbClient, venueId: string, eventId: string,
): Promise<EventVendorAssignment[]> {
  const { data, error } = await client
    .from("event_vendor_assignments")
    .select("*, vendors(name, category, contact_name, phone)")
    .eq("event_id", eventId).eq("venue_id", venueId)
    .order("arrival_time", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as EVARow[]).map(mapEVA);
}

export async function insertVendorAssignment(
  client: DbClient, venueId: string, eventId: string, input: VendorAssignmentInput,
): Promise<EventVendorAssignment> {
  const { data, error } = await client.from("event_vendor_assignments")
    .insert({
      venue_id: venueId, event_id: eventId, vendor_id: input.vendorId,
      arrival_time: input.arrivalTime || null, notes: input.notes.trim() || null,
    })
    .select("*, vendors(name, category, contact_name, phone)").single<EVARow>();
  if (error) throw error;
  return mapEVA(data);
}

export async function deleteVendorAssignment(
  client: DbClient, venueId: string, assignmentId: string,
): Promise<void> {
  const { error } = await client.from("event_vendor_assignments")
    .delete().eq("id", assignmentId).eq("venue_id", venueId);
  if (error) throw error;
}

export async function updateVendorAssignment(
  client: DbClient, venueId: string, assignmentId: string,
  input: { arrivalTime: string; notes: string },
): Promise<void> {
  const { error } = await client.from("event_vendor_assignments")
    .update({ arrival_time: input.arrivalTime || null, notes: input.notes.trim() || null })
    .eq("id", assignmentId).eq("venue_id", venueId);
  if (error) throw error;
}
