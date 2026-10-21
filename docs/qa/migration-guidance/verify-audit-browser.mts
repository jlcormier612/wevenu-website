/**
 * Read-only Sandbox browser audit: migration entry points + discoverability.
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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 240)}`);
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

async function shot(page: any, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  try {
    // Import Data
    await page.goto(`${APP}/settings/import`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    let body = await page.locator("body").innerText();
    record("import_has_mc_section", /Bringing over existing bookings/i.test(body), "section");
    record("import_says_active_commitment", /Active Commitment/i.test(body), /Active Commitment/i.test(body) ? "FOUND (jargon)" : "absent");
    record("import_help_link", /What Should I Set Up Before I Start/i.test(body), "link");
    await shot(page, "audit-import-1280");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await shot(page, "audit-import-390");
    await page.setViewportSize({ width: 1280, height: 900 });

    // Migration Center
    await page.goto(`${APP}/settings/migration`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);
    body = await page.locator("body").innerText();
    record("mc_page_loaded", /Migration Center/i.test(body), "title");
    record("mc_intro_present", /Bring your business/i.test(body), "intro");
    record("mc_says_active_commitment", /Active commitment/i.test(body), /Active commitment/i.test(body) ? "FOUND in UI" : "absent");
    record("mc_help_link", /What Should I Set Up Before I Start/i.test(body), "link");
    record("mc_has_recommended_order", /recommended order|step.?by.?step|first.*clients|prepare/i.test(body), "order checklist?");
    record("mc_entity_picker", /What are you bringing over/i.test(body) || /Clients \(booked/i.test(body), "picker");
    await shot(page, "audit-migration-1280");

    // Select active commitment if visible
    const select = page.locator('button[role="combobox"], [data-slot="select-trigger"]').first();
    if (await select.isVisible().catch(() => false)) {
      await select.click();
      await page.waitForTimeout(500);
      const opts = await page.locator('[role="option"]').allTextContents();
      record("mc_dropdown_has_active_commitment", opts.some((o) => /Active commitment/i.test(o)), opts.filter(o => /commit|invoice|agreement|finance/i.test(o)).join(" | ").slice(0, 200) || "no finance opts");
      const ac = page.locator('[role="option"]').filter({ hasText: /Active commitment|invoice|signed agreement/i }).first();
      if (await ac.isVisible().catch(() => false)) {
        await ac.click();
        await page.waitForTimeout(800);
        body = await page.locator("body").innerText();
        record("mc_ac_panel_explains", /Smart Import|signed PDF|invoice|payment/i.test(body), "panel copy");
        await shot(page, "audit-migration-active-commitment");
      } else {
        record("mc_ac_panel_explains", false, "could not select AC option");
        await page.keyboard.press("Escape");
      }
    } else {
      // maybe starting fresh lane hides picker
      record("mc_dropdown_has_active_commitment", false, "select not visible (starting fresh?)");
      // pick another system
      const another = page.getByText("Another system", { exact: true });
      if (await another.isVisible().catch(() => false)) {
        await another.click();
        await page.waitForTimeout(1000);
        body = await page.locator("body").innerText();
        record("mc_after_another_system", /What are you bringing over/i.test(body), "picker shown");
        await shot(page, "audit-migration-another-system");
      }
    }

    // Help article
    await page.goto(`${APP}/help/what-should-i-set-up-before-i-start`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    body = await page.locator("body").innerText();
    record("help_has_import_vs_mc", /Import Data/i.test(body) && /Migration Center/i.test(body), "paths");
    record("help_has_step_order", /1\.|step 1|recommended/i.test(body), "ordered steps?");
    record("help_uses_active_commitment", /Active commitment/i.test(body), /Active commitment/i.test(body) ? "jargon present" : "plain");
    record("help_no_session_undo", /no one-click undo|no.*undo/i.test(body), "limitation");
    await shot(page, "audit-help-1280");

    // Bring Your Business setup guide
    await page.goto(`${APP}/help/setup-bring-your-business`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    body = await page.locator("body").innerText();
    record("byb_guide_loaded", /Bring your existing business/i.test(body), "title");
    record("byb_has_steps", /Set up Calendar/i.test(body) && /Review before/i.test(body), "steps");
    record("byb_uses_active_commitment", /active commitment/i.test(body), /active commitment/i.test(body) ? "jargon" : "plain");
    await shot(page, "audit-byb-guide-1280");

    // Setup hub
    await page.goto(`${APP}/setup-hub`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    body = await page.locator("body").innerText();
    record("setup_hub_bring_business", /Import my business|Bring Your Business|Migration Center/i.test(body), "choices");
    await shot(page, "audit-setup-hub-1280");

    // Team & Data settings (nav discovery)
    await page.goto(`${APP}/settings/team`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    body = await page.locator("body").innerText();
    record("team_links_import", /Import Data|\/settings\/import/i.test(body), "import link?");
    record("team_links_migration", /Migration Center|\/settings\/migration/i.test(body), "mc link?");
    await shot(page, "audit-settings-team-1280");

  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
    await shot(page, "audit-error").catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = { pass: checks.filter(c => c.pass).length, fail: checks.filter(c => !c.pass).length, checks };
  writeFileSync(`${OUT}/audit-baseline.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
