import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export type VendorHandbookVenue = {
  id: string;
  name: string;
  phone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateRegion: string | null;
  postalCode: string | null;
  logoUrl: string | null;
};

export type VendorHandbookInfo = {
  parkingInfo: string | null;
  transportation: string | null;
  nearbyAccommodations: string | null;
  hotelBlocks: { name: string; url?: string; code?: string; notes?: string }[];
  rainPlan: string | null;
  policies: string | null;
  ceremonyInstructions: string | null;
  thingsToDo: string | null;
  faqs: { question: string; answer: string }[];
  importantContacts: { name: string; role: string; phone?: string; email?: string }[];
};

export type VendorHandbook = {
  venue: VendorHandbookVenue;
  operationalInfo: VendorHandbookInfo | null;
};

type RawInfo = {
  parkingInfo: string | null; transportation: string | null; nearbyAccommodations: string | null;
  hotelBlocks: VendorHandbookInfo["hotelBlocks"] | null; rainPlan: string | null; policies: string | null;
  ceremonyInstructions: string | null; thingsToDo: string | null;
  faqs: VendorHandbookInfo["faqs"] | null; importantContacts: VendorHandbookInfo["importantContacts"] | null;
} | null;

function mapInfo(raw: RawInfo): VendorHandbookInfo | null {
  if (!raw) return null;
  return {
    parkingInfo: raw.parkingInfo, transportation: raw.transportation,
    nearbyAccommodations: raw.nearbyAccommodations, hotelBlocks: raw.hotelBlocks ?? [],
    rainPlan: raw.rainPlan, policies: raw.policies, ceremonyInstructions: raw.ceremonyInstructions,
    thingsToDo: raw.thingsToDo, faqs: raw.faqs ?? [], importantContacts: raw.importantContacts ?? [],
  };
}

/** Venue Information tab inside a single event's workspace — gated by the vendor's actual assignment to that event. */
export async function getVendorHandbookForEvent(eventId: string): Promise<VendorHandbook | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_handbook", { p_event_id: eventId });
  if (error) throw error;
  if (!data || "error" in data) return null;
  const payload = data as { venue: VendorHandbookVenue; operationalInfo: RawInfo };
  return { venue: payload.venue, operationalInfo: mapInfo(payload.operationalInfo) };
}

/** Top-level Venue Information nav destination — every venue the vendor currently has a booked relationship with. */
export async function getVendorHandbooks(): Promise<VendorHandbook[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_vendor_handbooks");
  if (error) throw error;
  if (!data || "error" in data) return [];
  const payload = data as { venues: { venue: VendorHandbookVenue; operationalInfo: RawInfo }[] };
  return (payload.venues ?? []).map((v) => ({ venue: v.venue, operationalInfo: mapInfo(v.operationalInfo) }));
}
