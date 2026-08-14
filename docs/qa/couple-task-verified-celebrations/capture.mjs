/**
 * Live QA — Couple Tasks Impl 4 Verified Domain Completion Celebrations.
 * Safe Emma & Jordan seed probes (API one-time celebrated flags + UI screenshots).
 * Run: node docs/qa/couple-task-verified-celebrations/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const TOKEN = process.env.PORTAL_TOKEN ?? "seedcoupleportal00000000000000000000000000000001";
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const PORTAL = `${BASE}/p/${TOKEN}`;
const CLIENT_ID = "dbfa69d6-47ad-4f9d-892d-4f06cb7f1844";
const FLOOR_PLAN_ID = "059680d1-b596-437f-a0c4-a2d1632ef099";
const Q_KEY = "918ff2a84f4f487ea00dbb714d23f675";

function psql(sql) {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  return execSync(
    `docker exec supabase_db_wevenu-website psql -U postgres -d postgres -tA -c ${JSON.stringify(oneLine)}`,
    { encoding: "utf8" },
  ).trim();
}

async function dismissLegal(page) {
  for (const name of [/Accept/i, /I agree/i, /Continue/i, /Acknowledge/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) {
      try {
        await btn.click({ timeout: 1500 });
        await page.waitForTimeout(600);
      } catch {
        /* ignore */
      }
    }
  }
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const results = {
    env: { BASE, TOKEN: TOKEN.slice(0, 12) + "…" },
    beforeCelebrations: [],
    api: {},
    ui: {},
    afterCelebrations: [],
    confirmations: {},
  };

  results.beforeCelebrations = psql(`
    select celebration_type || '@' || fired_at::text
    from luv_celebrations
    where client_id = '${CLIENT_ID}'
    order by celebration_type;
  `).split("\n").filter(Boolean);

  // Temporarily share floor plan so couple seating Submit is possible; restore after.
  const priorAccess = psql(`select client_access from floor_plans where id = '${FLOOR_PLAN_ID}'`);
  psql(`update floor_plans set client_access = 'view' where id = '${FLOOR_PLAN_ID}'`);

  try {
    // 1) Guest count — existing Luv path
    {
      const res = await fetch(`${BASE}/api/portal/guest-count`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, count: 142 }),
      });
      const first = await res.json();
      const res2 = await fetch(`${BASE}/api/portal/guest-count`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, count: 143 }),
      });
      const second = await res2.json();
      results.api.guest_count = {
        firstCelebrated: first.celebrated === true,
        secondCelebrated: second.celebrated === true,
        firstOk: first.ok === true,
        secondOk: second.ok === true,
        pass: first.ok && first.celebrated === true && second.ok && second.celebrated !== true,
      };
    }

    // 2) Seating — NEW
    {
      const res = await fetch(`${BASE}/api/portal/seating/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, floorPlanId: FLOOR_PLAN_ID }),
      });
      const first = await res.json();
      const res2 = await fetch(`${BASE}/api/portal/seating/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, floorPlanId: FLOOR_PLAN_ID }),
      });
      const second = await res2.json();
      results.api.seating = {
        firstCelebrated: first.celebrated === true,
        secondCelebrated: second.celebrated === true,
        firstOk: first.ok === true,
        secondOk: second.ok === true,
        firstError: first.error ?? null,
        pass: first.ok && first.celebrated === true && second.ok && second.celebrated !== true,
      };
    }

    // 3) Vendors — NEW (resubmit first fire; second no replay)
    {
      const res = await fetch(`${BASE}/api/portal/vendors/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, clientId: CLIENT_ID }),
      });
      const first = await res.json();
      const res2 = await fetch(`${BASE}/api/portal/vendors/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: TOKEN, clientId: CLIENT_ID }),
      });
      const second = await res2.json();
      results.api.vendors = {
        firstCelebrated: first.celebrated === true,
        secondCelebrated: second.celebrated === true,
        firstOk: first.ok === true,
        secondOk: second.ok === true,
        pass: first.ok && first.celebrated === true && second.ok && second.celebrated !== true,
      };
    }

    // 4) Questionnaire — NEW
    {
      const payload = {
        accessKey: Q_KEY,
        finalGuestCount: 140,
        mealNotes: "QA celebration probe",
        processionalSong: "",
        recessionalSong: "",
        firstDanceSong: "",
        parentDances: "",
        emergencyContactName: "",
        emergencyContactPhone: "",
        specialRequests: "",
      };
      const res = await fetch(`${BASE}/api/public/questionnaire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const first = await res.json();
      const res2 = await fetch(`${BASE}/api/public/questionnaire`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const second = await res2.json();
      results.api.questionnaire = {
        firstCelebrated: first.celebrated === true,
        secondCelebrated: second.celebrated === true,
        firstOk: first.ok === true,
        secondOk: second.ok === true,
        pass: first.ok && first.celebrated === true && second.ok && second.celebrated !== true,
      };
    }
  } finally {
    psql(`update floor_plans set client_access = '${priorAccess}' where id = '${FLOOR_PLAN_ID}'`);
    results.floorPlanRestoredTo = psql(`select client_access from floor_plans where id = '${FLOOR_PLAN_ID}'`);
  }

  results.afterCelebrations = psql(`
    select celebration_type || '@' || fired_at::text
    from luv_celebrations
    where client_id = '${CLIENT_ID}'
    order by celebration_type;
  `).split("\n").filter(Boolean);

  // Unsupported: payment_received / insurance not in celebration rows unless inventively added
  results.confirmations.noPaymentReceivedCelebrationRow = !results.afterCelebrations.some((r) =>
    r.startsWith("payment_received"),
  );
  results.confirmations.noInsuranceCelebrationRow = !results.afterCelebrations.some((r) =>
    r.includes("insurance"),
  );
  results.confirmations.hasVendorSeatingQuestionnaire =
    results.afterCelebrations.some((r) => r.startsWith("vendor_list_submitted")) &&
    results.afterCelebrations.some((r) => r.startsWith("seating_submitted")) &&
    results.afterCelebrations.some((r) => r.startsWith("questionnaire_submitted")) &&
    results.afterCelebrations.some((r) => r.startsWith("guest_list_submitted"));

  // UI: guest count celebration + navigation no-replay + Mark complete still manual-only
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [prefix, viewport] of [
      ["01-desktop", { width: 1440, height: 900 }],
      ["02-mobile", { width: 390, height: 844 }],
    ]) {
      const ctx = await browser.newContext({ viewport });
      const page = await ctx.newPage();
      page.setDefaultTimeout(60000);
      const ui = { viewport };

      await page.goto(PORTAL + "#guests/finalize", { waitUntil: "networkidle" });
      await page.waitForTimeout(2200);
      await dismissLegal(page);
      await page.waitForTimeout(800);

      // Edit guest count → submit again (already celebrated; must NOT re-fire Luv confetti)
      const edit = page.getByRole("button", { name: /Edit|Update|Change/i }).first();
      if (await edit.count()) {
        await edit.click().catch(() => {});
        await page.waitForTimeout(400);
      }
      const input = page.locator("#portal-focus-guests-finalize input, input[type='number']").first();
      if (await input.count()) {
        await input.fill("144");
        const submitBtn = page.getByRole("button", { name: /Submit|Confirm|Save/i }).first();
        if (await submitBtn.count()) {
          await submitBtn.click();
          await page.waitForTimeout(1800);
        }
      }
      const toastText = await page.locator("[data-sonner-toast], [data-sonner-toaster]").allInnerTexts().catch(() => []);
      const confettiLayer = await page.evaluate(() =>
        !!document.querySelector("[style*='z-index:9999'] span"),
      );
      ui.resubmitGuest = {
        toastText: toastText.join(" | ").slice(0, 400),
        confettiLayerPresent: confettiLayer,
        // Resubmit should not get first-fire celebration (flag already consumed)
        noReplayOk: !/Your guest count is submitted\. 🎉/i.test(toastText.join(" ")),
      };
      await page.screenshot({ path: path.join(OUT, `${prefix}-guest-resubmit-no-replay.png`), fullPage: false });

      await page.goto(PORTAL + "#tasks", { waitUntil: "networkidle" });
      await page.waitForTimeout(1800);
      await dismissLegal(page);
      const tasksText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
      const markComplete = (await page.getByRole("button", { name: /^Mark complete$/i }).allInnerTexts()).length;
      ui.tasks = {
        hasLeaveReviewMarkComplete: /Leave a review/i.test(tasksText) && markComplete >= 1,
        markCompleteCount: markComplete,
        hasInsuranceUploadCta: /Upload insurance/i.test(tasksText),
        noFakeDomainConfettiOnLoad: !(await page.evaluate(() => !!document.querySelector("[style*='z-index:9999'] span"))),
      };
      await page.screenshot({ path: path.join(OUT, `${prefix}-tasks.png`), fullPage: false });

      await page.goto(PORTAL, { waitUntil: "networkidle" });
      await page.waitForTimeout(1800);
      await dismissLegal(page);
      const homeBtns = await page.locator("button").allInnerTexts();
      ui.home = {
        completeCtas: homeBtns.filter((b) => /^Complete$/i.test(b.trim())).length,
        reviewCtas: homeBtns.filter((b) => /^Review$/i.test(b.trim())).length,
      };
      await page.screenshot({ path: path.join(OUT, `${prefix}-home.png`), fullPage: false });

      results.ui[prefix] = ui;
      await ctx.close();
    }
  } finally {
    await browser.close();
  }

  results.summaryPass =
    results.api.guest_count?.pass &&
    results.api.seating?.pass &&
    results.api.vendors?.pass &&
    results.api.questionnaire?.pass &&
    results.confirmations.hasVendorSeatingQuestionnaire &&
    results.confirmations.noPaymentReceivedCelebrationRow &&
    results.confirmations.noInsuranceCelebrationRow &&
    results.floorPlanRestoredTo === "hidden";

  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.summaryPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
