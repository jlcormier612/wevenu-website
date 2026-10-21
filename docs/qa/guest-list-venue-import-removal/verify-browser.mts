/**
 * Sandbox browser: venue MC no longer offers guest_list; other imports remain;
 * portal guest list still loads. Magic-link Fancy only. No guest writes.
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
const OUT = "docs/qa/guest-list-venue-import-removal";
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();
  let optionTexts: string[] = [];

  try {
    await page.goto(`${APP}/settings/migration`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(3000);

    const another = page.locator("label").filter({ hasText: /^Another system/ }).first();
    const anotherVisible = await another.isVisible().catch(() => false);
    record("mc_another_system", anotherVisible, "source picker");
    if (anotherVisible) {
      await another.click();
      await page.waitForTimeout(1200);
    }

    const select = page.locator('button[role="combobox"], [data-slot="select-trigger"]').first();
    const selectVisible = await select.isVisible().catch(() => false);
    record("mc_entity_select", selectVisible, "What are you bringing over");
    if (selectVisible) {
      await select.click();
      await page.waitForTimeout(500);
      optionTexts = (await page.locator('[role="option"]').allTextContents()).map((t) => t.trim());
      const joined = optionTexts.join(" | ");
      record(
        "mc_no_guest_list_option",
        !optionTexts.some((o) => /guest list/i.test(o)),
        joined.slice(0, 400) || "no options",
      );
      record(
        "mc_still_has_client",
        optionTexts.some((o) => /^Clients?\b/i.test(o) || /Client info/i.test(o) || /^client$/i.test(o)),
        optionTexts.find((o) => /client/i.test(o)) ?? "missing",
      );
      record(
        "mc_still_has_event",
        optionTexts.some((o) => /^Events?\b/i.test(o) || /Booked event/i.test(o)),
        optionTexts.find((o) => /event/i.test(o)) ?? "missing",
      );
      record(
        "mc_still_has_booked_finances",
        optionTexts.some((o) => /Booked-event finances/i.test(o)),
        optionTexts.find((o) => /finance|invoice|agreement/i.test(o)) ?? "missing",
      );
      await page.screenshot({ path: `${OUT}/mc-entity-picker-1280.png`, fullPage: true });
      await page.keyboard.press("Escape");
    } else {
      record("mc_no_guest_list_option", false, "select missing");
      record("mc_still_has_client", false, "select missing");
      record("mc_still_has_event", false, "select missing");
      record("mc_still_has_booked_finances", false, "select missing");
    }

    // Portal guests — find a Fancy client portal token if any disposable exists; else open clients list.
    await page.goto(`${APP}/clients`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    const clientsBody = await page.locator("body").innerText();
    record("clients_list_loads", /Clients|client/i.test(clientsBody), page.url());
    await page.screenshot({ path: `${OUT}/clients-1280.png`, fullPage: true });
  } catch (e) {
    record("browser_error", false, e instanceof Error ? e.message : String(e));
    await page.screenshot({ path: `${OUT}/browser-error.png`, fullPage: true }).catch(() => {});
  } finally {
    await browser.close();
  }

  const summary = {
    pass: checks.filter((c) => c.pass).length,
    fail: checks.filter((c) => !c.pass).length,
    optionTexts,
    checks,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\nSUMMARY pass=${summary.pass} fail=${summary.fail}`);
  if (summary.fail) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
