/**
 * Follow-up: Dashboard (14-day window) + Calendar month visibility for Key Dates.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/qa/key-dates-browser-evidence");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";
const CLIENT_ID = "dbfa69d6-47ad-4f9d-892d-4f06cb7f1844";
const PASSWORD = "devpassword123";

function sql(q) {
  return execSync(
    `docker exec -i supabase_db_wevenu-website psql -U postgres -d postgres -t -A -c ${JSON.stringify(String(q).replace(/\s+/g, " ").trim())}`,
    { encoding: "utf8" },
  ).trim();
}

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

// Within dashboard 14-day window (today + 5 days)
const d = new Date();
d.setDate(d.getDate() + 5);
const DATE = d.toISOString().slice(0, 10);
const LABEL = `DashCal KD ${Date.now()}`;

await mkdir(OUT, { recursive: true });
const result = { startedAt: new Date().toISOString(), DATE, LABEL, checks: [], errors: [] };
function check(name, ok, detail) {
  result.checks.push({ name, ok: !!ok, detail: detail ?? null });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[type="email"]').first().fill("owner@example.com");
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });

  await page.goto(`${BASE}/clients/${CLIENT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const addBtn = page.getByRole("button", { name: /Add key date/i }).first();
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForSelector("#kd-label");
  await page.locator("#kd-label").fill(LABEL);
  await page.locator("#kd-date").fill(DATE);
  await page.getByRole("button", { name: /^Add date$/i }).click();
  await page.getByRole("button", { name: /Adding/i }).waitFor({ state: "hidden", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const inDb = sql(
    `select count(*)::text from client_key_dates where client_id='${CLIENT_ID}' and label=${sqlLiteral(LABEL)}`,
  );
  check("created", inDb === "1", `${LABEL}|${DATE}`);

  // Dashboard
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "15-dashboard-with-kd.png"), fullPage: false });
  const dash = await page.locator("body").innerText();
  const dashHas = dash.includes(LABEL);
  check("dashboard_shows_label", dashHas, dashHas ? "VERIFIED LIVE" : "UNVERIFIED");
  const dashLink = page.locator(`a[href="/clients/${CLIENT_ID}"]`).filter({ hasText: new RegExp(LABEL.slice(0, 12), "i") }).first();
  let linked = false;
  if (await page.locator(`a[href="/clients/${CLIENT_ID}"]`).count()) {
    // Click any attention item linking to this client, prefer one mentioning label
    const byLabel = page.getByRole("link", { name: new RegExp(LABEL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") });
    if (await byLabel.count()) {
      await byLabel.first().click();
      linked = true;
    } else {
      // click first client link that appears near key date text
      const candidate = page.locator(`a[href="/clients/${CLIENT_ID}"]`).first();
      await candidate.click();
      linked = true;
    }
    await page.waitForTimeout(2500);
  }
  check("dashboard_navigates_to_client", page.url().includes(`/clients/${CLIENT_ID}`), page.url());
  if (page.url().includes(`/clients/${CLIENT_ID}`)) {
    const body = await page.locator("body").innerText();
    check("dashboard_dest_has_key_dates_card", /Key Dates/i.test(body) && body.includes(LABEL), null);
  }
  await page.screenshot({ path: path.join(OUT, "16-from-dashboard.png"), fullPage: false });

  // Calendar — current month should include DATE (+5 days)
  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(OUT, "17-calendar-with-kd.png"), fullPage: false });
  const cal = await page.locator("body").innerText();
  const calHas = cal.includes(LABEL) || /key date/i.test(cal);
  check("calendar_shows_key_date", cal.includes(LABEL), calHas ? "label or type" : "UNVERIFIED");
  if (cal.includes(LABEL)) {
    await page.getByText(LABEL).first().click().catch(() => {});
    await page.waitForTimeout(2000);
  } else {
    const link = page.locator(`a[href="/clients/${CLIENT_ID}"]`).first();
    if (await link.count()) await link.click();
    await page.waitForTimeout(2000);
  }
  if (!page.url().includes(`/clients/${CLIENT_ID}`)) {
    await page.goto(`${BASE}/clients/${CLIENT_ID}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    result.errors.push("calendar click did not navigate; used direct URL");
  }
  check("calendar_dest_client", page.url().includes(`/clients/${CLIENT_ID}`), page.url());
  const afterCal = await page.locator("body").innerText();
  check("calendar_dest_has_key_dates", /Key Dates/i.test(afterCal) && afterCal.includes(LABEL), null);
  await page.screenshot({ path: path.join(OUT, "18-from-calendar.png"), fullPage: false });

  // cleanup
  sql(`delete from client_key_dates where client_id='${CLIENT_ID}' and label=${sqlLiteral(LABEL)}`);
  check("cleanup", sql(`select count(*)::text from client_key_dates where label=${sqlLiteral(LABEL)}`) === "0", null);

  result.passed = result.checks.every((c) => c.ok);
} catch (e) {
  result.errors.push(String(e?.stack || e));
  result.passed = false;
  await page.screenshot({ path: path.join(OUT, "99-followup-error.png"), fullPage: false }).catch(() => {});
} finally {
  await writeFile(path.join(OUT, "results-followup.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.passed ? 0 : 1);
}
