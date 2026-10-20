/**
 * Disposable Sandbox: prove tour cancel releases occupancy; lead_id reparent preserves appointment.
 * Read/write synthetic venue only. No Production. No customer sends.
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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 300)}`);
}

async function main() {
  const stamp = Date.now();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const email = `jennifer+lmprobe.${stamp}@hellotocheers.com`;
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password: `Lm-${stamp}-Aa1x`, email_confirm: true,
  });
  if (cErr || !created.user) throw cErr ?? new Error("user");
  const userId = created.user.id;

  const { data: venue, error: vErr } = await admin.from("venues").insert({
    owner_user_id: userId, name: `Lead Merge Probe ${stamp}`, email: `v.${email}`,
  }).select("id").single();
  if (vErr || !venue) throw vErr ?? new Error("venue");
  const venueId = venue.id as string;

  await admin.from("venue_staff").insert({
    venue_id: venueId, user_id: userId, full_name: "Probe", email,
    role: "owner", is_owner: true, is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator", title_basis: "administrator",
    capability_overrides: {}, owner_invite_pending: false,
  });
  await admin.from("venue_capacity_rules").upsert({
    venue_id: venueId, max_simultaneous_events: 1, max_simultaneous_tours: 2, min_turnaround_hours: 0,
  }, { onConflict: "venue_id" });
  // Open tour windows every weekday so inserts pass availability triggers
  await admin.from("tour_availability_windows").insert(
    [0, 1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      venue_id: venueId, day_of_week, start_time: "09:00", end_time: "17:00", sort_order: day_of_week,
    })),
  );

  const { data: leadA } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "Alpha", last_name: "Early",
    email: `alpha.${stamp}@example.invalid`, sales_stage: "new_inquiry",
  }).select("id,created_at").single();
  const { data: leadB } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "Beta", last_name: "Dup",
    email: `beta.${stamp}@example.invalid`, sales_stage: "new_inquiry",
  }).select("id,created_at").single();
  record("leads_created", !!leadA && !!leadB, `A=${leadA?.id} B=${leadB?.id}`);

  // Far-future weekday 15:00Z slots inside open windows
  const t1 = "2028-06-07T15:00:00.000Z";
  const t2 = "2028-06-14T15:00:00.000Z";
  const t3 = "2028-06-21T15:00:00.000Z";

  const { data: tour1, error: t1Err } = await admin.from("tour_appointments").insert({
    venue_id: venueId, lead_id: leadB!.id, status: "scheduled",
    scheduled_at: t1, duration_minutes: 60,
    contact_name: "Beta Dup", contact_email: `beta.${stamp}@example.invalid`,
    origin: "scheduled",
  }).select("id,status,lead_id,scheduled_at").single();
  record("tour1_created", !!tour1 && !t1Err, t1Err?.message ?? tour1?.id ?? "");
  if (!tour1) {
    writeFileSync(`${OUT}/probe-tour-slot-results.json`, JSON.stringify({ venueId, checks }, null, 2));
    process.exit(1);
  }

  const { count: occBefore } = await admin.from("tour_appointments")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("id", tour1.id)
    .neq("status", "cancelled");
  record("tour1_occupies_before_cancel", (occBefore ?? 0) === 1, `occ=${occBefore}`);

  const { error: cancelErr } = await admin.from("tour_appointments")
    .update({ status: "cancelled", cancellation_reason: "probe" })
    .eq("id", tour1.id)
    .eq("venue_id", venueId);
  const { count: occAfterCancel } = await admin.from("tour_appointments")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venueId)
    .eq("id", tour1.id)
    .neq("status", "cancelled");
  record("cancel_releases_occupancy", !cancelErr && (occAfterCancel ?? 0) === 0,
    `err=${cancelErr?.message ?? "none"} occ=${occAfterCancel}`);

  // Same slot as cancelled tour1 — must succeed if cancel released capacity
  const { data: tourSameSlot, error: sameErr } = await admin.from("tour_appointments").insert({
    venue_id: venueId, lead_id: leadB!.id, status: "scheduled",
    scheduled_at: t1, duration_minutes: 60,
    contact_name: "Beta Dup", contact_email: `beta.${stamp}@example.invalid`,
    origin: "scheduled",
  }).select("id").single();
  record("same_slot_bookable_after_cancel", !!tourSameSlot && !sameErr,
    sameErr?.message ?? tourSameSlot?.id ?? "");

  const { data: tour2, error: t2Err } = await admin.from("tour_appointments").insert({
    venue_id: venueId, lead_id: leadB!.id, status: "confirmed",
    scheduled_at: t2, duration_minutes: 60,
    contact_name: "Beta Dup", contact_email: `beta.${stamp}@example.invalid`,
    origin: "scheduled", confirmed_at: new Date().toISOString(), confirmation_source: "manual",
  }).select("id,status,lead_id,scheduled_at").single();
  record("tour2_created", !!tour2 && !t2Err, t2Err?.message ?? tour2?.id ?? "");
  if (!tour2) {
    writeFileSync(`${OUT}/probe-tour-slot-results.json`, JSON.stringify({ venueId, checks }, null, 2));
    process.exit(1);
  }

  const { error: reparentErr } = await admin.from("tour_appointments")
    .update({ lead_id: leadA!.id })
    .eq("id", tour2.id)
    .eq("venue_id", venueId);
  const { data: tour2After } = await admin.from("tour_appointments")
    .select("id,lead_id,status,scheduled_at").eq("id", tour2.id).single();
  record("reparent_preserves_appointment",
    !reparentErr
    && tour2After?.lead_id === leadA!.id
    && tour2After?.status === "confirmed"
    && tour2After?.scheduled_at === tour2.scheduled_at
    && tour2After?.id === tour2.id,
    `lead=${tour2After?.lead_id} status=${tour2After?.status} id=${tour2After?.id}`);

  const { data: leadC } = await admin.from("leads").insert({
    venue_id: venueId, first_name: "Gamma", last_name: "Delete",
    email: `gamma.${stamp}@example.invalid`, sales_stage: "new_inquiry",
  }).select("id").single();
  const { data: tour3 } = await admin.from("tour_appointments").insert({
    venue_id: venueId, lead_id: leadC!.id, status: "scheduled",
    scheduled_at: t3, duration_minutes: 60,
    contact_name: "Gamma", contact_email: `gamma.${stamp}@example.invalid`,
    origin: "scheduled",
  }).select("id").single();
  await admin.from("tour_appointments").update({ status: "cancelled" })
    .eq("id", tour3!.id).eq("venue_id", venueId);
  await admin.from("tour_appointments").update({ is_archived: true })
    .eq("id", tour3!.id).eq("venue_id", venueId);
  await admin.from("leads").delete().eq("id", leadC!.id).eq("venue_id", venueId);
  const { data: tour3After } = await admin.from("tour_appointments")
    .select("id,lead_id,status,is_archived").eq("id", tour3!.id).maybeSingle();
  record("lead_delete_path_cancels_and_nulls_lead",
    tour3After?.status === "cancelled"
    && tour3After?.is_archived === true
    && tour3After?.lead_id == null,
    JSON.stringify(tour3After));

  const summary = { venueId, stamp, pass: checks.filter((c) => c.pass).length, fail: checks.filter((c) => !c.pass).length, checks };
  writeFileSync(`${OUT}/probe-tour-slot-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail} venue=${venueId}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
