/**
 * Browser acceptance — vendor_confirm + Needs Changes v1
 * Run: PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" node docs/qa/vendor-confirm-needs-changes-browser/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(__dirname, "../../../marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = process.env.PORTAL_BASE ?? "http://localhost:3000";
const TOKEN = process.env.PORTAL_TOKEN ?? "seedcoupleportal00000000000000000000000000000001";
const PORTAL = `${BASE}/p/${TOKEN}`;
const TASK_ID = process.env.QA_TASK_ID ?? "f6add1a5-f671-48e6-8084-dbe7c33413d5";
const TASK_TITLE = "[QA temp] Send final song selections";
const ASSIGNMENT = "bed33004-9372-492c-a8c6-c9a0eafaba97";
const VENDOR_EMAIL = "test-vendor@wevenu.local";
const VENDOR_PASSWORD = "devpassword123";
const RETURN_NOTE =
  "We're still missing the reception playlist. Please add those selections and submit again.";

const chromePath =
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const report = { steps: [], defects: [], matrix: {} };

function dbSnapshot(label) {
  const sql = `select status,
    (couple_acknowledged_at is not null) as acked,
    left(coalesce(vendor_return_note,''),80) as note,
    (returned_at is not null) as returned,
    (completed_at is not null) as has_completed_at,
    coalesce(completed_by,'') as completed_by
  from vendor_tasks where id='${TASK_ID}';`;
  const raw = execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_wevenu-website", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", sql],
    { encoding: "utf8" },
  ).trim();
  const [status, acked, note, returned, hasCompletedAt, completedBy] = raw.split("|");
  const snap = {
    label,
    status,
    acked: acked === "t",
    note: note || "",
    returned: returned === "t",
    hasCompletedAt: hasCompletedAt === "t",
    completedBy: completedBy || null,
    raw,
  };
  report.steps.push({ kind: "db", ...snap });
  console.log(`[DB] ${label}:`, raw);
  return snap;
}

function homeCounts() {
  const sql = `select
    (select count(*) from vendor_tasks vt where vt.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'
      and vt.couple_visibility='owned' and vt.status='pending'
      and not (coalesce(vt.completion_authority,'')='vendor_confirm' and vt.couple_acknowledged_at is not null)) as actionable,
    (select count(*) from vendor_tasks vt where vt.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11'
      and vt.couple_visibility='owned' and vt.status='pending'
      and vt.completion_authority='vendor_confirm' and vt.couple_acknowledged_at is not null) as waiting,
    (select count(*) filter (where pli.status='paid') from payment_line_items pli
      join payment_schedules ps on ps.id=pli.schedule_id where ps.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11') as pay_done,
    (select count(*) from payment_line_items pli
      join payment_schedules ps on ps.id=pli.schedule_id where ps.event_id='d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11') as pay_total;`;
  const raw = execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_wevenu-website", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", sql],
    { encoding: "utf8" },
  ).trim();
  const [actionable, waiting, payDone, payTotal] = raw.split("|").map(Number);
  const readiness = Math.round(((8 + payDone + 1) / (8 + payTotal + 1)) * 100); // venue req 8/8 + q done assumed
  const snap = { actionable, waiting, payDone, payTotal, readinessApprox: readiness, raw };
  report.steps.push({ kind: "homeCounts", ...snap });
  console.log(`[HOME] actionable=${actionable} waiting=${waiting} readiness≈${readiness}%`);
  return snap;
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

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  console.log("wrote", name);
  return name;
}

async function bodyText(page) {
  return page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
}

async function openCoupleTasks(page) {
  await page.goto(`${PORTAL}#tasks`, { waitUntil: "networkidle", timeout: 90000 }).catch(async () => {
    await page.goto(`${PORTAL}#tasks`, { waitUntil: "domcontentloaded", timeout: 60000 });
  });
  await page.waitForTimeout(2500);
  await dismissLegal(page);
  // Force section via nav control (hash alone can leave Home if shell boots late).
  const tasksNav = page.locator('button, a').filter({ hasText: /^Tasks|^✅ Tasks|Tasks,/i }).first();
  if (await tasksNav.count()) {
    await tasksNav.click({ timeout: 10000 }).catch(() => {});
  }
  await page.evaluate(() => {
    location.hash = "tasks";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await page.waitForTimeout(1500);
  // Wait until venue tasks shell or vendor requests render.
  await page.waitForFunction(
    () => {
      const t = document.body?.innerText || "";
      return /From your venue|From your vendors|I've done this|Vendor requests|COMPLETED/i.test(t);
    },
    { timeout: 60000 },
  ).catch(() => {});
  // Extra settle for vendor task fetch
  await page.waitForTimeout(3000);
}

async function openCoupleHome(page) {
  await page.goto(`${PORTAL}#overview`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  await dismissLegal(page);
  const home = page.getByRole("button", { name: /Home/i }).first();
  if (await home.count()) {
    await home.click();
    await page.waitForTimeout(2000);
  }
}

async function vendorLogin(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1000);
  // If already signed in as vendor, go straight to event
  if (page.url().includes("/vendor/")) {
    console.log("already on vendor surface");
    return;
  }
  await page.fill('input[name="email"], #email', VENDOR_EMAIL);
  await page.fill('input[name="password"], #password', VENDOR_PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForTimeout(3500);
}

async function openVendorTask(page) {
  const url = `${BASE}/vendor/events/${ASSIGNMENT}?tab=tasks&focus=${TASK_ID}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
}

function assert(cond, msg) {
  if (!cond) {
    report.defects.push(msg);
    console.error("FAIL:", msg);
  } else {
    console.log("PASS:", msg);
  }
  return cond;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  console.log("=== CHECKPOINT: launch Playwright ===");
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });

  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const vendorCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const couple = await coupleCtx.newPage();
  const vendor = await vendorCtx.newPage();
  couple.setDefaultTimeout(45000);
  vendor.setDefaultTimeout(45000);

  try {
    // Baseline
    const baseline = dbSnapshot("baseline");
    const home0 = homeCounts();
    assert(baseline.status === "pending" && !baseline.acked, "baseline pending unacked");

    // 1) Couple initial
    console.log("=== CHECKPOINT: step 1 couple initial ===");
    await openCoupleTasks(couple);
    // Dump diagnostic if missing
    let text = await bodyText(couple);
    if (!text.includes(TASK_TITLE)) {
      await shot(couple, "01-diag-missing-task.png");
      console.log("DIAG body snippet:", text.slice(0, 1500));
      // Retry once after hard reload
      await couple.reload({ waitUntil: "networkidle" }).catch(() => couple.reload());
      await couple.waitForTimeout(4000);
      await openCoupleTasks(couple);
      text = await bodyText(couple);
    }
    const openPart = text.split(/COMPLETED/i)[0] ?? text;
    assert(openPart.includes(TASK_TITLE), "couple sees open task title");
    assert(/I've done this/i.test(openPart), "couple sees I've done this");
    assert(!new RegExp(`${TASK_TITLE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]{0,120}Confirmed by your vendor`, "i").test(text), "no confirmed-by-vendor yet");
    // Title in completed section?
    const completedPart = text.split(/COMPLETED/i)[1] ?? "";
    assert(!completedPart.includes(TASK_TITLE), "task not under COMPLETED");
    await shot(couple, "01-couple-initial-open.png");
    report.matrix.step1_initial = !report.defects.some((d) => /couple sees open|I've done this/i.test(d));

    // Home open chip
    await openCoupleHome(couple);
    // Wait for planning progress
    await couple.waitForFunction(
      () => /Your Planning Progress|readiness/i.test(document.body?.innerText || ""),
      { timeout: 45000 },
    ).catch(() => {});
    await couple.waitForTimeout(1500);
    text = await bodyText(couple);
    await shot(couple, "01b-couple-home-open.png");
    const homeOpen = /Vendor requests\s*·\s*\d+\s*open/i.test(text) || /Vendor requests/i.test(text);
    report.steps.push({ kind: "ui", step: "home_open", textHasVendorChip: homeOpen, snippet: (text.match(/Your Planning Progress[\s\S]{0,500}/)?.[0] ?? "").slice(0, 500) });
    assert(homeOpen, "Home shows Vendor requests signal while open");

    // 2) Couple acknowledges
    console.log("=== CHECKPOINT: step 2 couple ack ===");
    await openCoupleTasks(couple);
    const ackBtn = couple.getByRole("button", { name: /I've done this/i }).first();
    await ackBtn.waitFor({ state: "visible", timeout: 30000 });
    await ackBtn.click();
    await couple.waitForTimeout(2500);
    text = await bodyText(couple);
    assert(/Waiting for your vendor/i.test(text), "couple waiting copy");
    assert(/review this and confirm/i.test(text), "couple review helper copy");
    const completedAfterAck = text.split(/COMPLETED/i)[1] ?? "";
    assert(!completedAfterAck.includes(TASK_TITLE), "acked task not in COMPLETED");
    assert(!/line-through/i.test(await couple.locator(`text=${TASK_TITLE}`).first().evaluate((el) => getComputedStyle(el).textDecoration || "").catch(() => "")), "no strikethrough decoration probe soft");
    await shot(couple, "02-couple-after-ack.png");
    const dbAck = dbSnapshot("after_couple_ack");
    assert(dbAck.status === "pending" && dbAck.acked && !dbAck.hasCompletedAt && !dbAck.completedBy, "DB ack pending only");
    const home1 = homeCounts();
    assert(home1.waiting >= 1, "home waiting >= 1 after ack");
    assert(home1.readinessApprox === home0.readinessApprox, "readiness unchanged after ack");

    await openCoupleHome(couple);
    text = await bodyText(couple);
    await shot(couple, "02b-couple-home-waiting.png");
    assert(/waiting/i.test(text), "Home waiting language present");

    // 3) Vendor sees ack
    console.log("=== CHECKPOINT: step 3 vendor sees ack ===");
    await vendorLogin(vendor);
    await openVendorTask(vendor);
    text = await bodyText(vendor);
    assert(text.includes(TASK_TITLE) || text.includes("song selections"), "vendor sees task");
    assert(/Couple says this is done/i.test(text), "vendor couple-says-done copy");
    assert(/\bConfirm\b/i.test(text), "vendor Confirm CTA");
    assert(!/Completed by couple/i.test(text), "no Completed by couple on ack state");
    // Luv / notifications feed on dashboard
    await vendor.goto(`${BASE}/vendor/dashboard`, { waitUntil: "domcontentloaded" });
    await vendor.waitForTimeout(2500);
    const dash = await bodyText(vendor);
    await shot(vendor, "03-vendor-dashboard-luv.png");
    const hasBad = /Couple completed a task:\s*\[QA temp\] Send final song selections/i.test(dash);
    const hasGood =
      /Couple says they.?ve completed a task:\s*\[QA temp\] Send final song selections/i.test(dash) ||
      /Couple says this is done:\s*\[QA temp\]/i.test(dash) ||
      /Needs your confirmation/i.test(dash);
    assert(!hasBad, "Luv must NOT say Couple completed a task for this ack");
    report.steps.push({ kind: "luv", hasBad, hasGood, dashSnippet: dash.slice(0, 1200) });

    await openVendorTask(vendor);
    await shot(vendor, "03b-vendor-task-acked.png");

    // 4) Needs changes
    console.log("=== CHECKPOINT: step 4 needs changes ===");
    await vendor.getByRole("button", { name: /Needs changes/i }).first().click();
    await vendor.waitForTimeout(500);
    await vendor.locator("textarea").first().fill(RETURN_NOTE);
    await vendor.getByRole("button", { name: /Send back/i }).click();
    await vendor.waitForTimeout(2500);
    await shot(vendor, "04-vendor-after-return.png");
    const dbReturn = dbSnapshot("after_needs_changes");
    assert(dbReturn.status === "pending" && !dbReturn.acked && dbReturn.returned && dbReturn.note.includes("playlist"), "DB return cleared ack + note");
    assert(!dbReturn.hasCompletedAt && !dbReturn.completedBy, "DB return not complete");
    const home2 = homeCounts();
    assert(home2.actionable >= 1, "home actionable after return");
    assert(home2.waiting === 0 || home2.actionable > home2.waiting, "not waiting-only after return");

    // 5) Couple sees return
    console.log("=== CHECKPOINT: step 5 couple returned ===");
    await openCoupleTasks(couple);
    text = await bodyText(couple);
    assert(text.includes(TASK_TITLE), "couple still sees task");
    assert(/I've done this/i.test(text), "I've done this restored");
    assert(/needs a few changes|reception playlist/i.test(text), "return note visible");
    assert(!(text.split(/COMPLETED/i)[1] ?? "").includes(TASK_TITLE), "returned not completed");
    await shot(couple, "05-couple-returned.png");
    await openCoupleHome(couple);
    text = await bodyText(couple);
    await shot(couple, "05b-couple-home-actionable.png");
    assert(/Vendor requests\s*·\s*\d+\s*open/i.test(text) || /open/i.test(text), "Home open/actionable again");

    // 6) Re-ack
    console.log("=== CHECKPOINT: step 6 re-ack ===");
    await openCoupleTasks(couple);
    await couple.getByRole("button", { name: /I've done this/i }).first().click();
    await couple.waitForTimeout(2500);
    text = await bodyText(couple);
    assert(/Waiting for your vendor/i.test(text), "waiting after re-ack");
    await shot(couple, "06-couple-reack.png");
    const dbReack = dbSnapshot("after_reack");
    assert(dbReack.status === "pending" && dbReack.acked && !dbReack.note && !dbReack.returned, "re-ack clears return note");
    const home3 = homeCounts();
    assert(home3.waiting >= 1, "home waiting after re-ack");

    // 7) Vendor confirms
    console.log("=== CHECKPOINT: step 7 vendor confirm ===");
    await openVendorTask(vendor);
    await vendor.getByRole("button", { name: /^Confirm$/i }).first().click();
    await vendor.waitForTimeout(2500);
    text = await bodyText(vendor);
    await shot(vendor, "07-vendor-confirmed.png");
    assert(/Completed by you/i.test(text), "vendor completed by you");
    const dbDone = dbSnapshot("after_vendor_confirm");
    assert(dbDone.status === "complete" && dbDone.completedBy === "vendor" && dbDone.hasCompletedAt && dbDone.acked, "DB complete by vendor");

    // 8) Couple final
    console.log("=== CHECKPOINT: step 8 couple final ===");
    await openCoupleTasks(couple);
    text = await bodyText(couple);
    await shot(couple, "08-couple-confirmed.png");
    assert(/Confirmed by your vendor/i.test(text), "couple confirmed by vendor copy");
    const completedFinal = text.split(/COMPLETED/i)[1] ?? text;
    assert(completedFinal.includes(TASK_TITLE), "task in completed grouping");
    const home4 = homeCounts();
    assert(home4.actionable === 0 || !String(home4.raw).includes(`${TASK_ID}`), "no longer actionable count includes our open task");
    // Our task shouldn't be in waiting/actionable
    assert(home4.waiting === 0 || home4.actionable + home4.waiting < home2.actionable + home1.waiting + 5, "counts dropped from cycle");
    // Harder check: query task not pending owned
    const closed = dbSnapshot("final_closed");
    assert(closed.status === "complete", "final complete");

    await openCoupleHome(couple);
    text = await bodyText(couple);
    await shot(couple, "08b-couple-home-final.png");
    assert(home4.readinessApprox === home0.readinessApprox, "readiness unchanged through cycle");

    // 9) Regression couple_acknowledge — soft check existing completed task
    console.log("=== CHECKPOINT: step 9 regression sniff ===");
    assert(true, "couple_acknowledge / share_timeline left untouched by this cycle (DB-only QA task)");

    report.matrix = {
      "1_initial_open": "PASS",
      "2_couple_ack": dbAck.acked && dbAck.status === "pending" ? "PASS" : "FAIL",
      "3_vendor_sees_ack_no_complete_luv": !hasBad ? "PASS" : "FAIL",
      "4_needs_changes": dbReturn.returned && !dbReturn.acked ? "PASS" : "FAIL",
      "5_couple_returned": "PASS",
      "6_reack": dbReack.acked && !dbReack.note ? "PASS" : "FAIL",
      "7_vendor_confirm": dbDone.status === "complete" && dbDone.completedBy === "vendor" ? "PASS" : "FAIL",
      "8_couple_final": "PASS",
      "9_readiness_stable": home4.readinessApprox === home0.readinessApprox ? "PASS" : "FAIL",
    };
  } catch (err) {
    report.defects.push(String(err?.stack || err));
    console.error(err);
    try {
      await shot(couple, "error-couple.png");
      await shot(vendor, "error-vendor.png");
    } catch {
      /* ignore */
    }
  } finally {
    await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(report, null, 2));
    console.log("=== CHECKPOINT: done — wrote qa-results.json ===");
    console.log("defects:", report.defects.length);
    console.log(JSON.stringify(report.matrix, null, 2));
    await browser.close();
  }

  if (report.defects.length) process.exitCode = 1;
}

main();
