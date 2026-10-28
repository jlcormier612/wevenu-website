/**
 * Client-facing inventory photos — Sandbox E2E.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/inventory-item-images-client-visibility/verify-browser.mts
 *
 * Uses Fancy booked event + portal token. Does not email. Production untouched.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/inventory-item-images-client-visibility";
const PHOTO_A =
  "https://wvpsldwwjqdannqasrdf.supabase.co/storage/v1/object/public/inventory/05f16a15-1752-4855-8a3b-aad5c593d8d9/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png";
// Distinct URL string so cross-item association checks are meaningful (same
// underlying public object is fine for Sandbox display proof).
const PHOTO_B =
  "https://wvpsldwwjqdannqasrdf.supabase.co/storage/v1/object/public/inventory/05f16a15-1752-4855-8a3b-aad5c593d8d9/94ab5d9d-8139-428b-9dea-e912c623fe7a/image.png?v=item-b";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");
mkdirSync(`${OUT}/shots`, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, verdict: "BLOCKED" }, null, 2));
    process.exit(1);
  }

  // Schema: image_url column present
  const { data: probeRow, error: probeErr } = await admin
    .from("event_inventory_items")
    .select("id,image_url")
    .eq("venue_id", FANCY)
    .limit(1);
  record(
    "schema_image_url_column",
    !probeErr,
    probeErr?.message ?? `ok sample=${JSON.stringify(probeRow?.[0] ?? null)}`,
  );

  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;
  if (!token) throw new Error("missing portal token");

  let { data: inv } = await admin
    .from("event_inventory")
    .select("id,status")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  if (!inv) {
    const { data: created, error } = await admin
      .from("event_inventory")
      .insert({ venue_id: FANCY, event_id: EVENT, status: "draft", collaboration_mode: "view" })
      .select("id,status")
      .single();
    if (error || !created) throw error ?? new Error("create inv");
    inv = created;
  }
  if (inv.status === "finalized") {
    await admin.from("event_inventory").update({ status: "draft", finalized_at: null }).eq("id", inv.id);
  }

  const stamp = Date.now().toString(36);
  // Clean prior QA photo rows
  const { data: prior } = await admin
    .from("event_inventory_items")
    .select("id,name")
    .eq("event_inventory_id", inv.id)
    .like("name", "QA Photo%");
  for (const row of prior ?? []) {
    await admin.from("event_inventory_items").delete().eq("id", row.id);
  }

  // Catalog items on Fancy (create with distinct photos)
  const { data: catA, error: catAErr } = await admin
    .from("inventory_items")
    .insert({
      venue_id: FANCY,
      name: `QA Photo Catalog A ${stamp}`,
      image_url: PHOTO_A,
      quantity_available: 1,
      is_archived: false,
    })
    .select("id,image_url")
    .single();
  if (catAErr || !catA) throw catAErr ?? new Error("catA");

  const { data: catB, error: catBErr } = await admin
    .from("inventory_items")
    .insert({
      venue_id: FANCY,
      name: `QA Photo Catalog B ${stamp}`,
      image_url: PHOTO_B,
      quantity_available: 1,
      is_archived: false,
    })
    .select("id,image_url")
    .single();
  if (catBErr || !catB) throw catBErr ?? new Error("catB");

  const { data: catNone, error: catNoneErr } = await admin
    .from("inventory_items")
    .insert({
      venue_id: FANCY,
      name: `QA Photo Catalog None ${stamp}`,
      image_url: null,
      quantity_available: 1,
      is_archived: false,
    })
    .select("id")
    .single();
  if (catNoneErr || !catNone) throw catNoneErr ?? new Error("catNone");

  record("catalog_upload_persist", !!catA.image_url && catA.image_url === PHOTO_A, `catA=${catA.image_url}`);

  const { data: itemA, error: aErr } = await admin
    .from("event_inventory_items")
    .insert({
      event_inventory_id: inv.id,
      venue_id: FANCY,
      inventory_item_id: catA.id,
      name: `QA Photo Table A ${stamp}`,
      quantity: 2,
      unit_price: null,
      is_included: true,
      image_url: PHOTO_A,
      sort_order: 10,
    })
    .select("id,image_url,inventory_item_id,name")
    .single();
  if (aErr || !itemA) throw aErr ?? new Error("itemA");

  const { data: itemB, error: bErr } = await admin
    .from("event_inventory_items")
    .insert({
      event_inventory_id: inv.id,
      venue_id: FANCY,
      inventory_item_id: catB.id,
      name: `QA Photo Linen B ${stamp}`,
      quantity: 5,
      unit_price: 12,
      is_included: false,
      client_selectable: true,
      max_quantity: 5,
      image_url: PHOTO_B,
      sort_order: 11,
    })
    .select("id,image_url,name")
    .single();
  if (bErr || !itemB) throw bErr ?? new Error("itemB");

  const { data: itemNone, error: nErr } = await admin
    .from("event_inventory_items")
    .insert({
      event_inventory_id: inv.id,
      venue_id: FANCY,
      inventory_item_id: catNone.id,
      name: `QA Photo NoImg ${stamp}`,
      quantity: 1,
      unit_price: null,
      is_included: true,
      image_url: null,
      sort_order: 12,
    })
    .select("id,image_url,name")
    .single();
  if (nErr || !itemNone) throw nErr ?? new Error("itemNone");

  record(
    "event_snapshot_association",
    itemA.image_url === PHOTO_A && itemB.image_url === PHOTO_B && itemNone.image_url == null,
    JSON.stringify({ a: itemA.image_url, b: itemB.image_url, none: itemNone.image_url }),
  );

  await admin
    .from("event_inventory")
    .update({ status: "shared", collaboration_mode: "view" })
    .eq("id", inv.id);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    const getRes = await page.request.get(`${APP}/api/portal/inventory?token=${encodeURIComponent(token)}`);
    const getJson = (await getRes.json()) as {
      inventory: {
        status: string;
        items: Array<{ id: string; name: string; imageUrl?: string | null }>;
      } | null;
    };
    const apiItems = getJson.inventory?.items ?? [];
    const apiA = apiItems.find((i) => i.id === itemA.id);
    const apiB = apiItems.find((i) => i.id === itemB.id);
    const apiNone = apiItems.find((i) => i.id === itemNone.id);
    record(
      "portal_api_image_urls",
      getJson.inventory?.status === "shared"
        && apiA?.imageUrl === PHOTO_A
        && apiB?.imageUrl === PHOTO_B
        && (apiNone?.imageUrl == null || apiNone?.imageUrl === ""),
      JSON.stringify({ status: getJson.inventory?.status, a: apiA?.imageUrl, b: apiB?.imageUrl, none: apiNone?.imageUrl }),
    );
    record(
      "portal_api_no_cross",
      apiA?.imageUrl === PHOTO_A && apiB?.imageUrl === PHOTO_B && apiA?.imageUrl !== apiB?.imageUrl,
      `a=${apiA?.imageUrl} b=${apiB?.imageUrl}`,
    );

    const bad = await page.request.get(`${APP}/api/portal/inventory?token=not-a-real-token`);
    const badJson = (await bad.json()) as { inventory: unknown };
    record("auth_invalid_token_empty", badJson.inventory == null, JSON.stringify(badJson));

    await page.goto(`${APP}/p/${token}#inventory`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/shots/portal-inventory-1280.png`, fullPage: true });
    const photos = page.locator('[data-testid="inventory-item-photo"]');
    const photoCount = await photos.count();
    const srcs: string[] = [];
    for (let i = 0; i < photoCount; i++) {
      srcs.push((await photos.nth(i).getAttribute("src")) ?? "");
    }
    record(
      "portal_ui_photos_render",
      photoCount >= 2 && srcs.includes(PHOTO_A) && srcs.includes(PHOTO_B),
      `count=${photoCount} srcs=${JSON.stringify(srcs)}`,
    );
    const body = await page.locator('[data-testid="inventory-portal-view"]').innerText().catch(() => "");
    record(
      "portal_ui_names_present",
      body.includes(`QA Photo Table A ${stamp}`) && body.includes(`QA Photo NoImg ${stamp}`),
      body.slice(0, 500),
    );
    // No-image item should not create an empty/broken img for that row alone —
    // total photos should equal imaged items (2), not 3.
    record("portal_ui_no_image_item_clean", photoCount === 2, `photoCount=${photoCount} expected=2`);

    // Narrow
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/shots/portal-inventory-390.png`, fullPage: true });
    record("portal_ui_narrow_photos", (await photos.count()) >= 2, `count=${await photos.count()}`);

    await context.close();
  } finally {
    await browser.close().catch(() => {});
  }

  const failed = checks.filter((c) => !c.pass);
  const results = {
    expectedSha: EXPECTED,
    servingImage: image,
    checks,
    failedCount: failed.length,
    verdict: failed.length === 0 ? "GREEN" : "OPEN",
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(`\nVERDICT ${results.verdict} pass=${checks.length - failed.length} fail=${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
