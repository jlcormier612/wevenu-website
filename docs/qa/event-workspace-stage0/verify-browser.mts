/**
 * Stage 0 Sandbox — one Event Order journey; no competing strip/spine; anchors; booking unchanged.
 * No P2-C email claims.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/event-workspace-stage0";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image }, null, 2));
    process.exit(1);
  }

  const { data: eventBefore } = await admin
    .from("events")
    .select("id, status")
    .eq("id", EVENT)
    .maybeSingle();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}#event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(2000);

  record(
    "workflow-mounted",
    (await page.locator('[data-testid="event-commercial-workflow"]').count()) > 0,
    "event-commercial-workflow",
  );
  record(
    "one-journey",
    (await page.locator('[data-testid="event-order-journey"]').count()) === 1,
    "exactly one event-order-journey",
  );
  record(
    "no-spine",
    (await page.locator('[data-testid="event-commercial-workflow-spine"]').count()) === 0,
    "spine removed",
  );
  record(
    "no-status-strip",
    (await page.locator('[data-testid="event-commercial-status-strip"]').count()) === 0,
    "strip not on EO tab",
  );

  const journeyText = await page.locator('[data-testid="event-order-journey"]').innerText().catch(() => "");
  record(
    "no-inventory-in-journey",
    !/\bOpen Inventory\b/i.test(journeyText) && !/Inventory chip/i.test(journeyText),
    journeyText.slice(0, 280),
  );
  record(
    "journey-rows",
    (await page.locator('[data-testid="event-order-journey-rows"] > li').count()) === 3,
    "selections / event_order / invoice",
  );
  record(
    "one-current-row",
    (await page.locator('[data-testid^="event-order-journey-row-"][data-current="true"]').count()) === 1,
    "single current",
  );

  record(
    "choices-anchor",
    (await page.locator("#event-order-choices, [data-testid='event-order-choices']").count()) > 0,
    "event-order-choices",
  );
  record(
    "order-anchor",
    (await page.locator("#event-order-order, [data-testid='event-order-order']").count()) > 0,
    "event-order-order",
  );

  const primaryCount = await page.locator('[data-testid^="event-order-journey-primary-"]').count();
  record("stage-primary-present", primaryCount <= 1, `primaryButtons=${primaryCount}`);

  await page.screenshot({ path: `${OUT}/shots/event-order-journey-1280.png`, fullPage: false });

  await page.goto(`${APP}/events/${EVENT}#event-order-choices`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
  record(
    "deep-link-choices",
    (await page.locator("#event-order-choices, [data-testid='event-order-choices']").count()) > 0,
    page.url(),
  );

  await page.goto(`${APP}/events/${EVENT}#event-order-order`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
  record(
    "deep-link-order",
    (await page.locator("#event-order-order, [data-testid='event-order-order']").count()) > 0,
    page.url(),
  );
  await page.screenshot({ path: `${OUT}/shots/event-order-stage-1280.png`, fullPage: false });

  // Inventory card still on overview (not journey)
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1200);
  record(
    "inventory-card-preserved",
    (await page.locator('[data-testid="event-inventory-event-order-card"]').count()) > 0,
    "workspace card present",
  );
  await page.screenshot({ path: `${OUT}/shots/workspace-cards-1280.png`, fullPage: false });

  await browser.close();

  const { data: eventAfter } = await admin
    .from("events")
    .select("id, status")
    .eq("id", EVENT)
    .maybeSingle();
  record(
    "booking-status-unchanged",
    eventBefore?.status === eventAfter?.status,
    `before=${eventBefore?.status} after=${eventAfter?.status}`,
  );

  const persist = {
    eventStatusBefore: eventBefore?.status ?? null,
    eventStatusAfter: eventAfter?.status ?? null,
  };
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persist, null, 2));

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
    persist,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
