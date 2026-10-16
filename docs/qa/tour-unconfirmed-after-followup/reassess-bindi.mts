/** Read-only reassessment after repair guard refused. */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOUR_ID = "555060cd-a188-4e2a-ae42-f0da64396e50";
const LEAD_ID = "5d33fcbe-e6c7-4163-9b5e-29db3389efca";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox");
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: tour } = await admin.from("tour_appointments").select("*").eq("id", TOUR_ID).maybeSingle();
const { data: lead } = await admin
  .from("leads")
  .select("id, first_name, last_name, follow_up_date, next_action_text, updated_at, sales_stage")
  .eq("id", LEAD_ID)
  .maybeSingle();
const { data: activities } = await admin
  .from("lead_activities")
  .select("type, title, description, created_at")
  .eq("lead_id", LEAD_ID)
  .order("created_at", { ascending: true });
const { data: notifs } = await admin
  .from("venue_notifications")
  .select("id, type, title, body, created_at, needs_email, emailed_at")
  .eq("venue_id", tour!.venue_id)
  .ilike("title", "%Bindi%")
  .order("created_at", { ascending: true });
const { data: hybrids } = await admin
  .from("tour_appointments")
  .select("id, lead_id, contact_name, status, confirmed_at, confirmation_source, scheduled_at, updated_at")
  .eq("status", "scheduled")
  .not("confirmed_at", "is", null);

const payload = {
  observedAt: new Date().toISOString(),
  forensicVsNow: {
    forensic: {
      status: "scheduled",
      scheduled_at: "2026-10-18T16:00:00+00:00",
      confirmed_at: "2026-10-16T03:00:12.633152+00:00",
    },
    now: {
      status: tour?.status,
      scheduled_at: tour?.scheduled_at,
      confirmed_at: tour?.confirmed_at,
      confirmation_source: tour?.confirmation_source,
      updated_at: tour?.updated_at,
    },
  },
  tour,
  lead,
  activities,
  notifs,
  hybridScan: hybrids ?? [],
};
writeFileSync(
  resolve("docs/qa/tour-unconfirmed-after-followup/bindi-reassess.json"),
  JSON.stringify(payload, null, 2),
);
console.log(JSON.stringify(payload.forensicVsNow, null, 2));
console.log("activities since 03:02:", (activities ?? []).filter((a) => a.created_at >= "2026-10-16T03:02:00Z"));
console.log("hybrid count", (hybrids ?? []).length);
