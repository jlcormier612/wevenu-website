import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const require = createRequire(path.join(ROOT, "package.json"));
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  const m = createRequire(path.join(ROOT, "marketing/package.json"));
  ({ chromium } = m("playwright"));
}

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL ?? "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD ?? "devpassword123";
const OUT = path.join(ROOT, "docs/qa/help-guides-phase-1");
await mkdir(OUT, { recursive: true });

const results = [];
function check(name, pass, note = "") {
  results.push({ name, pass: !!pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator("#email, input[name=\"email\"], input[type=\"email\"]").first().fill(EMAIL);
  await page.locator("#password, input[name=\"password\"], input[type=\"password\"]").first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  check("login", true, page.url());

  const helpNav = page.getByRole("link", { name: /Help & Guides/i }).first();
  check("nav-help-guides", await helpNav.count() > 0);
  check("nav-no-success-library", (await page.getByRole("link", { name: /^Success Library$/i }).count()) === 0);

  await helpNav.click();
  await page.waitForURL(/\/help$/, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "01-home.png"), fullPage: true });
  const body = await page.getByRole("main").innerText();
  check("home-title", /Help & Guides/i.test(body));
  check("home-tagline", /Quick answers for using Hello to Cheers/i.test(body));
  const areas = [
    "Getting Started", "Finding & Booking Clients", "Working With Clients", "Contracts & Payments",
    "Planning the Event", "Building the Event", "Event Day", "After the Event", "Vendors",
    "Your Venue", "Reports", "Guided Journeys",
  ];
  const missing = areas.filter((a) => !body.includes(a));
  check("twelve-areas", missing.length === 0, missing.join(", ") || "all present");
  check("empty-state-copy", /Guides for this area are coming soon/i.test(body));
  check("no-luv-owns-title", !/Luv'?s Success Library/i.test(body));

  await page.goto(`${BASE}/help/getting-paid-on-time`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "02-article-paid.png"), fullPage: true });
  const a1 = await page.getByRole("main").innerText();
  check("article-1", /Getting Paid, On Time/i.test(a1) && /Contracts & Payments/i.test(a1));
  check("article-best-practice", /Best Practice/i.test(a1));
  const back = page.getByRole("main").getByRole("link", { name: /Help & Guides/i }).first();
  check("article-back-link", await back.count() > 0);
  await back.click();
  await page.waitForURL(/\/help\/?$/, { timeout: 20000 });

  await page.goto(`${BASE}/help/inviting-your-first-couple`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, "03-article-portal.png"), fullPage: true });
  check("article-2", /Inviting Your First Couple/i.test(await page.getByRole("main").innerText()) && /Working With Clients/i.test(await page.getByRole("main").innerText()));

  await page.goto(`${BASE}/success-library`, { waitUntil: "commit", timeout: 20000 });
  await page.waitForTimeout(1500);
  check("legacy-redirect", /\/help\/?$/.test(new URL(page.url()).pathname), page.url());

  await page.goto(`${BASE}/success-library/getting-paid-on-time`, { waitUntil: "commit", timeout: 20000 });
  await page.waitForTimeout(1500);
  check("legacy-slug-redirect", page.url().includes("/help/getting-paid-on-time"), page.url());
} catch (e) {
  check("smoke-exception", false, String(e?.message || e).slice(0, 300));
  await page.screenshot({ path: path.join(OUT, "error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
const report = { at: new Date().toISOString(), base: BASE, summary: { pass, fail, total: results.length }, results };
await writeFile(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary));
process.exit(fail ? 1 : 0);
