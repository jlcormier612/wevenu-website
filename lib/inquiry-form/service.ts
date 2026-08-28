import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import { getCurrentVenue } from "@/lib/venue/service";
import { DEFAULT_INQUIRY_FORM_FIELDS, PUBLIC_INQUIRY_EVENT_TYPES } from "@/lib/inquiry-form/constants";
import type {
  InquiryFormFieldsConfig,
  InquiryFormQuestion,
  InquiryFormSettings,
  PublicInquiryFormConfig,
} from "@/lib/inquiry-form/types";

const ALL_PUBLIC_EVENT_TYPES = PUBLIC_INQUIRY_EVENT_TYPES.map((t) => t.value);

/**
 * Validate against the canonical vocabulary and fall back to "all" when
 * unset/empty/invalid — matches the DB column's own non-empty default, and
 * keeps the public form showing every option (today's behavior) rather than
 * an empty dropdown if this ever reads a database that predates the
 * accepted_inquiry_event_types migration.
 */
function parseAcceptedEventTypes(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...ALL_PUBLIC_EVENT_TYPES];
  const valid = raw.filter((v): v is string => ALL_PUBLIC_EVENT_TYPES.includes(v as (typeof ALL_PUBLIC_EVENT_TYPES)[number]));
  return valid.length > 0 ? valid : [...ALL_PUBLIC_EVENT_TYPES];
}

type DbQuestionRow = {
  id: string;
  question_text: string;
  question_type: InquiryFormQuestion["questionType"];
  required: boolean;
  options: string[] | null;
  sort_order: number;
};

function mapQuestion(row: DbQuestionRow): InquiryFormQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    questionType: row.question_type,
    required: row.required,
    options: Array.isArray(row.options) ? row.options : [],
    sortOrder: row.sort_order,
  };
}

function parseFieldsConfig(raw: unknown): InquiryFormFieldsConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_INQUIRY_FORM_FIELDS };
  const obj = raw as Record<string, string>;
  const out = { ...DEFAULT_INQUIRY_FORM_FIELDS };
  for (const key of Object.keys(DEFAULT_INQUIRY_FORM_FIELDS) as (keyof InquiryFormFieldsConfig)[]) {
    const v = obj[key];
    if (v === "required" || v === "optional" || v === "hidden") out[key] = v;
  }
  return out;
}

export async function getPublicInquiryFormConfig(embedKey: string): Promise<PublicInquiryFormConfig | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_public_inquiry_form", { p_embed_key: embedKey });
  const payload = data as Record<string, unknown> | null;
  if (!payload?.ok) return null;
  const venue = payload.venue as Record<string, unknown>;
  return {
    venue: {
      id: String(venue.id),
      name: String(venue.name),
      logoUrl: (venue.logoUrl as string | null) ?? null,
      primaryColor: String(venue.primaryColor ?? "#5D6F5D"),
      secondaryColor: String(venue.secondaryColor ?? "#4F5F4F"),
      email: (venue.email as string | null) ?? null,
      phone: (venue.phone as string | null) ?? null,
      addressLine1: (venue.addressLine1 as string | null) ?? null,
      city: (venue.city as string | null) ?? null,
      stateRegion: (venue.stateRegion as string | null) ?? null,
    },
    tourSchedulingEnabled: Boolean(payload.tourSchedulingEnabled),
    tourEmbedKey: (payload.tourEmbedKey as string | null) ?? null,
    inquiryEventDateMode: payload.inquiryEventDateMode === "choose_available" ? "choose_available" : "request_preferred",
    inquiryFormFields: parseFieldsConfig(payload.inquiryFormFields),
    acceptedEventTypes: parseAcceptedEventTypes(payload.acceptedEventTypes),
    customQuestions: ((payload.customQuestions as DbQuestionRow[]) ?? []).map(mapQuestion),
  };
}

export async function getInquiryFormSettings(): Promise<InquiryFormSettings | null> {
  const venue = await getCurrentVenue();
  if (!venue || !isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("venues")
    .select("inquiry_event_date_mode, inquiry_form_fields, accepted_inquiry_event_types")
    .eq("id", venue.id)
    .maybeSingle<{ inquiry_event_date_mode: string; inquiry_form_fields: unknown; accepted_inquiry_event_types: unknown }>();
  const { data: questions } = await supabase
    .from("inquiry_form_questions")
    .select("id, question_text, question_type, required, options, sort_order")
    .eq("venue_id", venue.id)
    .order("sort_order")
    .order("created_at");
  return {
    inquiryEventDateMode: row?.inquiry_event_date_mode === "choose_available" ? "choose_available" : "request_preferred",
    inquiryFormFields: parseFieldsConfig(row?.inquiry_form_fields),
    acceptedEventTypes: parseAcceptedEventTypes(row?.accepted_inquiry_event_types),
    customQuestions: ((questions ?? []) as DbQuestionRow[]).map(mapQuestion),
  };
}

export async function updateInquiryFormSettings(
  patch: Partial<Pick<InquiryFormSettings, "inquiryEventDateMode" | "inquiryFormFields" | "acceptedEventTypes">>,
): Promise<{ ok: boolean }> {
  const venue = await getCurrentVenue();
  if (!venue || !isSupabaseConfigured) return { ok: false };
  const supabase = await createClient();
  const update: Record<string, unknown> = {};
  if (patch.inquiryEventDateMode) update.inquiry_event_date_mode = patch.inquiryEventDateMode;
  if (patch.inquiryFormFields) update.inquiry_form_fields = patch.inquiryFormFields;
  if (patch.acceptedEventTypes) {
    const valid = parseAcceptedEventTypes(patch.acceptedEventTypes);
    update.accepted_inquiry_event_types = valid;
  }
  if (Object.keys(update).length === 0) return { ok: true };
  const { error } = await supabase.from("venues").update(update).eq("id", venue.id);
  return { ok: !error };
}

export async function replaceInquiryFormQuestions(
  questions: Omit<InquiryFormQuestion, "sortOrder">[],
): Promise<{ ok: boolean }> {
  const venue = await getCurrentVenue();
  if (!venue || !isSupabaseConfigured) return { ok: false };
  const admin = createAdminClient();
  await admin.from("inquiry_form_questions").delete().eq("venue_id", venue.id);
  if (questions.length === 0) return { ok: true };
  const rows = questions.map((q, i) => ({
    venue_id: venue.id,
    question_text: q.questionText.trim(),
    question_type: q.questionType,
    required: q.required,
    options: q.options.length ? q.options : null,
    sort_order: i,
  }));
  const { error } = await admin.from("inquiry_form_questions").insert(rows);
  return { ok: !error };
}

export async function getAvailableEventDates(
  embedKey: string,
  start: string,
  end: string,
): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_available_event_dates", {
    p_embed_key: embedKey,
    p_start: start,
    p_end: end,
  });
  const payload = data as { ok?: boolean; dates?: string[] } | null;
  if (!payload?.ok || !Array.isArray(payload.dates)) return [];
  return payload.dates;
}
