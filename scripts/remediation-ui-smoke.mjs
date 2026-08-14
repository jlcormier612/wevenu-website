import playwright from "../marketing/node_modules/playwright/index.js";
import fs from "fs";

const { chromium } = playwright;
const email = "rem-a-1786482835265@example.com";
const password = "devpassword123";
const base = "http://localhost:3000";
const findings = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("pageerror", (e) => findings.push({ type: "pageerror", msg: String(e) }));

async function maybeAcceptWelcome() {
  if (!page.url().includes("/welcome")) return;
  const checkbox = page.locator('input[type="checkbox"]').first();
  if (await checkbox.count()) {
    await checkbox.check({ force: true }).catch(async () => {
      await page.getByText(/I agree|I have reviewed|agree/i).first().click({ force: true }).catch(() => {});
    });
  }
  const continueBtn = page.getByRole("button", { name: /Continue/i }).first();
  if (await continueBtn.count()) {
    await continueBtn.click();
    await page.waitForTimeout(2500);
  }
  findings.push({ type: "welcome", url: page.url() });
  console.log("afterWelcome", page.url());
}

async function visit(path) {
  const res = await page.goto(base + path, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  await maybeAcceptWelcome();
  if (page.url().includes("/welcome")) await maybeAcceptWelcome();
  const status = res?.status() ?? 0;
  const url = page.url();
  const body = await page.locator("body").innerText().catch(() => "");
  const snippet = body.replace(/\s+/g, " ").slice(0, 400);
  findings.push({ type: "nav", path, status, url, snippet });
  console.log(`${status} ${path} -> ${url.replace(base, "")} :: ${snippet.slice(0, 160)}`);
}

await page.goto(base + "/login", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1000);
await page.locator('input[type="email"]').first().fill(email);
await page.locator('input[type="password"]').first().fill(password);
await Promise.all([
  page.waitForURL((u) => !u.pathname.endsWith("/login") || u.search.includes("error"), { timeout: 15000 }).catch(() => {}),
  page.locator('button[type="submit"]').first().click(),
]);
await page.waitForTimeout(2000);
console.log("afterLogin", page.url());
await maybeAcceptWelcome();

const paths = [
  "/library",
  "/library/brochures",
  "/packages",
  "/reporting/saved",
  "/reporting/sales",
  "/reporting/bookings",
  "/reporting/revenue",
  "/reporting/events",
  "/guide",
  "/library/timeline-templates",
  "/library/floor-plan-templates",
  "/library/event-order-templates",
  "/library/contracts",
  "/library/questionnaire-templates",
  "/library/inventory",
  "/communication/templates",
  "/library/payment-schedules",
];

for (const p of paths) {
  try {
    await visit(p);
  } catch (e) {
    findings.push({ type: "nav-error", path: p, msg: String(e) });
    console.log("ERR", p, e.message);
  }
}

try {
  await page.goto(base + "/library/brochures", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await maybeAcceptWelcome();
  const link = page.locator('a[href*="/library/brochures/"]').first();
  if (await link.count()) {
    await link.click();
    await page.waitForTimeout(1500);
    const text = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    findings.push({ type: "brochure-detail", url: page.url(), snippet: text.slice(0, 600) });
    console.log("brochure-detail", text.slice(0, 240));
  } else {
    findings.push({ type: "brochure-detail", url: page.url(), snippet: "NO_LINK", body: (await page.locator("body").innerText()).slice(0, 400) });
  }
} catch (e) {
  findings.push({ type: "brochure-detail-error", msg: String(e) });
}

try {
  await page.goto(base + "/packages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await maybeAcceptWelcome();
  const text = await page.locator("body").innerText();
  findings.push({
    type: "packages-copy",
    hasSetYourPrice: /Set your price/i.test(text),
    hasPricedReady: /priced, ready/i.test(text),
    snippet: text.replace(/\s+/g, " ").slice(0, 600),
  });
  console.log("packages", {
    hasSetYourPrice: /Set your price/i.test(text),
    hasPricedReady: /priced, ready/i.test(text),
  });
} catch (e) {
  findings.push({ type: "packages-error", msg: String(e) });
}

try {
  await page.goto(base + "/reporting/saved", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await maybeAcceptWelcome();
  const text = await page.locator("body").innerText();
  findings.push({
    type: "saved-reports-ui",
    hasSales: /\bSales\b/.test(text),
    hasBookings: /\bBookings\b/.test(text),
    hasRevenue: /\bRevenue\b/.test(text),
    hasEvents: /\bEvents\b/.test(text),
    hasStarter: /Starter/.test(text),
    snippet: text.replace(/\s+/g, " ").slice(0, 600),
  });
  console.log("saved-reports", {
    hasSales: /\bSales\b/.test(text),
    hasBookings: /\bBookings\b/.test(text),
    hasRevenue: /\bRevenue\b/.test(text),
    hasEvents: /\bEvents\b/.test(text),
    hasStarter: /Starter/.test(text),
  });
} catch (e) {
  findings.push({ type: "saved-reports-error", msg: String(e) });
}

fs.writeFileSync("docs/qa/starter-library-remediation-ui-smoke.json", JSON.stringify({ afterLogin: page.url(), findings }, null, 2));
await browser.close();
console.log("done");
