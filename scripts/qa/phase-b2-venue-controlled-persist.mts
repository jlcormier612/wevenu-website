import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const venueId = process.argv[2];
const label = process.argv[3] ?? "self-service";
if (!venueId) throw new Error("venue id required");

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const q = (table: string, cols: string) => admin.from(table).select(cols).eq("venue_id", venueId);
const [
  clients, events, leads, batches, qbo, invites, contracts, payments, messages, sms, scheduled,
] = await Promise.all([
  q("clients", "id, first_name, last_name, email, event_date, status, venue_id, relationship_id"),
  q("events", "id, client_id, name, status, event_date, booked_at, space_id, venue_id"),
  q("leads", "id, first_name, last_name, email, partner_first_name, event_date, event_type, guest_count, estimated_budget, source, sales_stage, inquiry_message, source_data, venue_id, relationship_id, is_historical_import"),
  q("import_batches", "id, entity_type, imported_count, skipped_count, error_count, source_label, rolled_back_at"),
  q("quickbooks_sync_queue", "id"),
  q("client_invitations", "id"),
  q("contracts", "id"),
  q("payments", "id"),
  q("messages", "id"),
  q("sms_messages", "id"),
  q("scheduled_messages", "id"),
]);

const snap = {
  label,
  venueId,
  clients: clients.data ?? [],
  events: events.data ?? [],
  leads: leads.data ?? [],
  batches: batches.data ?? [],
  qbo: qbo.data ?? [],
  invites: invites.data ?? [],
  contracts: contracts.data ?? [],
  payments: payments.data ?? [],
  messages: messages.data ?? [],
  sms: sms.data ?? [],
  scheduled: scheduled.data ?? [],
  errors: {
    clients: clients.error?.message,
    events: events.error?.message,
    leads: leads.error?.message,
  },
};

const out = `${process.env.HOME}/Desktop/HTC-Phase-B2-Venue-Controlled-Review/persist-${label}.json`;
writeFileSync(out, JSON.stringify(snap, null, 2));

const riley = snap.leads.filter((l) => l.email === "riley.prospect@byb.test");
const avery = snap.leads.filter((l) => l.email === "avery.source@byb.test");
const other = snap.leads.filter((l) => l.first_name === "Other");
const casey = snap.leads.filter((l) => l.email === "casey.clear@byb.test");
const morganL = snap.leads.filter((l) => l.email === "morgan.booked@byb.test");
const morganC = snap.clients.filter((c) => c.email === "morgan.booked@byb.test");
const morganE = snap.events.filter((e) => morganC.some((c) => c.id === e.client_id) && e.status !== "cancelled");

console.log(JSON.stringify({
  out,
  leadCount: snap.leads.length,
  riley: riley.map((l) => ({
    id: l.id,
    date: l.event_date,
    stage: l.sales_stage,
    notes: l.inquiry_message,
    budget: l.estimated_budget,
    hist: l.is_historical_import,
    src: l.source_data,
    rel: l.relationship_id,
  })),
  avery: avery.map((l) => ({
    id: l.id,
    date: l.event_date,
    budget: l.estimated_budget,
    notes: l.inquiry_message,
    src: l.source_data,
  })),
  other: other.length,
  casey: casey.map((l) => ({ id: l.id, date: l.event_date })),
  morganClients: morganC,
  morganEvents: morganE,
  morganLeads: morganL.map((l) => ({ id: l.id, date: l.event_date, stage: l.sales_stage })),
  quiet: {
    qbo: snap.qbo.length,
    invites: snap.invites.length,
    contracts: snap.contracts.length,
    payments: snap.payments.length,
    messages: snap.messages.length,
    sms: snap.sms.length,
    scheduled: snap.scheduled.length,
  },
  isolation: [...snap.clients, ...snap.events, ...snap.leads].every((r) => r.venue_id === venueId),
}, null, 2));
