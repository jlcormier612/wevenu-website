/**
 * Help & Guides — Event Day / After the Event / Reports browser smoke.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/qa/help-guides-event-day-after-reports");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";

const EXPECTED_NEW = [
  { slug: "event-day-sheet", title: "What is the Day Sheet, and how do I get one?", category: "Event Day" },
  { slug: "wedding-day-dashboard", title: "What is the Wedding Day Dashboard, and when do I use it?", category: "Event Day" },
  { slug: "event-day-tasks", title: "Where do I see my event-day tasks?", category: "Event Day" },
  { slug: "mark-event-complete", title: "How do I mark an event complete, and what happens when I do?", category: "After the Event" },
  { slug: "post-event-feedback", title: "How do I collect feedback from a couple after their event?", category: "After the Event" },
  { slug: "what-can-i-see-in-reports", title: "What can I see in Reports?", category: "Reports" },
  { slug: "which-report-should-i-use", title: "Which report should I use for a specific question?", category: "Reports" },
  { slug: "save-a-report", title: "How do I save a report and find it again later?", category: "Reports" },
];

const PRESERVED_24 = [
  "Getting Started: Your First Morning",
  "What should I set up before I start?",
  "Creating Your First Package",
  "Inviting Your First Couple to Their Portal",
  "Getting Paid, On Time",
  "Turning a Lead into a Signed Client",
  "Getting the Most from Your Vendor Network",
  "How does my Pipeline work?",
  "Can I customize my Pipeline stages?",
  "What happens when I move a lead into a stage with an Automation?",
  "What's the difference between a Lead and a Client?",
  "Who signs a contract first, and what happens after?",
  "Can more than one person sign a contract?",
  "Can couples pay online?",
  "What do Sent, Paid, and Void mean on an invoice?",
  "What's the difference between a Package, Inventory, and an Inventory Template?",
  "What do the Floor Plan Studio icons mean?",
  "How do I move an object that's behind another one?",
  "What is an Automation?",
  "Can I pause an Automation for just one person?",
  "Why did this person get this message?",
  "What happens to an Automation if someone is marked Lost, Cancelled, or books?",
  "Where do my venue colors actually show up?",
  "How do I start collecting inquiries from my website?",
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

function sectionFor(body, area) {
  const idx = body.indexOf(area);
  if (idx < 0) return "";
  const after = AREAS.slice(AREAS.indexOf(area) + 1)
    .map((a) => body.indexOf(a, idx + 1))
    .filter((i) => i > idx);
  const end = after.length ? Math.min(...after) : body.length;
  return body.slice(idx, end);
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
  await page.screenshot({ path: path.join(OUT, "01-help-home.png"), fullPage: true });

  const body = await page.locator("main").innerText().catch(() => page.locator("body").innerText());
  check("areas-count-12", AREAS.every((a) => body.includes(a)), String(AREAS.filter((a) => body.includes(a)).length));
  for (const area of AREAS) check(`area:${area}`, body.includes(area));

  const guided = sectionFor(body, "Guided Journeys");
  const guidedArticles = EXPECTED_NEW.filter((a) => guided.includes(a.title));
  check("guided-journeys-empty", guidedArticles.length === 0 && !/What is|How do I|Where do I|Which /.test(guided.replace("Guided Journeys", "").replace("Multi-step paths across Hello to Cheers.", "")), guided.slice(0, 120));

  const eventDay = sectionFor(body, "Event Day");
  const afterEvent = sectionFor(body, "After the Event");
  const reports = sectionFor(body, "Reports");
  check(
    "event-day-has-3",
    EXPECTED_NEW.filter((a) => a.category === "Event Day").every((a) => eventDay.includes(a.title)),
    eventDay.slice(0, 200),
  );
  check(
    "after-the-event-has-2",
    EXPECTED_NEW.filter((a) => a.category === "After the Event").every((a) => afterEvent.includes(a.title)),
    afterEvent.slice(0, 200),
  );
  check(
    "reports-has-3",
    EXPECTED_NEW.filter((a) => a.category === "Reports").every((a) => reports.includes(a.title)),
    reports.slice(0, 200),
  );

  for (const title of PRESERVED_24) {
    check(`preserved:${title.slice(0, 40)}`, body.includes(title));
  }

  await page.screenshot({ path: path.join(OUT, "02-event-day-section.png"), fullPage: true });

  let i = 3;
  for (const article of EXPECTED_NEW) {
    await page.goto(`${BASE}/help/${article.slug}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(300);
    const title = await page.locator("h1").first().innerText().catch(() => "");
    const text = await page.locator("main").innerText().catch(() => "");
    const cat = await page.locator("main").locator("p").first().innerText().catch(() => "");
    const back = await page.locator('a:has-text("Help & Guides")').count();
    const bad = /not found|404/i.test(title) || /not found/i.test(text);
    check(`article:${article.slug}`, !bad && title === article.title && back > 0, title);
    check(`article-category:${article.slug}`, cat.toLowerCase().includes(article.category.toLowerCase()), cat);
    await page.screenshot({ path: path.join(OUT, `${String(i).padStart(2, "0")}-${article.slug}.png`), fullPage: true });
    i += 1;

    await page.locator('a:has-text("Help & Guides")').first().click();
    await page.waitForURL((u) => u.pathname === "/help" || u.pathname.endsWith("/help"), { timeout: 15000 });
    check(`back-nav:${article.slug}`, page.url().includes("/help") && !page.url().includes(article.slug), page.url());
  }
} catch (err) {
  check("smoke-error", false, String(err && err.message ? err.message : err));
  await page.screenshot({ path: path.join(OUT, "99-error.png"), fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  const summary = { passed, failed, total: results.length, results };
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(summary, null, 2));
  console.log(`\n${passed}/${results.length} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
