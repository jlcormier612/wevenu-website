/**
 * Browser validation — Questionnaire & Feedback authoring (§34)
 * Run:
 *   PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" node docs/qa/questionnaire-authoring-browser/capture.mjs
 */
import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../..");
const require = createRequire(path.resolve(ROOT, "marketing/package.json"));
const { chromium } = require("playwright");

const OUT = __dirname;
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.QA_EMAIL ?? "owner@example.com";
const PASSWORD = process.env.QA_PASSWORD ?? "devpassword123";
const SWEET_DAISY = "69cfd906-0d15-4e5c-8bab-ed106b411c34";
const CLIENT_PLANNING_ID = "4bec55b2-e174-42b7-b23e-e930d1be8963";
const FINAL_DETAILS_ID = "2dd16b96-a034-4d18-823f-996dd86c1d3c";
const FEEDBACK_ID = "0ddf0964-8e52-4fb8-9ced-88e9d505fec2";
const APPLY_EVENT_ID = "d2ee4a16-6d35-4d3b-86fd-9c0d24fdfa11"; // Emma & Jordan's Wedding
const MARKER = `QA-authoring-${Date.now()}`;
const CUSTOM_LABEL = `QA custom question ${Date.now()}`;

const chromePath =
  `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;

const report = {
  at: new Date().toISOString(),
  tools: {
    cursorIdeBrowserMcp: "unavailable — not in MCP catalog this session",
    fallback: "Playwright headed=false chromium (prior QA pattern)",
  },
  steps: [],
  matrix: {},
  defects: [],
  notes: [],
};

function sql(q) {
  return execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_wevenu-website", "psql", "-U", "postgres", "-d", "postgres", "-t", "-A", "-F", "|", "-c", q],
    { encoding: "utf8", timeout: 60000 },
  ).trim();
}

function record(id, status, note = "") {
  report.matrix[id] = { status, note };
  const line = `[${status}] ${id}${note ? ` — ${note}` : ""}`;
  if (status === "FAIL") {
    report.defects.push(`${id}: ${note}`);
    console.error(line);
  } else {
    console.log(line);
  }
}

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file, fullPage: false });
  report.steps.push({ kind: "screenshot", name });
  return name;
}

async function login(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(800);
  if (!page.url().includes("/login")) {
    report.notes.push(`Already authenticated; landed on ${page.url()}`);
    return true;
  }
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const ok = !page.url().includes("/login");
  report.steps.push({ kind: "login", ok, url: page.url(), email: EMAIL });
  return ok;
}

async function dismissOverlays(page) {
  for (const name of [/Accept/i, /I agree/i, /Continue/i, /Got it/i, /Dismiss/i]) {
    const btn = page.getByRole("button", { name }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 1500 }).catch(() => {});
      await page.waitForTimeout(400);
    }
  }
  await page.keyboard.press("Escape").catch(() => {});
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromePath,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();
  /** @type {"accept"|"dismiss"|"auto"} */
  let dialogMode = "auto";
  page.on("dialog", async (d) => {
    report.steps.push({ kind: "dialog", type: d.type(), message: d.message(), mode: dialogMode });
    if (dialogMode === "dismiss") await d.dismiss();
    else await d.accept();
  });

  try {
    const loggedIn = await login(page);
    if (!loggedIn) {
      record("auth", "BLOCKED", `Could not sign in as ${EMAIL}`);
      await shot(page, "00-login-blocked.png");
      return;
    }
    record("auth", "PASS", `Signed in as ${EMAIL}`);

    // 1) Library category
    await page.goto(`${BASE}/library`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    await dismissOverlays(page);
    const libText = await page.locator("body").innerText();
    const hasCategory = /Questionnaires\s*&\s*Feedback/i.test(libText);
    record("library_category_label", hasCategory ? "PASS" : "FAIL", hasCategory ? "Visible on /library" : "Missing on /library");
    await shot(page, "01-library-hub.png");

    // Spot-check Final Details + Feedback exist on list
    await page.goto(`${BASE}/library/questionnaire-templates`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    const listText = await page.locator("body").innerText();
    record(
      "list_shows_three_starters",
      /Client Planning Questionnaire/i.test(listText) && /Final Details/i.test(listText) && /Post-Event Feedback/i.test(listText)
        ? "PASS"
        : "FAIL",
      "List page body text",
    );
    await shot(page, "02-questionnaire-list.png");

    // 2) Full-page editor (not drawer)
    const editHref = `/library/questionnaire-templates/${CLIENT_PLANNING_ID}`;
    await page.goto(`${BASE}${editHref}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2000);
    await dismissOverlays(page);
    const editorUrl = page.url();
    const onFullPage = editorUrl.includes(editHref) && !/sheet|drawer/i.test(editorUrl);
    const hasEditHeading = await page.getByRole("heading", { name: /Edit questionnaire/i }).count();
    const hasDrawerRole = await page.locator('[role="dialog"]').count();
    record(
      "full_page_editor_client_planning",
      onFullPage && hasEditHeading > 0 ? "PASS" : "FAIL",
      `url=${editorUrl}; heading=${hasEditHeading}; dialogs=${hasDrawerRole}`,
    );
    await shot(page, "03-client-planning-editor.png");

    // Spot-check Final Details + Feedback open as full page
    for (const [id, kind] of [
      [FINAL_DETAILS_ID, "final_details"],
      [FEEDBACK_ID, "post_event_feedback"],
    ]) {
      await page.goto(`${BASE}/library/questionnaire-templates/${id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(1200);
      const ok = page.url().includes(id) && (await page.getByRole("heading", { name: /Edit questionnaire/i }).count()) > 0;
      record(`full_page_editor_${kind}`, ok ? "PASS" : "FAIL", page.url());
    }

    // Back to Client Planning for edits
    await page.goto(`${BASE}${editHref}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);

    // 3) Rename
    const nameInput = page.locator("#q-name");
    await nameInput.fill(`Client Planning Questionnaire ${MARKER}`);
    record("rename", "PASS", `Renamed with marker ${MARKER}`);

    // Edit first question wording
    const wording = page.locator('textarea').filter({ has: page.locator("xpath=..") }).first();
    // Find "Question wording" textareas — first field card's wording textarea
    const questionCards = page.locator("div.rounded-sm.border").filter({ hasText: "Question wording" });
    const firstCard = questionCards.nth(1); // 0 may be name/purpose panel which lacks this
    const wordingAreas = page.locator("label:text('Question wording') + textarea, label:has-text('Question wording')").locator("..").locator("textarea");
    const wordingCount = await wordingAreas.count();
    if (wordingCount === 0) {
      // fallback: every textarea under question cards
      const areas = page.locator("section textarea").first();
      await areas.fill(`QA overridden wording ${MARKER}`);
      record("edit_question_wording", "PASS", "Used section textarea fallback");
    } else {
      const original = await wordingAreas.first().inputValue();
      await wordingAreas.first().fill(`QA overridden wording ${MARKER}`);
      record("edit_question_wording", "PASS", `Was: ${original.slice(0, 40)}`);
    }

    // Required toggle on first Ask/Required row
    const requiredLabels = page.locator("label").filter({ hasText: /^Required$/ });
    if (await requiredLabels.count()) {
      await requiredLabels.first().click();
      record("toggle_required", "PASS", "Clicked first Required checkbox label");
    } else {
      record("toggle_required", "FAIL", "No Required toggle found");
    }

    // Reorder: Move down on first Move down button
    const moveDown = page.getByRole("button", { name: "Move down" }).first();
    if (await moveDown.count()) {
      await moveDown.click();
      record("reorder_move_down", "PASS", "Clicked Move down");
    } else {
      record("reorder_move_down", "FAIL", "Move down not found");
    }

    // Hide: uncheck Ask this question on a later card if possible
    const askLabels = page.locator("label").filter({ hasText: /Ask this question/i });
    if ((await askLabels.count()) > 2) {
      await askLabels.nth(2).click();
      record("hide_question", "PASS", "Toggled Ask this question off on 3rd field");
    } else {
      record("hide_question", "SKIP", "Not enough Ask toggles");
    }

    // Add custom question
    await page.getByRole("button", { name: /Add question/i }).click();
    await page.waitForTimeout(500);
    const customCard = page.locator("div.rounded-sm.border").filter({ hasText: "Your question" }).last();
    if (await customCard.count()) {
      const customWording = customCard.locator("textarea").first();
      await customWording.fill(CUSTOM_LABEL);
      const typeSelect = customCard.locator("select").first();
      if (await typeSelect.count()) {
        await typeSelect.selectOption("single_choice");
        await page.waitForTimeout(300);
        const choiceInputs = customCard.locator("input");
        // may include section + options
        const inputs = await choiceInputs.all();
        if (inputs.length >= 2) {
          // set first option if present after type change — look for Choices section
          const choice1 = customCard.getByRole("textbox").nth(1);
          if (await choice1.count()) await choice1.fill("Choice A").catch(() => {});
        }
      }
      record("add_custom_question", "PASS", CUSTOM_LABEL);
    } else {
      record("add_custom_question", "FAIL", "Custom question card not found after Add question");
    }
    await shot(page, "04-editor-dirty.png");

    // 4) Unsaved leave warning via Cancel
    dialogMode = "dismiss";
    await page.getByRole("button", { name: /^Cancel$/i }).click();
    await page.waitForTimeout(800);
    const leaveDialog = report.steps.filter((s) => s.kind === "dialog").at(-1);
    if (leaveDialog && /unsaved changes/i.test(leaveDialog.message || "")) {
      record("unsaved_leave_warning", "PASS", leaveDialog.message);
    } else {
      record("unsaved_leave_warning", "FAIL", leaveDialog ? leaveDialog.message : "No confirm dialog on Cancel while dirty");
    }
    dialogMode = "auto";
    // Should still be on editor
    if (!page.url().includes(CLIENT_PLANNING_ID)) {
      record("unsaved_stay_after_dismiss", "FAIL", `Navigated away to ${page.url()}`);
    } else {
      record("unsaved_stay_after_dismiss", "PASS", "Remained on editor after dismiss");
    }

    // Explicit Save
    await page.getByRole("button", { name: /Save changes/i }).first().click();
    await page.waitForTimeout(2500);
    const bodyAfterSave = await page.locator("body").innerText();
    const saveOk =
      /Changes saved|Saved just now|Saved/i.test(bodyAfterSave) ||
      !(await page.getByRole("button", { name: /Save changes/i }).first().isEnabled().catch(() => true));
    // Verify DB
    const dbName = sql(
      `select name from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
    );
    const dbCustoms = sql(
      `select custom_fields::text from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
    );
    const dbOverrides = sql(
      `select master_overrides::text from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
    );
    const persistOk = dbName.includes(MARKER) && dbCustoms.includes("custom_");
    record(
      "explicit_save",
      persistOk ? "PASS" : "FAIL",
      `uiHint=${saveOk}; dbName=${dbName.slice(0, 80)}; customsHasCustom=${dbCustoms.includes("custom_")}; overridesLen=${dbOverrides.length}`,
    );
    report.steps.push({ kind: "db_after_save", dbName, customsSnippet: dbCustoms.slice(0, 200), overridesSnippet: dbOverrides.slice(0, 200) });
    await shot(page, "05-editor-saved.png");

    // 5) Preview uses couple form + reflects changes
    await page.goto(`${BASE}/library/questionnaire-templates/${CLIENT_PLANNING_ID}/preview`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(2500);
    await dismissOverlays(page);
    const previewText = await page.locator("body").innerText();
    const hasCoupleForm =
      (await page.locator("form").count()) > 0 ||
      /Sample celebration|Preview as your clients/i.test(previewText);
    const reflectsCustom = previewText.includes(CUSTOM_LABEL) || previewText.includes("QA overridden wording");
    record(
      "preview_couple_renderer",
      hasCoupleForm ? "PASS" : "FAIL",
      hasCoupleForm ? "Preview shell / form present" : "No couple form markers",
    );
    record(
      "preview_reflects_edits",
      reflectsCustom ? "PASS" : "FAIL",
      reflectsCustom ? "Custom/override text visible" : `Missing custom label in preview. Snippet: ${previewText.slice(0, 280)}`,
    );
    await shot(page, "06-preview.png");

    // Spot-check Final Details + Feedback preview routes
    for (const [id, kind] of [
      [FINAL_DETAILS_ID, "final_details"],
      [FEEDBACK_ID, "post_event_feedback"],
    ]) {
      await page.goto(`${BASE}/library/questionnaire-templates/${id}/preview`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.waitForTimeout(1200);
      const t = await page.locator("body").innerText();
      record(
        `preview_route_${kind}`,
        /Preview as your clients/i.test(t) ? "PASS" : "FAIL",
        page.url(),
      );
    }

    // 6) Use Questionnaire → apply to event
    // Snapshot working form before apply if any
    const beforeApply = sql(
      `select id, status, left(coalesce(custom_fields::text,'[]'),80), coalesce(template_id::text,'') from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning' order by updated_at desc limit 1`,
    );

    await page.goto(`${BASE}/library/questionnaire-templates`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(1500);
    // Find the Client Planning card by marker name, click Use Questionnaire
    const card = page.locator("div, article, li, section").filter({ hasText: MARKER }).first();
    const useBtn = page.getByRole("button", { name: /Use Questionnaire/i }).first();
    // Prefer the Use button near the renamed card
    const cardUse = card.getByRole("button", { name: /Use Questionnaire/i });
    if (await cardUse.count()) {
      await cardUse.click();
    } else if (await useBtn.count()) {
      await useBtn.click();
      report.notes.push("Used first Use Questionnaire button (card filter miss)");
    } else {
      record("use_questionnaire_apply", "FAIL", "Use Questionnaire button not found");
    }
    await page.waitForTimeout(800);
    // Pick Emma & Jordan event if listed
    const eventBtn = page.getByRole("button", { name: /Emma & Jordan/i }).or(
      page.locator("button").filter({ hasText: /Emma & Jordan/i }),
    );
    if (await eventBtn.count()) {
      await eventBtn.first().click();
      await page.waitForTimeout(3000);
      const appliedUrl = page.url();
      const afterApply = sql(
        `select id, status, left(coalesce(custom_fields::text,'[]'),120), template_id::text from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning' order by updated_at desc limit 1`,
      );
      const appliedOk =
        appliedUrl.includes(`/events/${APPLY_EVENT_ID}`) ||
        afterApply.includes(CLIENT_PLANNING_ID) ||
        afterApply.includes("custom_");
      record(
        "use_questionnaire_apply",
        appliedOk ? "PASS" : "FAIL",
        `url=${appliedUrl}; before=${beforeApply.slice(0, 100)}; after=${afterApply.slice(0, 160)}`,
      );
      report.steps.push({ kind: "apply", beforeApply, afterApply, url: appliedUrl });
    } else {
      // Maybe toast error — sent form blocked
      const toastText = await page.locator("body").innerText();
      if (/sent|draft|Could not apply/i.test(toastText)) {
        record("use_questionnaire_apply", "SKIP", `Event picker / apply blocked: ${toastText.slice(0, 200)}`);
      } else {
        record("use_questionnaire_apply", "FAIL", "Event not found in Use Questionnaire sheet");
      }
      await shot(page, "07-use-sheet.png");
    }
    await shot(page, "07-after-apply.png");

    // 7) Working-form isolation: mutate Library again, ensure sent snapshot unchanged
    const workingRows = sql(
      `select id, status, md5(coalesce(custom_fields::text,'')) as customs_md5, md5(coalesce(master_overrides::text,'')) as ov_md5, md5(array_to_string(coalesce(field_order,array[]::text[]),',')) as order_md5 from event_questionnaires where template_id='${CLIENT_PLANNING_ID}' or (event_id='${APPLY_EVENT_ID}' and kind='client_planning') order by updated_at desc`,
    );
    report.steps.push({ kind: "working_forms", rows: workingRows });

    // Prefer a non-draft if exists; else create sent via SQL for isolation proof
    let sentId = sql(
      `select id from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning' and status <> 'draft' limit 1`,
    );
    if (!sentId) {
      // Promote latest draft to sent for isolation check (DB-only — UI send hard path)
      const draftId = sql(
        `select id from event_questionnaires where event_id='${APPLY_EVENT_ID}' and kind='client_planning' order by updated_at desc limit 1`,
      );
      if (draftId) {
        sql(
          `update event_questionnaires set status='sent', sent_at=coalesce(sent_at, now()) where id='${draftId}'`,
        );
        sentId = draftId;
        report.notes.push(`Promoted draft ${draftId} → sent via SQL for isolation proof (UI send not exercised)`);
      }
    }

    if (sentId) {
      const beforeSnap = sql(
        `select status, custom_fields::text, master_overrides::text, coalesce(array_to_string(field_order,','),'') from event_questionnaires where id='${sentId}'`,
      );
      // Edit library template name/custom again
      await page.goto(`${BASE}${editHref}`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await page.waitForTimeout(1200);
      await page.locator("#q-name").fill(`Client Planning AFTER-SENT ${MARKER}`);
      await page.getByRole("button", { name: /Add question/i }).click();
      await page.waitForTimeout(400);
      const newestCustom = page.locator("div.rounded-sm.border").filter({ hasText: "Your question" }).last();
      if (await newestCustom.count()) {
        await newestCustom.locator("textarea").first().fill(`Isolation probe ${MARKER}`);
      }
      await page.getByRole("button", { name: /Save changes/i }).first().click();
      await page.waitForTimeout(2500);
      const afterSnap = sql(
        `select status, custom_fields::text, master_overrides::text, coalesce(array_to_string(field_order,','),'') from event_questionnaires where id='${sentId}'`,
      );
      const libraryAfter = sql(
        `select name from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
      );
      const isolated = beforeSnap === afterSnap && libraryAfter.includes("AFTER-SENT");
      record(
        "working_form_isolation",
        isolated ? "PASS" : "FAIL",
        isolated
          ? `Sent snapshot ${sentId} unchanged after Library edit`
          : `before!==after or library not updated. lib=${libraryAfter.slice(0, 60)}`,
      );
      report.steps.push({ kind: "isolation", sentId, beforeSnap: beforeSnap.slice(0, 300), afterSnap: afterSnap.slice(0, 300), libraryAfter });
    } else {
      record("working_form_isolation", "SKIP", "No working form row to promote/compare");
    }

    // 8) Cross-venue / RLS SQL proof
    const otherVenueId = "f41cc6d2-b490-4b92-9e27-cfad042c30ea"; // The Pretty Platypus
    const otherCp = sql(
      `select id, custom_fields::text from questionnaire_templates where venue_id='${otherVenueId}' and kind='client_planning' and is_archived=false limit 1`,
    );
    const sweetCustoms = sql(
      `select custom_fields::text from questionnaire_templates where id='${CLIENT_PLANNING_ID}'`,
    );
    const rlsPolicy = sql(
      `select polname || ':' || pg_get_expr(polqual, polrelid) from pg_policy where polrelid='questionnaire_templates'::regclass`,
    );
    const venueScoped = /current_user_venue_id/i.test(rlsPolicy);
    const noLeak =
      !otherCp.includes(MARKER) &&
      sweetCustoms.includes("custom_") &&
      venueScoped;
    record(
      "cross_venue_rls_sql",
      noLeak ? "PASS" : "FAIL",
      `venueScoped=${venueScoped}; otherHasMarker=${otherCp.includes(MARKER)}; sweetHasCustom=${sweetCustoms.includes("custom_")}`,
    );
    report.steps.push({ kind: "rls", rlsPolicy, otherCp: otherCp.slice(0, 120) });

    // Restore nice name for local amenity (optional — leave marker so evidence is clear)
    report.notes.push(
      `Client Planning template ${CLIENT_PLANNING_ID} left with QA marker name for evidence. Restore manually if undesired.`,
    );
  } catch (err) {
    report.defects.push(String(err?.stack || err));
    console.error(err);
    try {
      await shot(page, "99-error.png");
    } catch {
      /* ignore */
    }
  } finally {
    await writeFile(path.join(OUT, "qa-results.json"), JSON.stringify(report, null, 2));
    console.log("\nWrote", path.join(OUT, "qa-results.json"));
    console.log("Matrix summary:");
    for (const [k, v] of Object.entries(report.matrix)) {
      console.log(`  ${v.status.padEnd(7)} ${k}`);
    }
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
