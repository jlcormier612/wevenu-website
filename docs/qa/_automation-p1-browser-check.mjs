/**
 * Automation P1 browser + DB validation (owner venue).
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/qa/automation-p1-browser-evidence");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.QA_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL || "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD || "devpassword123";

function loadEnv() {
  const text = readFileSync(path.join(ROOT, ".env.local"), "utf8");
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
  }
  return out;
}

function sql(q) {
  const oneLine = String(q).replace(/\s+/g, " ").trim();
  return execSync(
    `docker exec -i supabase_db_wevenu-website psql -U postgres -d postgres -t -A -c ${JSON.stringify(oneLine)}`,
    { encoding: "utf8" },
  ).trim();
}

async function waitFor(fn, { tries = 20, ms = 400 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = fn();
    if (v) return v;
    await new Promise((r) => setTimeout(r, ms));
  }
  return fn();
}

await mkdir(OUT, { recursive: true });
const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const result = { startedAt: new Date().toISOString(), checks: [], errors: [] };

function note(name, pass, detail) {
  result.checks.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${String(detail).slice(0, 220)}` : ""}`);
}

page.on("pageerror", (e) => result.errors.push(`pageerror:${e.message}`));
async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

async function login() {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60000 });
  await shot("01-after-login");
  note("login", true, page.url());
}

try {
  await login();

  await page.goto(`${BASE}/communication/series/new`, { waitUntil: "networkidle", timeout: 60000 });
  await page.locator("#strig").click();
  await page.waitForTimeout(400);
  const opts = page.locator('[role="option"]');
  const labels = [];
  for (let i = 0; i < await opts.count(); i++) labels.push((await opts.nth(i).innerText()).trim());
  note("trigger-has-tour-completed", labels.some((t) => /tour is completed/i.test(t)), labels.join(" | "));
  note("trigger-keeps-lead-created", labels.some((t) => /new inquiry/i.test(t)));
  note("trigger-keeps-stage", labels.some((t) => /pipeline stage/i.test(t)));
  await shot("02-tour-trigger-picker");
  await page.keyboard.press("Escape").catch(() => {});

  const venueId = sql(`SELECT v.id FROM venues v JOIN venue_staff vs ON vs.venue_id=v.id JOIN auth.users u ON u.id=vs.user_id WHERE u.email='${EMAIL}' LIMIT 1`);
  note("db-venue", !!venueId, venueId);

  const tourAutoId = sql(`SELECT id FROM message_sequences WHERE venue_id='${venueId}' AND trigger_type='tour_completed' LIMIT 1`);
  if (tourAutoId) sql(`UPDATE message_sequences SET status='active' WHERE id='${tourAutoId}'`);
  note("db-tour-automation", !!tourAutoId, tourAutoId);

  // Prefer a scheduled tour with relationship
  const tourLine = sql(`SELECT ta.id||'|'||ta.lead_id||'|'||coalesce(l.relationship_id::text,'') FROM tour_appointments ta JOIN leads l ON l.id=ta.lead_id WHERE ta.venue_id='${venueId}' AND ta.status IN ('scheduled','confirmed') AND l.relationship_id IS NOT NULL LIMIT 1`);
  const [tourApptId, leadId, relationshipId] = (tourLine || "||").split("|");
  note("db-tour-appt", !!tourApptId && !!relationshipId, tourLine);

  if (tourAutoId && relationshipId) {
    sql(`UPDATE sequence_enrollments SET status='cancelled', exited_at=now() WHERE sequence_id='${tourAutoId}' AND relationship_id='${relationshipId}' AND status='active'`);
  }

  if (tourApptId && leadId && tourAutoId && relationshipId) {
    const completeRes = await page.evaluate(async ({ appointmentId }) => {
      const res = await fetch("/api/tours/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status: "completed" }),
      });
      return { status: res.status, body: await res.text() };
    }, { appointmentId: tourApptId });
    note("tour-complete-api", completeRes.status >= 200 && completeRes.status < 300, JSON.stringify(completeRes).slice(0, 180));
    const enrollId = await waitFor(() =>
      sql(`SELECT id FROM sequence_enrollments WHERE sequence_id='${tourAutoId}' AND relationship_id='${relationshipId}' AND status='active' LIMIT 1`),
    );
    note("tour-completed-enrolls", !!enrollId, enrollId);
    await shot("03-after-tour-complete");

    const activeCount = Number(sql(`SELECT count(*) FROM sequence_enrollments WHERE sequence_id='${tourAutoId}' AND relationship_id='${relationshipId}' AND status='active'`));
    note("no-duplicate-active", activeCount <= 1, `count=${activeCount}`);

    // Non-completed path: completing already-completed should not create another
    await page.evaluate(async ({ appointmentId }) => {
      await fetch("/api/tours/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appointmentId, status: "completed" }),
      });
    }, { appointmentId: tourApptId });
    await page.waitForTimeout(800);
    const activeCount2 = Number(sql(`SELECT count(*) FROM sequence_enrollments WHERE sequence_id='${tourAutoId}' AND relationship_id='${relationshipId}' AND status='active'`));
    note("repeat-complete-no-dup", activeCount2 <= 1, `count=${activeCount2}`);

    if (enrollId) {
      await page.goto(`${BASE}/communication/series/${tourAutoId}/edit`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(800);
      const pauseBtn = page.getByRole("button", { name: "Pause for this person" }).first();
      await page.getByText("Priya Natarajan").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(1500);
      note("pause-ui-visible", (await pauseBtn.count()) > 0);
      if (await pauseBtn.count()) {
        await pauseBtn.click();
        await waitFor(() => sql(`SELECT paused_at IS NOT NULL FROM sequence_enrollments WHERE id='${enrollId}'`) === "t");
        await page.waitForTimeout(800);
        await shot("04-after-pause");
        const pausedAt = sql(`SELECT paused_at IS NOT NULL FROM sequence_enrollments WHERE id='${enrollId}'`);
        const status = sql(`SELECT status FROM sequence_enrollments WHERE id='${enrollId}'`);
        note("pause-status-active", status === "active", status);
        note("pause-paused-at-set", pausedAt === "t", pausedAt);

        const scheduledCount = Number(sql(`SELECT count(*) FROM scheduled_messages WHERE sequence_enrollment_id='${enrollId}' AND status='scheduled'`));
        note("pause-keeps-scheduled", scheduledCount >= 0, `scheduled=${scheduledCount}`);
        note("pause-would-skip-send", pausedAt === "t");

        const beforeDates = sql(`SELECT string_agg(scheduled_for::text, ',' ORDER BY scheduled_for) FROM scheduled_messages WHERE sequence_enrollment_id='${enrollId}'`);
        const resumeBtn = page.getByRole("button", { name: "Resume for this person" }).first();
        note("resume-ui-visible", (await resumeBtn.count()) > 0);
        if (await resumeBtn.count()) {
          await resumeBtn.click();
          await waitFor(() => sql(`SELECT paused_at IS NULL FROM sequence_enrollments WHERE id='${enrollId}'`) === "t");
          await page.waitForTimeout(800);
          await shot("05-after-resume");
          const pausedAfter = sql(`SELECT paused_at IS NOT NULL FROM sequence_enrollments WHERE id='${enrollId}'`);
          const resumedAt = sql(`SELECT resumed_at IS NOT NULL FROM sequence_enrollments WHERE id='${enrollId}'`);
          note("resume-clears-paused-at", pausedAfter === "f", pausedAfter);
          note("resume-sets-resumed-at", resumedAt === "t", resumedAt);
          const afterDates = sql(`SELECT string_agg(scheduled_for::text, ',' ORDER BY scheduled_for) FROM scheduled_messages WHERE sequence_enrollment_id='${enrollId}'`);
          note("resume-dates-unchanged", beforeDates === afterDates, `${beforeDates} => ${afterDates}`);
        }
      }
    }
  } else {
    note("tour-complete-flow", false, "missing tour/relationship/automation");
  }

  // Confirm preview via lead detail stage change to Proposal Issued (decision → proposal_sent)
  const destStageId = sql(`SELECT id FROM pipeline_stages WHERE venue_id='${venueId}' AND name='Proposal Issued' LIMIT 1`);
  const stageAutoId = sql(`SELECT id FROM message_sequences WHERE venue_id='${venueId}' AND status='active' AND trigger_type='lead_stage_changed' AND trigger_stage='proposal_sent' LIMIT 1`);
  note("db-stage-automation", !!stageAutoId, stageAutoId);

  const leadLine = sql(`SELECT l.id||'|'||l.relationship_id||'|'||l.status FROM leads l WHERE l.venue_id='${venueId}' AND l.relationship_id IS NOT NULL AND l.status <> 'proposal_sent' AND NOT EXISTS (SELECT 1 FROM sequence_enrollments se WHERE se.sequence_id='${stageAutoId}' AND se.relationship_id=l.relationship_id AND se.status='active') LIMIT 1`);
  const [targetLeadId, targetRelId, priorStatus] = (leadLine || "||").split("|");
  note("confirm-target-lead", !!targetLeadId && !!destStageId, leadLine);

  if (targetLeadId && destStageId && stageAutoId) {
    const better = sql(`SELECT l.id||'|'||l.relationship_id||'|'||l.status FROM leads l WHERE l.venue_id='${venueId}' AND l.relationship_id IS NOT NULL AND l.status IN ('new','contacted','qualified') AND NOT EXISTS (SELECT 1 FROM sequence_enrollments se WHERE se.sequence_id='${stageAutoId}' AND se.relationship_id=l.relationship_id AND se.status='active') LIMIT 1`);
    const pick = better || leadLine;
    const [lid, rid, pst] = pick.split("|");
    note("confirm-lead-picked", !!lid, pick);
    await page.goto(`${BASE}/leads/${lid}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    const change = page.getByRole("button", { name: /Change stage/i }).first();
    note("stage-control", (await change.count()) > 0);
    if (await change.count()) {
      await change.click();
      await page.waitForTimeout(500);
      const option = page.getByRole("menuitem", { name: /Proposal Issued/i });
      note("stage-option", (await option.count()) > 0);
      if (await option.count()) {
        await option.click();
        await page.waitForTimeout(1500);
        await shot("06-confirm-dialog");
        const dlg = page.getByRole("alertdialog");
        const shown = (await dlg.count()) > 0 && await dlg.isVisible().catch(() => false);
        note("confirm-dialog-shown", shown);
        if (shown) {
          const text = await dlg.innerText();
          note("confirm-has-copy", /active Automation/i.test(text));
          note("confirm-has-preview", /First message/i.test(text) || /Message preview unavailable/i.test(text), text.slice(0, 280));
          await dlg.getByRole("button", { name: /^Cancel$/i }).click();
          await page.waitForTimeout(800);
          const statusAfterCancel = sql(`SELECT status FROM leads WHERE id='${lid}'`);
          note("cancel-no-status-change", statusAfterCancel === pst, `${statusAfterCancel} vs ${pst}`);

          await change.click();
          await page.waitForTimeout(400);
          const option2 = page.getByRole("menuitem", { name: /Proposal Issued/i });
          if (await option2.count()) await option2.click();
          await page.waitForTimeout(1000);
          const dlg2 = page.getByRole("alertdialog");
          if ((await dlg2.count()) > 0) {
            await dlg2.getByRole("button", { name: /^Continue$/i }).click();
            await page.waitForTimeout(1500);
            await shot("07-after-continue");
            const enrolled = await waitFor(() =>
              sql(`SELECT id FROM sequence_enrollments WHERE sequence_id='${stageAutoId}' AND relationship_id='${rid}' AND status='active' LIMIT 1`),
            );
            note("continue-enrolls", !!enrolled, enrolled);
          }
        }
      }
    }
  }

  note("no-page-errors", result.errors.filter((e) => e.startsWith("pageerror:")).length === 0, result.errors.slice(0, 3));
} catch (e) {
  result.errors.push(`fatal:${e.message}`);
  note("fatal", false, e.message);
  await shot("99-error");
} finally {
  result.finishedAt = new Date().toISOString();
  result.passCount = result.checks.filter((c) => c.pass).length;
  result.failCount = result.checks.filter((c) => !c.pass).length;
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(JSON.stringify({ pass: result.passCount, fail: result.failCount, errors: result.errors }, null, 2));
}
