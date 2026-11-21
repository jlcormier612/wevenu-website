/**
 * Idempotent Sandbox backfill of Public Forms starters.
 * Default: The Willow Grove only. Pass --all-missing to fill any venue with 0 forms.
 * Never publishes. Never overwrites existing forms matched by name/starter_key.
 *
 *   npx tsx scripts/sandbox/backfill-public-form-starters.mts
 *   npx tsx scripts/sandbox/backfill-public-form-starters.mts --all-missing
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedPublicFormStarters } from "@/lib/public-forms/starters";
import { PROTECTED_SANDBOX_VENUE_IDS } from "@/lib/qa/protected-venues";

config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ALL = process.argv.includes("--all-missing");
const WILLOW = PROTECTED_SANDBOX_VENUE_IDS.WILLOW_GROVE;
const OUT = join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan");

async function backfillVenue(venueId: string, name: string) {
  const before = await admin
    .from("public_forms")
    .select("id, internal_name, status, starter_key")
    .eq("venue_id", venueId);
  const result = await seedPublicFormStarters(venueId, admin as never);
  const after = await admin
    .from("public_forms")
    .select("id, internal_name, public_title, status, starter_key, created_at")
    .eq("venue_id", venueId)
    .order("created_at", { ascending: true });
  return {
    venueId,
    name,
    beforeCount: before.data?.length ?? 0,
    afterCount: after.data?.length ?? 0,
    result,
    forms: after.data,
  };
}

const report: unknown[] = [];

if (ALL) {
  const { data: venues } = await admin.from("venues").select("id, name");
  for (const v of venues || []) {
    const { count } = await admin
      .from("public_forms")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", v.id);
    if ((count ?? 0) > 0) continue;
    report.push(await backfillVenue(v.id, v.name));
  }
} else {
  const { data: v } = await admin.from("venues").select("id, name").eq("id", WILLOW).maybeSingle();
  if (!v) throw new Error("Willow not found");
  report.push(await backfillVenue(v.id, v.name));
}

writeFileSync(join(OUT, "PUBLIC-FORMS-BACKFILL.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
