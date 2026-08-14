/**
 * Live QA — Couple Tasks Impl 2 Payment Attention / Final Payment Twin.
 * Run: node docs/qa/couple-task-payment-attention-impl2/capture.mjs
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

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
}

function countLabel(text, re) {
  return (text.match(re) || []).length;
}

async function captureViewport(browser, viewport, prefix) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(PORTAL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  // Home Next Steps
  const nextSteps = page.locator("#your-next-steps");
  if (await nextSteps.count()) {
    await nextSteps.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, `${prefix}-home-next-steps.png`);

  const homeText = await page.locator("body").innerText();
  const homeBtns = await page.locator("button").allInnerTexts();

  // Tasks
  const tasksNav = page.getByRole("button", { name: /Tasks/i }).first();
  await tasksNav.click();
  await page.waitForTimeout(2000);
  await shot(page, `${prefix}-tasks.png`);
  const tasksText = await page.locator("body").innerText();

  // Payments
  const payNav = page.getByRole("button", { name: /Payments/i }).first();
  await payNav.click();
  await page.waitForTimeout(2000);
  await shot(page, `${prefix}-payments.png`);
  const paymentsText = await page.locator("body").innerText();

  await ctx.close();

  const openVenueFinal =
    /Final payment\b/.test(tasksText) &&
    !tasksText.includes("Final payment") === false;
  // Checklist twin title vs ledger title
  const hasChecklistFinalPaymentPayNow =
    /Final payment[\s\S]{0,120}Pay now/i.test(tasksText);
  const hasLedgerFinalPaymentPayNow =
    /Final Payment[\s\S]{0,160}Pay now/i.test(tasksText);
  // More precise: open section sample before COMPLETED
  const openSlice = tasksText.split(/COMPLETED/i)[0] ?? tasksText;

  return {
    viewport,
    home: {
      text: homeText.slice(0, 2500),
      nextStepsSnippet: (homeText.match(/Your Next Steps[\s\S]{0,900}/)?.[0] ?? "").slice(0, 900),
      leftMatch: homeText.match(/(\d+) left for/)?.[1] ?? null,
      hasChecklistFinalInNextSteps: /Final payment\s+Required/.test(homeText),
      hasLedgerFinalInNextSteps: /Final Payment/.test(
        (homeText.match(/Your Next Steps[\s\S]{0,900}/)?.[0] ?? ""),
      ),
      payCtas: homeBtns.filter((b) => /^Pay$/i.test(b.trim())).length,
      reviewCtas: homeBtns.filter((b) => /^Review$/i.test(b.trim())).length,
      completeCtas: homeBtns.filter((b) => /^Complete$/i.test(b.trim())).length,
      submitCtas: homeBtns.filter((b) => /^Submit$/i.test(b.trim())).length,
    },
    tasks: {
      sample: openSlice.slice(0, 1800),
      payNow: countLabel(openSlice, /Pay now/gi),
      markComplete: countLabel(openSlice, /Mark complete/gi),
      openHasChecklistFinalPayment: /\bFinal payment\b/.test(openSlice),
      openHasLedgerFinalPayment: /\bFinal Payment\b/.test(openSlice),
      hasChecklistFinalPaymentPayNow,
      hasLedgerFinalPaymentPayNow,
    },
    payments: {
      sample: paymentsText.slice(0, 1200),
      hasRemaining12960: /\$12,960|12960/.test(paymentsText),
      hasFirst: /First Installment/.test(paymentsText),
      hasSecond: /Second Installment/.test(paymentsText),
      hasFinal: /Final Payment/.test(paymentsText),
      payNowCount: countLabel(paymentsText, /Pay now|Pay Now/gi),
    },
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const desktop = await captureViewport(browser, { width: 1440, height: 900 }, "01-desktop");
  const mobile = await captureViewport(browser, { width: 390, height: 844 }, "02-mobile");

  const results = {
    beforeReference: {
      source: "docs/qa/couple-task-verified-action-completion/qa-results.json (Impl 1)",
      homeLeft: 9,
      homeHadChecklistFinalPayment: true,
      tasksPayNow: 4,
      tasksOpenHadChecklistFinalPayment: true,
      tasksOpenHadLedgerFinalPayment: true,
    },
    desktop,
    mobile,
    checklist: {
      tasksOnlyLedgerFinalPayNow:
        desktop.tasks.openHasLedgerFinalPayment &&
        !desktop.tasks.openHasChecklistFinalPayment &&
        mobile.tasks.openHasLedgerFinalPayment &&
        !mobile.tasks.openHasChecklistFinalPayment,
      homeTwinNotConsumingNextSteps:
        !desktop.home.hasChecklistFinalInNextSteps &&
        !mobile.home.hasChecklistFinalInNextSteps,
      paymentsUnchanged:
        desktop.payments.hasRemaining12960 &&
        desktop.payments.hasFirst &&
        desktop.payments.hasSecond &&
        desktop.payments.hasFinal &&
        mobile.payments.hasRemaining12960,
      homeNoCompleteCta:
        desktop.home.completeCtas === 0 && mobile.home.completeCtas === 0,
    },
  };

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results.checklist, null, 2));
  console.log(
    "home left desktop/mobile:",
    desktop.home.leftMatch,
    mobile.home.leftMatch,
  );
  console.log(
    "tasks checklist/ledger final:",
    desktop.tasks.openHasChecklistFinalPayment,
    desktop.tasks.openHasLedgerFinalPayment,
    "payNow",
    desktop.tasks.payNow,
  );

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
