/**
 * Public Forms starter definitions + idempotent venue provisioning.
 *
 * Starters are venue-owned draft forms installed into Templates → Public Forms.
 * They are never auto-published. Existing customized forms are never overwritten.
 *
 * Idempotency: `starter_key` column when present; otherwise exact `internal_name`.
 * SMS consent is NOT collected here (product policy — venue inquiry form only).
 * Each starter includes a required contact-permission custom question.
 */
import { createAdminClient } from "@/integrations/supabase/admin";
import { createClient } from "@/integrations/supabase/server";
import type { PublicFormFieldConfig } from "@/lib/public-forms/types";
import type { InquiryQuestionType } from "@/lib/inquiry-form/types";

type DbClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

export type PublicFormStarterKey =
  | "general_venue_inquiry"
  | "wedding_expo_lead_capture"
  | "open_house_tour_interest"
  | "private_social_event_inquiry";

export type PublicFormStarterQuestion = {
  questionText: string;
  questionType: InquiryQuestionType;
  required: boolean;
  options?: string[];
  sortOrder: number;
};

export type PublicFormStarterMaster = {
  key: PublicFormStarterKey;
  internalName: string;
  publicTitle: string;
  description: string;
  fieldConfig: PublicFormFieldConfig;
  questions: PublicFormStarterQuestion[];
};

const CONTACT_PERMISSION: PublicFormStarterQuestion = {
  questionText: "I agree to be contacted by this venue about my inquiry.",
  questionType: "single_select",
  required: true,
  options: ["Yes, please contact me"],
  sortOrder: 90,
};

export const PUBLIC_FORM_STARTER_MASTERS: readonly PublicFormStarterMaster[] = [
  {
    key: "general_venue_inquiry",
    internalName: "General Venue Inquiry",
    publicTitle: "Tell us about your event",
    description:
      "Share a few details and we will follow up with availability, pricing, and next steps.",
    fieldConfig: {
      phone: "optional",
      event_type: "required",
      preferred_event_date: "optional",
      guest_count: "optional",
    },
    questions: [
      {
        questionText: "What else should we know about your celebration?",
        questionType: "long_answer",
        required: false,
        sortOrder: 10,
      },
      CONTACT_PERMISSION,
    ],
  },
  {
    key: "wedding_expo_lead_capture",
    internalName: "Wedding Expo Lead Capture",
    publicTitle: "Welcome — let's start your wedding inquiry",
    description:
      "Thanks for stopping by. Leave your details and preferred wedding timeframe so we can follow up.",
    fieldConfig: {
      phone: "optional",
      event_type: "hidden",
      preferred_event_date: "optional",
      guest_count: "optional",
    },
    questions: [
      {
        questionText: "Partner name (optional)",
        questionType: "short_answer",
        required: false,
        sortOrder: 10,
      },
      {
        questionText: "Wedding timeframe or approximate date",
        questionType: "short_answer",
        required: false,
        sortOrder: 20,
      },
      {
        questionText: "Preferred follow-up",
        questionType: "single_select",
        required: false,
        options: ["Email", "Phone", "Either"],
        sortOrder: 30,
      },
      CONTACT_PERMISSION,
    ],
  },
  {
    key: "open_house_tour_interest",
    internalName: "Open House & Tour Interest",
    publicTitle: "Open house & tour interest",
    description:
      "Interested in visiting? Tell us about your event and when you would like to tour.",
    fieldConfig: {
      phone: "optional",
      event_type: "optional",
      preferred_event_date: "optional",
      guest_count: "optional",
    },
    questions: [
      {
        questionText: "Preferred tour window",
        questionType: "single_select",
        required: false,
        options: ["Weekday daytime", "Weekday evening", "Weekend", "Flexible"],
        sortOrder: 10,
      },
      {
        questionText: "Anything we should prepare for your visit?",
        questionType: "long_answer",
        required: false,
        sortOrder: 20,
      },
      CONTACT_PERMISSION,
    ],
  },
  {
    key: "private_social_event_inquiry",
    internalName: "Private & Social Event Inquiry",
    publicTitle: "Private & social event inquiry",
    description:
      "Corporate gatherings, celebrations, and private parties — tell us what you have in mind.",
    fieldConfig: {
      phone: "optional",
      event_type: "required",
      preferred_event_date: "optional",
      guest_count: "optional",
    },
    questions: [
      {
        questionText: "Occasion or organization",
        questionType: "short_answer",
        required: false,
        sortOrder: 10,
      },
      {
        questionText: "Special requirements",
        questionType: "long_answer",
        required: false,
        sortOrder: 20,
      },
      CONTACT_PERMISSION,
    ],
  },
] as const;

