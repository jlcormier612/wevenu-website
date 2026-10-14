/**
 * Verify pink New / unseen lead row indicator on Sandbox Leads list.
 * Read-only for customer records except opening a lead detail (existing mark-seen).
 * Prefer a lead that is already unseen; do not create leads or send messages.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/lead-new-unreviewed-indicator-audit";

const TERMINAL = new Set(["booked", "lost", "won", "cancelled"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
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

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");

  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const { data: leads, error: leadErr } = await admin
    .from("leads")
    .select("id, first_name, last_name, sales_stage, venue_seen_at")
    .eq("venue_id", FANCY)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (leadErr) throw leadErr;

  const unseen = (leads ?? []).find(
    (l) =>
      l.venue_seen_at == null &&
      !TERMINAL.has(String(l.sales_stage ?? "").toLowerCase()),
  );
  const seen = (leads ?? []).find(
    (l) =>
      l.venue_seen_at != null &&
      !TERMINAL.has(String(l.sales_stage ?? "").toLowerCase()),
  );

  record(
    "Found unseen open lead",
    Boolean(unseen),
    unseen
      ? `${unseen.first_name} ${unseen.last_name} stage=${unseen.sales_stage} id=${unseen.id}`
      : "none",
  );
  record(
    "Found seen open lead",
    Boolean(seen),
    seen
      ? `${seen.first_name} ${seen.last_name} stage=${seen.sales_stage} id=${seen.id}`
      : "none",
  );

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");

  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  const cookies = [
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  await context.addCookies(cookies);
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("table", { timeout: 30000 }).catch(() => null);
    await page.screenshot({ path: `${OUT}/leads-all-1280.png`, fullPage: true });

    if (unseen) {
      const row = page.locator(`a[href="/leads/${unseen.id}"]`).first();
      const cell = row.locator("xpath=ancestor::td[1]");
      const indicator = cell.locator('[data-testid="lead-unseen-indicator"]');
      const visible = await indicator.count();
      const text = visible ? await indicator.innerText() : "";
      record(
        "Unseen lead shows New indicator",
        visible === 1 && /new/i.test(text),
        `count=${visible} text=${JSON.stringify(text)}`,
      );
      const hasDot = visible
        ? await indicator.locator(".bg-destructive").count()
        : 0;
      record("Unseen lead shows pink dot", hasDot >= 1, `dotCount=${hasDot}`);
    }

    if (seen) {
      const row = page.locator(`a[href="/leads/${seen.id}"]`).first();
      const cell = row.locator("xpath=ancestor::td[1]");
      const indicator = cell.locator('[data-testid="lead-unseen-indicator"]');
      const visible = await indicator.count();
      record(
        "Seen lead has no New indicator",
        visible === 0,
        `count=${visible}`,
      );
    }

    // Sidebar badge presence (count may be >0 when unseen exists).
    const badge = page.locator('a[href="/leads"] ~ a, [aria-label*="unseen lead"]');
    const badgeCount = await page.locator('[aria-label*="unseen lead"]').count();
    record(
      "Sidebar unseen aria label present when expected",
      unseen ? badgeCount >= 1 : true,
      `ariaBadgeCount=${badgeCount}`,
    );

    if (unseen) {
      const before = await admin
        .from("leads")
        .select("venue_seen_at")
        .eq("id", unseen.id)
        .single();
      record(
        "Unseen lead venue_seen_at null before open",
        before.data?.venue_seen_at == null,
        `venue_seen_at=${before.data?.venue_seen_at ?? "null"}`,
      );

      await page.goto(`${APP}/leads/${unseen.id}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${OUT}/lead-detail-after-open.png` });

      const after = await admin
        .from("leads")
        .select("venue_seen_at")
        .eq("id", unseen.id)
        .single();
      record(
        "Opening detail sets venue_seen_at",
        after.data?.venue_seen_at != null,
        `venue_seen_at=${after.data?.venue_seen_at ?? "null"}`,
      );

      await page.goto(`${APP}/leads`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForSelector("table", { timeout: 30000 }).catch(() => null);
      const row = page.locator(`a[href="/leads/${unseen.id}"]`).first();
      const cell = row.locator("xpath=ancestor::td[1]");
      const indicator = cell.locator('[data-testid="lead-unseen-indicator"]');
      const visible = await indicator.count();
      record(
        "Indicator cleared after mark-seen",
        visible === 0,
        `count=${visible}`,
      );
      await page.screenshot({ path: `${OUT}/leads-after-seen-1280.png`, fullPage: true });
    }

    // Narrow viewport smoke — no horizontal overflow on leads table area.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${APP}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => {
      const el = document.documentElement;
      return el.scrollWidth > el.clientWidth + 2;
    });
    record("Narrow leads list no page overflow", !overflow, `overflow=${overflow}`);
    await page.screenshot({ path: `${OUT}/leads-all-390.png`, fullPage: true });
  } finally {
    await browser.close();
  }

  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        expectedSha: EXPECTED,
        servingImage: image,
        unseenLeadId: unseen?.id ?? null,
        seenLeadId: seen?.id ?? null,
        allPass,
        checks,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  console.log(allPass ? "ALL PASS" : "SOME FAILED");
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
