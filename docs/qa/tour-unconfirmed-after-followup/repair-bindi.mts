/**
 * Guarded single-record Sandbox repair: restore Bindi tour status to confirmed.
 * Does not clear/rewrite confirmation metadata, schedule, or send communications.
 * Refuse unless current row matches the forensic hybrid snapshot.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const TOUR_ID = "555060cd-a188-4e2a-ae42-f0da64396e50";
const LEAD_ID = "5d33fcbe-e6c7-4163-9b5e-29db3389efca";
const VENUE_ID = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const EXPECTED_CONFIRMED_AT = "2026-10-16T03:00:12.633152+00:00";
const EXPECTED_SOURCE = "prospect_link";
const EXPECTED_SCHEDULED = "2026-10-18T16:00:00+00:00";

const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "").trim();
const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
if (!url || !key) throw new Error("Missing Sandbox Supabase env");
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error(`Refusing non-Sandbox URL: ${url}`);

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const outDir = resolve("docs/qa/tour-unconfirmed-after-followup");

async function loadTour() {
  const { data, error } = await admin
    .from("tour_appointments")
    .select(
      "id, venue_id, lead_id, scheduled_at, status, confirmed_at, confirmation_source, confirmation_requested_at, is_archived, cancellation_reason, updated_at, created_at, origin, contact_name",
    )
    .eq("id", TOUR_ID)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function hybridScan() {
  const { data, error } = await admin
    .from("tour_appointments")
    .select("id, lead_id, contact_name, status, confirmed_at, confirmation_source, updated_at")
    .eq("status", "scheduled")
    .not("confirmed_at", "is", null);
  if (error) throw error;
  return data ?? [];
}

const before = await loadTour();
if (!before) throw new Error("Tour not found");

const beforePath = resolve(outDir, "bindi-repair-before.json");
writeFileSync(beforePath, JSON.stringify({ observedAt: new Date().toISOString(), tour: before }, null, 2));

const matches =
  before.venue_id === VENUE_ID &&
  before.lead_id === LEAD_ID &&
  before.status === "scheduled" &&
  before.confirmation_source === EXPECTED_SOURCE &&
  before.confirmed_at === EXPECTED_CONFIRMED_AT &&
  before.scheduled_at === EXPECTED_SCHEDULED &&
  before.is_archived === false &&
  (before.cancellation_reason == null || before.cancellation_reason === "");

if (!matches) {
  console.error("STOP: tour no longer matches forensic snapshot; refusing repair.");
  console.error(JSON.stringify(before, null, 2));
  process.exit(2);
}

const { data: updatedRows, error: updErr } = await admin
  .from("tour_appointments")
  .update({ status: "confirmed" })
  .eq("id", TOUR_ID)
  .eq("venue_id", VENUE_ID)
  .eq("lead_id", LEAD_ID)
  .eq("status", "scheduled")
  .eq("confirmation_source", EXPECTED_SOURCE)
  .eq("confirmed_at", EXPECTED_CONFIRMED_AT)
  .eq("scheduled_at", EXPECTED_SCHEDULED)
  .eq("is_archived", false)
  .select("id");

if (updErr) throw updErr;
if (!updatedRows || updatedRows.length !== 1) {
  console.error("STOP: expected exactly 1 row updated, got", updatedRows?.length ?? 0);
  process.exit(3);
}

const after = await loadTour();
const hybrids = await hybridScan();
const afterPath = resolve(outDir, "bindi-repair-after.json");
writeFileSync(
  afterPath,
  JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      tour: after,
      hybridScan: hybrids,
      rowsUpdated: updatedRows.length,
    },
    null,
    2,
  ),
);

const ok =
  after &&
  after.status === "confirmed" &&
  after.confirmed_at === EXPECTED_CONFIRMED_AT &&
  after.confirmation_source === EXPECTED_SOURCE &&
  after.scheduled_at === EXPECTED_SCHEDULED &&
  after.lead_id === LEAD_ID &&
  after.venue_id === VENUE_ID &&
  after.is_archived === false;

console.log(JSON.stringify({ ok, rowsUpdated: updatedRows.length, hybridCount: hybrids.length, after }, null, 2));
if (!ok) process.exit(4);
