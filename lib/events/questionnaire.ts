/**
 * Final Details Questionnaire — domain layer.
 * One questionnaire per event; upsert semantics.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { getCurrentVenue } from "@/lib/venue/service";

export type QuestionnaireStatus = "draft" | "sent" | "submitted" | "reviewed";

export type Questionnaire = {
  id: string;
  venueId: string;
  eventId: string;
  status: QuestionnaireStatus;
  accessKey: string;
  sentAt: string | null;
  openedAt: string | null;
  threadId: string | null;
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
  access_key: string; sent_at: string | null; opened_at: string | null; thread_id: string | null;
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
    accessKey: r.access_key, sentAt: r.sent_at, openedAt: r.opened_at, threadId: r.thread_id,
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

export async function sendQuestionnaireToCouple(
  eventId: string,
  coupleEmail: string,
  coupleName: string,
  eventName: string,
  threadId?: string,   // when sending via Messages, link the thread
): Promise<{ ok: boolean; formUrl?: string; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  // Ensure questionnaire exists (create if not) and get the access_key
  const { data: existing } = await supabase.from("event_questionnaires")
    .select("id, access_key").eq("event_id", eventId).eq("venue_id", venue.id).maybeSingle<{ id: string; access_key: string }>();

  let accessKey: string;
  if (existing) {
    accessKey = existing.access_key;
  } else {
    const { data: created } = await supabase.from("event_questionnaires")
      .insert({ venue_id: venue.id, event_id: eventId })
      .select("access_key").single<{ access_key: string }>();
    if (!created) return { ok: false, message: "Could not create questionnaire." };
    accessKey = created.access_key;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const formUrl = `${appUrl}/questionnaire/${accessKey}`;

  // Mark as sent (and link thread if provided)
  const patch: Record<string, unknown> = { status: "sent", sent_at: new Date().toISOString() };
  if (threadId) patch.thread_id = threadId;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("event_questionnaires") as any).update(patch).eq("event_id", eventId).eq("venue_id", venue.id);

  // Send email if Resend is configured
  if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
    const emailResult = await sendEmail({
      to: coupleEmail,
      subject: `Final details form for ${eventName}`,
      text: [
        `Hi ${coupleName},`,
        "",
        `Your final details form for ${eventName} is ready!`,
        "",
        `Please take a few minutes to fill in your guest count, song selections, meal preferences, and any special requests:`,
        "",
        formUrl,
        "",
        `Everything goes directly to ${venue.name} — no PDFs, no attachments.`,
        "",
        `Thank you, and we can't wait for your event!`,
        "",
        venue.name,
      ].join("\n"),
      replyTo: venue.email ?? undefined,
    });
    if (!emailResult.ok) {
      return { ok: false, formUrl, message: `The form link was created, but the email couldn't be sent: ${emailResult.message}` };
    }
  }

  return { ok: true, formUrl };
}

/**
 * Work Package D5 — the minimum "truthful completion" bar (D3 finding:
 * "The Questionnaire form has zero required-field validation... A completely
 * empty questionnaire can be submitted and marked complete"). There's no
 * per-venue question configuration to defer to (BA1/D3 confirmed: one fixed
 * global schema, no template layer) — so this is grounded in what the venue
 * actually can't run the event without, not an invented global opinion:
 * final guest count (catering/seating) and a day-of emergency contact
 * (safety). Everything else on this form stays genuinely optional. Enforced
 * at both real submission entry points — this function (coordinator path)
 * and submit_questionnaire_as_couple() (couple path, see migration
 * 20261247000000) — neither can be bypassed by the other.
 */
function findMissingRequiredFields(fields: {
  finalGuestCount?: number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
}): string[] {
  const missing: string[] = [];
  if (fields.finalGuestCount == null) missing.push("Final guest count");
  if (!fields.emergencyContactName?.trim()) missing.push("Emergency contact name");
  if (!fields.emergencyContactPhone?.trim()) missing.push("Emergency contact phone");
  return missing;
}

export async function saveQuestionnaire(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt">>,
  submit = false,
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  if (submit) {
    const missing = findMissingRequiredFields(fields);
    if (missing.length > 0) {
      return { ok: false, message: `Add these before submitting: ${missing.join(", ")}.` };
    }
  }
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
