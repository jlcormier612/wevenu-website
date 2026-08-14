/**
 * Event Order minimum-safe-release browser validation.
 * Temporarily enables Event Orders for Sweet Daisy QA venue, validates HQ
 * control + $0 warning, then restores event_order_enabled = false.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs/qa/event-order-minimum-safe-release");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";
const VENUE_ID = "69cfd906-0d15-4e5c-8bab-ed106b411c34";

function sql(q) {
  const oneLine = String(q).replace(/\s+/g, " ").trim();
  return execSync(
    `docker exec -i supabase_db_wevenu-website psql -U postgres -d postgres -t -A -c ${JSON.stringify(oneLine)}`,
    { encoding: "utf8" },
  ).trim();
}

function isZeroTotal(text) {
  return /\$0(?:\.00)?\b/.test(text);
}

const results = [];
function check(name, pass, note = "") {
  results.push({ name, pass: !!pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
}

await mkdir(OUT, { recursive: true });

const flagBefore = sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`);
check("precondition-flag-false", flagBefore === "f" || flagBefore === "false", flagBefore);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let clientId = "";

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('#email, input[name="email"], input[type="email"]').first().fill(EMAIL);
  await page.locator('#password, input[name="password"], input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  check("login", true, page.url());

  await page.goto(`${BASE}/admin/venues/${VENUE_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  check("on-hq-venue-page", page.url().includes(`/admin/venues/${VENUE_ID}`), page.url());
  await page.screenshot({ path: path.join(OUT, "01-hq-venue-disabled.png"), fullPage: true });
  let hqBody = await page.locator("main").innerText();
  check("hq-section-visible", /Event Orders/i.test(hqBody) && /Disabled/i.test(hqBody));
  check("hq-enable-button", await page.getByRole("button", { name: /Enable Event Orders/i }).count() > 0);

  await page.getByRole("button", { name: /Enable Event Orders/i }).click();
  await page.waitForTimeout(2500);
  await page.goto(`${BASE}/admin/venues/${VENUE_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "02-hq-venue-enabled.png"), fullPage: true });
  hqBody = await page.locator("main").innerText();
  const dbEnabled = sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`);
  check("db-enabled-via-hq", dbEnabled === "t" || dbEnabled === "true", dbEnabled);
  check("hq-enabled-state", /Enabled/i.test(hqBody) && /Disable Event Orders/i.test(hqBody));

  // Happy path must persist via HQ UI after the service_role UPDATE grant.
  // Keep a last-resort DB enable only so EO UI checks can still run if HQ fails.
  if (dbEnabled !== "t" && dbEnabled !== "true") {
    sql(`update venues set event_order_enabled = true where id = '${VENUE_ID}'`);
    check("db-enable-fallback", sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`) === "t");
  }

  const eventId = sql(`select e.id from events e where e.venue_id = '${VENUE_ID}' order by e.created_at desc nulls last limit 1`);
  clientId = eventId ? sql(`select client_id from events where id = '${eventId}'`) : "";
  check("has-event", Boolean(eventId && clientId), `${eventId}|${clientId}`);

  if (eventId && clientId) {
    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    const tab = page.getByRole("button", { name: /^Event Order$/i }).or(page.getByRole("tab", { name: /Event Order/i }));
    if (await tab.count()) await tab.first().click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT, "03-event-order-tab.png"), fullPage: true });
    let body = await page.locator("main").innerText();
    check("eo-tab-visible", /Event Order/i.test(body), body.slice(0, 250));

    if (/No Event Order yet/i.test(body)) {
      const startBtn = page.getByRole("button", { name: /Start Event Order/i });
      if (await startBtn.count()) {
        const select = page.locator('[role="combobox"]').first();
        if (await select.count()) {
          await select.click().catch(() => {});
          await page.getByRole("option").filter({ hasText: /Standard Wedding/i }).first().click().catch(() => {});
        }
        await startBtn.click();
        await page.waitForTimeout(3500);
        body = await page.locator("main").innerText();
      }
    }

    // Reopen if a prior smoke left the order finalized, so Finalize is available again.
    const reopen = page.getByRole("button", { name: /Reopen for Editing/i });
    if (await reopen.count()) {
      await reopen.first().click();
      await page.waitForTimeout(2000);
      body = await page.locator("main").innerText();
    }

    check("eo-total-zero", isZeroTotal(body), body.match(/Running total[^\n]*/)?.[0] ?? "");

    const finalize = page.getByRole("button", { name: /^Finalize$/i });
    if (await finalize.count()) {
      await finalize.first().click();
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(OUT, "04-zero-warning.png"), fullPage: true });
      const dialog = page.getByRole("alertdialog");
      check("zero-warning-appears", await dialog.count() > 0);
      const dialogText = await dialog.innerText().catch(() => "");
      check("zero-warning-copy", isZeroTotal(dialogText) || /\$0\.00/.test(dialogText), dialogText.slice(0, 120));

      await dialog.getByRole("button", { name: /^Cancel$/i }).click();
      await page.waitForTimeout(500);
      check("cancel-stays-editable", await page.getByRole("button", { name: /^Finalize$/i }).count() > 0);

      await page.getByRole("button", { name: /^Finalize$/i }).click();
      await page.waitForTimeout(500);
      await page.getByRole("alertdialog").getByRole("button", { name: /Continue — Finalize/i }).click();
      await page.waitForTimeout(2500);
      check("continue-finalizes", /Finalized/i.test(await page.locator("main").innerText()));
    } else {
      check("finalize-button", false, "not found");
    }
  }

  await page.goto(`${BASE}/admin/venues/${VENUE_ID}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  const disable = page.getByRole("button", { name: /Disable Event Orders/i });
  if (await disable.count()) {
    await disable.click();
    await page.waitForTimeout(2000);
  }
  check("db-restored-false", (() => {
    const v = sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`);
    return v === "f" || v === "false";
  })());
  await page.screenshot({ path: path.join(OUT, "05-hq-restored-disabled.png"), fullPage: true });

  if (clientId) {
    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1000);
    const disabledBody = await page.locator("main").innerText();
    check("eo-tab-hidden-when-disabled", !/Running total:/i.test(disabledBody));
  }
} catch (e) {
  check("browser-run", false, String(e));
} finally {
  sql(`update venues set event_order_enabled = false where id = '${VENUE_ID}'`);
  const finalFlag = sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`);
  check("final-flag-false", finalFlag === "f" || finalFlag === "false", finalFlag);
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
await writeFile(path.join(OUT, "results.json"), JSON.stringify({ pass, fail, results, venueId: VENUE_ID }, null, 2));
console.log(`\nSUMMARY ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
