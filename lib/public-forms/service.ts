import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { InquiryFormQuestion } from "@/lib/inquiry-form/types";
import { DEFAULT_PUBLIC_FORM_FIELD_CONFIG } from "@/lib/public-forms/constants";
import type {
  CreatePublicFormInput,
  PublicForm,
  PublicFormFieldConfig,
  PublicFormListItem,
  PublicFormPublicConfig,
  PublicFormQuestionInput,
  PublicFormStatus,
  UpdatePublicFormInput,
} from "@/lib/public-forms/types";
import { getCurrentUserRole, getCurrentVenue } from "@/lib/venue/service";

function canManagePublicForms(role: string | null): boolean {
  return role === "owner" || role === "manager";
}

type FormRow = {
  id: string;
  venue_id: string;
  internal_name: string;
  public_title: string;
  description: string;
  status: PublicFormStatus;
  public_key: string;
  field_config: unknown;
  created_at: string;
  updated_at: string;
};

type QuestionRow = {
  id: string;
  question_text: string;
  question_type: InquiryFormQuestion["questionType"];
  required: boolean;
  options: string[] | null;
  sort_order: number;
};

function parseFieldConfig(raw: unknown): PublicFormFieldConfig {
  const out = { ...DEFAULT_PUBLIC_FORM_FIELD_CONFIG };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, string>;
  for (const key of Object.keys(out) as (keyof PublicFormFieldConfig)[]) {
    const v = obj[key];
    if (v === "required" || v === "optional" || v === "hidden") out[key] = v;
  }
  return out;
}

function mapQuestion(row: QuestionRow): InquiryFormQuestion {
  return {
    id: row.id,
    questionText: row.question_text,
    questionType: row.question_type,
    required: row.required,
    options: Array.isArray(row.options) ? row.options : [],
    sortOrder: row.sort_order,
  };
}

function mapForm(row: FormRow, questions: InquiryFormQuestion[] = []): PublicForm {
  return {
    id: row.id,
    venueId: row.venue_id,
    internalName: row.internal_name,
    publicTitle: row.public_title,
    description: row.description ?? "",
    status: row.status,
    publicKey: row.public_key,
    fieldConfig: parseFieldConfig(row.field_config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions,
  };
}

export async function listPublicForms(includeArchived = false): Promise<PublicFormListItem[]> {
  if (!isSupabaseConfigured) return [];
  const venue = await getCurrentVenue();
  if (!venue) return [];
  const supabase = await createClient();
  let query = supabase
    .from("public_forms")
    .select("*")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: false });
  if (!includeArchived) query = query.neq("status", "archived");
  const { data } = await query;
  const forms = (data ?? []) as FormRow[];
  if (forms.length === 0) return [];

  const ids = forms.map((f) => f.id);
  const { data: qRows } = await supabase
    .from("public_form_questions")
    .select("public_form_id")
    .in("public_form_id", ids);
  const counts = new Map<string, number>();
  for (const row of (qRows ?? []) as { public_form_id: string }[]) {
    counts.set(row.public_form_id, (counts.get(row.public_form_id) ?? 0) + 1);
  }

  return forms.map((row) => {
    const mapped = mapForm(row);
    return {
      id: mapped.id,
      venueId: mapped.venueId,
      internalName: mapped.internalName,
      publicTitle: mapped.publicTitle,
      description: mapped.description,
      status: mapped.status,
      publicKey: mapped.publicKey,
      fieldConfig: mapped.fieldConfig,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt,
      questionCount: counts.get(row.id) ?? 0,
    };
  });
}

export async function listPublishedPublicFormsForPicker(): Promise<
  Array<{ id: string; internalName: string; publicTitle: string }>
> {
  const forms = await listPublicForms(false);
  return forms
    .filter((f) => f.status === "published")
    .map((f) => ({ id: f.id, internalName: f.internalName, publicTitle: f.publicTitle }));
}

export async function getPublicForm(id: string): Promise<PublicForm | null> {
  if (!isSupabaseConfigured) return null;
  const venue = await getCurrentVenue();
  if (!venue) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("public_forms")
    .select("*")
    .eq("id", id)
    .eq("venue_id", venue.id)
    .maybeSingle();
  if (!data) return null;
  const { data: questions } = await supabase
    .from("public_form_questions")
    .select("id, question_text, question_type, required, options, sort_order")
    .eq("public_form_id", id)
    .eq("venue_id", venue.id)
    .order("sort_order")
    .order("created_at");
  return mapForm(data as FormRow, ((questions ?? []) as QuestionRow[]).map(mapQuestion));
}

