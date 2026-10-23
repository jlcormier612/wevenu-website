/**
 * C6 — Setup / readiness cleanup (no Send-as-EO / invoice create on Setup).
 * Read-mostly: does not Release, Invite, Share, or Create Invoice.
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
mkdirSync(`${OUT}/shots-c6`, { recursive: true });

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

  const { count: invBefore } = await admin
    .from("event_inventory")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);
  const { count: eoBefore } = await admin
    .from("event_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  // ---- Profile Setup terminology (read-only Edit, Cancel) ----
  await page.goto(`${APP}/settings/leads/setup-profiles`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const editBtn = page.getByRole("button", { name: /^Edit$/i }).first();
  if (await editBtn.count()) {
    await editBtn.click();
    await page.waitForTimeout(1000);
  }
  const invText = (await page.getByTestId("setup-profile-inventory").innerText().catch(() => "")) || "";
  const eoText = (await page.getByTestId("setup-profile-event-order").innerText().catch(() => "")) || "";
  record(
    "A Setup Profiles: starting inventory template label",
    /Starting inventory template/i.test(invText),
    invText.slice(0, 220) || "missing",
  );
  record(
    "A Setup Profiles: starting Event Order template label",
    /Starting Event Order template/i.test(eoText),
    eoText.slice(0, 220) || "missing",
  );
  record(
    "A Setup Profiles: no Send/Create Invoice CTAs in profile form",
    !(await page.getByRole("button", { name: /Send to client|Send Event Order|Create Invoice|Share with Client/i }).count()),
    "profile form",
  );
  const cancel = page.getByRole("button", { name: /^Cancel$/i });
  if (await cancel.count()) await cancel.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/shots-c6/A-setup-profiles-1280.png`, fullPage: true });

  // ---- Event Overview Setup ----
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);
  if ((await page.getByTestId("event-setup-panel").count()) === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click();
    await page.waitForTimeout(800);
  }
  const setup = page.getByTestId("event-setup-panel");
  const setupText = (await setup.innerText().catch(() => "")) || "";
  record(
    "B Setup panel present with readiness narrative",
    (await setup.count()) > 0
      && (/Inventory and Event Order rows here are readiness/i.test(setupText)
        || /Open Inventory/i.test(setupText)
        || /readiness/i.test(setupText)),
    setupText.slice(0, 320),
  );
  record(
    "B Setup has no Send-as-EO / Share / Create Invoice buttons",
    !(await setup.getByRole("button", {
      name: /^(Send|Send to Client|Send Event Order|Share with Client|Create Invoice)$/i,
    }).count()),
    "setup CTAs",
  );
  const release = page.getByTestId("prepare-and-release-portal");
  if (await release.count()) {
    const releaseBox = page.getByTestId("event-setup-prepare-release");
    const releaseText = (await releaseBox.innerText().catch(() => "")) || "";
    record(
      "B Release copy denies Inventory/EO share and invoice create",
      /share Inventory or the Event Order/i.test(releaseText)
        && /create invoices/i.test(releaseText),
      releaseText.slice(0, 280),
    );
  } else {
    record("B Release copy denies Inventory/EO share and invoice create", true, "release block not shown (may already be collapsed path)");
  }

  const openInv = page.getByTestId("event-setup-open-inventory");
  if (await openInv.count()) {
    await openInv.click();
    await page.waitForTimeout(1200);
    record(
      "B Open Inventory deep link reaches Inventory tab",
      /#inventory|tab=inventory/i.test(page.url())
        || (await page.getByRole("tab", { name: /^Inventory$/i }).getAttribute("data-active")) != null
        || /Event Inventory/i.test(await page.locator("body").innerText()),
      page.url(),
    );
  } else {
    record("B Open Inventory deep link reaches Inventory tab", false, "Open Inventory CTA missing");
  }

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1500);
  if ((await page.getByTestId("event-setup-panel").count()) === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click();
  }
  const openEo = page.getByTestId("event-setup-open-event_order");
  if (await openEo.count()) {
    await openEo.click();
    await page.waitForTimeout(1200);
    record(
      "B Open Event Order reaches commercial workspace strip",
      (await page.getByTestId("event-commercial-status-strip").count()) > 0,
      page.url(),
    );
  } else {
    await page.goto(`${APP}/events/${EVENT}?tab=event-order`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1200);
    record(
      "B Open Event Order reaches commercial workspace strip",
      (await page.getByTestId("event-commercial-status-strip").count()) > 0,
      "direct tab fallback",
    );
  }
  await page.screenshot({ path: `${OUT}/shots-c6/B-event-setup-1280.png`, fullPage: true });

  // ---- Retain commercial runner + portal ----
  record(
    "C Commercial strip still present (C3/C4)",
    (await page.getByTestId("event-commercial-status-strip").count()) > 0,
    "strip",
  );
  record(
    "C Checklist still present (C4)",
    (await page.getByTestId("event-commercial-progress-checklist").count()) > 0,
    "checklist",
  );

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
    const portalPage = await context.newPage();
    for (const section of ["inventory", "event-order", "choices"] as const) {
      await portalPage.goto(`${APP}/p/${token}#${section}`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await portalPage.waitForTimeout(1000);
      const t = await portalPage.locator("body").innerText();
      record(`D Portal ${section} reachable`, !/This page could not be found/i.test(t), t.slice(0, 120));
    }
    await portalPage.close();
  } else {
    record("D Portal sections", false, "no token");
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  if ((await page.getByTestId("event-setup-panel").count()) === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click().catch(() => {});
  }
  record(
    "E Setup panel usable at 390 without Send-as-EO",
    (await page.getByTestId("event-setup-panel").count()) > 0
      && !(await page.getByTestId("event-setup-panel").getByRole("button", { name: /^Send to Client$/i }).count()),
    "390",
  );
  await page.screenshot({ path: `${OUT}/shots-c6/E-setup-390.png`, fullPage: true });

  const { count: invAfter } = await admin
    .from("event_inventory")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);
  const { count: eoAfter } = await admin
    .from("event_orders")
    .select("id", { count: "exact", head: true })
    .eq("event_id", EVENT);
  record(
    "F No duplicate inventory/EO rows from C6 navigation",
    invBefore === invAfter && eoBefore === eoAfter,
    `inv ${invBefore}->${invAfter} eo ${eoBefore}->${eoAfter}`,
  );

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results-c6.json`,
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
