/**
 * Live QA portal screenshots — Impl 7 Final Payment verified completion.
 * Run: node docs/qa/couple-task-final-payment-impl7/capture.mjs [phase]
 * phase: before | after-first | after-final | after-refresh
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
const PHASE = process.argv[2] ?? "before";

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
}

function analyze(tasksText, homeText, paymentsText) {
  const openSlice = tasksText.split(/COMPLETED/i)[0] ?? tasksText;
  const next = homeText.match(/Your Next Steps[\s\S]{0,1200}/)?.[0] ?? "";
  return {
    home: {
      leftMatch: homeText.match(/(\d+) left for/)?.[1] ?? null,
      nextStepsSnippet: next.slice(0, 900),
      hasChecklistFinalInNextSteps: /Final payment\s+Required/i.test(next),
      hasLedgerFinalInNextSteps: /\bFinal Payment\b/.test(next),
      payNowInNextSteps: /Pay now|Pay\b/i.test(next),
    },
    tasks: {
      sample: openSlice.slice(0, 2000),
      payNow: (openSlice.match(/Pay now/gi) || []).length,
      openHasChecklistFinalPayment: /\bFinal payment\b/.test(openSlice),
      openHasLedgerFinalPayment: /\bFinal Payment\b/.test(openSlice),
      openHasChecklistFinalPayNow: /Final payment[\s\S]{0,160}Pay now/i.test(openSlice),
      openHasLedgerFinalPayNow: /Final Payment[\s\S]{0,160}Pay now/i.test(openSlice),
      completedHasFinalPayment: /COMPLETED[\s\S]*Final payment/i.test(tasksText),
    },
    payments: {
      sample: paymentsText.slice(0, 1500),
      hasFirstUnpaid: /First Installment[\s\S]{0,200}(Pay now|Overdue|Pending)/i.test(paymentsText),
      hasFinalUnpaid: /Final Payment[\s\S]{0,200}(Pay now|Pending|Overdue)/i.test(paymentsText),
      hasFinalPaid: /Final Payment[\s\S]{0,200}Paid/i.test(paymentsText),
    },
  };
}

async function captureViewport(browser, viewport, prefix) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60000);

  await page.goto(PORTAL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);

  const nextSteps = page.locator("#your-next-steps");
  if (await nextSteps.count()) {
    await nextSteps.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
  }
  await shot(page, `${prefix}-home-next-steps.png`);
  const homeText = await page.locator("body").innerText();

  await page.getByRole("button", { name: /Tasks/i }).first().click();
  await page.waitForTimeout(2000);
  await shot(page, `${prefix}-tasks.png`);
  const tasksText = await page.locator("body").innerText();

  await page.getByRole("button", { name: /Payments/i }).first().click();
  await page.waitForTimeout(2000);
  await shot(page, `${prefix}-payments.png`);
  const paymentsText = await page.locator("body").innerText();

  // Luv / Memories if present
  const luvBtn = page.getByRole("button", { name: /Luv|Memories/i }).first();
  let luvText = "";
  if (await luvBtn.count()) {
    await luvBtn.click().catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, `${prefix}-luv.png`);
    luvText = await page.locator("body").innerText();
  }

  await ctx.close();
  return {
    viewport,
    ...analyze(tasksText, homeText, paymentsText),
    luvSample: luvText.slice(0, 800),
  };
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const desktop = await captureViewport(browser, { width: 1440, height: 900 }, `01-${PHASE}-desktop`);
  const mobile = await captureViewport(browser, { width: 390, height: 844 }, `02-${PHASE}-mobile`);
  await browser.close();

  // API proof
  let apiTasks = null;
  try {
    const res = await fetch(`${BASE}/api/portal/tasks?token=${TOKEN}`);
    if (res.ok) apiTasks = await res.json();
    else apiTasks = { status: res.status, body: await res.text() };
  } catch (e) {
    apiTasks = { error: String(e) };
  }

  const results = {
    phase: PHASE,
    at: new Date().toISOString(),
    portal: PORTAL,
    desktop,
    mobile,
    apiTasksSummary: summarizeApi(apiTasks),
  };
  const file = path.join(OUT, `qa-results-${PHASE}.json`);
  await writeFile(file, JSON.stringify(results, null, 2));
  console.log("wrote", file);
  console.log(JSON.stringify({ phase: PHASE, desktop: desktop.tasks, mobile: mobile.tasks, api: results.apiTasksSummary }, null, 2));
}

function summarizeApi(payload) {
  if (!payload || payload.error || payload.status) return payload;
  const tasks = Array.isArray(payload) ? payload : payload.tasks ?? payload.items ?? [];
  if (!Array.isArray(tasks)) {
    // try nested shapes used by portal
    const flat = [];
    const walk = (n) => {
      if (!n) return;
      if (Array.isArray(n)) return n.forEach(walk);
      if (typeof n === "object") {
        if (n.title || n.autoCompleteTrigger) flat.push(n);
        Object.values(n).forEach(walk);
      }
    };
    walk(payload);
    return summarizeTaskList(flat);
  }
  return summarizeTaskList(tasks);
}

function summarizeTaskList(tasks) {
  const paymentish = tasks.filter(
    (t) =>
      /payment/i.test(t.title ?? "") ||
      t.autoCompleteTrigger === "final_payment_obligation_paid" ||
      t.autoCompleteTrigger === "payment_received",
  );
  return paymentish.map((t) => ({
    id: t.id,
    title: t.title,
    status: t.status,
    autoCompleteTrigger: t.autoCompleteTrigger,
    canComplete: t.canComplete,
    paymentLineItemId: t.paymentLineItemId ?? t.payment_line_item_id,
  }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
