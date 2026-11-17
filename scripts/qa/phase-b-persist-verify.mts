import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const WILLOW = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const VENUE = "f016be73-5ada-4922-b600-0ad2ee6121dc";
const OUT = `${process.env.HOME}/Desktop/HTC-Phase-B-Browser-Acceptance`;

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Refusing: not Sandbox supabase");
}

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function count(table: string, filter?: { col: string; val: string }) {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  if (filter) q = q.eq(filter.col, filter.val);
  const res = await q;
  return { table, count: res.count ?? 0, error: res.error?.message ?? null };
}

const [
  clients,
  events,
  leads,
  batches,
  qbo,
  invites,
  setup,
  messages,
  comms,
  sms,
  payments,
  stripeEvents,
  fancyClients,
  willowClients,
] = await Promise.all([
  admin.from("clients").select("id, first_name, last_name, email, event_date, status, venue_id, partner_first_name, partner_last_name").eq("venue_id", VENUE),
  admin.from("events").select("id, client_id, status, event_date, booked_at, venue_id").eq("venue_id", VENUE),
  admin.from("leads").select("id, first_name, last_name, email, sales_stage, venue_id").eq("venue_id", VENUE),
  admin.from("import_batches").select("id, entity_type, imported_count, skipped_count, error_count, source_label, created_at").eq("venue_id", VENUE).order("created_at"),
  admin.from("quickbooks_sync_queue").select("id").eq("venue_id", VENUE),
  admin.from("client_invitations").select("id, status").eq("venue_id", VENUE),
  admin.from("event_setup_states").select("event_id").eq("venue_id", VENUE),
  admin.from("messages").select("id").eq("venue_id", VENUE),
  admin.from("communications").select("id").eq("venue_id", VENUE),
  admin.from("sms_messages").select("id").eq("venue_id", VENUE),
  admin.from("payments").select("id").eq("venue_id", VENUE),
  admin.from("stripe_webhook_events").select("id").eq("venue_id", VENUE),
  count("clients", { col: "venue_id", val: FANCY }),
  count("clients", { col: "venue_id", val: WILLOW }),
]);

const vendors = await admin.from("vendors").select("id, business_name, email").ilike("email", "%byb.test%");

const snap = {
  at: new Date().toISOString(),
  venueId: VENUE,
  clients: clients.data ?? [],
  events: events.data ?? [],
  leads: leads.data ?? [],
  batches: batches.data ?? [],
  vendors: vendors.data ?? [],
  qbo: qbo.data ?? [],
  invites: invites.data ?? [],
  setup: setup.data ?? [],
  messages: { data: messages.data, error: messages.error?.message ?? null },
  communications: { data: comms.data, error: comms.error?.message ?? null },
  sms: { data: sms.data, error: sms.error?.message ?? null },
  payments: { data: payments.data, error: payments.error?.message ?? null },
  stripe: { data: stripeEvents.data, error: stripeEvents.error?.message ?? null },
  fancyClientCount: fancyClients,
  willowClientCount: willowClients,
  clientErrors: clients.error?.message ?? null,
};

writeFileSync(`${OUT}/persist-final.json`, JSON.stringify(snap, null, 2));
console.log(JSON.stringify({
  clients: snap.clients.length,
  names: snap.clients.map((c: { first_name: string; last_name: string }) => `${c.first_name} ${c.last_name}`),
  events: snap.events.map((e: { status: string; event_date: string }) => `${e.status} ${e.event_date}`),
  leads: snap.leads.map((l: { first_name: string; sales_stage: string }) => `${l.first_name} ${l.sales_stage}`),
  vendors: snap.vendors.map((v: { business_name: string }) => v.business_name),
  batches: snap.batches.map((b: { entity_type: string; imported_count: number; skipped_count: number }) => `${b.entity_type} +${b.imported_count}/skip${b.skipped_count}`),
  qbo: snap.qbo.length,
  invites: snap.invites.length,
  setup: snap.setup.length,
  messages: snap.messages,
  communications: snap.communications,
  sms: snap.sms,
  payments: snap.payments,
  stripe: snap.stripe,
  fancy: snap.fancyClientCount,
  willow: snap.willowClientCount,
}, null, 2));
