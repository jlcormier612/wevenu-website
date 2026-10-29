// Read-only S7 snapshot (GET only). Usage: node /tmp/r1/snapshot.mjs <label>
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const env = Object.fromEntries(
  readFileSync("/Users/jensmac/Developer/wevenu-website/.env.local", "utf8")
    .split("\n").filter((l) => /^[A-Z0-9_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"|"$/g, "")]),
);
const base = env.NEXT_PUBLIC_SUPABASE_URL;
if (!base.includes("wvpsldwwjqdannqasrdf")) throw new Error("Not Sandbox");
const key = env.SUPABASE_SERVICE_ROLE_KEY;
const V = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
async function get(path) {
  const res = await fetch(`${base}/rest/v1/${path}`, { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}` } });
  const body = await res.json();
  if (!res.ok) return { error: `${res.status} ${JSON.stringify(body).slice(0, 160)}` };
  return body;
}
const sum = (rows) => (Array.isArray(rows)
  ? { count: rows.length, hash: createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16) }
  : rows);
const inList = (ids) => `in.(${ids.join(",")})`;

const EVENTS = {
  template_case_5cd0be77: "5cd0be77-ec99-48c6-a86b-7235b3a65f76",
  packet_shared_ebf74f77: "ebf74f77-2944-474a-b735-48762ecb6842",
  empty_case_9f569e99: "9f569e99-cca9-4b5e-be5c-bbe0b60affc4",
  shared_9c200402: "9c200402-5d76-4851-aa8e-ef3ffd823144",
};
const out = { label: process.argv[2], at: new Date().toISOString(), events: {}, library: {}, venueWide: {} };
for (const [name, E] of Object.entries(EVENTS)) {
  const r = {};
  const inv = await get(`event_inventory?event_id=eq.${E}&select=*&order=id`);
  r.event_inventory = sum(inv);
  const invIds = Array.isArray(inv) ? inv.map((x) => x.id) : [];
  r.event_inventory_items = invIds.length ? sum(await get(`event_inventory_items?event_inventory_id=${inList(invIds)}&select=*&order=id`)) : { count: 0 };
  r.event_inventory_activities = invIds.length ? sum(await get(`event_inventory_activities?event_inventory_id=${inList(invIds)}&select=id&order=id`)) : { count: 0 };
  const eo = await get(`event_orders?event_id=eq.${E}&select=*&order=id`);
  r.event_orders = sum(eo);
  const eoIds = Array.isArray(eo) ? eo.map((x) => x.id) : [];
  for (const t of ["event_order_lines", "event_order_sections", "event_order_share_snapshots", "event_order_activities"]) {
    r[t] = eoIds.length ? sum(await get(`${t}?event_order_id=${inList(eoIds)}&select=*&order=id`)) : { count: 0 };
  }
  const ch = await get(`client_choices?event_id=eq.${E}&select=*&order=id`);
  r.client_choices = sum(ch);
  const chIds = Array.isArray(ch) ? ch.map((x) => x.id) : [];
  r.client_choices_submissions = sum(await get(`client_choices_submissions?event_id=eq.${E}&select=*&order=id`));
  r.client_choices_activities = chIds.length ? sum(await get(`client_choices_activities?client_choices_id=${inList(chIds)}&select=id&order=id`)) : { count: 0 };
  const inv2 = await get(`invoices?event_id=eq.${E}&select=*&order=id`);
  r.invoices = sum(inv2);
  const invoiceIds = Array.isArray(inv2) ? inv2.map((x) => x.id) : [];
  r.invoice_line_items = invoiceIds.length ? sum(await get(`invoice_line_items?invoice_id=${inList(invoiceIds)}&select=*&order=id`)) : { count: 0 };
  r.contracts = sum(await get(`contracts?event_id=eq.${E}&select=*&order=id`));
  const ev = await get(`events?id=eq.${E}&select=client_id`);
  const clientId = Array.isArray(ev) && ev[0] ? ev[0].client_id : null;
  r.client_portal_sessions = clientId ? sum(await get(`client_portal_sessions?client_id=eq.${clientId}&select=id,last_accessed_at&order=id`)) : { count: 0 };
  out.events[name] = r;
}
const invTpl = await get(`inventory_templates?venue_id=eq.${V}&select=*&order=id`);
out.library.inventory_templates = sum(invTpl);
out.library.inventory_template_items = sum(await get(`inventory_template_items?template_id=${inList(invTpl.map((t) => t.id))}&select=*&order=id`));
out.library.event_order_templates = sum(await get(`event_order_templates?venue_id=eq.${V}&select=*&order=id`));
async function exact(t) {
  const res = await fetch(`${base}/rest/v1/${t}?venue_id=eq.${V}&select=*&limit=1`, {
    method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, Prefer: "count=exact" },
  });
  const body = await res.json();
  if (!res.ok) return { error: `${res.status} ${JSON.stringify(body).slice(0, 120)}` };
  return { count: Number(res.headers.get("content-range")?.split("/")[1]), newest: null };
}
for (const t of ["notification_log", "messages", "scheduled_messages", "conversation_messages", "message_events", "invitation_emails", "quickbooks_sync_queue", "invoices", "invoice_line_items", "contracts", "client_choices", "client_choices_submissions", "event_inventory_items", "event_order_lines"]) {
  out.venueWide[t] = await exact(t);
}
const file = `/tmp/r1/snapshot-${process.argv[2]}.json`;
writeFileSync(file, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
