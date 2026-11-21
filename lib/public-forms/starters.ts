/**
 * Public Forms starter definitions + idempotent venue provisioning.
 *
 * Starters are venue-owned draft forms installed into Templates → Public Forms.
 * They are never auto-published. Existing customized forms are never overwritten.
 *
 * Collision policy:
 * - Platform ownership is `starter_key` only (never claim by internal_name alone).
 * - A venue-authored form with the same display name is left untouched; the
 *   platform starter is still installed under starter_key (names may coexist).
 *
 * Idempotency / concurrency: unique (venue_id, starter_key) via DB + RPC.
 * Incomplete recovery: only for rows that already carry starter_key.
 *
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

/** Verified Willow Grove Sandbox backfill form IDs (PUBLIC-FORMS-BACKFILL.json). */
export const WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS = {
  venueId: "31f38b79-eb99-4ebc-81bc-af85767b42aa",
  forms: {
    general_venue_inquiry: "f80e069f-e231-42ad-962f-6deb83e2421d",
    wedding_expo_lead_capture: "3cbf6f4e-1595-40d4-bc98-602ecefa9f84",
    open_house_tour_interest: "b56d4251-1275-49ef-a38a-99df1ee36065",
    private_social_event_inquiry: "16eb3c94-906d-4a32-a433-a04e40c0387f",
  },
} as const;

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
  repaired: string[];
  failed: Array<{ key: string; message: string }>;
};

function questionsPayload(master: PublicFormStarterMaster) {
  return master.questions.map((q) => ({
    question_text: q.questionText,
    question_type: q.questionType,
    required: q.required,
    options: q.options ?? null,
    sort_order: q.sortOrder,
  }));
}

type RpcSeedStatus = "created" | "skipped" | "repaired";

async function seedOneViaRpc(
  client: DbClient,
  venueId: string,
  master: PublicFormStarterMaster,
): Promise<RpcSeedStatus | "unavailable"> {
  const { data, error } = await client.rpc("seed_public_form_starter", {
    p_venue_id: venueId,
    p_starter_key: master.key,
    p_internal_name: master.internalName,
    p_public_title: master.publicTitle,
    p_description: master.description,
    p_field_config: master.fieldConfig,
    p_questions: questionsPayload(master),
  });
  if (error) {
    if (/function|schema cache|does not exist|42883/i.test(error.message)) {
      return "unavailable";
    }
    throw new Error(error.message);
  }
  const status = (data as { status?: string } | null)?.status;
  if (status === "created" || status === "skipped" || status === "repaired") return status;
  throw new Error(`unexpected_rpc_status:${String(status)}`);
}

/**
 * Client-side fallback when RPC is not yet migrated.
 * Still keys only on starter_key; recovers incomplete platform starters;
 * rolls back form insert if question insert fails.
 */
async function seedOneFallback(
  client: DbClient,
  venueId: string,
  master: PublicFormStarterMaster,
): Promise<RpcSeedStatus> {
  const existing = await client
    .from("public_forms")
    .select("id, status")
    .eq("venue_id", venueId)
    .eq("starter_key", master.key)
    .maybeSingle();

  if (existing.error && !/starter_key|schema cache|column/i.test(existing.error.message)) {
    throw new Error(existing.error.message);
  }

  if (existing.data?.id) {
    const formId = existing.data.id as string;
    const { count, error: cErr } = await client
      .from("public_form_questions")
      .select("id", { count: "exact", head: true })
      .eq("public_form_id", formId);
    if (cErr) throw new Error(cErr.message);
    if ((count ?? 0) >= master.questions.length) return "skipped";

    const { error: delErr } = await client
      .from("public_form_questions")
      .delete()
      .eq("public_form_id", formId);
    if (delErr) throw new Error(delErr.message);
    const qRows = master.questions.map((q) => ({
      public_form_id: formId,
      venue_id: venueId,
      question_text: q.questionText,
      question_type: q.questionType,
      required: q.required,
      options: q.options ?? null,
      sort_order: q.sortOrder,
    }));
    if (qRows.length) {
      const { error: qErr } = await client.from("public_form_questions").insert(qRows);
      if (qErr) throw new Error(qErr.message);
    }
    return "repaired";
  }

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
  } else if (withKey.error && /duplicate|unique/i.test(withKey.error.message)) {
    return "skipped";
  } else if (withKey.error && /starter_key|schema cache|column/i.test(withKey.error.message)) {
    // Pre-migration: cannot safely claim ownership without starter_key.
    // Avoid installing by name alone.
    throw new Error("starter_key_column_required");
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
    if (qErr) {
      // Roll back incomplete platform starter so retry can recreate cleanly.
      await client.from("public_forms").delete().eq("id", formId).eq("venue_id", venueId);
      throw new Error(qErr.message);
    }
  }
  return "created";
}

/**
 * Idempotent: installs missing Public Forms starters as drafts.
 * Never overwrites customized forms. Never claims same-name forms without starter_key.
 */
export async function seedPublicFormStarters(
  venueId: string,
  client?: DbClient,
): Promise<PublicFormStarterSeedResult> {
  const db = client ?? createAdminClient();
  const created: string[] = [];
  const skipped: string[] = [];
  const repaired: string[] = [];
  const failed: Array<{ key: string; message: string }> = [];

  for (const master of PUBLIC_FORM_STARTER_MASTERS) {
    try {
      let status = await seedOneViaRpc(db, venueId, master);
      if (status === "unavailable") {
        status = await seedOneFallback(db, venueId, master);
      }
      if (status === "created") created.push(master.key);
      else if (status === "repaired") repaired.push(master.key);
      else skipped.push(master.key);
    } catch (e) {
      failed.push({
        key: master.key,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { created, skipped, repaired, failed };
}
