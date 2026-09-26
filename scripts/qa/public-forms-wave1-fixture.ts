/**
 * Wave 1 Sandbox fixture: Wedding Expo — QA public form + optional QR.
 * Usage: npx tsx --env-file=.env.local scripts/qa/public-forms-wave1-fixture.ts
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "fs";
import { resolve } from "path";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = resolve("docs/qa/public-forms-qr-architecture");
const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.sandbox.hellotocheers.com";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  // Verify migration applied
  const { data: tables, error: tErr } = await sb.from("public_forms").select("id").limit(1);
  if (tErr) {
    console.error("public_forms missing or inaccessible:", tErr.message);
    process.exit(1);
  }

  // Reuse if already created this run label
  const { data: existing } = await sb
    .from("public_forms")
    .select("*")
    .eq("venue_id", FANCY)
    .eq("internal_name", "Wedding Expo — QA")
    .maybeSingle();

  let form = existing as Record<string, unknown> | null;
  if (!form) {
    const { data, error } = await sb
      .from("public_forms")
      .insert({
        venue_id: FANCY,
        internal_name: "Wedding Expo — QA",
        public_title: "Welcome to our Wedding Expo!",
        description: "Tell us what you're looking for and we'll follow up.",
        status: "published",
        field_config: {
          phone: "optional",
          event_type: "hidden",
          preferred_event_date: "optional",
          guest_count: "optional",
        },
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("create form failed", error?.message);
      process.exit(1);
    }
    form = data as Record<string, unknown>;
  } else if (form.status !== "published") {
    await sb.from("public_forms").update({ status: "published" }).eq("id", form.id);
    form.status = "published";
  }

  const formId = String(form.id);

  // Replace questions for deterministic QA
  await sb.from("public_form_questions").delete().eq("public_form_id", formId);
  const { error: qErr } = await sb.from("public_form_questions").insert([
    {
      public_form_id: formId,
      venue_id: FANCY,
      question_text: "What are you looking for?",
      question_type: "short_answer",
      required: true,
      options: null,
      sort_order: 0,
    },
    {
      public_form_id: formId,
      venue_id: FANCY,
      question_text: "Preferred wedding season?",
      question_type: "single_select",
      required: true,
      options: ["Spring", "Summer", "Fall", "Winter"],
      sort_order: 1,
    },
    {
      public_form_id: formId,
      venue_id: FANCY,
      question_text: "Anything else we should know? (optional)",
      question_type: "long_answer",
      required: false,
      options: null,
      sort_order: 2,
    },
  ]);
  if (qErr) {
    console.error("questions failed", qErr.message);
    process.exit(1);
  }

  // QR campaign pointing at this form
  let qr = (
    await sb
      .from("qr_campaigns")
      .select("*")
      .eq("venue_id", FANCY)
      .eq("name", "Wedding Expo — QA")
      .eq("destination_type", "public_form")
      .maybeSingle()
  ).data as Record<string, unknown> | null;

  if (!qr) {
    const { data, error } = await sb
      .from("qr_campaigns")
      .insert({
        venue_id: FANCY,
        name: "Wedding Expo — QA",
        destination_type: "public_form",
        public_form_id: formId,
        status: "active",
      })
      .select("*")
      .single();
    if (error || !data) {
      console.error("qr create failed", error?.message);
      process.exit(1);
    }
    qr = data as Record<string, unknown>;
  } else if (qr.public_form_id !== formId) {
    await sb.from("qr_campaigns").update({ public_form_id: formId }).eq("id", qr.id);
    qr.public_form_id = formId;
  }

  // Legacy QR samples for regression (active inquiry/tour/external if present)
  const { data: legacy } = await sb
    .from("qr_campaigns")
    .select("id, name, code, destination_type, status")
    .eq("venue_id", FANCY)
    .eq("status", "active")
    .in("destination_type", ["inquiry_form", "tour_booking", "wedding_website", "external_url"])
    .limit(8);

  const publicKey = String(form.public_key);
  const proof = {
    createdAt: new Date().toISOString(),
    venueId: FANCY,
    publicForm: {
      id: formId,
      internalName: form.internal_name,
      publicTitle: form.public_title,
      status: form.status,
      publicKey,
      url: `${BASE}/forms/${publicKey}`,
    },
    qrCampaign: {
      id: qr.id,
      name: qr.name,
      code: qr.code,
      publicFormId: qr.public_form_id,
      scanUrl: `${BASE}/qr/${qr.code}`,
    },
    legacyActiveCampaigns: legacy ?? [],
    tablesProbeOk: Array.isArray(tables),
  };

  writeFileSync(resolve(OUT, "fixture.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
