/**
 * Final Details Questionnaire — domain layer.
 * One questionnaire per event; upsert semantics.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";

export type QuestionnaireStatus = "draft" | "submitted" | "reviewed";

export type Questionnaire = {
  id: string;
  venueId: string;
  eventId: string;
  status: QuestionnaireStatus;
  ceremonyStartTime: string | null;
  receptionStartTime: string | null;
  ceremonyLocation: string | null;
  receptionLocation: string | null;
  finalGuestCount: number | null;
  mealNotes: string | null;
  processionalSong: string | null;
  recessionalSong: string | null;
  firstDanceSong: string | null;
  parentDances: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  vendorNotes: string | null;
  specialRequests: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type QRow = {
  id: string; venue_id: string; event_id: string; status: string;
  ceremony_start_time: string | null; reception_start_time: string | null;
  ceremony_location: string | null; reception_location: string | null;
  final_guest_count: number | null; meal_notes: string | null;
  processional_song: string | null; recessional_song: string | null;
  first_dance_song: string | null; parent_dances: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  vendor_notes: string | null; special_requests: string | null;
  submitted_at: string | null; created_at: string; updated_at: string;
};

function mapQ(r: QRow): Questionnaire {
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id,
    status: r.status as QuestionnaireStatus,
    ceremonyStartTime: r.ceremony_start_time, receptionStartTime: r.reception_start_time,
    ceremonyLocation: r.ceremony_location, receptionLocation: r.reception_location,
    finalGuestCount: r.final_guest_count, mealNotes: r.meal_notes,
    processionalSong: r.processional_song, recessionalSong: r.recessional_song,
    firstDanceSong: r.first_dance_song, parentDances: r.parent_dances,
    emergencyContactName: r.emergency_contact_name, emergencyContactPhone: r.emergency_contact_phone,
    vendorNotes: r.vendor_notes, specialRequests: r.special_requests,
    submittedAt: r.submitted_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function getQuestionnaire(eventId: string): Promise<Questionnaire | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("event_questionnaires").select("*")
    .eq("event_id", eventId).eq("venue_id", venue.id).maybeSingle<QRow>();
  return data ? mapQ(data) : null;
}

export async function saveQuestionnaire(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt">>,
  submit = false,
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const row: Record<string, unknown> = {
    venue_id: venue.id, event_id: eventId,
    ceremony_start_time: fields.ceremonyStartTime || null,
    reception_start_time: fields.receptionStartTime || null,
    ceremony_location: fields.ceremonyLocation?.trim() || null,
    reception_location: fields.receptionLocation?.trim() || null,
    final_guest_count: fields.finalGuestCount ?? null,
    meal_notes: fields.mealNotes?.trim() || null,
    processional_song: fields.processionalSong?.trim() || null,
    recessional_song: fields.recessionalSong?.trim() || null,
    first_dance_song: fields.firstDanceSong?.trim() || null,
    parent_dances: fields.parentDances?.trim() || null,
    emergency_contact_name: fields.emergencyContactName?.trim() || null,
    emergency_contact_phone: fields.emergencyContactPhone?.trim() || null,
    vendor_notes: fields.vendorNotes?.trim() || null,
    special_requests: fields.specialRequests?.trim() || null,
  };
  if (submit) { row.status = "submitted"; row.submitted_at = new Date().toISOString(); }

  const { error } = await supabase.from("event_questionnaires").upsert(row, { onConflict: "event_id" });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
