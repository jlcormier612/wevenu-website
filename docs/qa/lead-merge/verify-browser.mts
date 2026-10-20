/**
 * Sandbox browser: Merge lead UI on disposable Fancy staff session if available,
 * else document login blocker. Prefer RPC probe for data integrity GREEN.
 */
import { chromium } from "playwright";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";

config({ path: ".env.local", quiet: true });
const OUT = "docs/qa/lead-merge";
mkdirSync(OUT, { recursive: true });
const BASE = process.env.SANDBOX_APP_URL ?? "https://sandbox.hellotocheers.com";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const results: Record<string, unknown> = { base: BASE, at: new Date().toISOString() };

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    const email = process.env.SANDBOX_STAFF_EMAIL ?? "jennifer@hellotocheers.com";
    const password = process.env.SANDBOX_STAFF_PASSWORD;
    if (!password) {
      results.blocker = "SANDBOX_STAFF_PASSWORD not set — UI login skipped; rely on RPC probe";
      writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
    await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const firstLead = page.locator('a[href^="/leads/"]').first();
    const href = await firstLead.getAttribute("href");
    results.openedLead = href;
    if (href) {
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2000);
      const mergeBtn = page.getByTestId("merge-lead-open");
      const visible = await mergeBtn.isVisible().catch(() => false);
      results.mergeButtonVisible = visible;
      if (visible) {
        await mergeBtn.click();
        await page.waitForTimeout(500);
        results.dialogVisible = await page.getByTestId("merge-lead-dialog").isVisible().catch(() => false);
        await page.screenshot({ path: `${OUT}/merge-dialog-1280.png`, fullPage: true });
      } else {
        await page.screenshot({ path: `${OUT}/lead-detail-no-merge-1280.png`, fullPage: true });
      }
    }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e);
    await page.screenshot({ path: `${OUT}/browser-error.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
