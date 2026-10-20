import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { readFileSync } from "fs";

config({ path: ".env.local", quiet: true });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const results = JSON.parse(readFileSync("docs/qa/mc-specialized-cert/runtime-results.json", "utf8"));
const venueId = results.venueId as string;
console.log("venue", venueId);

async function dump(table: string, cols = "*") {
  const { data, error, count } = await admin.from(table).select(cols, { count: "exact" }).eq("venue_id", venueId).limit(30);
  console.log(`\n=== ${table} count=${count} err=${error?.message ?? "none"}`);
  console.log(JSON.stringify(data, null, 2)?.slice(0, 3500));
}

await dump("couple_guests", "id,first_name,last_name,email,client_id,notes");
await dump("documents", "id,name,file_name,category,entity_type,entity_id,tags,storage_path");
await dump("migration_sessions", "id,status,source_key,created_at,summary");
const { data: sessions } = await admin.from("migration_sessions").select("id").eq("venue_id", venueId);
const ids = (sessions ?? []).map((s) => s.id);
if (ids.length) {
  const { data: recs, error } = await admin.from("migration_records")
    .select("id,session_id,target_entity_type,status,validation_errors,normalized_payload,committed_entity_id")
    .in("session_id", ids)
    .in("target_entity_type", ["guest_list", "document", "floor_plan"]);
  console.log("\n=== migration_records guest/doc/floor err=", error?.message);
  console.log(JSON.stringify(recs, null, 2)?.slice(0, 8000));
}
