/**
 * Continuation: Use Questionnaire + isolation + RLS (after capture.mjs passed editor/preview)
 */
import { createRequire } from "node:module";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = "http://localhost:3000";
const EMAIL = "owner@example.com";
const PASSWORD = "devpassword123";
const CLIENT_PLANNING_ID = "4bec55b2-e174-42b7-b23e-e930d1be8963";
const APPLY_EVENT_ID = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11";
const OTHER_VENUE = "f41cc6d2-b490-4b92-9e27-cfad042c30ea";
const chromePath =
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

function sql(q) {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_wevenu-website", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", q],
    { encoding: "utf8", timeout: 60000 },
  ).trim();
}

const prev = JSON.parse(await readFile(path.join(OUT, "qa-results.json"), "utf8"));
const report = prev;
report.continuedAt = new Date().toISOString();

function record(id, status, note = "") {
  report.matrix[id] = { status, note };
  console.log(`[${status}] ${id}${note ? ` — ${note}` : ""}`);
  if (status === "FAIL") report.defects.push(`${id}: ${note}`);
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(600);
  if (!page.url().includes("/login")) return true;
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1200);
  return !page.url().includes("/login");
}

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("dialog", async (d) => {
  report.steps.push({ kind: "dialog", message: d.message() });
  await d.accept();
});

