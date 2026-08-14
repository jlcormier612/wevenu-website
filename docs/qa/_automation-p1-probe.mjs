import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");
function sql(q) {
  return execSync(
    `docker exec -i supabase_db_wevenu-website psql -U postgres -d postgres -t -A -c ${JSON.stringify(String(q).replace(/\s+/g, " ").trim())}`,
    { encoding: "utf8" },
  ).trim();
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:3000/login", { waitUntil: "domcontentloaded" });
await page.fill('input[type="email"]', "owner@example.com");
await page.fill('input[type="password"]', "devpassword123");
await page.click('button[type="submit"]');
await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });

await page.goto(
  "http://localhost:3000/communication/series/172dd27d-1b5b-4717-b131-f2a2cd8bdf18/edit",
  { waitUntil: "networkidle" },
);
await page.getByText("Priya Natarajan").first().waitFor({ timeout: 15000 });
await page.waitForTimeout(2500);
const pause = page.getByRole("button", { name: "Pause" }).first();
console.log("pause count", await pause.count());
page.on("console", (m) => console.log("browser:", m.type(), m.text().slice(0, 200)));
await pause.click();
await page.waitForTimeout(3500);
console.log(
  "paused_at",
  sql("SELECT coalesce(paused_at::text,'NULL') FROM sequence_enrollments WHERE id='b38b340b-25d9-496b-bbb5-05f5be7873f8'"),
);
console.log("body badges", (await page.locator("body").innerText()).match(/Active|Paused|Resumed/g));

await page.goto("http://localhost:3000/leads/55a7d6d1-68e7-442a-8452-66cc8abf44f1", {
  waitUntil: "networkidle",
});
await page.waitForTimeout(1500);
await page.getByRole("button", { name: /Change stage/i }).click();
await page.waitForTimeout(600);
const item = page.getByRole("menuitem", { name: /Proposal Issued/i });
console.log("menuitem", await item.count());
await item.click();
await page.waitForTimeout(2500);
const dlg = page.getByRole("alertdialog");
console.log("dialog", await dlg.count(), await dlg.isVisible().catch(() => false));
if (await dlg.count()) console.log("dlg", (await dlg.innerText()).slice(0, 500));
await page.screenshot({
  path: path.join(ROOT, "docs/qa/automation-p1-browser-evidence/08-pause-confirm-probe.png"),
});
await browser.close();
