/**
 * Sandbox browser: Import Data + Migration Center + help article language.
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
const OUT = "docs/qa/migration-language";
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
    await page.goto(`${APP}/settings/import`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    const body = await page.locator("body").innerText();
    record("import_no_coming_soon", !/coming soon/i.test(body), /coming soon/i.test(body) ? "found" : "absent");
    record("import_lists_five", /Clients/i.test(body) && /Leads/i.test(body) && /Vendors/i.test(body)
      && /Inventory/i.test(body) && /Package/i.test(body), "entity cards");
    record("import_points_to_mc", /Migration Center/i.test(body), "intro or footer");
    const mcLink = page.locator('a[href="/settings/migration"]').first();
    record("import_mc_link_visible", await mcLink.isVisible().catch(() => false), "link");
    await page.screenshot({ path: `${OUT}/import-data-1280.png`, fullPage: true });

    await mcLink.click();
    await page.waitForTimeout(2500);
    record("navigated_migration", page.url().includes("/settings/migration"), page.url());
    const mcBody = await page.locator("body").innerText();
    record("mc_mentions_events_or_csv", /event|csv|commitment/i.test(mcBody), "copy present");
    await page.screenshot({ path: `${OUT}/migration-center-1280.png`, fullPage: true });

    await page.goto(`${APP}/help/what-should-i-set-up-before-i-start`, {
      waitUntil: "domcontentloaded", timeout: 90000,
    });
    await page.waitForTimeout(2500);
    const help = await page.locator("body").innerText();
    record("help_has_import_data", /Import Data/i.test(help), "section");
    record("help_has_migration_center", /Migration Center/i.test(help), "section");
    record("help_has_active_commitment", /Active commitment/i.test(help), "section");
    record("help_no_coming_soon", !/coming soon/i.test(help), "clean");
    await page.screenshot({ path: `${OUT}/help-article-1280.png`, fullPage: true });

    // Health widget: only if venue has data (Fancy does)
    await page.goto(`${APP}/settings/import`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    const after = await page.locator("body").innerText();
    if (/Not on Import Data/i.test(after)) {
      record("widget_mc_directions", true, "Not on Import Data");
      record("widget_no_coming_soon", !/Coming soon/i.test(after), "ok");
    } else {
      record("widget_mc_directions", false, "widget section not visible (empty venue?)");
    }
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
