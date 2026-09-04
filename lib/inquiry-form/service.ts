import { createClient } from "@/integrations/supabase/server";
import { createAdminClient } from "@/integrations/supabase/admin";
import { isSupabaseConfigured } from "@/lib/env";
import {
  DEFAULT_INQUIRY_FORM_FIELDS,
} from "@/lib/inquiry-form/constants";
import {
  filterValidAcceptedEventTypes,
  parseAcceptedEventTypes,
} from "@/lib/event-types/canonical";
import type {
  InquiryFormFieldsConfig,
  InquiryFormQuestion,
  InquiryFormSettings,
  PublicInquiryFormConfig,
} from "@/lib/inquiry-form/types";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

function canManageInquiryFormSettings(role: string | null): boolean {
  return role === "owner" || role === "manager";
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
): Promise<{ ok: boolean; error?: string }> {
  const venue = await getCurrentVenue();
  if (!venue || !isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const role = await getCurrentUserRole();
  if (!canManageInquiryFormSettings(role)) {
    return { ok: false, error: "forbidden" };
  }

  const update: Record<string, unknown> = {};
  if (patch.inquiryEventDateMode) update.inquiry_event_date_mode = patch.inquiryEventDateMode;
  if (patch.inquiryFormFields) update.inquiry_form_fields = patch.inquiryFormFields;
  if (patch.acceptedEventTypes) {
    const valid = filterValidAcceptedEventTypes(patch.acceptedEventTypes);
    if (valid.length === 0) return { ok: false, error: "accepted_types_empty" };
    update.accepted_inquiry_event_types = valid;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  // Owner-only venues_update RLS would silently no-op for Managers. Write
  // only these operational inquiry columns via admin after Owner|Manager check.
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("venues")
    .update(update)
    .eq("id", venue.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data?.id) return { ok: false, error: "no_row_updated" };
  return { ok: true };
}

export async function replaceInquiryFormQuestions(
  questions: Omit<InquiryFormQuestion, "sortOrder">[],
): Promise<{ ok: boolean; error?: string }> {
  const venue = await getCurrentVenue();
  if (!venue || !isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const role = await getCurrentUserRole();
  if (!canManageInquiryFormSettings(role)) {
    return { ok: false, error: "forbidden" };
  }
  const admin = createAdminClient();
  const { error: delError } = await admin.from("inquiry_form_questions").delete().eq("venue_id", venue.id);
  if (delError) return { ok: false, error: delError.message };
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
  return error ? { ok: false, error: error.message } : { ok: true };
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
