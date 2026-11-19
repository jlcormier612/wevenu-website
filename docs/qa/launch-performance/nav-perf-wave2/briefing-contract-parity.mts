/** Compare fat getContracts vs lean briefing contracts for readiness attention parity. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";

const LEAN =
  "id, venue_id, client_id, event_id, template_id, title, status, execution_origin, sign_token, signer_name, signed_at, sent_at, expires_at, created_at, updated_at, amends_contract_id, branding_snapshot, clients(first_name, last_name, partner_first_name, partner_last_name, event_date), events(event_date)";

function needsAttention(contracts: { status: string; execution_origin?: string | null }[]) {
  const signed = contracts.filter((c) => c.status === "signed").length;
  const sent = contracts.filter((c) => c.status === "sent").length;
  if (contracts.length === 0) return "not_started";
  if (signed === contracts.length) return "complete";
  if (sent > 0) return "waiting";
  return "needs_attention";
}

async function main() {
  const t0 = performance.now();
  const fat = await sb.from("contracts").select("*, clients(first_name,last_name), events(event_date)").eq("venue_id", FANCY);
  const fatMs = Math.round(performance.now() - t0);
  const t1 = performance.now();
  const lean = await sb.from("contracts").select(LEAN).eq("venue_id", FANCY);
  const leanMs = Math.round(performance.now() - t1);

  const byEvent = (rows: { event_id?: string | null; status: string; execution_origin?: string | null }[]) => {
    const m = new Map<string, typeof rows>();
    for (const r of rows) {
      if (!r.event_id) continue;
      const list = m.get(r.event_id) ?? [];
      list.push(r);
      m.set(r.event_id, list);
    }
    return m;
  };
  const fatRows = (fat.data ?? []) as { event_id: string | null; status: string; execution_origin: string | null }[];
  const leanRows = (lean.data ?? []) as { event_id: string | null; status: string; execution_origin: string | null }[];
  const fatMap = byEvent(fatRows);
  const leanMap = byEvent(leanRows);
  const eventIds = new Set([...fatMap.keys(), ...leanMap.keys()]);
  let mismatch = 0;
  const samples: unknown[] = [];
  for (const id of eventIds) {
    const a = needsAttention(fatMap.get(id) ?? []);
    const b = needsAttention(leanMap.get(id) ?? []);
    if (a !== b) {
      mismatch += 1;
      samples.push({ eventId: id, fat: a, lean: b });
    }
  }
  const out = {
    fatMs,
    leanMs,
    fatBytes: JSON.stringify(fat.data).length,
    leanBytes: JSON.stringify(lean.data).length,
    fatRows: fatRows.length,
    leanRows: leanRows.length,
    eventBuckets: eventIds.size,
    readinessStatusMismatches: mismatch,
    samples,
  };
  writeFileSync(resolve("docs/qa/launch-performance/nav-perf-wave2/briefing-contract-parity.json"), JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  if (mismatch > 0) process.exit(1);
}
main();
