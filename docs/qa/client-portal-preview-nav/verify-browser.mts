/**
 * Sandbox — Client Portal Preview nav is Planning → Timeline → Floor Plans → Vendors.
 * Confirms EO/Inventory are absent from preview and still reachable commercially.
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
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
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/client-portal-preview-nav";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

const REQUIRED_TABS = [
  ["planning", "Planning"],
  ["timeline", "Timeline"],
  ["floor-plans", "Floor Plans"],
  ["vendors", "Vendors"],
] as const;

async function cookiesFor() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
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

function servingImage(): string {
  try {
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

async function main() {
  const image = servingImage();
  const shaOk = !EXPECTED_SHA || image.includes(EXPECTED_SHA.slice(0, 12));
  record("serving-sha", shaOk, `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`);
  record("serving-image-digest", image.includes("@sha256:") || image.includes(":"), image);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  const previewUrl = `${APP}/clients/${CLIENT}/portal-preview?event=${EVENT}`;
  await page.goto(previewUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="client-portal-preview"]', { timeout: 45000 });

  const tabLabels = await page.evaluate(`(() => {
    const root = document.querySelector('[data-testid="client-portal-preview"]');
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-testid^="portal-preview-tab-"]')).map((el) => ({
      id: el.getAttribute("data-testid")?.replace("portal-preview-tab-", "") ?? "",
      label: (el.textContent ?? "").trim(),
    }));
  })()`) as Array<{ id: string; label: string }>;

  record(
    "exact-four-tabs",
    tabLabels.length === 4
      && tabLabels.every((t, i) => t.id === REQUIRED_TABS[i][0] && t.label === REQUIRED_TABS[i][1]),
    JSON.stringify(tabLabels),
  );
  record(
    "no-event-order-tab",
    !tabLabels.some((t) => t.id === "event-order" || /event order/i.test(t.label)),
    JSON.stringify(tabLabels),
  );
  record(
    "no-inventory-tab",
    !tabLabels.some((t) => t.id === "inventory" || /inventory/i.test(t.label)),
    JSON.stringify(tabLabels),
  );

  // Default tab is Planning
  const planningVisible = await page.locator('[data-testid="portal-preview-planning"]').isVisible();
  record("default-tab-planning", planningVisible, `planningVisible=${planningVisible}`);

  for (const [id] of REQUIRED_TABS) {
    await page.click(`[data-testid="portal-preview-tab-${id}"]`);
    await page.waitForTimeout(400);
    const section = page.locator(`[data-testid="portal-preview-${id}"]`);
    const visible = await section.isVisible().catch(() => false);
    record(`tab-content-${id}`, visible, `visible=${visible}`);
    await page.screenshot({ path: `${OUT}/shots/preview-${id}-1280.png`, fullPage: true });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(previewUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="client-portal-preview"]', { timeout: 45000 });
  const narrowTabs = await page.evaluate(`(() => {
    const root = document.querySelector('[data-testid="client-portal-preview"]');
    if (!root) return [];
    return Array.from(root.querySelectorAll('[data-testid^="portal-preview-tab-"]')).map((el) =>
      (el.textContent ?? "").trim(),
    );
  })()`) as string[];
  record(
    "narrow-four-tabs",
    narrowTabs.length === 4
      && narrowTabs[0] === "Planning"
      && narrowTabs[1] === "Timeline"
      && narrowTabs[2] === "Floor Plans"
      && narrowTabs[3] === "Vendors",
    JSON.stringify(narrowTabs),
  );
  await page.screenshot({ path: `${OUT}/shots/preview-nav-390.png`, fullPage: true });

  // Commercial workflows still reachable on the event page
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "networkidle", timeout: 90000 });
  const commercialCard = await page.getByTestId("event-inventory-event-order-card").count();
  const openEo = await page.getByTestId("open-event-order-card").count();
  const openInv = await page.getByTestId("open-inventory-card").count();
  record(
    "commercial-eo-inventory-card",
    commercialCard > 0 && openEo > 0 && openInv > 0,
    `card=${commercialCard} eo=${openEo} inv=${openInv}`,
  );
  await page.screenshot({ path: `${OUT}/shots/event-commercial-card-1280.png`, fullPage: false });

  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  const eoSurface =
    (await page.getByTestId("event-commercial-status-strip").count()) > 0
    || (await page.locator("text=/Event Order|Commercial/i").count()) > 0;
  record("commercial-event-order-tab", eoSurface, `eoSurface=${eoSurface}`);

  await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
    waitUntil: "networkidle",
    timeout: 90000,
  });
  const invSurface =
    (await page.locator('[data-testid*="inventory"]').count()) > 0
    || (await page.locator("text=/Inventory/i").count()) > 0;
  record("commercial-inventory-tab", invSurface, `invSurface=${invSurface}`);

  await browser.close();
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, image, checks }, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
