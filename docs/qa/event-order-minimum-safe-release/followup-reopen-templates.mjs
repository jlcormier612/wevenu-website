/**
 * Follow-up UI checks: templates production-safe names + reopen after finalize.
 * Always restores event_order_enabled = false and deletes the temp Event Order.
 */
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
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

const results = [];
function check(name, pass, note = "") {
  results.push({ name, pass: !!pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
}

await mkdir(OUT, { recursive: true });

const badTemplates = sql(
  `select coalesce(string_agg(name, ' | '), '') from event_order_templates where name ~* '(test|d7a|cert|dev|dummy|qa|sample)'`,
);
check("templates-no-dev-names-db", badTemplates === "", badTemplates || "none");

const sweetNames = sql(
  `select coalesce(string_agg(name, ' | ' order by name), '') from event_order_templates where venue_id = '${VENUE_ID}' and is_archived = false`,
);
check(
  "sweet-daisy-templates-production-names",
  /Standard Wedding Event Order/.test(sweetNames) && /Reception Only/.test(sweetNames) && !/CERT|Test|D7A/i.test(sweetNames),
  sweetNames,
);

sql(`update venues set event_order_enabled = true where id = '${VENUE_ID}'`);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
let createdOrderId = "";

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('#email, input[name="email"], input[type="email"]').first().fill(EMAIL);
  await page.locator('#password, input[name="password"], input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });

  await page.goto(`${BASE}/library/event-order-templates`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1000);
  const libText = await page.locator("main").innerText();
  check(
    "library-templates-no-dev-names",
    !/\b(CERT|D7A|Test Wedding|dev)\b/i.test(libText) && /Standard Wedding/i.test(libText),
    libText.slice(0, 200),
  );

  const eventId = sql(`select e.id from events e where e.venue_id = '${VENUE_ID}' order by e.created_at desc nulls last limit 1`);
  const clientId = eventId ? sql(`select client_id from events where id = '${eventId}'`) : "";
  check("has-event", Boolean(eventId && clientId), `${eventId}|${clientId}`);

  if (eventId && clientId) {
    // Ensure no leftover order on this event
    sql(`delete from event_orders where event_id = '${eventId}'`);

    await page.goto(`${BASE}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1200);
    const tab = page.getByRole("button", { name: /^Event Order$/i }).or(page.getByRole("tab", { name: /Event Order/i }));
    if (await tab.count()) await tab.first().click();
    await page.waitForTimeout(800);

    let body = await page.locator("main").innerText();
    if (/No Event Order yet/i.test(body)) {
      const startBtn = page.getByRole("button", { name: /Start Event Order/i });
      if (await startBtn.count()) {
        const select = page.locator('[role="combobox"]').first();
        if (await select.count()) {
          await select.click().catch(() => {});
          await page.getByRole("option").filter({ hasText: /Standard Wedding Event Order/i }).first().click().catch(() => {});
        }
        await startBtn.click();
        await page.waitForTimeout(3500);
      }
    }

    createdOrderId = sql(`select id from event_orders where event_id = '${eventId}' limit 1`);
    check("order-created", Boolean(createdOrderId), createdOrderId);
    const lineCount = createdOrderId
      ? sql(`select count(*) from event_order_lines where event_order_id = '${createdOrderId}'`)
      : "0";
    check("order-has-lines", Number(lineCount) > 0, lineCount);

    const finalize = page.getByRole("button", { name: /^Finalize$/i });
    check("finalize-available", await finalize.count() > 0 && !(await finalize.first().isDisabled()));
    if (await finalize.count() && !(await finalize.first().isDisabled())) {
      await finalize.first().click({ timeout: 5000 });
      await page.waitForTimeout(700);
      const dialog = page.getByRole("alertdialog");
      if (await dialog.count()) {
        await dialog.getByRole("button", { name: /Continue — Finalize/i }).click();
        await page.waitForTimeout(2500);
      }
    }

    body = await page.locator("main").innerText();
    check("finalized-state", /Finalized/i.test(body));
    check("add-line-hidden-when-finalized", !(await page.getByRole("button", { name: /\+?\s*Add Line/i }).count()));

    const reopen = page.getByRole("button", { name: /Reopen for Editing/i });
    check("reopen-available", await reopen.count() > 0);
    if (await reopen.count()) {
      await reopen.first().click();
      await page.waitForTimeout(2500);
      const statusAfter = sql(`select status from event_orders where id = '${createdOrderId}'`);
      check("db-status-open-after-reopen", statusAfter === "open", statusAfter);
      check("finalize-available-after-reopen", await page.getByRole("button", { name: /^Finalize$/i }).count() > 0);
      check("add-line-visible-after-reopen", (await page.getByRole("button", { name: /\+?\s*Add Line/i }).count()) > 0);
    }

    await page.screenshot({ path: path.join(OUT, "06-reopen-templates-followup.png"), fullPage: true });
  }
} catch (e) {
  check("followup-run", false, String(e));
} finally {
  if (createdOrderId) sql(`delete from event_orders where id = '${createdOrderId}'`);
  sql(`update venues set event_order_enabled = false where id = '${VENUE_ID}'`);
  const remaining = sql(`select count(*) from event_orders where venue_id = '${VENUE_ID}'`);
  const flag = sql(`select event_order_enabled from venues where id = '${VENUE_ID}'`);
  check("cleanup-orders-gone", remaining === "0", remaining);
  check("flag-restored-false", flag === "f" || flag === "false", flag);
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
await writeFile(path.join(OUT, "results-followup.json"), JSON.stringify({ pass, fail, results }, null, 2));
console.log(`\nSUMMARY ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
