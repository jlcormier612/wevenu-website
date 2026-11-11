import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import {
  afterVenueChoosesClientPhoto,
  afterVenueChoosesVenuePhoto,
  afterVenuePhotoRemove,
  afterVenuePhotoUpload,
  resolveVenueFacingPhoto,
  type VenueFacingPhotoState,
  type VenueDisplaySource,
} from "@/lib/relationship-photos/model";
import {
  getVenueRelationshipPhoto,
  updateRelationshipPhotoFields,
} from "@/lib/relationship-photos/repository";

type PhotoActionResult = { ok: true } | { ok: false; message: string };

async function withVenue<T>(
  fn: (supabase: Awaited<ReturnType<typeof createClient>>, venueId: string) => Promise<T>,
): Promise<T | PhotoActionResult> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Session expired." };
  return fn(supabase, venue.id);
}

function rowToState(row: {
  venue_photo_url: string | null;
  client_photo_url: string | null;
  client_photo_shared: boolean;
  venue_display_source: VenueDisplaySource;
}) {
  return {
    venuePhotoUrl: row.venue_photo_url,
    clientPhotoUrl: row.client_photo_url,
    clientPhotoShared: row.client_photo_shared,
    venueDisplaySource: row.venue_display_source,
  };
}

export async function getRelationshipPhotoForVenue(
  relationshipId: string | null | undefined,
): Promise<VenueFacingPhotoState | null> {
  if (!relationshipId) return null;
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const row = await getVenueRelationshipPhoto(supabase, relationshipId);
  if (!row) return null;
  return resolveVenueFacingPhoto(rowToState(row));
}

export async function setVenueRelationshipPhoto(
  relationshipId: string,
  url: string,
): Promise<PhotoActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await getVenueRelationshipPhoto(supabase, relationshipId);
    const next = afterVenuePhotoUpload(
      row
        ? rowToState(row)
        : { venuePhotoUrl: null, clientPhotoUrl: null, clientPhotoShared: false, venueDisplaySource: "none" },
      url,
    );
    return updateRelationshipPhotoFields(supabase, venueId, relationshipId, {
      venue_photo_url: next.venuePhotoUrl,
      venue_display_source: next.venueDisplaySource,
    });
  });
  return result as PhotoActionResult;
}

export async function removeVenueRelationshipPhoto(
  relationshipId: string,
): Promise<PhotoActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await getVenueRelationshipPhoto(supabase, relationshipId);
    if (!row) return { ok: false, message: "Relationship not found." };
    const next = afterVenuePhotoRemove(rowToState(row));
    return updateRelationshipPhotoFields(supabase, venueId, relationshipId, {
      venue_photo_url: next.venuePhotoUrl,
      venue_display_source: next.venueDisplaySource,
    });
  });
  return result as PhotoActionResult;
}

export async function useClientRelationshipPhoto(
  relationshipId: string,
): Promise<PhotoActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await getVenueRelationshipPhoto(supabase, relationshipId);
    if (!row) return { ok: false, message: "Relationship not found." };
    const next = afterVenueChoosesClientPhoto(rowToState(row));
    if (!next) return { ok: false, message: "No shared client photo is available." };
    return updateRelationshipPhotoFields(supabase, venueId, relationshipId, {
      venue_display_source: next.venueDisplaySource,
    });
  });
  return result as PhotoActionResult;
}

export async function useVenueRelationshipPhoto(
  relationshipId: string,
): Promise<PhotoActionResult> {
  const result = await withVenue(async (supabase, venueId) => {
    const row = await getVenueRelationshipPhoto(supabase, relationshipId);
    if (!row) return { ok: false, message: "Relationship not found." };
    const next = afterVenueChoosesVenuePhoto(rowToState(row));
    if (!next) return { ok: false, message: "No venue photo is available." };
    return updateRelationshipPhotoFields(supabase, venueId, relationshipId, {
      venue_display_source: next.venueDisplaySource,
    });
  });
  return result as PhotoActionResult;
}

/** Direct read for tests / service-role scripts — uses authenticated venue client. */
export async function loadRawRelationshipPhotoRow(relationshipId: string) {
  const supabase = await createClient();
  return getVenueRelationshipPhoto(supabase, relationshipId);
}
