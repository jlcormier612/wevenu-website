"use server";

import { createClient } from "@/integrations/supabase/server";
import type {
  FaqEntry,
  HotelBlock,
  VenueContact,
  VenueGuideData,
} from "@/lib/guide/venue-guide-data";
import {
  normalizeSectionAudiences,
  normalizeSectionOverrides,
  type GuideAudience,
  type GuideSectionKey,
  type SectionOverrides,
} from "@/lib/venue-guide/audience";
import { getCurrentVenue } from "@/lib/venue/service";

type DbRow = {
  parking_info: string | null;
  transportation: string | null;
  nearby_accommodations: string | null;
  hotel_blocks: HotelBlock[];
  rain_plan: string | null;
  policies: string | null;
  ceremony_instructions: string | null;
  things_to_do: string | null;
  faqs: FaqEntry[];
  important_contacts: VenueContact[];
  section_audiences: unknown;
  section_overrides: unknown;
};

function mapRow(row: DbRow): VenueGuideData {
  return {
    parkingInfo: row.parking_info,
    transportation: row.transportation,
    nearbyAccommodations: row.nearby_accommodations,
    hotelBlocks: row.hotel_blocks ?? [],
    rainPlan: row.rain_plan,
    policies: row.policies,
    ceremonyInstructions: row.ceremony_instructions,
    thingsToDo: row.things_to_do,
    faqs: row.faqs ?? [],
    importantContacts: row.important_contacts ?? [],
    sectionAudiences: normalizeSectionAudiences(row.section_audiences),
    sectionOverrides: normalizeSectionOverrides(row.section_overrides),
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
  parking_info?: string | null;
  transportation?: string | null;
  nearby_accommodations?: string | null;
  hotel_blocks?: HotelBlock[];
  rain_plan?: string | null;
  policies?: string | null;
  ceremony_instructions?: string | null;
  things_to_do?: string | null;
  faqs?: FaqEntry[];
  important_contacts?: VenueContact[];
  section_audiences?: Record<GuideSectionKey, GuideAudience>;
  section_overrides?: SectionOverrides;
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
