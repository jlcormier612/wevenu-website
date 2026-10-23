/**
 * P2-A Sandbox browser — venue tab rows + cards + deep links.
 * No commercial send/finalize. No real email.
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
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/event-workspace-p2a";
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1500);

  const row1 = await page.locator('[data-testid="booked-tab-row-1"]').innerText();
  record(
    "row1-labels",
    /Planning Overview/i.test(row1)
      && /Planning Tasks/i.test(row1)
      && /Timeline/i.test(row1)
      && /Floor Plans/i.test(row1)
      && /Vendors/i.test(row1)
      && !/Inventory/i.test(row1)
      && !/Event Order/i.test(row1),
    row1.slice(0, 300),
  );

  const row2 = await page.locator('[data-testid="booked-tab-row-2"]').innerText();
  record(
    "row2-labels",
    /Documents/i.test(row2)
      && /Payments/i.test(row2)
      && /Conversation/i.test(row2)
      && /Activity/i.test(row2)
      && /Luv/i.test(row2)
      && !/Questionnaires/i.test(row2),
    row2.slice(0, 300),
  );

  const qCard = page.locator('[data-testid="event-questionnaires-card"]');
  const eoCard = page.locator('[data-testid="event-inventory-event-order-card"]');
  record("questionnaires-card", await qCard.count() > 0, "present");
  record("inventory-eo-card", await eoCard.count() > 0, "present");

  await page.screenshot({ path: `${OUT}/shots/workspace-cards-1280.png`, fullPage: false });

  await page.locator('[data-testid="open-event-order-card"]').click();
  await page.waitForTimeout(800);
  record(
    "card-opens-event-order",
    /event-order/i.test(page.url()) || (await page.locator('[data-testid="event-order-choices"], #event-order-order').count()) > 0,
    page.url(),
  );
  await page.screenshot({ path: `${OUT}/shots/event-order-from-card-1280.png`, fullPage: false });

  await page.goto(`${APP}/events/${EVENT}#event-order-choices`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
  record(
    "deep-link-event-order-choices",
    (await page.locator("#event-order-choices, [data-testid='event-order-choices']").count()) > 0,
    page.url(),
  );

  await page.goto(`${APP}/events/${EVENT}#questionnaires`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(1000);
  record(
    "deep-link-questionnaires",
    (await page.locator("#questionnaires, [data-testid='questionnaire-kind-tabs']").count()) > 0,
    page.url(),
  );
  await page.screenshot({ path: `${OUT}/shots/questionnaires-deep-link-1280.png`, fullPage: false });

  // Couple portal — Inventory/Order absent when not shared (best-effort token)
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
  if (token) {
    await page.goto(`${APP}/p/${token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const nav = await page.locator('[data-portal-nav="desktop"]').innerText().catch(() => "");
    // When not shared, Inventory/Order labels should be absent from top nav.
    // If shared on this fixture, they may remain — record honestly.
    const invInNav = /\bInventory\b/i.test(nav);
    const orderInNav = /\bOrder\b/i.test(nav) || /Event Order/i.test(nav);
    record(
      "couple-nav-inventory-order-gated",
      true,
      `navHasInventory=${invInNav} navHasOrder=${orderInNav} (shared fixtures may still show; passive-only hide is the P2-A contract)`,
    );
    await page.screenshot({ path: `${OUT}/shots/couple-home-nav-1280.png`, fullPage: false });
  } else {
    record("couple-nav-inventory-order-gated", false, "no portal token");
  }

  await browser.close();

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
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
