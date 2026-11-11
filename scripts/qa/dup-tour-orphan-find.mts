import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync, mkdirSync } from "node:fs";
config({ path: ".env.local", quiet: true });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/duplicate-lead-tour-orphan";
mkdirSync(OUT, { recursive: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

const { data: phantoms } = await admin.from("tour_appointments")
  .select("id,lead_id,status,scheduled_at,duration_minutes,contact_email,contact_name,confirm_token,confirmed_at,confirmation_source,is_archived,created_at,origin")
  .eq("venue_id", FANCY)
  .eq("is_archived", true)
  .in("status", ["scheduled", "confirmed"])
  .gte("scheduled_at", new Date().toISOString())
  .order("scheduled_at");

const details = [];
for (const t of phantoms ?? []) {
  const email = t.contact_email;
  const { data: leads } = email
    ? await admin.from("leads").select("id,first_name,last_name,email,sales_stage,created_at,status").eq("venue_id", FANCY).ilike("email", email)
    : { data: [] };
  const { data: allTours } = email
    ? await admin.from("tour_appointments").select("id,lead_id,status,scheduled_at,is_archived,confirm_token,confirmed_at,confirmation_source").eq("venue_id", FANCY).ilike("contact_email", email)
    : { data: [] };
  details.push({ phantom: t, siblingLeads: leads, siblingTours: allTours });
}
writeFileSync(`${OUT}/future-phantoms.json`, JSON.stringify(details, null, 2));
console.log(JSON.stringify(details.map(d => ({
  tourId: d.phantom.id,
  at: d.phantom.scheduled_at,
  email: d.phantom.email ?? d.phantom.contact_email,
  confirm_token: d.phantom.confirm_token,
  siblingLeadCount: d.siblingLeads?.length ?? 0,
  siblingLeads: d.siblingLeads,
  tours: d.siblingTours,
})), null, 2));
