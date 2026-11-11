/**
 * Settings UX: simultaneous public availability copy — Sandbox browser check.
 * EXPECTED_SHA=<serving> npx tsx docs/qa/simultaneous-public-availability-copy/verify-browser.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
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
const OUT = "docs/qa/simultaneous-public-availability-copy";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 350)}`);
}

async function servingImage() {
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
        method: "POST",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: "magiclink", email: EMAIL }),
      });
      if (!res.ok) throw new Error(`generate_link HTTP ${res.status}`);
      const body = await res.json() as { hashed_token?: string; properties?: { hashed_token?: string } };
      const hash = body.hashed_token ?? body.properties?.hashed_token;
      if (!hash) throw new Error("missing hash");
      const { data: otp, error } = await anon.auth.verifyOtp({ type: "email", token_hash: hash });
      if (!error && otp?.session) {
        const projectRef = new URL(url).hostname.split(".")[0];
        const cookieName = `sb-${projectRef}-auth-token`;
        const chunked = ssrUtils.createChunks(cookieName, JSON.stringify(otp.session));
        return (Array.isArray(chunked) ? chunked : [{ name: cookieName, value: chunked }]).map(
          (c: { name: string; value: string }) => ({
            name: c.name,
            value: c.value,
            domain: "app.sandbox.hellotocheers.com",
            path: "/",
            httpOnly: false,
            secure: true,
            sameSite: "Lax" as const,
          }),
        );
      }
      lastErr = error ?? new Error("no session");
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
  }
  throw lastErr ?? new Error("staff session failed");
}

async function passWelcome(page: any) {
  for (let a = 0; a < 5; a++) {
    const onWelcome = page.url().includes("/welcome");
    const visible = await page.locator('[data-welcome-experience="true"]').isVisible().catch(() => false);
    if (!onWelcome && !visible) return;
    await page.locator("#welcome-experience-agree").check({ force: true }).catch(() => {});
    const boxes = page.locator("input[type='checkbox']");
    const n = await boxes.count();
    for (let i = 0; i < n; i++) await boxes.nth(i).check({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    const cont = page.getByRole("button", { name: /^Continue$/i });
    if ((await cont.count()) > 0 && (await cont.first().isEnabled())) await cont.first().click();
    for (let i = 0; i < 20; i++) {
      if (!page.url().includes("/welcome")) return;
      await page.waitForTimeout(300);
    }
  }
}

async function main() {
  const image = await servingImage();
  record("serving_sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, verdict: "BLOCKED" }, null, 2));
    process.exit(1);
  }

  const { data: before } = await admin
    .from("venues")
    .select("allow_simultaneous_public_availability")
    .eq("id", FANCY)
    .single();
  const original = before?.allow_simultaneous_public_availability === true;
  record("baseline_flag_loaded", true, `fancyAllow=${original}`);

  const cookies = await staffCookies();
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [1280, 390] as const) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      await context.addCookies(cookies);
      const page = await context.newPage();
      await page.goto(`${APP}/settings/availability`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1500);
      await passWelcome(page);
      await page.goto(`${APP}/settings/availability`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);

      const fieldset = page.locator('[data-testid="simultaneous-public-availability"]');
      await fieldset.scrollIntoViewIfNeeded();
      const body = await page.locator("main").innerText();
      await page.screenshot({ path: `${OUT}/shots/availability-${width}.png`, fullPage: true });

      record(
        `copy_title_${width}`,
        /Allow inquiries when another event is booked/i.test(body),
        "setting title",
      );
      record(
        `copy_options_${width}`,
        /Close the date when an event is booked/i.test(body) && /Keep the date open for other events/i.test(body),
        "both options",
      );
      record(
        `copy_note_${width}`,
        /public inquiry availability is currently date-based/i.test(body),
        "important note visible",
      );
      record(
        `howto_multi_space_${width}`,
        /An open date does not mean every space/i.test(body) && /Booked events and public availability/i.test(body),
        "how-to section",
      );

      const closeRadio = fieldset.locator('input[type="radio"]').nth(0);
      const openRadio = fieldset.locator('input[type="radio"]').nth(1);
      const closeChecked = await closeRadio.isChecked();
      const openChecked = await openRadio.isChecked();
      record(
        `selection_matches_db_${width}`,
        original ? openChecked && !closeChecked : closeChecked && !openChecked,
        `db=${original} close=${closeChecked} open=${openChecked}`,
      );

      // Toggle to opposite, confirm persist, restore
      const target = !original;
      if (target) await openRadio.click();
      else await closeRadio.click();
      await page.waitForTimeout(2500);
      const { data: mid } = await admin
        .from("venues")
        .select("allow_simultaneous_public_availability")
        .eq("id", FANCY)
        .single();
      const midVal = mid?.allow_simultaneous_public_availability === true;
      record(`toggle_persists_${width}`, midVal === target, `expected=${target} got=${midVal}`);

      if (original) await openRadio.click();
      else await closeRadio.click();
      await page.waitForTimeout(2500);
      const { data: after } = await admin
        .from("venues")
        .select("allow_simultaneous_public_availability")
        .eq("id", FANCY)
        .single();
      const restored = after?.allow_simultaneous_public_availability === true;
      record(`restored_${width}`, restored === original, `original=${original} restored=${restored}`);

      await context.close();
    }
  } finally {
    // Ensure Fancy flag restored even if harness errors mid-toggle
    await admin
      .from("venues")
      .update({ allow_simultaneous_public_availability: original })
      .eq("id", FANCY);
    await browser.close().catch(() => {});
  }

  const failed = checks.filter((c) => !c.pass);
  const results = {
    expectedSha: EXPECTED,
    servingImage: image,
    originalFlag: original,
    checks,
    failedCount: failed.length,
    verdict: failed.length === 0 ? "GREEN" : "OPEN",
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(`\nVERDICT ${results.verdict} pass=${checks.length - failed.length} fail=${failed.length}`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
