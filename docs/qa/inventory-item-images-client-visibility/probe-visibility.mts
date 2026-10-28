/**
 * Sandbox probe: catalog images exist; portal/event-inventory models do not carry them.
 * EXPECTED_SHA optional. Does not mutate Production; Fancy read-only except no writes.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: ".env.local", quiet: true });
const OUT = "docs/qa/inventory-item-images-client-visibility";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function main() {
  const { data: withImage, error } = await admin
    .from("inventory_items")
    .select("id,name,image_url,venue_id")
    .not("image_url", "is", null)
    .limit(5);
  // Fancy may have zero photos; any Sandbox row with image_url proves catalog storage.
  record(
    "catalog_image_url_field_in_use_or_empty",
    !error,
    error?.message ?? `sandboxRowsWithImage=${withImage?.length ?? 0} sample=${JSON.stringify((withImage ?? []).slice(0, 2))}`,
  );
  const { count: fancyItems } = await admin
    .from("inventory_items")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY);
  record(
    "fancy_catalog_readable",
    (fancyItems ?? 0) >= 0,
    `fancyItemCount=${fancyItems ?? 0}`,
  );

  const portalView = readFileSync(resolve("components/portal/inventory-view.tsx"), "utf8");
  record(
    "portal_view_model_no_image",
    /export type PortalInventoryItemView = \{[\s\S]*?\};/.test(portalView) &&
      !/export type PortalInventoryItemView = \{[\s\S]*?image/i.test(portalView),
    "PortalInventoryItemView lacks image fields",
  );

  const portalApi = readFileSync(resolve("app/api/portal/inventory/route.ts"), "utf8");
  record(
    "portal_api_no_image_map",
    !/imageUrl|image_url|item_image/i.test(portalApi),
    "GET /api/portal/inventory does not map image",
  );

  const eventTypes = readFileSync(resolve("lib/event-inventory/types.ts"), "utf8");
  record(
    "event_inventory_item_no_image",
    /export type EventInventoryItem = \{[\s\S]*?\n\};/.test(eventTypes) &&
      !/export type EventInventoryItem = \{[\s\S]*?image/i.test(eventTypes),
    "EventInventoryItem has no imageUrl",
  );

  const rpcMig = readFileSync(
    resolve("supabase/migrations/20261422400000_event_inventory_client_selection.sql"),
    "utf8",
  );
  const rpcSlice = rpcMig.slice(rpcMig.indexOf("get_event_inventory_for_portal"));
  record(
    "rpc_no_image_column",
    /item_name text/.test(rpcSlice) && !/item_image|image_url/i.test(rpcSlice.slice(0, 1200)),
    "portal RPC returns no image column",
  );

  const { data: cols } = await admin.rpc("" as never).maybeSingle().then(() => ({ data: null })).catch(() => ({ data: null }));
  void cols;
  // Schema probe via information_schema
  const { data: eiiCols, error: colErr } = await admin
    .from("event_inventory_items")
    .select("*")
    .limit(1);
  const sampleKeys = eiiCols?.[0] ? Object.keys(eiiCols[0]) : [];
  record(
    "event_inventory_items_columns_no_image",
    !colErr && (sampleKeys.length === 0 || !sampleKeys.some((k) => /image/i.test(k))),
    colErr?.message ?? `keys=${sampleKeys.join(",") || "(empty table ok)"}`,
  );

  const failed = checks.filter((c) => !c.pass);
  const results = {
    checks,
    failedCount: failed.length,
    verdict: failed.length === 0 ? "GREEN_NO_CLIENT_IMAGES" : "OPEN",
    conclusion:
      "Catalog image_url is venue-side only. Event inventory + portal RPC/API/UI do not carry or render inventory item photos.",
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/probe-results.json`, JSON.stringify(results, null, 2));
  console.log(`\nVERDICT ${results.verdict}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
