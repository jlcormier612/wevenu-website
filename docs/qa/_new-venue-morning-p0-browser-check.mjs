/**
 * New Venue Morning P0 remediation — browser validation.
 * Not part of the product. Writes evidence under docs/qa/.
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = path.join(ROOT, "docs/qa/new-venue-morning-p0-evidence");
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

await mkdir(OUT, { recursive: true });

const env = loadEnv();
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const result = {
  startedAt: new Date().toISOString(),
  checks: [],
  errors: [],
};

function note(name, pass, detail) {
  result.checks.push({ name, pass: !!pass, detail: detail ?? null });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

page.on("pageerror", (e) => result.errors.push(`pageerror:${e.message}`));

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: true });
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

  // ---- 1. Pipeline Templates copy ----
  await page.goto(`${BASE}/library/pipeline-templates`, { waitUntil: "networkidle", timeout: 60000 });
  await shot("02-pipeline-templates");
  const bodyText = await page.locator("body").innerText();
  const hasStale = bodyText.includes("Not connected to Leads yet");
  const hasTrue = bodyText.includes("Customize the stages on your Leads Pipeline")
    || bodyText.includes("Names and order here are what you see on the board");
  note("pipeline-copy-no-stale", !hasStale, hasStale ? "stale copy still present" : "stale copy gone");
  note("pipeline-copy-truthful", hasTrue, hasTrue ? "truthful copy present" : "expected copy missing");

  // Open first edit link if present
  const editLink = page.locator('a[href*="/library/pipeline-templates/"][href*="/edit"]').first();
  if (await editLink.count()) {
    await editLink.click();
    await page.waitForLoadState("networkidle");
    await shot("03-pipeline-template-edit");
    note("pipeline-edit-opens", true, page.url());
  } else {
    note("pipeline-edit-opens", false, "no edit link");
  }

  // Leads pipeline still shows stages
  await page.goto(`${BASE}/leads/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
  await shot("04-leads-pipeline");
  const stageHeaders = await page.locator(".font-semibold.text-heading").count();
  note("leads-pipeline-reflects-stages", stageHeaders > 0, `stage header nodes≈${stageHeaders}`);

  // ---- 2. Automation safety (cancel path) ----
  // Find an active lead_stage_changed automation + a lead not already enrolled
  const { data: autos } = await admin.from("message_sequences")
    .select("id, name, trigger_stage, venue_id")
    .eq("status", "active")
    .eq("trigger_type", "lead_stage_changed")
    .not("trigger_stage", "is", null)
    .limit(10);
  note("db-active-stage-automations", (autos?.length ?? 0) > 0, JSON.stringify((autos ?? []).map((a) => ({ name: a.name, stage: a.trigger_stage }))));

  let cancelVerified = false;
  let noConfirmVerified = false;

  if (autos?.length) {
    const auto = autos.find((a) => a.trigger_stage === "proposal_sent") || autos[0];
    const venueId = auto.venue_id;

    const { data: stages } = await admin.from("pipeline_stages")
      .select("id, name, canonical_stage, pipeline_template_id")
      .eq("venue_id", venueId);
    // Map LeadStatus → canonical for destination
    const statusToCanonical = {
      new: "inquiry", contacted: "tour", qualified: "tour",
      proposal_sent: "proposal", won: "booked", lost: "lost", cancelled: "cancelled",
    };
    const destCanonical = statusToCanonical[auto.trigger_stage];
    const destStage = (stages ?? []).find((s) => s.canonical_stage === destCanonical);

    const { data: leads } = await admin.from("leads")
      .select("id, first_name, last_name, status, relationship_id, pipeline_stage_id")
      .eq("venue_id", venueId)
      .not("relationship_id", "is", null)
      .limit(30);

    let candidate = null;
    for (const lead of leads ?? []) {
      if (lead.status === auto.trigger_stage) continue;
      const { data: enr } = await admin.from("sequence_enrollments").select("id")
        .eq("sequence_id", auto.id).eq("relationship_id", lead.relationship_id).eq("status", "active").maybeSingle();
      if (enr) continue;
      candidate = lead;
      break;
    }

    note("safety-candidate", !!candidate && !!destStage, candidate
      ? `lead=${candidate.first_name} ${candidate.last_name}; dest=${destStage?.name}; auto=${auto.name}`
      : "no candidate lead/stage");

    if (candidate && destStage) {
      await page.goto(`${BASE}/leads/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
      // Find card by name
      const card = page.locator("div.cursor-grab").filter({ hasText: candidate.first_name }).first();
      const column = page.locator("div.flex.w-72").filter({ hasText: destStage.name }).first();
      if (await card.count() && await column.count()) {
        const box = await column.boundingBox();
        await card.dragTo(column, { targetPosition: { x: 40, y: 80 } });
        await page.waitForTimeout(800);
        await shot("05-after-drag-to-auto-stage");
        const dialog = page.getByRole("alertdialog");
        const dialogVisible = await dialog.isVisible().catch(() => false);
        note("confirm-shows-when-would-enroll", dialogVisible, dialogVisible ? "dialog visible" : "dialog missing");
        if (dialogVisible) {
          const dlgText = await dialog.innerText();
          note("confirm-mentions-automation", /Automation/i.test(dlgText), dlgText.slice(0, 180));
          note("confirm-mentions-messages", /message/i.test(dlgText), null);
          // Cancel — lead should stay
          await dialog.getByRole("button", { name: "Cancel" }).click();
          await page.waitForTimeout(500);
          await shot("06-after-cancel");
          const dialogGone = !(await dialog.isVisible().catch(() => false));
          note("cancel-closes-dialog", dialogGone, null);
          // Re-fetch lead status — should be unchanged
          const { data: after } = await admin.from("leads").select("status, pipeline_stage_id")
            .eq("id", candidate.id).maybeSingle();
          const unchanged = after?.status === candidate.status;
          note("cancel-no-status-change", unchanged, `before=${candidate.status} after=${after?.status}`);
          cancelVerified = unchanged && dialogGone;

          // Confirm path with same lead (still not enrolled)
          await page.goto(`${BASE}/leads/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
          const card2 = page.locator("div.cursor-grab").filter({ hasText: candidate.first_name }).first();
          const column2 = page.locator("div.flex.w-72").filter({ hasText: destStage.name }).first();
          await card2.dragTo(column2, { targetPosition: { x: 40, y: 80 } });
          await page.waitForTimeout(800);
          const dialog2 = page.getByRole("alertdialog");
          if (await dialog2.isVisible().catch(() => false)) {
            await dialog2.getByRole("button", { name: "Continue" }).click();
            await page.waitForTimeout(1500);
            await shot("07-after-continue");
            const { data: after2 } = await admin.from("leads").select("status")
              .eq("id", candidate.id).maybeSingle();
            note("continue-commits-stage", after2?.status === auto.trigger_stage, `status=${after2?.status} expected=${auto.trigger_stage}`);
            const { data: enr2 } = await admin.from("sequence_enrollments").select("id, status")
              .eq("sequence_id", auto.id).eq("relationship_id", candidate.relationship_id).eq("status", "active").maybeSingle();
            note("continue-enrolls", !!enr2, enr2 ? `enrollment=${enr2.id}` : "no enrollment");
          } else {
            note("continue-commits-stage", false, "dialog did not reappear");
          }
        }
      } else {
        note("confirm-shows-when-would-enroll", false, "card or column not found in DOM");
      }

      // Ordinary move: stage with no active automation
      const autoStages = new Set(autos.map((a) => a.trigger_stage));
      const ordinaryStage = (stages ?? []).find((s) => {
        const status = Object.entries(statusToCanonical).find(([, c]) => c === s.canonical_stage)?.[0];
        // crude: map canonical back
        const mapped = {
          inquiry: "new", tour: "contacted", proposal: "proposal_sent",
          decision: "proposal_sent", booked: "won", lost: "lost", cancelled: "cancelled",
        }[s.canonical_stage];
        return mapped && !autoStages.has(mapped) && s.id !== destStage?.id;
      });
      const { data: leads2 } = await admin.from("leads")
        .select("id, first_name, status, relationship_id")
        .eq("venue_id", venueId)
        .not("relationship_id", "is", null)
        .limit(20);
      const ordinaryLead = (leads2 ?? []).find((l) => ordinaryStage && l.status !== {
        inquiry: "new", tour: "contacted", proposal: "proposal_sent",
        decision: "proposal_sent", booked: "won", lost: "lost", cancelled: "cancelled",
      }[ordinaryStage.canonical_stage]);

      if (ordinaryLead && ordinaryStage) {
        await page.goto(`${BASE}/leads/pipeline`, { waitUntil: "networkidle", timeout: 60000 });
        const card3 = page.locator("div.cursor-grab").filter({ hasText: ordinaryLead.first_name }).first();
        const column3 = page.locator("div.flex.w-72").filter({ hasText: ordinaryStage.name }).first();
        if (await card3.count() && await column3.count()) {
          await card3.dragTo(column3, { targetPosition: { x: 40, y: 80 } });
          await page.waitForTimeout(1000);
          await shot("08-ordinary-move");
          const dlg = page.getByRole("alertdialog");
          const shown = await dlg.isVisible().catch(() => false);
          note("ordinary-move-no-confirm", !shown, shown ? "unexpected dialog" : "no dialog");
          noConfirmVerified = !shown;
        } else {
          note("ordinary-move-no-confirm", false, "DOM nodes missing");
        }
      } else {
        note("ordinary-move-no-confirm", false, "no ordinary candidate");
      }
    }
  }

  // ---- 3. Help Getting Started ----
  await page.goto(`${BASE}/help`, { waitUntil: "networkidle", timeout: 60000 });
  await shot("09-help-home");
  const helpText = await page.locator("body").innerText();
  note("help-getting-started-listed", helpText.includes("Getting Started: Your First Morning"), null);
  note("help-getting-started-not-empty", !helpText.includes("Guides for this area are coming soon") || helpText.includes("Getting Started: Your First Morning"), null);
  // Other articles still present
  note("help-other-articles-unchanged",
    helpText.includes("Turning a Lead into a Signed Client")
    && helpText.includes("Getting Paid, On Time")
    && helpText.includes("Creating Your First Package"),
    null);

  await page.click('a[href="/help/getting-started-your-first-morning"]');
  await page.waitForLoadState("networkidle");
  await shot("10-help-article");
  const articleText = await page.locator("body").innerText();
  note("help-article-opens", articleText.includes("Getting Started: Your First Morning"), null);
  note("help-article-category", articleText.includes("Getting Started"), null);
  note("help-article-answer", articleText.includes("Check your Dashboard, then your Leads"), null);
  note("help-article-dashboard-labels",
    articleText.includes("Morning Briefing") && articleText.includes("Today's Attention"), null);
  note("help-article-nav-truth",
    articleText.includes("Sales → Leads") && articleText.includes("Help & Guides"), null);

  const back = page.locator('a[href="/help"]').first();
  await back.click();
  await page.waitForLoadState("networkidle");
  await shot("11-help-back");
  note("help-back-nav", page.url().includes("/help") && !page.url().includes("getting-started"), page.url());

  note("cancel-path-verified", cancelVerified || result.checks.some((c) => c.name === "cancel-no-status-change" && c.pass), null);
  note("ordinary-path-noted", noConfirmVerified || result.checks.some((c) => c.name === "ordinary-move-no-confirm"), null);
} catch (e) {
  result.errors.push(String(e?.stack || e));
  note("script-error", false, String(e?.message || e));
  await shot("error").catch(() => {});
} finally {
  result.finishedAt = new Date().toISOString();
  result.passCount = result.checks.filter((c) => c.pass).length;
  result.failCount = result.checks.filter((c) => !c.pass).length;
  await writeFile(path.join(OUT, "results.json"), JSON.stringify(result, null, 2));
  await browser.close();
  console.log(`\nDone: ${result.passCount} pass / ${result.failCount} fail → ${OUT}/results.json`);
  process.exit(result.failCount > 0 || result.errors.length > 0 ? 1 : 0);
}