export type PublicFormStarterSeedResult = {
  created: string[];
  skipped: string[];
  failed: Array<{ key: string; message: string }>;
};

async function findExistingStarter(
  client: DbClient,
  venueId: string,
  master: PublicFormStarterMaster,
): Promise<string | null> {
  const byKey = await client
    .from("public_forms")
    .select("id")
    .eq("venue_id", venueId)
    .eq("starter_key", master.key)
    .maybeSingle();
  if (!byKey.error && byKey.data?.id) return byKey.data.id as string;

  const byName = await client
    .from("public_forms")
    .select("id")
    .eq("venue_id", venueId)
    .eq("internal_name", master.internalName)
    .maybeSingle();
  if (!byName.error && byName.data?.id) return byName.data.id as string;
  return null;
}

async function insertStarterForm(
  client: DbClient,
  venueId: string,
  master: PublicFormStarterMaster,
): Promise<string> {
  const baseRow = {
    venue_id: venueId,
    internal_name: master.internalName,
    public_title: master.publicTitle,
    description: master.description,
    field_config: master.fieldConfig,
    status: "draft" as const,
  };

  let formId: string | null = null;
  const withKey = await client
    .from("public_forms")
    .insert({ ...baseRow, starter_key: master.key })
    .select("id")
    .single();
  if (!withKey.error && withKey.data?.id) {
    formId = withKey.data.id as string;
  } else if (withKey.error && /starter_key|schema cache|column/i.test(withKey.error.message)) {
    const withoutKey = await client.from("public_forms").insert(baseRow).select("id").single();
    if (withoutKey.error || !withoutKey.data?.id) {
      throw new Error(withoutKey.error?.message ?? withKey.error.message);
    }
    formId = withoutKey.data.id as string;
  } else if (withKey.error) {
    throw new Error(withKey.error.message);
  }

  if (!formId) throw new Error("create_failed");

  const questionRows = master.questions.map((q) => ({
    public_form_id: formId,
    venue_id: venueId,
    question_text: q.questionText,
    question_type: q.questionType,
    required: q.required,
    options: q.options ?? null,
    sort_order: q.sortOrder,
  }));
  if (questionRows.length) {
    const { error: qErr } = await client.from("public_form_questions").insert(questionRows);
    if (qErr) throw new Error(qErr.message);
  }
  return formId;
}

/**
 * Idempotent: installs missing Public Forms starters as drafts.
 * Never overwrites existing forms (matched by starter_key or internal_name).
 * Safe to call for new venues and for existing-venue backfill.
 */
export async function seedPublicFormStarters(
  venueId: string,
  client?: DbClient,
): Promise<PublicFormStarterSeedResult> {
  const db = client ?? createAdminClient();
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: Array<{ key: string; message: string }> = [];

  for (const master of PUBLIC_FORM_STARTER_MASTERS) {
    try {
      const existing = await findExistingStarter(db, venueId, master);
      if (existing) {
        skipped.push(master.key);
        continue;
      }
      await insertStarterForm(db, venueId, master);
      created.push(master.key);
    } catch (e) {
      failed.push({
        key: master.key,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { created, skipped, failed };
}
