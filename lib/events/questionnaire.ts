/**
 * Questionnaire Family — domain layer.
 * Up to three working questionnaires per event (kind): Client Planning,
 * Final Details, Post-Event Feedback. Answers that belong on Event /
 * contacts stay authoritative there; narrative answers live in additional.family.
 */
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { sendEmail } from "@/lib/email/send";
import { kindLabel, getQuestionnaireMasterByKind, masterIncludedFieldIds, masterRequiredFieldIds, type QuestionnaireKind } from "@/lib/questionnaire-family/definitions";
import {
  sanitizeCustomFields,
  sanitizeFieldOrder,
  sanitizeMasterOverrides,
  type CustomQuestionnaireField,
  type MasterOverrides,
} from "@/lib/questionnaire-family/resolve";
import { getCurrentVenue } from "@/lib/venue/service";

import { CONFIGURABLE_FIELDS, type ConfigurableField, type QuestionnaireStatus } from "@/lib/events/questionnaire-constants";
export { CONFIGURABLE_FIELDS, type ConfigurableField, type QuestionnaireStatus };

export type Questionnaire = {
  id: string;
  venueId: string;
  eventId: string;
  kind: QuestionnaireKind;
  status: QuestionnaireStatus;
  accessKey: string;
  sentAt: string | null;
  openedAt: string | null;
  threadId: string | null;
  templateId: string | null;
  includedFields: string[];
  requiredFields: string[];
  customFields: CustomQuestionnaireField[];
  masterOverrides: MasterOverrides;
  fieldOrder: string[];
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
  additional: { family?: Record<string, string> } | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type QRow = {
  id: string; venue_id: string; event_id: string; kind: string | null; status: string;
  access_key: string; sent_at: string | null; opened_at: string | null; thread_id: string | null;
  template_id: string | null; included_fields: string[] | null; required_fields: string[] | null;
  custom_fields?: unknown; master_overrides?: unknown; field_order?: string[] | null;
  ceremony_start_time: string | null; reception_start_time: string | null;
  ceremony_location: string | null; reception_location: string | null;
  final_guest_count: number | null; meal_notes: string | null;
  processional_song: string | null; recessional_song: string | null;
  first_dance_song: string | null; parent_dances: string | null;
  emergency_contact_name: string | null; emergency_contact_phone: string | null;
  vendor_notes: string | null; special_requests: string | null;
  additional: { family?: Record<string, string> } | null;
  submitted_at: string | null; created_at: string; updated_at: string;
};

function mapQ(r: QRow): Questionnaire {
  const kind = ((r.kind || "final_details") as QuestionnaireKind);
  const customs = sanitizeCustomFields(kind, r.custom_fields ?? []);
  const included = r.included_fields ?? [...CONFIGURABLE_FIELDS];
  return {
    id: r.id, venueId: r.venue_id, eventId: r.event_id,
    kind,
    status: r.status as QuestionnaireStatus,
    accessKey: r.access_key, sentAt: r.sent_at, openedAt: r.opened_at, threadId: r.thread_id,
    templateId: r.template_id, includedFields: included, requiredFields: r.required_fields ?? [],
    customFields: customs,
    masterOverrides: sanitizeMasterOverrides(kind, r.master_overrides ?? {}),
    fieldOrder: sanitizeFieldOrder(kind, included, customs, r.field_order),
    ceremonyStartTime: r.ceremony_start_time, receptionStartTime: r.reception_start_time,
    ceremonyLocation: r.ceremony_location, receptionLocation: r.reception_location,
    finalGuestCount: r.final_guest_count, mealNotes: r.meal_notes,
    processionalSong: r.processional_song, recessionalSong: r.recessional_song,
    firstDanceSong: r.first_dance_song, parentDances: r.parent_dances,
    emergencyContactName: r.emergency_contact_name, emergencyContactPhone: r.emergency_contact_phone,
    vendorNotes: r.vendor_notes, specialRequests: r.special_requests,
    additional: r.additional ?? null,
    submittedAt: r.submitted_at, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

async function logActivity(
  supabase: Awaited<ReturnType<typeof createClient>>, venueId: string, questionnaireId: string,
  type: "sent" | "resent" | "opened" | "submitted" | "reviewed" | "reopened" | "access_withdrawn", title: string, description?: string,
): Promise<void> {
  try {
    await supabase.from("questionnaire_activities").insert({
      venue_id: venueId, questionnaire_id: questionnaireId, type, title, description: description ?? null,
    });
  } catch { /* non-blocking */ }
}

/** Prefer Final Details for legacy single-questionnaire callers. */
export async function getQuestionnaire(
  eventId: string,
  kind: QuestionnaireKind = "final_details",
): Promise<Questionnaire | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("event_questionnaires").select("*")
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind).maybeSingle<QRow>();
  return data ? mapQ(data) : null;
}

export async function getQuestionnaires(eventId: string): Promise<Questionnaire[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("event_questionnaires").select("*")
    .eq("event_id", eventId).eq("venue_id", venue.id)
    .order("created_at", { ascending: true })
    .returns<QRow[]>();
  return (data ?? []).map(mapQ);
}

export type QuestionnaireActivity = { id: string; type: string; title: string; description: string | null; createdAt: string };

export async function getQuestionnaireActivities(questionnaireId: string): Promise<QuestionnaireActivity[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("questionnaire_activities")
    .select("id, type, title, description, created_at")
    .eq("questionnaire_id", questionnaireId).eq("venue_id", venue.id)
    .order("created_at", { ascending: false })
    .returns<{ id: string; type: string; title: string; description: string | null; created_at: string }[]>();
  return (data ?? []).map((r) => ({ id: r.id, type: r.type, title: r.title, description: r.description, createdAt: r.created_at }));
}

const SHARE_DEFAULTS: Record<QuestionnaireKind, { subject: string; body: string }> = {
  client_planning: {
    subject: "Client Planning Questionnaire for {{event}}",
    body: "Your Client Planning Questionnaire for {{event}} is ready. We already have your booking basics — this helps us learn more about your plans and priorities.",
  },
  final_details: {
    subject: "Final details form for {{event}}",
    body: "Your final details form for {{event}} is ready! Please take a few minutes to confirm guest count, day-of contacts, and any remaining details.",
  },
  post_event_feedback: {
    subject: "We'd love your feedback — {{event}}",
    body: "Thank you for celebrating with us. When you have a moment, we'd love your Post-Event Feedback about how everything felt.",
  },
};

export async function sendQuestionnaireToCouple(
  eventId: string,
  coupleEmail: string,
  coupleName: string,
  eventName: string,
  threadId?: string,
  customMessage?: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; formUrl?: string; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data: existing } = await supabase.from("event_questionnaires")
    .select("id, access_key, status").eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .maybeSingle<{ id: string; access_key: string; status: string }>();
  const isResend = existing ? existing.status !== "draft" : false;

  let accessKey: string;
  if (existing) {
    accessKey = existing.access_key;
  } else {
    const master = getQuestionnaireMasterByKind(kind);
    const { data: created } = await supabase.from("event_questionnaires")
      .insert({
        venue_id: venue.id,
        event_id: eventId,
        kind,
        included_fields: masterIncludedFieldIds(master),
        required_fields: masterRequiredFieldIds(master),
      })
      .select("access_key").single<{ access_key: string }>();
    if (!created) return { ok: false, message: "Could not create the form." };
    accessKey = created.access_key;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const formUrl = `${appUrl}/questionnaire/${accessKey}`;

  const patch: Record<string, unknown> = {
    status: existing?.status === "submitted" || existing?.status === "reviewed" ? existing.status : "sent",
    sent_at: new Date().toISOString(),
    kind,
  };
  if (threadId) patch.thread_id = threadId;
  const { data: sentRow } = await supabase.from("event_questionnaires")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update(patch as any).eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .select("id").maybeSingle<{ id: string }>();
  if (sentRow) {
    await logActivity(
      supabase, venue.id, sentRow.id,
      isResend ? "resent" : "sent",
      isResend ? `Resent ${kindLabel(kind)}` : `Sent ${kindLabel(kind)}`,
    );
  }

  const share = SHARE_DEFAULTS[kind];
  const defaultText = share.body.replace(/\{\{event\}\}/g, eventName);

  if (process.env.RESEND_API_KEY && process.env.FROM_EMAIL) {
    const emailResult = await sendEmail({
      to: coupleEmail,
      subject: share.subject.replace(/\{\{event\}\}/g, eventName),
      text: [
        `Hi ${coupleName},`,
        "",
        customMessage?.trim() || defaultText,
        "",
        formUrl,
        "",
        `Everything goes directly to ${venue.name} — no PDFs, no attachments.`,
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

const FIELD_LABELS: Record<ConfigurableField, string> = {
  meal_notes: "Meal preferences", processional_song: "Processional song", recessional_song: "Recessional song",
  first_dance_song: "First dance song", parent_dances: "Parent dances", special_requests: "Special requests",
};

function findMissingRequiredFields(
  fields: {
    finalGuestCount?: number | null; emergencyContactName?: string | null; emergencyContactPhone?: string | null;
    mealNotes?: string | null; processionalSong?: string | null; recessionalSong?: string | null;
    firstDanceSong?: string | null; parentDances?: string | null; specialRequests?: string | null;
  },
  requiredFields: string[],
  kind: QuestionnaireKind,
): string[] {
  const missing: string[] = [];
  // Always-required operational fields apply to Final Details only.
  if (kind === "final_details") {
    if (fields.finalGuestCount == null) missing.push("Final guest count");
    if (!fields.emergencyContactName?.trim()) missing.push("Emergency contact name");
    if (!fields.emergencyContactPhone?.trim()) missing.push("Emergency contact phone");
  }
  const configuredValues: Record<ConfigurableField, string | null | undefined> = {
    meal_notes: fields.mealNotes, processional_song: fields.processionalSong, recessional_song: fields.recessionalSong,
    first_dance_song: fields.firstDanceSong, parent_dances: fields.parentDances, special_requests: fields.specialRequests,
  };
  for (const key of requiredFields) {
    if (!(key in FIELD_LABELS)) continue;
    const value = configuredValues[key as ConfigurableField];
    if (!value?.trim()) missing.push(FIELD_LABELS[key as ConfigurableField]);
  }
  return missing;
}

export async function saveQuestionnaire(
  eventId: string,
  fields: Partial<Omit<Questionnaire, "id" | "venueId" | "eventId" | "status" | "submittedAt" | "createdAt" | "updatedAt" | "templateId" | "includedFields" | "requiredFields" | "kind" | "additional">>,
  submit = false,
  options?: { requiredFields?: string[]; expectedUpdatedAt?: string; kind?: QuestionnaireKind; additional?: { family?: Record<string, string> } | null },
): Promise<{ ok: boolean; message?: string; reason?: "stale"; updatedAt?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const kind = options?.kind ?? "final_details";
  if (submit) {
    const missing = findMissingRequiredFields(fields, options?.requiredFields ?? [], kind);
    if (missing.length > 0) {
      return { ok: false, message: `Add these before submitting: ${missing.join(", ")}.` };
    }
  }
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const row: Record<string, unknown> = {
    venue_id: venue.id, event_id: eventId, kind,
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
  if (options?.additional !== undefined) row.additional = options.additional;
  if (submit) { row.status = "submitted"; row.submitted_at = new Date().toISOString(); }

  if (options?.expectedUpdatedAt) {
    const { data, error } = await supabase.from("event_questionnaires")
      .update(row)
      .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
      .eq("updated_at", options.expectedUpdatedAt)
      .select("id, updated_at").maybeSingle<{ id: string; updated_at: string }>();
    if (error) return { ok: false, message: error.message };
    if (!data) return { ok: false, reason: "stale", message: "This form changed since you loaded it. Refresh to see the latest before saving." };
    if (submit) await logActivity(supabase, venue.id, data.id, "submitted", `${kindLabel(kind)} marked submitted`, "Coordinator marked submitted");
    return { ok: true, updatedAt: data.updated_at };
  }

  const { data, error } = await supabase.from("event_questionnaires").upsert(row, { onConflict: "event_id,kind" })
    .select("id, updated_at").maybeSingle<{ id: string; updated_at: string }>();
  if (error) return { ok: false, message: error.message };
  if (submit && data) await logActivity(supabase, venue.id, data.id, "submitted", `${kindLabel(kind)} marked submitted`, "Coordinator marked submitted");
  return { ok: true, updatedAt: data?.updated_at };
}

export async function reopenQuestionnaire(
  eventId: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data, error } = await supabase.from("event_questionnaires")
    .update({ status: "sent" })
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .in("status", ["submitted", "reviewed"])
    .select("id").maybeSingle<{ id: string }>();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "That form isn't currently submitted." };
  await logActivity(supabase, venue.id, data.id, "reopened", `${kindLabel(kind)} reopened`, "Coordinator reopened the form");
  return { ok: true };
}

/**
 * Stops couple access via the public /questionnaire/{access_key} link without
 * deleting answers or rotating the key. Public RPC only serves sent|submitted|reviewed,
 * so draft removes access. Only sent → draft (submitted/reviewed use Reopen instead).
 * Does NOT recall emails already delivered.
 */
export async function withdrawQuestionnaireAccess(
  eventId: string,
  kind: QuestionnaireKind = "final_details",
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured) return { ok: false, message: "Backend not configured." };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, message: "No venue found." };
  const supabase = await createClient();

  const { data, error } = await supabase.from("event_questionnaires")
    .update({ status: "draft" })
    .eq("event_id", eventId).eq("venue_id", venue.id).eq("kind", kind)
    .eq("status", "sent")
    .select("id").maybeSingle<{ id: string }>();
  if (error) return { ok: false, message: error.message };
  if (!data) return { ok: false, message: "Only a sent (not yet submitted) form can have client access stopped." };
  await logActivity(
    supabase, venue.id, data.id, "access_withdrawn",
    `${kindLabel(kind)} client access stopped`,
    "Coordinator closed the public form link (emails already sent were not recalled)",
  );
  return { ok: true };
}
