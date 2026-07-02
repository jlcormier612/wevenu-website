"use server";

import { createClient } from "@/integrations/supabase/server";
import { getCurrentVenue } from "@/lib/venue/service";

export type FaqEntry     = { question: string; answer: string };
export type HotelBlock   = { name: string; url?: string; code?: string; notes?: string };
export type VenueContact = { name: string; role: string; phone?: string; email?: string };

export type VenueGuideData = {
  parkingInfo:          string | null;
  transportation:       string | null;
  nearbyAccommodations: string | null;
  hotelBlocks:          HotelBlock[];
  rainPlan:             string | null;
  policies:             string | null;
  ceremonyInstructions: string | null;
  thingsToDo:           string | null;
  faqs:                 FaqEntry[];
  importantContacts:    VenueContact[];
};

type DbRow = {
  parking_info:          string | null;
  transportation:        string | null;
  nearby_accommodations: string | null;
  hotel_blocks:          HotelBlock[];
  rain_plan:             string | null;
  policies:              string | null;
  ceremony_instructions: string | null;
  things_to_do:          string | null;
  faqs:                  FaqEntry[];
  important_contacts:    VenueContact[];
};

function mapRow(row: DbRow): VenueGuideData {
  return {
    parkingInfo:          row.parking_info,
    transportation:       row.transportation,
    nearbyAccommodations: row.nearby_accommodations,
    hotelBlocks:          row.hotel_blocks          ?? [],
    rainPlan:             row.rain_plan,
    policies:             row.policies,
    ceremonyInstructions: row.ceremony_instructions,
    thingsToDo:           row.things_to_do,
    faqs:                 row.faqs                  ?? [],
    importantContacts:    row.important_contacts     ?? [],
  };
}

export async function loadVenueGuideAction(): Promise<VenueGuideData | null> {
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("venue_operational_info")
    .select("*")
    .eq("venue_id", venue.id)
    .maybeSingle<DbRow>();
  return data ? mapRow(data) : null;
}

type GuidePartial = {
  parking_info?:          string | null;
  transportation?:        string | null;
  nearby_accommodations?: string | null;
  hotel_blocks?:          HotelBlock[];
  rain_plan?:             string | null;
  policies?:              string | null;
  ceremony_instructions?: string | null;
  things_to_do?:          string | null;
  faqs?:                  FaqEntry[];
  important_contacts?:    VenueContact[];
};

export async function saveGuideAction(partial: GuidePartial): Promise<{ ok: boolean; error?: string }> {
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "No venue found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("venue_operational_info")
    .upsert({ venue_id: venue.id, ...partial }, { onConflict: "venue_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
