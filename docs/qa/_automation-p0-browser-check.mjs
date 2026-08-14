/**
 * One-shot Automation P0 browser validation. Not part of the product.
 * Writes JSON evidence under docs/qa/.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/qa/automation-p0-browser-evidence");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const result = {
  startedAt: new Date().toISOString(),
  base: BASE,
  login: null,
  seriesList: null,
  newForm: null,
  editForm: null,
  enrollments: null,
  activity: null,
  errors: [],
};

page.on("pageerror", (e) => result.errors.push(`pageerror:${e.message}`));
page.on("console", (msg) => {
  if (msg.type() === "error") result.errors.push(`console:${msg.text().slice(0, 200)}`);
});

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  // Login form
  const email = page.locator('input[type="email"], input[name="email"], input#email').first();
  const password = page.locator('input[type="password"], input[name="password"], input#password').first();
  if (!(await email.count()) || !(await password.count())) {
    result.login = { ok: false, reason: "login inputs not found", body: (await page.locator("body").innerText()).slice(0, 400) };
  } else {
    await email.fill(EMAIL);
    await password.fill(PASSWORD);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);
    result.login = { ok: !page.url().includes("/login"), url: page.url() };
  }
  await shot("01-after-login");

  // Automations list
  await page.goto(`${BASE}/communication/series`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const listText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  result.seriesList = {
    url: page.url(),
    hasAutomationsTitle: /Automations/i.test(listText),
    hasNewInquiryWelcome: /New Inquiry Welcome/i.test(listText),
    hasSequenceWord: /\bSequence\b/.test(listText) && !/Automated/.test(listText),
    sample: listText.slice(0, 800),
  };
  await shot("02-series-list");

  // New Automation — stage picker
  await page.goto(`${BASE}/communication/series/new`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const formText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const editNoteVisible = /new enrollments only/i.test(formText);

  // Open "Starts when" and pick stage trigger
  const startsWhen = page.getByText(/Starts when/i).first();
  let stageLabels = [];
  let openedStagePicker = false;
  try {
    // Click the Starts when select
    const triggerSelect = page.locator("#strig").first();
    if (await triggerSelect.count()) {
      await triggerSelect.click();
      await page.waitForTimeout(400);
      const stageOption = page.getByRole("option", { name: /pipeline stage/i }).first();
      if (await stageOption.count()) {
        await stageOption.click();
      } else {
        // fallback: any option containing "stage"
        const opts = page.locator('[role="option"]');
        const n = await opts.count();
        for (let i = 0; i < n; i++) {
          const t = await opts.nth(i).innerText();
          if (/stage/i.test(t)) {
            await opts.nth(i).click();
            break;
          }
        }
      }
      await page.waitForTimeout(500);
    }
    const stageSelect = page.locator("#sstage").first();
    if (await stageSelect.count()) {
      await stageSelect.click();
      await page.waitForTimeout(500);
      openedStagePicker = true;
      const opts = page.locator('[role="option"]');
      const n = await opts.count();
      for (let i = 0; i < n; i++) {
        stageLabels.push((await opts.nth(i).innerText()).trim());
      }
      await page.keyboard.press("Escape").catch(() => {});
    }
  } catch (e) {
    result.errors.push(`stage-picker:${e.message}`);
  }

  const expectedCanonical = [
    "New",
    "Contacted",
    "Qualified",
    "Proposal Sent",
    "Won",
    "Lost",
    "Cancelled",
  ];
  const foundCanonical = expectedCanonical.filter((c) =>
    stageLabels.some((l) => l.includes(c)),
  );

  result.newForm = {
    editNoteVisible,
    openedStagePicker,
    stageLabels,
    stageCount: stageLabels.length,
    foundCanonical,
    allSevenPresent: foundCanonical.length === 7,
    hasVenueStyleSeparator: stageLabels.some((l) => l.includes("·")),
    sample: formText.slice(0, 600),
  };
  await shot("03-new-form-stages");

  // Try open first existing edit page from list
  await page.goto(`${BASE}/communication/series`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const editLink = page.locator('a[href*="/communication/series/"][href$="/edit"]').first();
  if (await editLink.count()) {
    const href = await editLink.getAttribute("href");
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    const editText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    result.editForm = {
      href,
      editNoteVisible: /new enrollments only/i.test(editText),
      hasEnrollmentsSection: /enroll/i.test(editText),
      hasStepProgress: /Step \d+ of \d+/i.test(editText),
      hasForbiddenTerms: {
        sequenceEnrollment: /sequence enrollment/i.test(editText),
        materialized: /materialized/i.test(editText),
        scheduler: /\bscheduler\b/i.test(editText),
        cron: /\bcron\b/i.test(editText),
        executionEngine: /execution engine/i.test(editText),
        canonicalStage: /canonical stage/i.test(editText),
      },
      sample: editText.slice(0, 1000),
    };
    await shot("04-edit-form");

    // Enrollment progress lines
    const progressEls = page.locator("text=/Step \\d+ of \\d+/");
    result.enrollments = {
      progressCount: await progressEls.count(),
      progressSamples: [],
    };
    const pc = Math.min(await progressEls.count(), 5);
    for (let i = 0; i < pc; i++) {
      result.enrollments.progressSamples.push(await progressEls.nth(i).innerText());
    }
  } else {
    result.editForm = { ok: false, reason: "no edit link" };
  }

  // Activity timeline: find a lead/relationship page if possible
  await page.goto(`${BASE}/leads`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const leadLink = page.locator('a[href*="/leads/"]').first();
  if (await leadLink.count()) {
    await leadLink.click();
    await page.waitForTimeout(2000);
    // Activity tab
    const activityTab = page.getByRole("tab", { name: /activity/i }).or(page.getByText(/^Activity$/i)).first();
    if (await activityTab.count()) {
      await activityTab.click();
      await page.waitForTimeout(1500);
    }
    const actText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    result.activity = {
      url: page.url(),
      hasAutomationLifecycle: /Enrolled in automation|Automation completed|Automation stopped/i.test(actText),
      sample: actText.slice(0, 800),
    };
    await shot("05-activity");
  } else {
    result.activity = { ok: false, reason: "no lead link" };
  }
} catch (e) {
  result.errors.push(`fatal:${e.message}`);
}

result.finishedAt = new Date().toISOString();
await writeFile(path.join(OUT, "results.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
await browser.close();
