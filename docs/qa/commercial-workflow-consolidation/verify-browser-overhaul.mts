/**
 * Actual commercial overhaul — Setup exclusion + EO agreement smoke.
 * Read-mostly except optional EO accept on fixture when shared & not agreed.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/commercial-workflow-consolidation";
mkdirSync(`${OUT}/shots-overhaul`, { recursive: true });

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
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
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
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const { data: eoBefore } = await admin
    .from("event_orders")
    .select("id, status, shared_at, client_agreed_at, client_agreed_revision, revision")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  record(
    "DB: agreement columns readable",
    eoBefore != null && "client_agreed_at" in (eoBefore as object),
    JSON.stringify(eoBefore),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // Setup Profiles — no Inventory/EO starting templates
  await page.goto(`${APP}/settings/leads/setup-profiles`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const profilesBody = await page.locator("body").innerText();
  record(
    "Setup Profiles: no Inventory/EO starting template UI",
    !/Starting inventory template/i.test(profilesBody)
      && !/Starting Event Order template/i.test(profilesBody),
    profilesBody.slice(0, 280),
  );
  await page.screenshot({ path: `${OUT}/shots-overhaul/setup-profiles-1280.png`, fullPage: true });

  // Event Setup panel — planning only
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1600);
  const setup = page.getByTestId("event-setup-panel");
  const setupText = (await setup.count()) > 0 ? await setup.innerText() : await page.locator("body").innerText();
  record(
    "Event Setup: no Open Inventory / Open Event Order",
    !/Open Inventory/i.test(setupText) && !/Open Event Order/i.test(setupText),
    setupText.slice(0, 320),
  );
  record(
    "Event Setup: commercial copy present",
    /commercial/i.test(setupText) || /Inventory and Event Order/i.test(setupText),
    "copy",
  );
  await page.screenshot({ path: `${OUT}/shots-overhaul/event-setup-1280.png`, fullPage: true });

  // Commercial strip still on EO tab
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1400);
  record(
    "Commercial strip still on Event Order tab",
    (await page.getByTestId("event-commercial-status-strip").count()) > 0,
    "strip",
  );

  // Planning / vendors / floor still reachable (Setup support)
  await page.goto(`${APP}/events/${EVENT}?tab=timeline`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  record("Timeline tab intact", /Timeline|timeline/i.test(await page.locator("body").innerText()), "timeline");

  // Portal EO accept surface
  const { data: portal } = await admin
    .from("client_portal_sessions")
    .select("access_token")
    .eq("client_id", CLIENT)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const token = portal?.access_token as string | undefined;
  if (!token) throw new Error("no portal token");

  const portalPage = await context.newPage();
  await portalPage.goto(`${APP}/p/${token}#event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await portalPage.waitForTimeout(1600);
  const portalText = await portalPage.locator("body").innerText();
  const acceptCount = await portalPage.getByTestId("event-order-accept-panel").count();
  const agreedBadge = await portalPage.getByTestId("event-order-agreed-badge").count();
  record(
    "Portal Event Order section loads",
    /Event Order|What you're receiving|Not shared/i.test(portalText),
    portalText.slice(0, 220),
  );
  record(
    "Portal shows accept panel or agreed badge when EO shared",
    !eoBefore?.shared_at || acceptCount > 0 || agreedBadge > 0 || /Agreed|Accept Event Order/i.test(portalText),
    `accept=${acceptCount} agreedBadge=${agreedBadge} shared=${eoBefore?.shared_at}`,
  );

  if (acceptCount > 0 && !eoBefore?.client_agreed_at) {
    await portalPage.getByTestId("event-order-accept-name").fill("Overhaul Accept QA");
    await portalPage.getByTestId("event-order-accept-submit").click();
    await portalPage.waitForTimeout(2000);
    const { data: eoAfter } = await admin
      .from("event_orders")
      .select("client_agreed_at, client_agreed_name, client_agreed_revision")
      .eq("id", eoBefore!.id)
      .maybeSingle();
    record(
      "Client accept persists agreement",
      Boolean(eoAfter?.client_agreed_at),
      JSON.stringify(eoAfter),
    );
  } else {
    record(
      "Client accept persists agreement",
      true,
      "skipped — already agreed or accept panel absent",
    );
  }
  await portalPage.screenshot({ path: `${OUT}/shots-overhaul/portal-eo-1280.png`, fullPage: true });

  // Inventory remains outside Setup checklist language on portal home
  await portalPage.goto(`${APP}/p/${token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await portalPage.waitForTimeout(1200);
  record(
    "Portal home still has Inventory entry (commercial, not setup checklist)",
    (await portalPage.getByTestId("portal-home-inventory-entry").count()) > 0
      || /Inventory/i.test(await portalPage.locator("body").innerText()),
    "home",
  );

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results-overhaul.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        passed: failed.length === 0,
        checks,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  if (failed.length) {
    console.error(`FAILED ${failed.length}/${checks.length}`);
    process.exit(1);
  }
  console.log(`ALL PASS ${checks.length}/${checks.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
