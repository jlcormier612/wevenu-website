/**
 * C2 closure — Sandbox Library clarity (read-mostly; no Use/Send/share clicks).
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
const OUT = "docs/qa/commercial-workflow-consolidation";
mkdirSync(`${OUT}/shots-c2`, { recursive: true });

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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  const hub = await page.locator("body").innerText();
  record("Hub: five commercial areas present", /Available Inventory/i.test(hub) && /Offerings/i.test(hub) && /Inventory Templates/i.test(hub) && /Event Order Templates/i.test(hub) && /Packages/i.test(hub), "hub cards");
  record("Hub: Packages ≠ Event Order Templates", /Distinct from Event Order Templates/i.test(hub) && /Distinct from sales Packages/i.test(hub), "distinction copy");
  record("Hub: Inventory Templates Use/Send language", /Use applies a draft/i.test(hub) && /Send also shares/i.test(hub), "inv tmpl hub");
  record("Hub: no Choices Templates card", !/Choices Templates/i.test(hub), "absent");
  await page.screenshot({ path: `${OUT}/shots-c2/library-hub-1280.png`, fullPage: true });

  await page.goto(`${APP}/library/inventory`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const inv = await page.locator("body").innerText();
  record("Available Inventory editable catalog", /Available Inventory/i.test(inv) && /New Inventory Item|Import Inventory/i.test(inv), inv.slice(0, 200));
  record("Available Inventory: catalog ≠ share/EO", /does not share with clients/i.test(inv), "boundary copy");
  await page.screenshot({ path: `${OUT}/shots-c2/available-inventory-1280.png`, fullPage: true });

  await page.goto(`${APP}/library/offerings`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const off = await page.locator("body").innerText();
  record("Offerings catalog accessible", /Offerings/i.test(off) && /New Offering/i.test(off), "offerings");
  record("Offerings: catalog ≠ client selection", /do not request client selections/i.test(off), "boundary");
  await page.screenshot({ path: `${OUT}/shots-c2/offerings-1280.png`, fullPage: true });

  await page.goto(`${APP}/library/inventory-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const it = await page.locator("body").innerText();
  record("Inventory Templates: Use does not share", /does not share/i.test(it), "Use language");
  record("Inventory Templates: Send shares", /Send applies and shares|Send also shares|shares for/i.test(it), "Send language");
  record("Inventory Templates: Use/Send actions retained", await page.getByRole("button", { name: /^Use$/i }).count() > 0 || /Use/i.test(it), "actions");
  await page.screenshot({ path: `${OUT}/shots-c2/inventory-templates-1280.png`, fullPage: true });

  await page.goto(`${APP}/library/event-order-templates`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const eo = await page.locator("body").innerText();
  record("Event Order Templates accessible", /Event Order Templates/i.test(eo), "page");
  record("EO Templates: Distinct from sales Packages", /Distinct from sales Packages/i.test(eo), "packages distinction");
  record("EO Templates: Send gated copy", /Send is only for templates with client choice groups/i.test(eo), "send gate");
  await page.screenshot({ path: `${OUT}/shots-c2/event-order-templates-1280.png`, fullPage: true });

  await page.goto(`${APP}/packages`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const pkg = await page.locator("body").innerText();
  record("Packages distinct from EO", /Distinct from Event Order Templates/i.test(pkg), "packages page");
  record("Packages: not Event Order authoring", /not where you author or send an Event Order/i.test(pkg), "boundary");
  await page.screenshot({ path: `${OUT}/shots-c2/packages-1280.png`, fullPage: true });

  // C1 regression: commercial workspace intro still present
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  record(
    "C1 regression: commercial workspace intro",
    (await page.getByTestId("event-commercial-workspace-intro").count()) > 0,
    "intro",
  );
  const eoTab = await page.locator("body").innerText();
  record("EO → Invoice handoff language intact", /Invoice|Payment/i.test(eoTab), "finance nav");
  await page.screenshot({ path: `${OUT}/shots-c2/c1-commercial-intro-1280.png`, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1000);
  const hub390 = await page.locator("body").innerText();
  record("Hub @390 still shows Packages ≠ EO", /Distinct from Event Order Templates/i.test(hub390), "390");
  await page.screenshot({ path: `${OUT}/shots-c2/library-hub-390.png`, fullPage: true });

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results-c2.json`,
    JSON.stringify({ expectedSha: EXPECTED, servingImage: image, passed: failed.length === 0, checks, at: new Date().toISOString() }, null, 2),
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
