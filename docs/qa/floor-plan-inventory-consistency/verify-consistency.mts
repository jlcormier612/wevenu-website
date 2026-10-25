/**
 * Floor-plan object identity + inventory link consistency — Sandbox browser.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  nextPlacementLabel,
  resolveItemTypeLabel,
  suggestedCapacityForPlacement,
} from "@/lib/floor-plans/object-identity";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/floor-plan-inventory-consistency";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaOk = EXPECTED ? image.includes(EXPECTED.slice(0, 8)) : true;
  record("serving-sha", shaOk, `expected=${EXPECTED || "(any)"} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  if (!shaOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  // Unit identity contract (also covered by node:test)
  record(
    "identity-c1-is-placement-not-type",
    resolveItemTypeLabel(
      { objectType: "table_round", label: "C1", displayShape: "cocktail", inventoryItemId: null },
      null,
    ).label === "Cocktail Table",
    "C1 → Cocktail Table via shape",
  );
  record(
    "identity-t1-distinct-from-cocktail",
    resolveItemTypeLabel(
      { objectType: "table_round", label: "T1", displayShape: "round", inventoryItemId: null },
      null,
    ).label === "Round Table",
    "T1 → Round Table",
  );
  record(
    "identity-palette-prefixes-distinct",
    nextPlacementLabel([{ label: "C1" }], "cocktail", "table_round") === "C2"
      && nextPlacementLabel([{ label: "T1" }], "round", "table_round") === "T2",
    "C vs T numbering",
  );
  record(
    "identity-cocktail-capacity-default",
    suggestedCapacityForPlacement("cocktail", "table_round", 30) === 4,
    "cocktail seats=4",
  );

  // Prefer true cocktail starters (display_shape=cocktail), not arbitrary "C1" labels.
  // Order by id for a stable fixture across runs (many Barn-master C1 copies share the same label).
  const { data: cocktailObjs } = await admin
    .from("floor_plan_objects")
    .select("id, floor_plan_id, label, capacity, display_shape, object_type, inventory_item_id, width, height, locked")
    .eq("venue_id", FANCY)
    .eq("display_shape", "cocktail")
    .order("id", { ascending: true })
    .limit(40);
  const { data: roundObjs } = await admin
    .from("floor_plan_objects")
    .select("id, floor_plan_id, label, capacity, display_shape, object_type, inventory_item_id, width, height, locked")
    .eq("venue_id", FANCY)
    .eq("display_shape", "round")
    .ilike("label", "T%")
    .order("id", { ascending: true })
    .limit(40);

  const unlockedCocktails = (cocktailObjs ?? []).filter((o) => o.locked !== true);
  const unlockedRounds = (roundObjs ?? []).filter((o) => o.locked !== true);
  const c1 = unlockedCocktails.find((o) => o.label === "C1")
    ?? unlockedCocktails[0]
    ?? null;
  const t1 = unlockedRounds.find((o) => o.label === "T1")
    ?? unlockedRounds[0]
    ?? null;
  const objs = [...(cocktailObjs ?? []), ...(roundObjs ?? [])];
  record(
    "persisted-c1-shape-and-unlinked",
    Boolean(c1 && c1.display_shape === "cocktail" && c1.inventory_item_id == null),
    JSON.stringify(c1),
  );
  record(
    "persisted-t1-shape-and-unlinked",
    Boolean(t1 && t1.display_shape === "round" && t1.inventory_item_id == null),
    JSON.stringify(t1),
  );

  const planId = c1?.floor_plan_id ?? t1?.floor_plan_id;
  let eventId: string | null = null;
  if (planId) {
    const { data: plan } = await admin
      .from("floor_plans")
      .select("id, event_id, client_id, name")
      .eq("id", planId)
      .maybeSingle();
    eventId = plan?.event_id ?? null;
    record("fixture-plan", Boolean(plan?.id), JSON.stringify(plan));
  } else {
    record("fixture-plan", false, "no C1/T1 objects");
  }

  const { data: invCocktail } = await admin
    .from("inventory_items")
    .select("id, name, shape, quantity_available, available_for_floor_plans")
    .eq("venue_id", FANCY)
    .ilike("name", "Cocktail Table")
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  const { data: invRound60 } = await admin
    .from("inventory_items")
    .select("id, name, shape, width, quantity_available")
    .eq("venue_id", FANCY)
    .ilike("name", '%60%Round%')
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();
  record("inventory-cocktail-exists", Boolean(invCocktail?.id), JSON.stringify(invCocktail));
  record(
    "inventory-distinct-from-round60",
    Boolean(invCocktail?.id && invRound60?.id && invCocktail.id !== invRound60.id),
    JSON.stringify({ cocktail: invCocktail?.id, round60: invRound60?.id }),
  );

  if (!planId || !eventId || !c1) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies(await staffCookies());
    const page = await ctx.newPage();
    await page.goto(`${APP}/events/${eventId}/floor-plans/${planId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(4000);

    // Click the cocktail placement label on canvas
    const placeLabel = String(c1.label ?? "");
    const c1Text = page.locator("svg text", { hasText: new RegExp(`^${placeLabel}$`) }).first();
    record("ui-c1-on-canvas", await c1Text.count() > 0, `label=${placeLabel}`);
    if ((await c1Text.count()) > 0) {
      await c1Text.click({ force: true });
      await page.waitForTimeout(800);
    }

    const props = page.locator('[data-testid="floor-plan-object-properties"]');
    record("ui-properties-open", await props.count() > 0, await props.count().then(String));

    const itemType = page.locator('[data-testid="floor-plan-object-item-type"]');
    const itemTypeText = (await itemType.textContent().catch(() => ""))?.trim() ?? "";
    record(
      "ui-item-type-cocktail-not-c1",
      /cocktail/i.test(itemTypeText) && itemTypeText.toLowerCase() !== placeLabel.toLowerCase(),
      itemTypeText,
    );

    const placement = page.locator('[data-testid="floor-plan-object-placement-label"]');
    const placementVal = await placement.inputValue().catch(() => "");
    record("ui-placement-label-c1", placementVal === placeLabel, placementVal);

    const invStatus = page.locator('[data-testid="floor-plan-object-inventory-status"]');
    const invText = (await invStatus.textContent().catch(() => "")) ?? "";
    record("ui-unlinked-honest", /not linked/i.test(invText), invText);

    await page.screenshot({ path: `${OUT}/shots/c1-properties-1280.png`, fullPage: false });

    // Link to Cocktail Table inventory if available
    const select = page.locator('[data-testid="floor-plan-object-inventory-select"]');
    if ((await select.count()) > 0 && invCocktail?.id) {
      await select.selectOption(invCocktail.id);
      for (let i = 0; i < 10; i++) {
        if ((await select.inputValue()) === invCocktail.id) break;
        await page.waitForTimeout(200);
      }
      // Persist is async server action — poll DB rather than fixed sleep (avoids parallel-load flakes).
      let afterLink: { id: string; inventory_item_id: string | null; label: string | null } | null = null;
      for (let i = 0; i < 20; i++) {
        const { data } = await admin
          .from("floor_plan_objects")
          .select("id, inventory_item_id, label")
          .eq("id", c1.id)
          .single();
        afterLink = data;
        if (afterLink?.inventory_item_id === invCocktail.id) break;
        await page.waitForTimeout(400);
      }
      record(
        "persisted-explicit-link",
        afterLink?.inventory_item_id === invCocktail.id && afterLink?.label === "C1",
        JSON.stringify(afterLink),
      );
      // Unlink to restore starter state (preserve fixtures)
      await select.selectOption("");
      let afterUnlink: { inventory_item_id: string | null; label: string | null } | null = null;
      for (let i = 0; i < 20; i++) {
        const { data } = await admin
          .from("floor_plan_objects")
          .select("inventory_item_id, label")
          .eq("id", c1.id)
          .single();
        afterUnlink = data;
        if (afterUnlink?.inventory_item_id == null) break;
        await page.waitForTimeout(400);
      }
      record(
        "persisted-unlink-restores",
        afterUnlink?.inventory_item_id == null && afterUnlink?.label === "C1",
        JSON.stringify(afterUnlink),
      );
    } else {
      record("persisted-explicit-link", false, "no inventory select or cocktail item");
      record("persisted-unlink-restores", true, "skipped");
    }

    const usageLegend = page.locator('[data-testid="floor-plan-inventory-usage-legend"]');
    if ((await usageLegend.count()) > 0) {
      const legend = (await usageLegend.textContent()) ?? "";
      record("ui-usage-honest-copy", /reporting only|does not reserve/i.test(legend), legend.slice(0, 200));
    } else {
      record("ui-usage-honest-copy", true, "usage panel hidden when no linked usage — ok");
    }

    await page.screenshot({ path: `${OUT}/shots/editor-1280.png`, fullPage: false });
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass, image, digest, expectedSha: EXPECTED || null, planId, eventId, c1, t1, checks, at: new Date().toISOString(),
  }, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({ c1, t1, invCocktail, invRound60, objs }, null, 2));
  console.log(pass ? "\nGREEN floor-plan inventory consistency" : "\nNOT GREEN");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, error: String(err) }, null, 2));
  process.exit(1);
});
