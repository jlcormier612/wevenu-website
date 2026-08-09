/**
 * Live QA — Couple Tasks Impl 3 Exact Workspace Routing.
 * Run: node docs/qa/couple-task-workspace-routing-impl3/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const TOKEN = process.env.PORTAL_TOKEN ?? "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;

const HASH_CASES = [
  { hash: "guests/finalize", focusId: "portal-focus-guests-finalize", marker: /Guest Count/i },
  { hash: "vendors/pick", focusId: "portal-focus-vendors-pick", marker: /Recommended for You|Preferred Vendors|trusts and loves/i },
  { hash: "seating/submit", focusId: "portal-focus-seating-submit", marker: /Submit Seating|seating/i },
  { hash: "timeline/submit", focusId: "portal-focus-timeline-submit", marker: /Timeline Status|Submit Timeline/i },
  { hash: "documents/sign", focusId: "portal-focus-documents-sign", marker: /Contract|signature|Documents/i },
  { hash: "questionnaire/form", focusId: "portal-focus-questionnaire-form", marker: /final details|questionnaire|Nothing waiting/i },
];

async function dismissLegal(page) {
  for (const name of [/Accept/i, /I agree/i, /Continue/i, /Acknowledge/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) {
      try { await btn.click({ timeout: 1500 }); await page.waitForTimeout(800); } catch { /* ignore */ }
    }
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  console.log("wrote", name);
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
}

