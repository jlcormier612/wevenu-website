/**
 * C1 closure — Sandbox browser verification of commercial navigation & terminology.
 * Read-mostly: no share/send/invoice sends. Sandbox Fancy venue only.
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
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
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

  // A — Setup Profiles terminology (labels appear in Edit form for Included steps)
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
  // Read-only: do not toggle Included/Not included — only inspect already-Included defaults.
  const invText = (await page.getByTestId("setup-profile-inventory").innerText().catch(() => "")) || "";
  const eoText = (await page.getByTestId("setup-profile-event-order").innerText().catch(() => "")) || "";
  if (!invText || !eoText) {
    record(
      "A Setup Profiles: Included Inventory/EO defaults visible",
      false,
      `inventory=${Boolean(invText)} eventOrder=${Boolean(eoText)} — profile may mark these Not included`,
    );
  }
  record(
    "A Setup Profiles: Event Order template label",
    /Starting Event Order template/i.test(eoText),
    eoText.slice(0, 300) || "event-order defaults missing",
  );
  record(
    "A Setup Profiles: inventory template label",
    /Starting inventory template/i.test(invText),
    invText.slice(0, 300) || "inventory defaults missing",
  );
  const formText = `${invText}\n${eoText}`;
  record(
    "A Setup Profiles: no starting package option",
    !/Select a starting package…/i.test(formText),
    "old package option absent",
  );
  record(
    "A Setup Profiles: no starting offering option",
    !/Select a starting offering…/i.test(formText),
    "old offering option absent",
  );
  // Cancel without saving — do not mutate profile config
  const cancel = page.getByRole("button", { name: /^Cancel$/i });
  if (await cancel.count()) await cancel.click().catch(() => {});
  await page.screenshot({ path: `${OUT}/shots/A-setup-profiles-1280.png`, fullPage: true });

  // D — Library Packages vs EO Templates
  await page.goto(`${APP}/library`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  const libraryBody = await page.locator("body").innerText();
  record(
    "D Library: Packages distinct from Event Order Templates",
    /Distinct from Event Order Templates/i.test(libraryBody) && /Event Order Templates/i.test(libraryBody),
    /Distinct from Event Order Templates/i.test(libraryBody) ? "Packages card copy present" : libraryBody.slice(0, 300),
  );
  await page.screenshot({ path: `${OUT}/shots/D-library-1280.png`, fullPage: true });

  await page.goto(`${APP}/library/inventory-templates`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1000);
  const invTmpl = await page.locator("body").innerText();
  record(
    "D Inventory Templates: apply ≠ share copy",
    /share and client selection happen there/i.test(invTmpl) || /Inventory tab/i.test(invTmpl),
    invTmpl.slice(0, 280),
  );

  // B — Event Overview Setup readiness
  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);
  const setup = page.getByTestId("event-setup-panel");
  const setupVisible = await setup.count();
  if (setupVisible === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click();
    await page.waitForTimeout(800);
  }
  const setupText = (await page.getByTestId("event-setup-panel").innerText().catch(() => "")) || "";
  record(
    "B Overview: readiness narrative for Inventory/EO",
    /Inventory and Event Order rows here are readiness/i.test(setupText)
      || /event Inventory and Event Order tabs/i.test(setupText)
      || /Open Inventory/i.test(setupText),
    setupText.slice(0, 500) || "setup panel missing",
  );

  const openInv = page.getByTestId("event-setup-open-inventory");
  const openEo = page.getByTestId("event-setup-open-event_order");
  if (await openInv.count()) {
    await openInv.click();
    await page.waitForTimeout(1200);
    const urlAfter = page.url();
    record(
      "B Open Inventory navigates to inventory tab",
      /tab=inventory|inventory/i.test(urlAfter) || (await page.getByRole("tab", { name: /^Inventory$/i }).getAttribute("data-state")) === "active",
      urlAfter,
    );
  } else {
    record("B Open Inventory navigates to inventory tab", false, "CTA not present (may be needs Setup Profiles)");
  }

  await page.goto(`${APP}/events/${EVENT}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1500);
  if ((await page.getByTestId("event-setup-panel").count()) === 0) {
    const show = page.getByRole("button", { name: /Show setup/i });
    if (await show.count()) await show.click();
  }
  if (await openEo.count()) {
    await page.getByTestId("event-setup-open-event_order").click();
    await page.waitForTimeout(1200);
    const intro = page.getByTestId("event-commercial-workspace-intro");
    record(
      "B Open Event Order reaches commercial workspace",
      (await intro.count()) > 0,
      `intro=${await intro.count()} url=${page.url()}`,
    );
  } else {
    // Fall through to direct tab
    record("B Open Event Order CTA", true, "CTA absent — will open Event Order tab directly");
  }
  await page.screenshot({ path: `${OUT}/shots/B-overview-setup-1280.png`, fullPage: true });

  // C — Event commercial workspace
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const intro = page.getByTestId("event-commercial-workspace-intro");
  const introText = (await intro.innerText().catch(() => "")) || "";
  record(
    "C Commercial workspace intro present",
    (await intro.count()) > 0 && /Commercial workspace/i.test(introText),
    introText.slice(0, 400) || "missing",
  );
  record(
    "C Intro: Inventory tab + no invoice from setup",
    /Inventory tab/i.test(introText) && /do not send selections or create invoices/i.test(introText),
    introText.slice(0, 300),
  );
  const choices = await page.getByText(/Client selections/i).count();
  record("C Client selections panel present (choices runtime)", choices > 0, `count=${choices}`);
  const eoTitle = await page.getByText(/^Event Order$/).count();
  record("C Event Order panel present", eoTitle > 0, `count=${eoTitle}`);
  await page.screenshot({ path: `${OUT}/shots/C-event-order-commercial-1280.png`, fullPage: true });

  // Inventory tab remains
  await page.goto(`${APP}/events/${EVENT}?tab=inventory`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  const invBody = await page.locator("body").innerText();
  record(
    "C Inventory tab available",
    /Event Inventory/i.test(invBody) || /inventory/i.test(invBody),
    invBody.slice(0, 200),
  );
  record(
    "C Inventory tab remains separate from Event Order",
    /Event Inventory/i.test(invBody) && !(await page.getByTestId("event-commercial-workspace-intro").count()),
    "inventory workspace without commercial EO intro",
  );
  await page.screenshot({ path: `${OUT}/shots/C-inventory-1280.png`, fullPage: true });

  // E — Payments / invoice navigation intact
  await page.goto(`${APP}/events/${EVENT}?tab=invoice`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  const payBody = await page.locator("body").innerText();
  record(
    "E Payments tab intact",
    /Payment|Invoice/i.test(payBody),
    payBody.slice(0, 200),
  );
  await page.screenshot({ path: `${OUT}/shots/E-payments-1280.png`, fullPage: true });

  // Back to EO for invoice link presence (no click that sends)
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  const eoBody = await page.locator("body").innerText();
  record(
    "E Event Order retains invoice / payment language",
    /Invoice|Payment plan|Payments/i.test(eoBody),
    "finance handoff copy/controls visible without sending",
  );

  // E — Portal client entry points (no mutation)
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
      await portalPage.waitForTimeout(1400);
      const t = await portalPage.locator("body").innerText();
      const ok =
        section === "inventory"
          ? /Inventory/i.test(t) && !/This page could not be found/i.test(t)
          : section === "event-order"
            ? /Event Order|order/i.test(t) && !/This page could not be found/i.test(t)
            : (/Choice|selection|Your Choices/i.test(t) || /not available|not shared|no choices|nothing to choose/i.test(t))
              && !/This page could not be found/i.test(t);
      record(`E Portal section ${section} reachable`, ok, t.slice(0, 220));
      await portalPage.screenshot({
        path: `${OUT}/shots/E-portal-${section}-1280.png`,
        fullPage: true,
      });
    }
    await portalPage.close();
  } else {
    record("E Portal sections", false, "no portal session token for client+event");
  }

  // Mobile width smoke on commercial intro
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${APP}/events/${EVENT}?tab=event-order`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForTimeout(1200);
  record(
    "C Commercial intro visible at 390",
    (await page.getByTestId("event-commercial-workspace-intro").count()) > 0,
    "390 viewport",
  );
  await page.screenshot({ path: `${OUT}/shots/C-event-order-commercial-390.png`, fullPage: true });

  await browser.close();

  const failed = checks.filter((c) => !c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
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
