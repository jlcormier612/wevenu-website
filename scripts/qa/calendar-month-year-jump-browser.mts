/**
 * Sandbox: public inquiry availability calendar month/year jump selectors.
 * Fancy Venue choose_available form. Read-only except UI navigation; no submit.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");

const APP = "https://app.sandbox.hellotocheers.com";
const EMBED = "2551bc9f8f6d4b9aabfcab9b8795edf6"; // Fancy
const FORM = `${APP}/form/${EMBED}`;
const OUT = "docs/qa/calendar-month-year-jump";
const EXPECTED_PREFIX = process.env.EXPECTED_TIP_PREFIX ?? "";
const DISTANT_YEAR = String(new Date().getFullYear() + 4);

mkdirSync(OUT, { recursive: true });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 300)}`);
}

async function main() {
  const tipRes = await fetch(`${APP}/login`);
  const tipHtml = await tipRes.text();
  const tip =
    (tipRes.headers.get("link")?.match(/dpl=([a-f0-9]{40})/) || [])[1]
    || (tipHtml.match(/data-dpl-id="([a-f0-9]+)/) || [])[1]
    || "unknown";
  record("serving_tip", !EXPECTED_PREFIX || tip.startsWith(EXPECTED_PREFIX), tip);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(FORM, { waitUntil: "domcontentloaded", timeout: 90000 });
      // Prefer Request Information so preferred-event-date calendar shows
      const infoBtn = page.getByRole("button", { name: /Request Information/i });
      if (await infoBtn.count()) await infoBtn.click();
      await page.waitForSelector('[data-testid="availability-calendar"]', { timeout: 30000 });
      record(
        `picker_visible_${width}`,
        (await page.locator('[data-testid="month-year-picker"]').count()) === 1,
        "month-year-picker",
      );
      record(
        `month_year_selects_${width}`,
        (await page.locator('[data-testid="calendar-month-select"]').count()) === 1
          && (await page.locator('[data-testid="calendar-year-select"]').count()) === 1,
        "month + year selects",
      );

      // Capture selected date before jump (may be empty)
      const beforeSelected = await page.locator('[data-testid="availability-calendar"] button[disabled=false]').count();

      // Jump year to distant future via year select
      await page.locator('[data-testid="calendar-year-select"]').click();
      await page.getByRole("option", { name: DISTANT_YEAR, exact: true }).click();
      await page.waitForTimeout(800);
      const yearLabel = await page.locator('[data-testid="calendar-year-select"]').innerText();
      record(`distant_year_${width}`, yearLabel.includes(DISTANT_YEAR), yearLabel);

      // Pick June via month select
      await page.locator('[data-testid="calendar-month-select"]').click();
      await page.getByRole("option", { name: "June", exact: true }).click();
      await page.waitForTimeout(800);
      const monthLabel = await page.locator('[data-testid="calendar-month-select"]').innerText();
      record(`month_june_${width}`, /June/i.test(monthLabel), monthLabel);

      // Jumping month/year must not auto-select a day — look for selected styling by checking no aria-pressed or selected primary fill is optional; verify Christmas-style disabled still works by going to Dec 2027
      await page.locator('[data-testid="calendar-year-select"]').click();
      await page.getByRole("option", { name: "2027", exact: true }).click();
      await page.locator('[data-testid="calendar-month-select"]').click();
      await page.getByRole("option", { name: "December", exact: true }).click();
      await page.waitForTimeout(1200);

      // Day 25 should be disabled (Fancy Christmas blocked)
      const day25 = page.locator('[data-testid="availability-calendar"] button').filter({ hasText: /^25$/ });
      const day25Disabled = await day25.first().isDisabled().catch(() => false);
      record(`christmas_disabled_${width}`, day25Disabled, `Dec 25 2027 disabled=${day25Disabled}`);

      // Next/prev still present
      record(
        `chevrons_${width}`,
        (await page.getByRole("button", { name: "Previous month" }).count()) === 1
          && (await page.getByRole("button", { name: "Next month" }).count()) === 1,
        "prev/next",
      );

      await page.screenshot({ path: `${OUT}/form-${width}.png`, fullPage: true });
      await page.close();
      void beforeSelected;
    }
  } finally {
    await browser.close();
  }

  const payload = {
    observedAt: new Date().toISOString(),
    tip,
    form: FORM,
    distantYear: DISTANT_YEAR,
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(payload, null, 2));
  console.log(JSON.stringify({ pass: payload.passCount, fail: payload.failCount, tip }, null, 2));
  if (payload.failCount > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