async function captureViewport(browser, viewport, prefix) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);
  const results = { viewport, hashLandings: {}, ctaClicks: {}, home: {}, paymentsUnchanged: {}, incompleteAfterNav: {} };

  await page.goto(PORTAL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await dismissLegal(page);
  await page.waitForTimeout(1500);

  const nextSteps = page.locator("#your-next-steps");
  if (await nextSteps.count()) {
    await nextSteps.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, `${prefix}-home-next-steps.png`);
  const homeText = await bodyText(page);
  const homeBtns = await page.locator("button").allInnerTexts();
  results.home = {
    leftMatch: homeText.match(/(\d+) left for/)?.[1] ?? null,
    completeCtas: homeBtns.filter((b) => /^Complete$/i.test(b.trim())).length,
    reviewCtas: homeBtns.filter((b) => /^Review$/i.test(b.trim())).length,
    submitCtas: homeBtns.filter((b) => /^Submit$/i.test(b.trim())).length,
    payCtas: homeBtns.filter((b) => /^Pay$/i.test(b.trim())).length,
    nextStepsSnippet: (homeText.match(/Your Next Steps[\s\S]{0,1000}/)?.[0] ?? "").slice(0, 1000),
  };

  await page.getByRole("button", { name: /Tasks/i }).first().click();
  await page.waitForTimeout(2200);
  await shot(page, `${prefix}-tasks.png`);
  const tasksText = await bodyText(page);
  const openSlice = tasksText.split(/COMPLETED/i)[0] ?? tasksText;
  results.tasks = {
    submitGuestCount: /Submit guest count/i.test(openSlice),
    addVendors: /Add vendors/i.test(openSlice),
    submitSeating: /Submit seating/i.test(openSlice),
    submitTimeline: /Submit timeline/i.test(openSlice),
    reviewSign: /Review & sign/i.test(openSlice),
    completeForm: /Complete form/i.test(openSlice),
    markComplete: (openSlice.match(/Mark complete/gi) || []).length,
    payNow: (openSlice.match(/Pay now/gi) || []).length,
    openHasChecklistFinalPayment: /\bFinal payment\b/.test(openSlice),
    sample: openSlice.slice(0, 1600),
  };

  const ctaMap = [
    { label: /Submit guest count/i, focusId: "portal-focus-guests-finalize", key: "guest_count" },
    { label: /Add vendors/i, focusId: "portal-focus-vendors-pick", key: "vendors" },
    { label: /Submit seating/i, focusId: "portal-focus-seating-submit", key: "seating" },
    { label: /Submit timeline/i, focusId: "portal-focus-timeline-submit", key: "timeline" },
    { label: /Review & sign/i, focusId: "portal-focus-documents-sign", key: "contract" },
    { label: /Complete form/i, focusId: "portal-focus-questionnaire-form", key: "questionnaire" },
  ];

  for (const c of ctaMap) {
    await page.goto(`${PORTAL}#tasks`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1800);
    await dismissLegal(page);
    const btn = page.getByRole("button", { name: c.label }).first();
    const found = await btn.count();
    if (!found) {
      results.ctaClicks[c.key] = { found: false };
      continue;
    }
    await btn.click();
    await page.waitForTimeout(2200);
    const hash = await page.evaluate(() => location.hash);
    const focusPresent = await page.evaluate((id) => !!document.getElementById(id), c.focusId);
    await shot(page, `${prefix}-cta-${c.key}.png`);
    results.ctaClicks[c.key] = {
      found: true,
      hash,
      focusPresent,
      url: page.url(),
    };
  }

  for (const h of HASH_CASES) {
    await page.goto(`${PORTAL}#${h.hash}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    await dismissLegal(page);
    await page.waitForTimeout(800);
    const text = await bodyText(page);
    const focusPresent = await page.evaluate((id) => !!document.getElementById(id), h.focusId);
    results.hashLandings[h.hash] = {
      focusPresent,
      marker: h.marker.test(text),
      hash: await page.evaluate(() => location.hash),
      sample: text.slice(0, 280),
    };
  }

  const tasksApi = await page.evaluate(async (token) => {
    const r = await fetch(`/api/portal/tasks?token=${token}`);
    return r.json();
  }, TOKEN);
  const guestTask = (tasksApi.tasks || []).find((t) => t.autoCompleteTrigger === "guest_count_finalized");
  const timelineTask = (tasksApi.tasks || []).find((t) => t.autoCompleteTrigger === "timeline_submitted");
  results.incompleteAfterNav = {
    guestStatus: guestTask?.status ?? null,
    guestCanComplete: guestTask?.canComplete ?? null,
    timelineStatus: timelineTask?.status ?? null,
    timelineCanComplete: timelineTask?.canComplete ?? null,
  };

  if (guestTask?.id) {
    results.manualCompleteBlocked = await page.evaluate(async ({ token, taskId }) => {
      const r = await fetch("/api/portal/complete-task", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, taskId }),
      });
      return { status: r.status, body: await r.json().catch(() => null) };
    }, { token: TOKEN, taskId: guestTask.id });
  }

  await page.goto(`${PORTAL}#payments`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1800);
  await shot(page, `${prefix}-payments.png`);
  const payText = await bodyText(page);
  results.paymentsUnchanged = {
    hasRemaining12960: /\$12,960|12960/.test(payText),
    hasFirst: /First Installment/.test(payText),
    hasFinal: /Final Payment/.test(payText),
    payNowCount: (payText.match(/Pay now|Pay Now/gi) || []).length,
  };

  await page.goto(PORTAL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await dismissLegal(page);
  const homeSubmit = page.getByRole("button", { name: /^Submit$/i }).first();
  if (await homeSubmit.count()) {
    await homeSubmit.click();
    await page.waitForTimeout(2000);
    results.home.reviewPath = {
      hash: await page.evaluate(() => location.hash),
      focusPresent: await page.evaluate(
        () => !!document.getElementById("portal-focus-guests-finalize")
          || !!document.getElementById("portal-focus-timeline-submit"),
      ),
    };
    await shot(page, `${prefix}-home-submit-landing.png`);
  }

  await ctx.close();
  return results;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await captureViewport(browser, { width: 1440, height: 900 }, "01-desktop");
  const mobile = await captureViewport(browser, { width: 390, height: 844 }, "02-mobile");
  const results = {
    workPackage: "Couple Tasks – Implementation 3 – Exact Workspace Routing",
    portal: PORTAL,
    desktop,
    mobile,
  };
  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    desktopCtas: desktop.ctaClicks,
    desktopHashes: Object.fromEntries(Object.entries(desktop.hashLandings).map(([k, v]) => [k, { focusPresent: v.focusPresent, marker: v.marker }])),
    home: desktop.home,
    incomplete: desktop.incompleteAfterNav,
    manual: desktop.manualCompleteBlocked,
    payments: desktop.paymentsUnchanged,
    mobileCtaKeys: Object.keys(mobile.ctaClicks),
  }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