try {
  if (!(await login(page))) {
    record("auth_continue", "BLOCKED", "login failed");
  } else {
    const markerMatch = report.matrix.rename?.note?.match(/QA-authoring-\d+/);
    const marker = markerMatch?.[0] ?? "QA-authoring";

    const beforeApply = sql(
      `select id, status, left(coalesce(custom_fields::text,'[]'),100), coalesce(template_id::text,'') from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
    );
    report.steps.push({ kind: "before_apply", beforeApply });

    // Ensure draft for apply (unique per event+kind)
    const statusNow = sql(
      `select status from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
    );
    if (statusNow && statusNow !== "draft") {
      sql(
        `update event_questionnaires set status='draft' where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
      );
      report.notes.push(`Temporarily reset Emma&Jordan client_planning ${statusNow}→draft so Apply can run`);
    }

    await page.goto(`${BASE}/library/questionnaire-templates`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);

    // Row Card: find marker title, click Use Questionnaire inside that card only
    const clicked = await page.evaluate((m) => {
      const titleEl = Array.from(document.querySelectorAll("p.font-medium")).find((p) =>
        (p.textContent || "").includes(m),
      );
      if (!titleEl) return false;
      const card =
        titleEl.closest('[data-slot="card"]') ||
        titleEl.closest(".rounded-xl") ||
        titleEl.closest("div");
      if (!card) return false;
      const btn = Array.from(card.querySelectorAll("button")).find(
        (b) => /Use Questionnaire/i.test(b.textContent || "") && !b.disabled,
      );
      if (!btn) return false;
      btn.click();
      return true;
    }, marker);

    if (!clicked) {
      // Fallback: second Use Questionnaire (first may be archived copy disabled)
      const buttons = page.getByRole("button", { name: /^Use Questionnaire$/i });
      const n = await buttons.count();
      let did = false;
      for (let i = 0; i < n; i++) {
        const btn = buttons.nth(i);
        if (await btn.isDisabled()) continue;
        await btn.click();
        did = true;
        report.notes.push(`Fallback: clicked Use Questionnaire index ${i}`);
        break;
      }
      if (!did) record("use_questionnaire_apply", "FAIL", "No enabled Use Questionnaire button");
    }
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, "07-use-sheet.png") });

    // Wait for sheet title
    await page.getByRole("heading", { name: /Use Questionnaire/i }).waitFor({ timeout: 10000 }).catch(() => {});
    const eventBtn = page.locator('[data-slot="sheet-content"] button, [role="dialog"] button').filter({ hasText: /Emma & Jordan/i }).first();
    const eventBtnLoose = page.locator("button").filter({ hasText: /Emma & Jordan/i }).first();
    const pick = (await eventBtn.count()) ? eventBtn : eventBtnLoose;
    if (!(await pick.count())) {
      const sheetText = await page.locator("body").innerText();
      record("use_questionnaire_apply", "FAIL", `Emma & Jordan not in picker. Snippet: ${sheetText.slice(0, 240)}`);
    } else {
      await pick.click();
      await page.waitForTimeout(4000);
      const url = page.url();
      const afterApply = sql(
        `select id, status, left(coalesce(custom_fields::text,'[]'),160), coalesce(template_id::text,''), (custom_fields::text like '%custom_%')::text from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
      );
      const ok = afterApply.includes(CLIENT_PLANNING_ID) || /\|t$/.test(afterApply) || afterApply.includes("|t|") || afterApply.endsWith("|t");
      // custom flag is last column — also accept navigation to event
      const pass = ok || url.includes(APPLY_EVENT_ID);
      record(
        "use_questionnaire_apply",
        pass ? "PASS" : "FAIL",
        `url=${url}; after=${afterApply.slice(0, 220)}`,
      );
      report.steps.push({ kind: "after_apply", afterApply, url });
      await page.screenshot({ path: path.join(OUT, "07-after-apply.png") });
    }

    // Isolation: promote to sent, edit library, compare snapshot
    let sentId = sql(
      `select id from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
    );
    if (sentId) {
      sql(
        `update event_questionnaires set status='sent', sent_at=coalesce(sent_at, now()) where id='${sentId}'`,
      );
      report.notes.push(`Promoted ${sentId} → sent via SQL for isolation (UI send not exercised)`);
      const beforeSnap = sql(
        `select status, md5(custom_fields::text), md5(master_overrides::text), md5(coalesce(array_to_string(field_order,','),'')) from event_questionnaires where id='${sentId}'`,
      );
      const isolationMarker = `Isolation-${Date.now()}`;
      await page.goto(`${BASE}/library/questionnaire-templates/${CLIENT_PLANNING_ID}`, {
        waitUntil: "domcontentloaded",
        timeout: 90000,
      });
      await page.waitForTimeout(1200);
      const nameVal = await page.locator("#q-name").inputValue();
      await page.locator("#q-name").fill(`${nameVal} ${isolationMarker}`);
      await page.getByRole("button", { name: /Add question/i }).click();
      await page.waitForTimeout(400);
      const custom = page.locator("div.rounded-sm.border").filter({ hasText: "Your question" }).last();
      if (await custom.count()) await custom.locator("textarea").first().fill(isolationMarker);
      await page.getByRole("button", { name: /Save changes/i }).first().click();
      await page.waitForTimeout(2500);
      const afterSnap = sql(
        `select status, md5(custom_fields::text), md5(master_overrides::text), md5(coalesce(array_to_string(field_order,','),'')) from event_questionnaires where id='${sentId}'`,
      );
      const libName = sql(`select name from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`);
      const isolated = beforeSnap === afterSnap && libName.includes(isolationMarker);
      record(
        "working_form_isolation",
        isolated ? "PASS" : "FAIL",
        isolated
          ? `Sent ${sentId} snapshot hashes unchanged; library updated`
          : `before=${beforeSnap} after=${afterSnap} lib=${libName.slice(0, 80)}`,
      );
      report.steps.push({ kind: "isolation", sentId, beforeSnap, afterSnap, libName });
    } else {
      record("working_form_isolation", "SKIP", "No event questionnaire row");
    }

    // RLS SQL
    const rls = sql(
      `select string_agg(polname || ':' || coalesce(pg_get_expr(polqual, polrelid),''), ' || ') from pg_policy where polrelid='questionnaire_templates'::regclass`,
    );
    const sweet = sql(
      `select (custom_fields::text like '%custom_%')::text, left(name,60) from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
    );
    const other = sql(
      `select id, left(custom_fields::text,80) from questionnaire_templates where venue_id='${OTHER_VENUE}' and kind='client_planning' and is_archived=false limit 1`,
    );
    const venueScoped = /current_user_venue_id/i.test(rls);
    const markerInOther = other.includes("QA-authoring") || other.includes("Isolation-");
    record(
      "cross_venue_rls_sql",
      venueScoped && !markerInOther && sweet.startsWith("t") ? "PASS" : "FAIL",
      `venueScoped=${venueScoped}; otherHasSweetMarker=${markerInOther}; sweet=${sweet}; rls=${rls.slice(0, 160)}`,
    );
    report.steps.push({ kind: "rls", rls, sweet, other });
  }
} catch (e) {
  report.defects.push(String(e?.stack || e));
  console.error(e);
} finally {
  await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(report, null, 2));
  console.log("\nUpdated qa-results.json");
  for (const [k, v] of Object.entries(report.matrix)) console.log(`  ${v.status.padEnd(7)} ${k}`);
  await browser.close();
}
