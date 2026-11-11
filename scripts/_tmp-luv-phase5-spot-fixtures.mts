/**
 * Temp: seed Jen's Fancy Venue fixtures for Luv Phase 5 Spot Patterns browser proof.
 * Usage: npx tsx --env-file=.env.local scripts/_tmp-luv-phase5-spot-fixtures.mts
 *
 * Seeds:
 *   P-A1 — 3 unattended new_inquiry leads (≥48h, within 14d)
 *   P-A4 — 3 upcoming events (≤14d) with payment needs_attention
 *   P-P1 — 7 leads in last 14d vs 5 in prior 14d (net evidence; may combine with existing)
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const TAG = "LUV-P5-QA";

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing SUPABASE env");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: venue } = await sb.from("venues").select("id,name,timezone").eq("id", FANCY).single();
  console.log("venue", venue);

  // ── P-A1: 3 unattended inquiries ─────────────────────────────────────────
  for (let i = 1; i <= 3; i++) {
    const created = hoursAgo(48 + i * 6);
    const { data, error } = await sb
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: TAG,
        last_name: `Unattended${i}`,
        email: `luv-p5-a1-${i}-${Date.now()}@hellotocheers-test.invalid`,
        sales_stage: "new_inquiry",
        status: "active",
        source: "website",
        last_contacted_at: null,
        created_at: created,
        updated_at: created,
      })
      .select("id,last_name,created_at,sales_stage,last_contacted_at")
      .single();
    if (error) console.error("P-A1", i, error.message);
    else console.log("P-A1", data);
  }

  // ── P-P1 volume helpers: stamp 7 "current" + ensure prior baseline visible ─
  // (evaluator uses all business leads; these add clear current-window mass)
  for (let i = 1; i <= 7; i++) {
    const created = daysAgo(1 + (i % 10));
    const { data, error } = await sb
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: TAG,
        last_name: `VolumeCur${i}`,
        email: `luv-p5-p1-cur-${i}-${Date.now()}@hellotocheers-test.invalid`,
        sales_stage: "new_inquiry",
        status: "active",
        source: "website",
        last_contacted_at: hoursAgo(1),
        created_at: created,
        updated_at: created,
      })
      .select("id,last_name,created_at")
      .single();
    if (error) console.error("P-P1 cur", i, error.message);
    else console.log("P-P1 cur", data?.id, data?.created_at);
  }
  for (let i = 1; i <= 5; i++) {
    const created = daysAgo(15 + i);
    const { data, error } = await sb
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: TAG,
        last_name: `VolumePrior${i}`,
        email: `luv-p5-p1-prior-${i}-${Date.now()}@hellotocheers-test.invalid`,
        sales_stage: "outreach_sent",
        status: "active",
        source: "website",
        last_contacted_at: hoursAgo(24),
        created_at: created,
        updated_at: created,
      })
      .select("id,last_name,created_at")
      .single();
    if (error) console.error("P-P1 prior", i, error.message);
    else console.log("P-P1 prior", data?.id, data?.created_at);
  }

  // ── P-A4: 3 upcoming events with overdue payment lines ───────────────────
  for (let i = 1; i <= 3; i++) {
    const eventDate = isoDaysFromNow(3 + i * 2);
    const { data: client, error: cErr } = await sb
      .from("clients")
      .insert({
        venue_id: FANCY,
        first_name: TAG,
        last_name: `PayEvt${i}`,
        email: `luv-p5-a4-${i}-${Date.now()}@hellotocheers-test.invalid`,
        status: "booking",
      })
      .select("id")
      .single();
    if (cErr) {
      console.error("P-A4 client", i, cErr.message);
      continue;
    }
    const { data: event, error: eErr } = await sb
      .from("events")
      .insert({
        venue_id: FANCY,
        client_id: client!.id,
        name: `${TAG} Payment ${i}`,
        event_date: eventDate,
        status: "confirmed",
        event_type: "wedding",
        guest_count: 100,
      })
      .select("id,name,event_date")
      .single();
    if (eErr) {
      console.error("P-A4 event", i, eErr.message);
      continue;
    }
    await sb.from("clients").update({ linked_event_id: event!.id }).eq("id", client!.id);
    const { data: schedule, error: sErr } = await sb
      .from("payment_schedules")
      .insert({
        venue_id: FANCY,
        client_id: client!.id,
        event_id: event!.id,
        title: `${TAG} Schedule ${i}`,
        total_amount: 2000,
      })
      .select("id")
      .single();
    if (sErr) {
      console.error("P-A4 schedule", i, sErr.message);
      continue;
    }
    const { data: line, error: lErr } = await sb
      .from("payment_line_items")
      .insert({
        venue_id: FANCY,
        schedule_id: schedule!.id,
        label: "Deposit",
        amount: 500,
        due_date: isoDaysFromNow(-3),
        status: "overdue",
        sort_order: 0,
      })
      .select("id,status,due_date")
      .single();
    if (lErr) console.error("P-A4 line", i, lErr.message);
    else console.log("P-A4", event, line);
  }

  console.log("done", TAG);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
