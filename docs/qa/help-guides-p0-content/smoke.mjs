/**
 * Help & Guides P0 content browser smoke.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/qa/help-guides-p0-content");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";

const EXPECTED_NEW = [
  "getting-started-what-to-set-up-before-i-start",
  "how-does-my-pipeline-work",
  "can-i-customize-my-pipeline-stages",
  "what-happens-when-i-move-a-lead-into-a-stage-with-an-automation",
  "whats-the-difference-between-a-lead-and-a-client",
  "who-signs-a-contract-first-and-what-happens-after",
  "can-more-than-one-person-sign-a-contract",
  "can-couples-pay-online",
  "what-do-sent-paid-and-void-mean-on-an-invoice",
  "whats-the-difference-between-a-package-inventory-and-an-inventory-template",
  "what-do-the-floor-plan-studio-icons-mean",
  "how-do-i-move-an-object-thats-behind-another-one",
  "what-is-an-automation",
  "can-i-pause-an-automation-for-just-one-person",
  "why-did-this-person-get-this-message",
  "what-happens-to-an-automation-if-someone-is-marked-lost-cancelled-or-books",
  "where-do-my-venue-colors-actually-show-up",
  "how-do-i-start-collecting-inquiries-from-my-website",
];

const AUTOMATION_TITLES = [
  "What is an Automation?",
  "Can I pause an Automation for just one person?",
  "Why did this person get this message?",
  "What happens to an Automation if someone is marked Lost, Cancelled, or books?",
];

const AREAS = [
  "Getting Started",
  "Finding & Booking Clients",
  "Working With Clients",
  "Contracts & Payments",
  "Planning the Event",
  "Building the Event",
  "Event Day",
  "After the Event",
  "Vendors",
  "Your Venue",
  "Reports",
  "Guided Journeys",
];

const results = [];
function check(name, pass, note = "") {
  results.push({ name, pass: !!pass, note });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}${note ? " — " + note : ""}`);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.locator('#email, input[name="email"], input[type="email"]').first().fill(EMAIL);
  await page.locator('#password, input[name="password"], input[type="password"]').first().fill(PASSWORD);
  await page.getByRole("button", { name: /sign in|log in|continue/i }).first().click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  check("login", true, page.url());

  await page.goto(`${BASE}/help`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(OUT, "help-home.png"), fullPage: true });

  const body = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
  for (const area of AREAS) check(`area:${area}`, body.includes(area));
  check("no-Automations-category", !/(^|\n)Automations(\n|$)/.test(body));
  check("first-morning-present", body.includes("Getting Started: Your First Morning"));
  check("existing:Creating Your First Package", body.includes("Creating Your First Package"));
  check("existing:Inviting Your First Couple", body.includes("Inviting Your First Couple"));
  check("existing:Getting Paid, On Time", body.includes("Getting Paid, On Time"));
  check("existing:Turning a Lead into a Signed Client", body.includes("Turning a Lead into a Signed Client"));
  check("existing:Vendor Network", body.includes("Getting the Most from Your Vendor Network"));
  check("lead-capture-present", body.includes("How do I start collecting inquiries from my website?"));

  const fbIdx = body.indexOf("Finding & Booking Clients");
  const after = AREAS.slice(AREAS.indexOf("Finding & Booking Clients") + 1)
    .map((a) => body.indexOf(a, fbIdx + 1))
    .filter((i) => i > fbIdx);
  const sectionEnd = after.length ? Math.min(...after) : body.length;
  const fbSection = body.slice(fbIdx, sectionEnd);
  for (const t of AUTOMATION_TITLES) check(`automation-under-FB:${t}`, fbSection.includes(t));

  for (const slug of EXPECTED_NEW) {
    await page.goto(`${BASE}/help/${slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(300);
    const title = await page.locator("h1").first().innerText().catch(() => "");
    const text = await page.locator("main").innerText().catch(() => "");
    const back = await page.locator('a:has-text("Help & Guides")').count();
    const bad = /not found|404/i.test(title) || /not found/i.test(text);
    check(`article:${slug}`, !bad && title.length > 0 && back > 0, title);
  }

  await page.goto(`${BASE}/help/can-couples-pay-online`, { waitUntil: "domcontentloaded" });
  const stripe = await page.locator("main").innerText();
  check("stripe-has-Connect with Stripe", stripe.includes("Connect with Stripe"));
  check("stripe-screens-may-differ", stripe.includes("Your Stripe screens may look different"));
  check("stripe-no-invented-screen-path", !/Account details →|Submit for verification|Stripe Dashboard → Business/.test(stripe));
  check("stripe-never-paste-credentials", stripe.includes("Never paste your Stripe password, secret API key"));

  await page.goto(`${BASE}/help/getting-started-your-first-morning`, { waitUntil: "domcontentloaded" });
  const fm = await page.locator("main").innerText();
  check("first-morning-unchanged", fm.includes("Check your Dashboard, then your Leads"));

  // Spot-check high-risk titles load
  for (const slug of [
    "can-i-customize-my-pipeline-stages",
    "what-happens-when-i-move-a-lead-into-a-stage-with-an-automation",
    "who-signs-a-contract-first-and-what-happens-after",
    "can-more-than-one-person-sign-a-contract",
    "whats-the-difference-between-a-package-inventory-and-an-inventory-template",
    "what-do-the-floor-plan-studio-icons-mean",
    "can-i-pause-an-automation-for-just-one-person",
    "how-do-i-start-collecting-inquiries-from-my-website",
    "where-do-my-venue-colors-actually-show-up",
  ]) {
    await page.goto(`${BASE}/help/${slug}`, { waitUntil: "domcontentloaded" });
    const t = await page.locator("h1").first().innerText();
    check(`spot:${slug}`, Boolean(t && t.length > 5), t);
  }
} catch (e) {
  check("browser-run", false, String(e));
} finally {
  await browser.close();
}

const pass = results.filter((r) => r.pass).length;
const fail = results.filter((r) => !r.pass).length;
await writeFile(path.join(OUT, "results.json"), JSON.stringify({ pass, fail, results }, null, 2));
console.log(`\nSUMMARY ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
