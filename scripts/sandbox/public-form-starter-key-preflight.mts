/**
 * READ-ONLY preflight before applying 20261420000000_public_form_starter_key.sql.
 * Reports collisions / unknown-provenance name matches. Never writes.
 *
 *   npx tsx scripts/sandbox/public-form-starter-key-preflight.mts
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  PUBLIC_FORM_STARTER_MASTERS,
  WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS,
} from "@/lib/public-forms/starters";

config({ path: ".env.local", quiet: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const names = PUBLIC_FORM_STARTER_MASTERS.map((m) => m.internalName);
const OUT = join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan");

async function main() {
  const { data: rows, error } = await admin
    .from("public_forms")
    .select("id, venue_id, internal_name, status, starter_key, created_at")
    .in("internal_name", names);
  if (error) throw error;

  const willowIds = new Set(Object.values(WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS.forms));
  const verifiedWillow = (rows ?? []).filter((r) => willowIds.has(r.id));
  const unknownNameMatches = (rows ?? []).filter(
    (r) => !willowIds.has(r.id) && (r.starter_key == null || r.starter_key === ""),
  );
  const alreadyKeyed = (rows ?? []).filter((r) => r.starter_key);

  // Duplicate starter_key candidates per venue (should be empty after migration)
  const keyed = (rows ?? []).filter((r) => r.starter_key);
  const dupMap = new Map<string, number>();
  for (const r of keyed) {
    const k = `${r.venue_id}::${r.starter_key}`;
    dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
  }
  const duplicateStarterKeys = [...dupMap.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => ({ key: k, count: n }));

  const report = {
    mode: "read-only",
    measuredAt: new Date().toISOString(),
    verifiedWillowExpected: 4,
    verifiedWillowFound: verifiedWillow.length,
    verifiedWillow,
    unknownNameMatchesCount: unknownNameMatches.length,
    unknownNameMatches: unknownNameMatches.slice(0, 50),
    alreadyKeyedCount: alreadyKeyed.length,
    duplicateStarterKeys,
    collisionPolicy:
      "Unknown same-name forms are NOT claimed as platform starters. Migration only keys verified Willow IDs. App seed installs under starter_key without overwriting customer forms.",
    safeToApplyMigration:
      verifiedWillow.length === 4 &&
      duplicateStarterKeys.length === 0 &&
      unknownNameMatches.every((r) => r.id), // informational; unknown matches are OK
  };

  writeFileSync(join(OUT, "PUBLIC-FORMS-STARTER-KEY-PREFLIGHT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (verifiedWillow.length !== 4) {
    console.error("STOP: expected 4 verified Willow drafts; found", verifiedWillow.length);
    process.exit(2);
  }
  if (duplicateStarterKeys.length) {
    console.error("STOP: duplicate starter_key collisions present");
    process.exit(2);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