export async function getPublicFormConfig(publicKey: string): Promise<PublicFormPublicConfig | null> {
  if (!isSupabaseConfigured) return null;
  // Public embed — admin client so a stale staff JWT cannot empty the payload.
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("get_public_form", { p_public_key: publicKey });
  const payload = data as Record<string, unknown> | null;
  if (!payload?.ok) {
    if (process.env.NODE_ENV === "development") {
      console.error("[getPublicFormConfig] missing/invalid payload", {
        publicKey,
        error: error?.message ?? null,
      });
    }
    return null;
  }

  const form = payload.form as Record<string, unknown>;
  const venue = payload.venue as Record<string, unknown>;
  const questions = (payload.customQuestions as QuestionRow[]) ?? [];

  return {
    form: {
      id: String(form.id),
      internalName: String(form.internalName),
      publicTitle: String(form.publicTitle),
      description: String(form.description ?? ""),
      fieldConfig: parseFieldConfig(form.fieldConfig),
      publicKey: String(form.publicKey),
    },
    venue: {
      id: String(venue.id),
      name: String(venue.name),
      logoUrl: (venue.logoUrl as string | null) ?? null,
      primaryColor: String(venue.primaryColor ?? "#5D6F5D"),
      secondaryColor: String(venue.secondaryColor ?? "#4F5F4F"),
      accentColor: String(venue.accentColor ?? "#B8AEA1"),
      neutralColor: String(venue.neutralColor ?? "#F7F5F1"),
      email: (venue.email as string | null) ?? null,
      phone: (venue.phone as string | null) ?? null,
      addressLine1: (venue.addressLine1 as string | null) ?? null,
      city: (venue.city as string | null) ?? null,
      stateRegion: (venue.stateRegion as string | null) ?? null,
    },
    customQuestions: questions.map(mapQuestion),
  };
}

export async function createPublicForm(
  input: CreatePublicFormInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "session_expired" };
  const role = await getCurrentUserRole();
  if (!canManagePublicForms(role)) return { ok: false, error: "forbidden" };

  const internalName = input.internalName.trim();
  const publicTitle = input.publicTitle.trim();
  if (!internalName) return { ok: false, error: "internal_name_required" };
  if (!publicTitle) return { ok: false, error: "public_title_required" };

  const fieldConfig: PublicFormFieldConfig = {
    ...DEFAULT_PUBLIC_FORM_FIELD_CONFIG,
    ...(input.fieldConfig ?? {}),
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_forms")
    .insert({
      venue_id: venue.id,
      internal_name: internalName,
      public_title: publicTitle,
      description: (input.description ?? "").trim(),
      field_config: fieldConfig,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "create_failed" };
  return { ok: true, id: (data as { id: string }).id };
}

export async function updatePublicForm(
  id: string,
  patch: UpdatePublicFormInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "session_expired" };
  const role = await getCurrentUserRole();
  if (!canManagePublicForms(role)) return { ok: false, error: "forbidden" };

  const update: Record<string, unknown> = {};
  if (patch.internalName !== undefined) {
    const v = patch.internalName.trim();
    if (!v) return { ok: false, error: "internal_name_required" };
    update.internal_name = v;
  }
  if (patch.publicTitle !== undefined) {
    const v = patch.publicTitle.trim();
    if (!v) return { ok: false, error: "public_title_required" };
    update.public_title = v;
  }
  if (patch.description !== undefined) update.description = patch.description.trim();
  if (patch.fieldConfig) update.field_config = patch.fieldConfig;
  if (patch.status) {
    if (!["draft", "published", "archived"].includes(patch.status)) {
      return { ok: false, error: "invalid_status" };
    }
    update.status = patch.status;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("public_forms")
    .update(update)
    .eq("id", id)
    .eq("venue_id", venue.id)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "not_found" };
  return { ok: true };
}

export async function replacePublicFormQuestions(
  formId: string,
  questions: PublicFormQuestionInput[],
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: false, error: "not_configured" };
  const venue = await getCurrentVenue();
  if (!venue) return { ok: false, error: "session_expired" };
  const role = await getCurrentUserRole();
  if (!canManagePublicForms(role)) return { ok: false, error: "forbidden" };

  const supabase = await createClient();
  const { data: form } = await supabase
    .from("public_forms")
    .select("id")
    .eq("id", formId)
    .eq("venue_id", venue.id)
    .maybeSingle();
  if (!form) return { ok: false, error: "not_found" };

  const { error: delError } = await supabase
    .from("public_form_questions")
    .delete()
    .eq("public_form_id", formId)
    .eq("venue_id", venue.id);
  if (delError) return { ok: false, error: delError.message };

  const cleaned = questions
    .map((q) => ({
      questionText: q.questionText.trim(),
      questionType: q.questionType,
      required: q.required,
      options: q.options.map((o) => o.trim()).filter(Boolean),
    }))
    .filter((q) => q.questionText.length > 0);

  if (cleaned.length === 0) return { ok: true };

  const rows = cleaned.map((q, i) => ({
    public_form_id: formId,
    venue_id: venue.id,
    question_text: q.questionText,
    question_type: q.questionType,
    required: q.required,
    options: q.options.length ? q.options : null,
    sort_order: i,
  }));
  const { error } = await supabase.from("public_form_questions").insert(rows);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function publishPublicForm(id: string): Promise<{ ok: boolean; error?: string }> {
  return updatePublicForm(id, { status: "published" });
}

export async function deactivatePublicForm(id: string): Promise<{ ok: boolean; error?: string }> {
  return updatePublicForm(id, { status: "draft" });
}

export async function archivePublicForm(id: string): Promise<{ ok: boolean; error?: string }> {
  return updatePublicForm(id, { status: "archived" });
}
