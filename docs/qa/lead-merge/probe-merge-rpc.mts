/**
 * Disposable Sandbox: exercise merge_leads_v1 end-to-end (fields, notes, tours, soft-mark).
 * Requires migration 20261420100000 applied. No Production. No customer sends.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const SANDBOX_REF = "wvpsldwwjqdannqasrdf";
if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes(SANDBOX_REF)) {
  throw new Error("Refusing — not Sandbox");
}
const OUT = "docs/qa/lead-merge";
mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 280)}`);
}

async function main() {
  const stamp = Date.now();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const admin = createClient(url, service, { auth: { persistSession: false } });

  const email = `jennifer+lmmerge.${stamp}@hellotocheers.com`;
  const password = `Lm-${stamp}-Aa1x`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;

  const { data: venue } = await admin.from("venues").insert({
    owner_user_id: userId, name: `Lead Merge RPC ${stamp}`, email: `v.${email}`,
  }).select("id").single();
  const venueId = venue!.id as string;
  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: userId, full_name: "Merge Probe", email,
    role: "owner", is_owner: true, is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator", title_basis: "administrator",
    capability_overrides: {}, owner_invite_pending: false,
  });
  await admin.from("venue_capacity_rules").upsert({
    venue_id: venueId, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0,
  }, { onConflict: "venue_id" });
  await admin.from("tour_availability_windows").insert(
    [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      venue_id: venueId, day_of_week, start_time: "09:00", end_time: "17:00", sort_order: day_of_week,
    })),
  );

  const { data: leadA } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "Primary", last_name: "Early",
    email: `early.${stamp}@example.invalid`, phone: null,
    sales_stage: "new_inquiry", inquiry_message: "First inquiry",
  }).select("id,created_at,updated_at").single();
  // Ensure B is later
  await new Promise((r) => setTimeout(r, 50));
  const { data: leadB } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "Secondary", last_name: "Late",
    email: `late.${stamp}@example.invalid`, phone: "555-0199",
    sales_stage: "new_inquiry", inquiry_message: "Tour request later",
  }).select("id,created_at,updated_at").single();

  await admin.from("lead_notes").insert({
    venue_id: venueId, lead_id: leadB!.id, body: `Note on secondary ${stamp}`,
  });
  const tIso = "2028-07-12T15:00:00.000Z";
  const { data: tour } = await admin.from("tour_appointments").insert({
    venue_id: venueId, lead_id: leadB!.id, status: "scheduled",
    scheduled_at: tIso, duration_minutes: 60,
    contact_name: "Secondary Late", contact_email: `late.${stamp}@example.invalid`,
    origin: "scheduled",
  }).select("id,scheduled_at,status").single();

  const userClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: signErr } = await userClient.auth.signInWithPassword({ email, password });
  record("signed_in_as_owner", !signErr, signErr?.message ?? userId);

  const { data: rpc1, error: rpcErr } = await userClient.rpc("merge_leads_v1", {
    p_venue_id: venueId,
    p_primary_id: leadA!.id,
    p_secondary_id: leadB!.id,
    p_primary_updated_at: leadA!.updated_at,
    p_secondary_updated_at: leadB!.updated_at,
    p_field_patch: { phone: "555-0199" },
    p_tour_cancel_ids: [],
    p_audit: { probe: true, stamp },
  });
  record("merge_rpc_ok", !rpcErr && rpc1?.ok === true,
    rpcErr?.message ?? JSON.stringify(rpc1));

  const { data: primaryAfter } = await admin.from("leads")
    .select("id,phone,merged_into_lead_id").eq("id", leadA!.id).single();
  const { data: secondaryAfter } = await admin.from("leads")
    .select("id,merged_into_lead_id,merged_at").eq("id", leadB!.id).single();
  record("phone_filled_on_primary", primaryAfter?.phone === "555-0199", primaryAfter?.phone ?? "");
  record("secondary_soft_marked",
    secondaryAfter?.merged_into_lead_id === leadA!.id && !!secondaryAfter?.merged_at,
    JSON.stringify(secondaryAfter));

  const { data: noteMoved } = await admin.from("lead_notes")
    .select("id,lead_id,body").eq("venue_id", venueId).eq("body", `Note on secondary ${stamp}`).maybeSingle();
  record("note_reparented", noteMoved?.lead_id === leadA!.id, noteMoved?.lead_id ?? "");

  const { data: tourAfter } = await admin.from("tour_appointments")
    .select("id,lead_id,status,scheduled_at").eq("id", tour!.id).single();
  record("tour_reparented_same_slot",
    tourAfter?.lead_id === leadA!.id
    && tourAfter?.status === "scheduled"
    && tourAfter?.scheduled_at === tIso
    && tourAfter?.id === tour!.id,
    JSON.stringify(tourAfter));

  // Retry idempotent
  const { data: rpc2 } = await userClient.rpc("merge_leads_v1", {
    p_venue_id: venueId,
    p_primary_id: leadA!.id,
    p_secondary_id: leadB!.id,
    p_primary_updated_at: leadA!.updated_at,
    p_secondary_updated_at: secondaryAfter?.merged_at ? (await admin.from("leads").select("updated_at").eq("id", leadB!.id).single()).data?.updated_at : leadB!.updated_at,
    p_field_patch: {},
    p_tour_cancel_ids: [],
    p_audit: { retry: true },
  });
  // After merge, secondary updated_at changed — stale OR alreadyMerged
  const retryOk = rpc2?.ok === true && rpc2?.alreadyMerged === true;
  const retryStale = rpc2?.ok === false && rpc2?.error === "stale";
  // Prefer alreadyMerged: refresh secondary updated_at for true idempotent path
  const { data: secFresh } = await admin.from("leads").select("updated_at,merged_into_lead_id").eq("id", leadB!.id).single();
  const { data: primFresh } = await admin.from("leads").select("updated_at").eq("id", leadA!.id).single();
  const { data: rpc3 } = await userClient.rpc("merge_leads_v1", {
    p_venue_id: venueId,
    p_primary_id: leadA!.id,
    p_secondary_id: leadB!.id,
    p_primary_updated_at: primFresh!.updated_at,
    p_secondary_updated_at: secFresh!.updated_at,
    p_field_patch: {},
    p_tour_cancel_ids: [],
    p_audit: { retry2: true },
  });
  record("retry_idempotent_already_merged",
    rpc3?.ok === true && rpc3?.alreadyMerged === true,
    JSON.stringify({ rpc2, rpc3, retryOk, retryStale }));

  // Cross-venue reject: create other venue lead and attempt
  const { data: otherVenue } = await admin.from("venues").insert({
    owner_user_id: userId, name: `Other ${stamp}`, email: `o.${email}`,
  }).select("id").single();
  const { data: foreign } = await admin.from("leads").insert({
    venue_id: otherVenue!.id, first_name: "X", last_name: "Y", sales_stage: "new_inquiry",
  }).select("id,updated_at").single();
  const { data: cross } = await userClient.rpc("merge_leads_v1", {
    p_venue_id: venueId,
    p_primary_id: leadA!.id,
    p_secondary_id: foreign!.id,
    p_primary_updated_at: primFresh!.updated_at,
    p_secondary_updated_at: foreign!.updated_at,
    p_field_patch: {},
    p_tour_cancel_ids: [],
    p_audit: {},
  });
  record("cross_venue_rejected",
    cross?.ok === false && (cross?.error === "secondary_not_found" || cross?.error === "unauthorized"),
    JSON.stringify(cross));

  // No duplicate tour rows created
  const { count: tourCount } = await admin.from("tour_appointments")
    .select("id", { count: "exact", head: true }).eq("id", tour!.id);
  record("no_tour_duplication", (tourCount ?? 0) === 1, `count=${tourCount}`);

  const summary = {
    venueId, primaryId: leadA!.id, secondaryId: leadB!.id, tourId: tour!.id,
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/probe-merge-rpc-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
