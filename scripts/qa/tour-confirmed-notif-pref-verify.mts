/**
 * Sandbox verify: prefs OFF still create in-app tour_confirmed; needs_email=false.
 * Prefs ON create in-app with needs_email=true. No processVenueNotificationEmails
 * (would send real staff email). No Gina record mutations. Fixtures cleaned up.
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("sandbox only");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const OUT = "docs/qa/tour-confirmed-venue-notification";
mkdirSync(OUT, { recursive: true });
const MEADOW = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const GINA_TOUR = "81c85d1b-b6bc-436c-a395-39fda70dc281";

async function probe(venueId: string, label: string) {
  const { data: prefs } = await admin
    .from("venue_notification_preferences")
    .select("pref_tour_confirmed,pref_tour_scheduled")
    .eq("venue_id", venueId)
    .single();
  const tag = `pref-verify-${label}-${Date.now()}`;
  const { data: lead, error: le } = await admin
    .from("leads")
    .insert({
      venue_id: venueId,
      first_name: "PrefVerify",
      last_name: tag,
      email: `${tag}@hellotocheers.test`,
      sales_stage: "new_inquiry",
      inquiry_message_origin: "customer",
    })
    .select("id")
    .single();
  if (le || !lead) throw le ?? new Error("lead");

  const token = randomUUID();
  const { data: tour, error: te } = await admin
    .from("tour_appointments")
    .insert({
      venue_id: venueId,
      lead_id: lead.id,
      scheduled_at: "2028-12-05T15:00:00.000Z",
      duration_minutes: 30,
      status: "cancelled",
      origin: "scheduled",
      contact_name: `PrefVerify ${tag}`,
      contact_email: `${tag}@hellotocheers.test`,
      confirm_token: token,
      is_archived: false,
    })
    .select("id")
    .single();
  if (te || !tour) {
    await admin.from("leads").delete().eq("id", lead.id);
    throw te ?? new Error("tour");
  }
  await admin.from("tour_appointments").update({ status: "scheduled" }).eq("id", tour.id);
  const since = new Date().toISOString();
  const { data: rpc } = await admin.rpc("confirm_tour_by_token", { p_token: token });
  const { data: notifs } = await admin
    .from("venue_notifications")
    .select("id,type,title,needs_email,emailed_at,created_at")
    .eq("venue_id", venueId)
    .eq("type", "tour_confirmed")
    .gte("created_at", since);

  // Cleanup fixtures + any notifs we created
  if (notifs?.length) {
    await admin.from("venue_notifications").delete().in("id", notifs.map((n) => n.id));
  }
  await admin.from("lead_activities").delete().eq("lead_id", lead.id);
  await admin.from("tour_appointments").delete().eq("id", tour.id);
  await admin.from("leads").delete().eq("id", lead.id);

  return {
    venueId,
    label,
    prefs,
    rpc,
    notifCount: notifs?.length ?? 0,
    needs_email: notifs?.[0]?.needs_email ?? null,
    title: notifs?.[0]?.title ?? null,
    emailed_at: notifs?.[0]?.emailed_at ?? null,
  };
}

const { data: ginaBefore } = await admin
  .from("tour_appointments")
  .select("id,status,confirmed_at,lead_id,updated_at")
  .eq("id", GINA_TOUR)
  .single();

const meadow = await probe(MEADOW, "meadow-off");
const fancy = await probe(FANCY, "fancy-on");

const { data: ginaAfter } = await admin
  .from("tour_appointments")
  .select("id,status,confirmed_at,lead_id,updated_at")
  .eq("id", GINA_TOUR)
  .single();

const report = {
  probedAt: new Date().toISOString(),
  meadowOff: {
    ...meadow,
    pass:
      meadow.prefs?.pref_tour_confirmed === false &&
      meadow.notifCount === 1 &&
      meadow.needs_email === false &&
      (meadow.rpc as { ok?: boolean })?.ok === true,
  },
  fancyOn: {
    ...fancy,
    pass:
      fancy.prefs?.pref_tour_confirmed === true &&
      fancy.notifCount === 1 &&
      fancy.needs_email === true &&
      (fancy.rpc as { ok?: boolean })?.ok === true,
  },
  ginaUntouched: {
    before: ginaBefore,
    after: ginaAfter,
    pass:
      ginaBefore?.status === ginaAfter?.status &&
      ginaBefore?.confirmed_at === ginaAfter?.confirmed_at &&
      ginaBefore?.updated_at === ginaAfter?.updated_at,
  },
  emailSend: {
    attempted: false,
    note: "Did not call processVenueNotificationEmails — would deliver to venue staff email. needs_email flags assert suppression/eligibility only.",
  },
};
const allPass = report.meadowOff.pass && report.fancyOn.pass && report.ginaUntouched.pass;
writeFileSync(`${OUT}/pref-contract-runtime-verify.json`, JSON.stringify({ allPass, ...report }, null, 2));
console.log(JSON.stringify({ allPass, meadowOff: report.meadowOff, fancyOn: report.fancyOn, ginaUntouched: report.ginaUntouched.pass }, null, 2));
process.exit(allPass ? 0 : 1);
