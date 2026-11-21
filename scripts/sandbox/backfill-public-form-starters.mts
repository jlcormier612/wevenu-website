/**
 * Idempotent Sandbox backfill of Public Forms starters.
 *
 * Dry-run by default. Requires explicit venue scope.
 *
 *   npx tsx scripts/sandbox/backfill-public-form-starters.mts --venue=<uuid>
 *   npx tsx scripts/sandbox/backfill-public-form-starters.mts --venue=<uuid> --apply
 *
 * Broad writes are intentionally unsupported here. Use per-venue --apply only.
 * Never publishes. Never overwrites existing starter_key forms.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { seedPublicFormStarters } from "@/lib/public-forms/starters";
import { assertWritableQaVenue, isProtectedSandboxVenueId } from "@/lib/qa/protected-venues";

config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APPLY = process.argv.includes("--apply");
const venueArg = process.argv.find((a) => a.startsWith("--venue="))?.slice("--venue=".length)?.trim();
const OUT = join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan");

if (!venueArg) {
  console.error(
    "REFUSED: pass --venue=<uuid>. Dry-run is default; add --apply to write.\n" +
      "Broad --all-missing writes are not supported.",
  );
  process.exit(1);
}

if (process.argv.includes("--all-missing")) {
  console.error("REFUSED: --all-missing removed. Scope writes with --venue=<uuid> --apply.");
  process.exit(1);
}

async function main() {
  const { data: venue, error } = await admin
    .from("venues")
    .select("id, name")
    .eq("id", venueArg)
    .maybeSingle();
  if (error || !venue) throw error ?? new Error("venue not found");

  // Curated venues may receive intentional founder backfill with --apply, but
  // never silently from automation without an explicit venue id (already required).
  if (!isProtectedSandboxVenueId(venue.id)) {
    assertWritableQaVenue({
      venueId: venue.id,
      venueName: venue.name,
      purpose: "public-forms-backfill",
    });
  }

  const before = await admin
    .from("public_forms")
    .select("id, internal_name, status, starter_key")
    .eq("venue_id", venue.id);

  const report: Record<string, unknown> = {
    mode: APPLY ? "apply" : "dry-run",
    venueId: venue.id,
    name: venue.name,
    beforeCount: before.data?.length ?? 0,
    before: before.data,
  };

  if (!APPLY) {
    report.wouldCall = "seedPublicFormStarters";
    writeFileSync(join(OUT, "PUBLIC-FORMS-BACKFILL-DRY-RUN.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const result = await seedPublicFormStarters(venue.id, admin as never);
  const after = await admin
    .from("public_forms")
    .select("id, internal_name, public_title, status, starter_key, created_at")
    .eq("venue_id", venue.id)
    .order("created_at", { ascending: true });

  report.result = result;
  report.afterCount = after.data?.length ?? 0;
  report.forms = after.data;
  writeFileSync(join(OUT, "PUBLIC-FORMS-BACKFILL.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
