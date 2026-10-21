/**
 * Sandbox browser: migration guidance journey after implementation.
 * Magic-link Fancy session. No imports committed.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/migration-guidance";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 220)}`);
}

async function cookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email", token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com",
      path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    // Migration Center — guidance visible even on starting-from-scratch
    await page.goto(`${APP}/settings/migration`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);
    let body = await page.locator("body").innerText();
    record("mc_guidance_panel", /How to bring your existing business over/i.test(body), "panel");
    record("mc_suggested_order", /Prepare/i.test(body) && /Calendar/i.test(body) && /Agreements & money/i.test(body), "steps");
    record("mc_no_unexplained_active_commitment", !/\bActive [Cc]ommitment\b/.test(body), "plain language");
    record("mc_help_link", /How to bring your business over/i.test(body), "help CTA");
    record("mc_mentions_import_data", /Import Data/i.test(body), "path contrast");
    await page.screenshot({ path: `${OUT}/mc-guidance-1280.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/mc-guidance-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Choose Another system so entity picker appears
    const another = page.getByText("Another system", { exact: true });
    if (await another.isVisible().catch(() => false)) {
      await another.click();
      await page.waitForTimeout(1200);
      body = await page.locator("body").innerText();
      record("mc_picker_after_source", /What are you bringing over/i.test(body), "picker");
      const select = page.locator('button[role="combobox"], [data-slot="select-trigger"]').first();
      if (await select.isVisible().catch(() => false)) {
        await select.click();
        await page.waitForTimeout(400);
        const opts = await page.locator('[role="option"]').allTextContents();
        record(
          "mc_booked_event_finances_option",
          opts.some((o) => /Booked-event finances/i.test(o)),
          opts.find((o) => /finance|invoice|agreement|commitment/i.test(o))?.slice(0, 120) ?? "none",
        );
        const finance = page.locator('[role="option"]').filter({ hasText: /Booked-event finances/i }).first();
        if (await finance.isVisible().catch(() => false)) {
          await finance.click();
          await page.waitForTimeout(800);
          body = await page.locator("body").innerText();
          record("mc_finance_panel", /invoice, payments, signed agreement/i.test(body), "panel explains task");
          await page.screenshot({ path: `${OUT}/mc-booked-event-finances-1280.png`, fullPage: true });
        } else {
          record("mc_finance_panel", false, "option missing");
          await page.keyboard.press("Escape");
        }
      } else {
        record("mc_picker_after_source", false, "no select");
        record("mc_booked_event_finances_option", false, "no select");
        record("mc_finance_panel", false, "no select");
      }
    } else {
      record("mc_picker_after_source", false, "Another system not found");
      record("mc_booked_event_finances_option", false, "skip");
      record("mc_finance_panel", false, "skip");
    }

    // Import Data
    await page.goto(`${APP}/settings/import`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    body = await page.locator("body").innerText();
    record("import_no_active_commitment", !/Active Commitment/i.test(body), "plain");
    record("import_points_mc", /Migration Center/i.test(body), "direction");
    record("import_calendar_prereq", /Calendar\s*&\s*Availability/i.test(body), "prereq");
    record("import_help_cta", /How to bring your business over/i.test(body), "help");
    await page.screenshot({ path: `${OUT}/import-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/import-390.png`, fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });

    // Help article
    await page.goto(`${APP}/help/what-should-i-set-up-before-i-start`, {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    await page.waitForTimeout(2500);
    body = await page.locator("body").innerText();
    record("help_title", /How to Bring Your Business Over/i.test(body), "title");
    record("help_suggested_order", /Suggested order/i.test(body), "checklist");
    record("help_booked_finances", /Booked-event finances/i.test(body), "plain finances");
    record("help_no_paren_active_commitment", !/\(Active commitment\)/i.test(body), "jargon removed");
    record("help_no_undo", /no one-click undo/i.test(body), "limitation");
    await page.screenshot({ path: `${OUT}/help-1280.png`, fullPage: true });

    // Team & Data
    await page.goto(`${APP}/settings/team`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    body = await page.locator("body").innerText();
    record("team_import_data_link", /Open Import Data/i.test(body), "import");
    record("team_mc_calendar_scope", /events, tours, date holds/i.test(body), "scope");
    await page.screenshot({ path: `${OUT}/team-1280.png`, fullPage: true });

    await page.goto(`${APP}/settings/availability`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    record("availability_loads", page.url().includes("/settings/availability"), page.url());
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/browser-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
