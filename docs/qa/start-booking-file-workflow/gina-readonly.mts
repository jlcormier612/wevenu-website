/** Read-only Gina Palo / Rich Dude booking-file state. */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox");
const sb = createClient(url, key, { auth: { persistSession: false } });

const { data: leads } = await sb
  .from("leads")
  .select(
    "id, first_name, last_name, partner_first_name, partner_last_name, sales_stage, linked_client_id, linked_event_id, venue_id, updated_at, email, event_date",
  )
  .or(
    "and(first_name.ilike.%Gina%,last_name.ilike.%Palo%),and(partner_first_name.ilike.%Rich%,partner_last_name.ilike.%Dude%),email.ilike.%gina%",
  )
  .limit(30);

const rich = (leads ?? []).filter(
  (l) =>
    /gina/i.test(`${l.first_name} ${l.last_name}`) ||
    /rich/i.test(`${l.partner_first_name ?? ""} ${l.partner_last_name ?? ""}`),
);

const detailed = [];
for (const lead of rich) {
  let client = null;
  let event = null;
  let floorPlans = [];
  let vendors = [];
  if (lead.linked_client_id) {
    const { data: c } = await sb
      .from("clients")
      .select("id, status, first_name, last_name, partner_first_name, partner_last_name, created_at, updated_at, lead_id")
      .eq("id", lead.linked_client_id)
      .maybeSingle();
    client = c;
    const { data: fps } = await sb
      .from("floor_plans")
      .select("id, name, event_id, client_id, created_at")
      .or(`client_id.eq.${lead.linked_client_id}${lead.linked_event_id ? `,event_id.eq.${lead.linked_event_id}` : ""}`);
    floorPlans = fps ?? [];
    if (lead.linked_event_id) {
      const { data: e } = await sb
        .from("events")
        .select("id, status, event_date, name, client_id, created_at")
        .eq("id", lead.linked_event_id)
        .maybeSingle();
      event = e;
      const { data: va } = await sb
        .from("event_vendor_assignments")
        .select("id, vendor_id, event_id, created_at")
        .eq("event_id", lead.linked_event_id);
      vendors = va ?? [];
    }
  }
  detailed.push({ lead, client, event, floorPlans, vendors });
}

const out = { observedAt: new Date().toISOString(), count: detailed.length, detailed };
writeFileSync(resolve("docs/qa/start-booking-file-workflow/gina-readonly.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
