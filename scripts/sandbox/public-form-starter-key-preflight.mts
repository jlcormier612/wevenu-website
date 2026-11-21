/**
 * READ-ONLY preflight before applying 20270207120000_public_form_starter_key.sql.
 * Reports collisions / unknown-provenance name matches. Never writes.
 *
 * Works before and after the migration (tolerates missing starter_key column).
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

type FormRow = {
  id: string;
  venue_id: string;
  internal_name: string;
  status: string;
  starter_key?: string | null;
  created_at: string;
};

async function loadForms(): Promise<{ rows: FormRow[]; starterKeyPresent: boolean }> {
  const withKey = await admin
    .from("public_forms")
    .select("id, venue_id, internal_name, status, starter_key, created_at")
    .in("internal_name", names);
  if (!withKey.error) {
    return { rows: (withKey.data ?? []) as FormRow[], starterKeyPresent: true };
  }
  if (!/starter_key/i.test(withKey.error.message)) throw withKey.error;

  const without = await admin
    .from("public_forms")
    .select("id, venue_id, internal_name, status, created_at")
    .in("internal_name", names);
  if (without.error) throw without.error;
  return {
    rows: ((without.data ?? []) as FormRow[]).map((r) => ({ ...r, starter_key: null })),
    starterKeyPresent: false,
  };
}

async function main() {
  const { rows, starterKeyPresent } = await loadForms();

  const willowIds = new Set(Object.values(WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS.forms));
  const verifiedWillow = rows.filter((r) => willowIds.has(r.id));
  const missingWillowIds = Object.entries(WILLOW_GROVE_PUBLIC_FORM_STARTER_IDS.forms)
    .filter(([, id]) => !rows.some((r) => r.id === id))
    .map(([key, id]) => ({ key, id }));

  const unknownNameMatches = rows.filter(
    (r) => !willowIds.has(r.id) && (r.starter_key == null || r.starter_key === ""),
  );

  const alreadyKeyed = rows.filter((r) => r.starter_key);
  const keyed = rows.filter((r) => r.starter_key);
  const dupMap = new Map<string, number>();
  for (const r of keyed) {
    const k = `${r.venue_id}::${r.starter_key}`;
    dupMap.set(k, (dupMap.get(k) ?? 0) + 1);
  }
  const duplicateStarterKeys = [...dupMap.entries()]
    .filter(([, n]) => n > 1)
    .map(([k, n]) => ({ key: k, count: n }));

  // Same venue with multiple forms sharing a starter display name (collision candidates)
  const nameDupMap = new Map<string, FormRow[]>();
  for (const r of rows) {
    const k = `${r.venue_id}::${r.internal_name}`;
    const list = nameDupMap.get(k) ?? [];
    list.push(r);
    nameDupMap.set(k, list);
  }
  const sameVenueNameDuplicates = [...nameDupMap.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([k, list]) => ({ key: k, count: list.length, ids: list.map((r) => r.id) }));

  const report = {
    mode: "read-only",
    measuredAt: new Date().toISOString(),
    starterKeyColumnPresent: starterKeyPresent,
    verifiedWillowExpected: 4,
    verifiedWillowFound: verifiedWillow.length,
    verifiedWillow,
    missingWillowIds,
    unknownNameMatchesCount: unknownNameMatches.length,
    unknownNameMatches: unknownNameMatches.slice(0, 80),
    alreadyKeyedCount: alreadyKeyed.length,
    duplicateStarterKeys,
    sameVenueNameDuplicates,
    collisionPolicy:
      "Unknown same-name forms are NOT claimed as platform starters. Migration only keys verified Willow IDs. App seed installs under starter_key without overwriting customer forms.",
    safeToApplyMigration:
      verifiedWillow.length === 4 &&
      missingWillowIds.length === 0 &&
      duplicateStarterKeys.length === 0,
  };

  writeFileSync(join(OUT, "PUBLIC-FORMS-STARTER-KEY-PREFLIGHT.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (verifiedWillow.length !== 4 || missingWillowIds.length) {
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
