/**
 * Wave 1 proof: submit via create_public_form_lead + verify lead/source_data.
 * Usage: npx tsx --env-file=.env.local scripts/qa/public-forms-wave1-submit-proof.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const OUT = resolve("docs/qa/public-forms-qr-architecture");
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

async function main() {
  const fixture = JSON.parse(readFileSync(resolve(OUT, "fixture.json"), "utf8"));
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const publicKey = fixture.publicForm.publicKey as string;
  const formId = fixture.publicForm.id as string;
  const qrId = fixture.qrCampaign.id as string;

  const { data: pub } = await sb.rpc("get_public_form", { p_public_key: publicKey });
  if (!pub?.ok) {
    console.error("get_public_form failed", pub);
    process.exit(1);
  }

  const stamp = Date.now();
  const email = `expo.qa.${stamp}@example.com`;

  const { data: submit, error } = await sb.rpc("create_public_form_lead", {
    p_public_key: publicKey,
    p_first_name: "Expo",
    p_last_name: "QA",
    p_email: email,
    p_phone: "",
    p_event_type: "other",
    p_event_date: null,
    p_guest_count: null,
    p_message: "",
    p_source_data: {
      source: "public_form",
      public_form_id: formId,
      qr_campaign_id: qrId,
      custom_answers: [
        { questionText: "What are you looking for?", answer: "Outdoor ceremony space" },
        { questionText: "Preferred wedding season?", answer: "Fall" },
      ],
      utm_source: "wave1_qa",
      landing_page: fixture.publicForm.url,
    },
  });

  if (error || !submit?.ok) {
    console.error("submit failed", error?.message, submit);
    process.exit(1);
  }

  const leadId = String(submit.lead_id ?? submit.leadId);
  const { data: lead } = await sb
    .from("leads")
    .select("id, venue_id, first_name, last_name, email, source, source_data, relationship_id, status")
    .eq("id", leadId)
    .single();

  // Side-effect checks: no client/event/contract/invoice/payment_plan for this relationship
  const relId = lead?.relationship_id as string | null;
  let sideEffects: Record<string, number> = {};
  if (relId) {
    const [clients, events, contracts, invoices, plans] = await Promise.all([
      sb.from("clients").select("id", { count: "exact", head: true }).eq("relationship_id", relId),
      sb.from("events").select("id", { count: "exact", head: true }).eq("relationship_id", relId),
      sb.from("contracts").select("id", { count: "exact", head: true }).eq("relationship_id", relId),
      sb.from("invoices").select("id", { count: "exact", head: true }).eq("relationship_id", relId),
      sb.from("payment_plans").select("id", { count: "exact", head: true }).eq("relationship_id", relId),
    ]);
    sideEffects = {
      clients: clients.count ?? -1,
      events: events.count ?? -1,
      contracts: contracts.count ?? -1,
      invoices: invoices.count ?? -1,
      payment_plans: plans.count ?? -1,
    };
  }

  // Venue isolation: get_public_form does not expose another venue's form by guessing
  const { data: bogus } = await sb.rpc("get_public_form", { p_public_key: "0".repeat(32) });

  // Inactive form cannot submit
  await sb.from("public_forms").update({ status: "draft" }).eq("id", formId);
  const { data: inactiveSubmit } = await sb.rpc("create_public_form_lead", {
    p_public_key: publicKey,
    p_first_name: "Should",
    p_last_name: "Fail",
    p_email: `should.fail.${stamp}@example.com`,
    p_phone: "",
    p_event_type: "other",
    p_event_date: null,
    p_guest_count: null,
    p_message: "",
    p_source_data: {},
  });
  // Restore published for browser QA
  await sb.from("public_forms").update({ status: "published" }).eq("id", formId);

  const proof = {
    getPublicForm: {
      ok: pub.ok,
      venueName: pub.venue?.name,
      publicTitle: pub.form?.publicTitle,
      questionCount: (pub.customQuestions ?? []).length,
    },
    submit,
    lead,
    sourceData: lead?.source_data ?? null,
    attribution: {
      public_form_id: (lead?.source_data as Record<string, unknown> | null)?.public_form_id ?? null,
      qr_campaign_id: (lead?.source_data as Record<string, unknown> | null)?.qr_campaign_id ?? null,
      utm_source: (lead?.source_data as Record<string, unknown> | null)?.utm_source ?? null,
      custom_answers: (lead?.source_data as Record<string, unknown> | null)?.custom_answers ?? null,
    },
    sideEffects,
    security: {
      bogusTokenOk: Boolean(bogus?.ok),
      inactiveSubmitOk: Boolean(inactiveSubmit?.ok),
      inactiveError: inactiveSubmit?.error ?? null,
      leadVenueMatchesFancy: lead?.venue_id === FANCY,
    },
  };

  writeFileSync(resolve(OUT, "submit-proof.json"), JSON.stringify(proof, null, 2));
  console.log(JSON.stringify(proof, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
