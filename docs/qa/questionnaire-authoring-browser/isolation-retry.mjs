/**
 * Re-prove working-form isolation after baseline save fix.
 */
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = "http://localhost:3000";
const CLIENT_PLANNING_ID = "4bec55b2-e174-42b7-b23e-e930d1be8963";
const APPLY_EVENT_ID = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11";
const chromePath =
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

function sql(q) {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_wevenu-website", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", q],
    { encoding: "utf8", timeout: 60000 },
  ).trim();
}

const report = JSON.parse(await readFile(path.join(OUT, "qa-results.json"), "utf8"));
report.isolationRetryAt = new Date().toISOString();

function record(id, status, note = "") {
  report.matrix[id] = { status, note };
  console.log(`[${status}] ${id} — ${note}`);
}

const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
if (page.url().includes("/login")) {
  await page.fill("#email", "owner@example.com");
  await page.fill("#password", "devpassword123");
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
}

let sentId = sql(
  `select id from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning'`,
);
if (!sentId) {
  record("working_form_isolation", "SKIP", "no working form");
} else {
  sql(`update event_questionnaires set status='sent', sent_at=coalesce(sent_at, now()) where id='${sentId}'`);
  const beforeSnap = sql(
    `select status, md5(custom_fields::text), md5(master_overrides::text), md5(coalesce(array_to_string(field_order,','),'')) from event_questionnaires where id='${sentId}'`,
  );
  const isolationMarker = `Isolation-${Date.now()}`;

  await page.goto(`${BASE}/library/questionnaire-templates/${CLIENT_PLANNING_ID}`, {
    waitUntil: "networkidle",
    timeout: 120000,
  }).catch(async () => {
    await page.goto(`${BASE}/library/questionnaire-templates/${CLIENT_PLANNING_ID}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
  });
  await page.waitForSelector("#q-name", { timeout: 30000 });
  await page.waitForTimeout(1000);

  const current = await page.locator("#q-name").inputValue();
  await page.locator("#q-name").click();
  await page.locator("#q-name").fill(`${current} ${isolationMarker}`);
  await page.waitForTimeout(300);

  // Confirm dirty affordance
  const dirtyHint = await page.locator("body").innerText();
  const sawDirty = /Unsaved|unsaved|Save changes/i.test(dirtyHint);

  const saveBtn = page.getByRole("button", { name: /Save changes/i }).first();
  const enabled = await saveBtn.isEnabled();
  if (!enabled) {
    // force a second edit to dirty
    await page.getByRole("button", { name: /Add question/i }).click();
    await page.waitForTimeout(500);
  }
  await saveBtn.click();
  await page.waitForTimeout(4000);

  // Wait until Save disabled or toast
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return /Changes saved|Saved just now/i.test(t);
  }, { timeout: 15000 }).catch(() => {});

  const afterSnap = sql(
    `select status, md5(custom_fields::text), md5(master_overrides::text), md5(coalesce(array_to_string(field_order,','),'')) from event_questionnaires where id='${sentId}'`,
  );
  const libName = sql(`select name from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`);
  const libUpdated = libName.includes(isolationMarker);
  const snapshotSame = beforeSnap === afterSnap;
  const pass = libUpdated && snapshotSame;
  record(
    "working_form_isolation",
    pass ? "PASS" : snapshotSame && !libUpdated ? "FAIL" : "FAIL",
    `libUpdated=${libUpdated}; snapshotUnchanged=${snapshotSame}; sawDirty=${sawDirty}; saveEnabledInitially=${enabled}; lib=${libName.slice(0, 90)}; before=${beforeSnap}; after=${afterSnap}`,
  );
  report.steps.push({
    kind: "isolation_retry",
    sentId,
    beforeSnap,
    afterSnap,
    libName,
    isolationMarker,
    sawDirty,
    enabled,
  });
  report.notes.push(
    snapshotSame
      ? "Sent working-form hashes unchanged after Library edit (isolation holds)."
      : "WARNING: sent working-form hashes changed after Library edit.",
  );
}

await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(report, null, 2));
console.log("matrix working_form_isolation:", report.matrix.working_form_isolation);
await browser.close();
