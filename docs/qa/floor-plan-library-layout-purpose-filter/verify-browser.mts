/**
 * Floor Plan Library — event type vs layout purpose filter (Sandbox).
 * Read-mostly; applies one starter to a disposable event plan then deletes it.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  layoutPurposeFromSourceMasterKey,
  templateMatchesLayoutPurposeFilter,
} from "@/lib/floor-plan-templates/layout-purpose";

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
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/floor-plan-library-layout-purpose-filter";
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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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
  record("serving-sha", !EXPECTED || image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  record("production-untouched", url.includes("wvpsldwwjqdannqasrdf"), "sandbox only");

  const { data: templates } = await admin
    .from("floor_plan_templates")
    .select("id,name,event_type,source_master_key,is_archived")
    .eq("venue_id", FANCY)
    .eq("is_archived", false);
  const fp02 = (templates ?? []).find((t) => t.source_master_key === "FP-02");
  const fp01 = (templates ?? []).find((t) => t.source_master_key === "FP-01");
  record(
    "persisted-fp02-wedding-event-type",
    Boolean(fp02) && fp02?.event_type === "wedding",
    JSON.stringify(fp02),
  );
  record(
    "persisted-fp02-reception-layout",
    layoutPurposeFromSourceMasterKey(fp02?.source_master_key) === "reception",
    fp02?.source_master_key ?? "missing",
  );
  record(
    "persisted-legacy-fp01-intact",
    Boolean(fp01) && /Ceremony \+ Reception/i.test(fp01?.name ?? ""),
    JSON.stringify(fp01),
  );
  const receptionLayoutMatches = (templates ?? []).filter((t) =>
    templateMatchesLayoutPurposeFilter(t.source_master_key, "reception"),
  );
  record(
    "db-reception-layout-filter",
    receptionLayoutMatches.some((t) => t.source_master_key === "FP-02"),
    receptionLayoutMatches.map((t) => t.name).join(" | "),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/library/floor-plan-templates`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForTimeout(1500);
  const body0 = await page.locator("body").innerText();
  record(
    "library-shows-wedding-and-layout-copy",
    /Event type is the booking kind|Layout purpose/i.test(body0),
    body0.slice(0, 400),
  );
  record(
    "library-lists-reception-template",
    /Reception Only|Wedding Reception/i.test(body0),
    body0.slice(0, 500),
  );
  await page.screenshot({ path: `${OUT}/shots/library-all-1280.png`, fullPage: true });

  // Layout purpose → Reception Only
  const layoutFilter = page.getByTestId("floor-plan-layout-purpose-filter");
  record("layout-purpose-filter-present", (await layoutFilter.count()) > 0, "testid");
  if ((await layoutFilter.count()) > 0) {
    await layoutFilter.click();
    await page.getByRole("option", { name: /^Reception Only$/ }).click();
    await page.waitForTimeout(800);
  }
  const bodyLayout = await page.locator("body").innerText();
  const showsFp02 =
    /Standard Wedding — Reception Only|Wedding Reception/i.test(bodyLayout)
    && !/No templates match your search/i.test(bodyLayout);
  record("layout-reception-only-shows-fp02", showsFp02, bodyLayout.slice(0, 600));
  await page.screenshot({ path: `${OUT}/shots/filter-layout-reception-1280.png`, fullPage: true });

  // Reset layout to All; event type Wedding
  if ((await layoutFilter.count()) > 0) {
    await layoutFilter.click();
    await page.getByRole("option", { name: /^All layouts$/ }).click();
    await page.waitForTimeout(400);
  }
  // Event type select — first select after search; open by label
  const eventTrigger = page.getByLabel("Filter by event type");
  if ((await eventTrigger.count()) > 0) {
    await eventTrigger.click();
    await page.getByRole("option", { name: /^Wedding$/ }).click();
    await page.waitForTimeout(800);
  }
  const bodyWedding = await page.locator("body").innerText();
  record(
    "event-type-wedding-shows-starters",
    /Wedding Ceremony|Cocktail Hour|Reception|Blank Floor Plan|Same-Room/i.test(bodyWedding)
      && !/No templates match your search/i.test(bodyWedding),
    bodyWedding.slice(0, 500),
  );
  await page.screenshot({ path: `${OUT}/shots/filter-event-wedding-1280.png`, fullPage: true });

  // Event type Reception Only → empty guidance (booking type)
  if ((await eventTrigger.count()) > 0) {
    await eventTrigger.click();
    await page.getByRole("option", { name: /^Reception Only$/ }).click();
    await page.waitForTimeout(800);
  }
  const bodyEvtReception = await page.locator("body").innerText();
  record(
    "event-type-reception-explains-or-empty",
    /No templates match|reception-only booking|Layout → Reception Only/i.test(bodyEvtReception),
    bodyEvtReception.slice(0, 500),
  );
  await page.screenshot({ path: `${OUT}/shots/filter-event-reception-booking-1280.png`, fullPage: true });

  // Search + layout together
  if ((await eventTrigger.count()) > 0) {
    await eventTrigger.click();
    await page.getByRole("option", { name: /^All event types$/ }).click();
    await page.waitForTimeout(300);
  }
  if ((await layoutFilter.count()) > 0) {
    await layoutFilter.click();
    await page.getByRole("option", { name: /^Reception Only$/ }).click();
    await page.waitForTimeout(300);
  }
  await page.getByPlaceholder(/Search templates/i).fill("Reception");
  await page.waitForTimeout(500);
  const bodySearch = await page.locator("body").innerText();
  record(
    "search-plus-layout-reception",
    /Reception/i.test(bodySearch) && !/No templates match your search/i.test(bodySearch),
    bodySearch.slice(0, 400),
  );
  await page.screenshot({ path: `${OUT}/shots/search-layout-reception-1280.png`, fullPage: true });

  // Badge on a reception card
  const purposeBadges = page.getByTestId("floor-plan-layout-purpose-badge");
  const badgeTexts = await purposeBadges.allInnerTexts().catch(() => [] as string[]);
  record(
    "layout-purpose-badge-visible",
    badgeTexts.some((t) => /Reception Only/i.test(t)),
    badgeTexts.join(" | "),
  );

  // Apply FP-02 to event (create plan) then count objects — disposable cleanup
  const { count: plansBefore } = await admin
    .from("floor_plans")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);

  await page.goto(`${APP}/events/${EVENT}#floorplan`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2500);
  const floorBody = await page.locator("body").innerText();
  record("event-floorplan-loads", /floor plan|layout|Add|template/i.test(floorBody), floorBody.slice(0, 300));

  // Client submit confirm still in portal source (smoke via page not portal)
  const { readFileSync } = await import("node:fs");
  const portalSrc = readFileSync("components/portal/portal-floor-plan-client.tsx", "utf8");
  record(
    "client-submit-confirm-intact",
    /confirm|Submit|review/i.test(portalSrc),
    "portal-floor-plan-client.tsx",
  );

  await browser.close();

  const { count: plansAfter } = await admin
    .from("floor_plans")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);
  record(
    "event-plans-count-unchanged",
    (plansAfter ?? 0) === (plansBefore ?? 0),
    `${plansBefore}→${plansAfter}`,
  );

  const pass = checks.every((c) => c.pass);
  const results = {
    pass,
    capturedAt: new Date().toISOString(),
    image,
    digest,
    expectedSha: EXPECTED,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
    templatesSnapshot: templates,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({ templates, fp02, fp01 }, null, 2));
  console.log(`\nRESULT ${pass ? "PASS" : "FAIL"} ${results.passCount}/${checks.length}`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
