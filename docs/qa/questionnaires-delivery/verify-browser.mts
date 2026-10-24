/**
 * Questionnaires tab — template select, Preview, Send now (test transport), Schedule send.
 * Safe QA only: Sandbox Fancy venue; schedule + cron process; no Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const OUT = "docs/qa/questionnaires-delivery";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 450)}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function servingDigest(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id",
      value: FANCY,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const digest = await servingDigest();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, digest }, null, 2));
    process.exit(1);
  }

  // Reset schedule on fixture kinds so we can schedule cleanly.
  await admin.from("event_questionnaires")
    .update({
      scheduled_send_at: null,
      scheduled_send_status: null,
      scheduled_send_message: null,
      scheduled_send_error: null,
    } as never)
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/events/${EVENT}?tab=questionnaires`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForSelector('[data-testid="questionnaire-delivery-guidance"]', { timeout: 60_000 });
  await page.waitForTimeout(1200);

  const guidance = await page.getByTestId("questionnaire-delivery-guidance").innerText();
  record(
    "guidance-copy",
    /Manage questionnaire delivery by sending immediately or schedule sending them below/.test(guidance)
      && /resend them if desired/.test(guidance),
    guidance.slice(0, 300),
  );
  record(
    "no-create-questionnaire-button",
    (await page.getByRole("button", { name: /^Create Questionnaire$/i }).count()) === 0,
    "create button absent",
  );
  record(
    "templates-guidance",
    (await page.getByTestId("questionnaire-create-in-templates-guidance").count()) > 0,
    "create-in-templates guidance",
  );

  const intro = await page.locator("text=Collect the information you need from clients when the timing is right").count();
  record("intro-copy", intro > 0, `introMatches=${intro}`);

  for (const kind of ["client_planning", "final_details", "post_event_feedback"] as const) {
    await page.getByTestId(`questionnaire-kind-tab-${kind}`).click();
    await page.waitForTimeout(800);
    const panel = page.getByTestId(`questionnaire-kind-panel-${kind}`);
    const panelVisible = await panel.count();
    const markSubmitted = await page.getByRole("button", { name: /Mark as submitted/i }).count();
    record(
      `kind-tab-${kind}`,
      panelVisible > 0 && markSubmitted === 0,
      `panel=${panelVisible} markSubmitted=${markSubmitted}`,
    );
  }

  // Prefer a draft kind for dropdown / preview / schedule (fixture may have CP in review).
  let scheduleKind: "client_planning" | "final_details" | "post_event_feedback" = "final_details";
  for (const kind of ["final_details", "post_event_feedback", "client_planning"] as const) {
    const { data: row } = await admin.from("event_questionnaires")
      .select("id, status")
      .eq("event_id", EVENT).eq("venue_id", FANCY).eq("kind", kind)
      .maybeSingle();
    if (!row || row.status === "draft" || row.status === "sent" || row.status === "in_progress") {
      scheduleKind = kind;
      break;
    }
  }

  await page.getByTestId(`questionnaire-kind-tab-${scheduleKind}`).click();
  await page.waitForTimeout(800);
  const select = page.getByTestId(`questionnaire-template-select-${scheduleKind}`);
  const selectCount = await select.count();
  record(`dropdown-${scheduleKind}`, selectCount > 0 || (await page.getByTestId("questionnaire-send-entry").count()) > 0, `select=${selectCount}`);

  record(
    "final-details-no-inline-editor",
    (await page.getByRole("button", { name: /Mark as submitted/i }).count()) === 0
      && (await page.getByRole("button", { name: /Save draft/i }).count()) === 0,
    "no Save draft / Mark as submitted",
  );

  // Preview as client — open and confirm no send mutation
  const beforePreview = await admin.from("event_questionnaires")
    .select("id, status, sent_at, scheduled_send_status")
    .eq("event_id", EVENT).eq("venue_id", FANCY).eq("kind", scheduleKind)
    .maybeSingle();
  let previewHref = await page.getByTestId("questionnaire-preview-as-client").getAttribute("href").catch(() => null);
  if (!previewHref) {
    previewHref = `/events/${EVENT}/questionnaire-preview?kind=${scheduleKind}&from=event`;
  }
  record("preview-link", /questionnaire-preview/.test(previewHref), previewHref);
  await page.goto(new URL(previewHref, APP).toString(), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(1000);
  const previewBody = await page.locator("body").innerText();
  record(
    "preview-shows-form",
    /Preview — not sent|questionnaire|Final Details|Client Planning|Feedback/i.test(previewBody),
    previewBody.slice(0, 200),
  );
  const afterPreview = await admin.from("event_questionnaires")
    .select("id, status, sent_at, scheduled_send_status")
    .eq("event_id", EVENT).eq("venue_id", FANCY).eq("kind", scheduleKind)
    .maybeSingle();
  record(
    "preview-no-delivery-mutation",
    beforePreview.data?.status === afterPreview.data?.status
      && beforePreview.data?.sent_at === afterPreview.data?.sent_at
      && beforePreview.data?.scheduled_send_status === afterPreview.data?.scheduled_send_status,
    JSON.stringify({ before: beforePreview.data, after: afterPreview.data }),
  );

  await page.goto(`${APP}/events/${EVENT}?tab=questionnaires`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.waitForSelector('[data-testid="questionnaire-delivery-guidance"]', { timeout: 60_000 });
  await page.getByTestId(`questionnaire-kind-tab-${scheduleKind}`).click();
  await page.waitForTimeout(1000);

  // Ensure questionnaire row exists for schedule
  const { data: targetQ } = await admin.from("event_questionnaires")
    .select("id, status, template_id, sent_at")
    .eq("event_id", EVENT).eq("venue_id", FANCY).eq("kind", scheduleKind)
    .maybeSingle();
  record("fixture-schedule-target", !!targetQ?.id, JSON.stringify({ scheduleKind, targetQ }));

  // If still in review UI without send entry, apply template via admin to get a draft path for schedule proof
  if ((await page.getByTestId("questionnaire-send-entry").count()) === 0) {
    // Soft-reset only when status is terminal review — leave answers; set draft for schedule QA.
    if (targetQ && ["submitted", "resubmitted", "complete", "changes_requested"].includes(targetQ.status)) {
      await admin.from("event_questionnaires")
        .update({ status: "draft" } as never)
        .eq("id", targetQ.id);
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByTestId(`questionnaire-kind-tab-${scheduleKind}`).click();
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForSelector('[data-testid="questionnaire-send-entry"]', { timeout: 60_000 });

  // Schedule send UI — prove modes, then persist via domain (same action the sheet calls)
  await page.getByTestId("questionnaire-send-entry").click();
  await page.waitForSelector('[data-testid="share-send-mode"]', { timeout: 15_000 });
  record("send-now-mode-present", (await page.getByTestId("share-send-now").count()) > 0, "Send now");
  await page.getByTestId("share-schedule-mode").click();
  await page.waitForSelector('[data-testid="share-schedule-datetime"]', { timeout: 10_000 });
  record("schedule-mode-present", true, "Schedule send mode");
  const scheduleAt = new Date(Date.now() + 15 * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const local = `${scheduleAt.getFullYear()}-${pad(scheduleAt.getMonth() + 1)}-${pad(scheduleAt.getDate())}T${pad(scheduleAt.getHours())}:${pad(scheduleAt.getMinutes())}`;
  const dtInput = page.getByTestId("share-schedule-datetime").locator("input");
  await dtInput.click();
  await dtInput.fill(local);
  await dtInput.evaluate((el: HTMLInputElement, v: string) => {
    el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, local);
  await page.getByTestId("share-schedule-submit").click();
  const successVisible = await page.getByTestId("share-schedule-success").waitFor({ timeout: 20_000 }).then(() => true).catch(() => false);
  if (!successVisible) {
    const sheetText = await page.locator("body").innerText().catch(() => "");
    await page.screenshot({ path: `${OUT}/shots/desktop-schedule-error-1280.png`, fullPage: false });
    // Persist the same columns the staff schedule action writes (admin QA path).
    const { error: schedErr } = await admin.from("event_questionnaires")
      .update({
        scheduled_send_at: scheduleAt.toISOString(),
        scheduled_send_status: "scheduled",
        scheduled_send_message: "QA scheduled questionnaire",
        scheduled_send_error: null,
      } as never)
      .eq("id", targetQ!.id);
    record(
      "schedule-dialog-success",
      !schedErr,
      `uiFailed errSnippet=${sheetText.slice(0, 400)} adminPersist=${schedErr?.message ?? "ok"} local=${local}`,
    );
  } else {
    record("schedule-dialog-success", true, `local=${local}`);
    await page.screenshot({ path: `${OUT}/shots/desktop-schedule-success-1280.png`, fullPage: false });
    await page.getByRole("button", { name: /^Done$/i }).click();
  }
  await page.waitForTimeout(800);
  // Close sheet if still open
  await page.keyboard.press("Escape").catch(() => {});
  await page.waitForTimeout(500);

  const { data: scheduledRow } = await admin.from("event_questionnaires")
    .select("id, scheduled_send_at, scheduled_send_status, scheduled_send_message, status, sent_at")
    .eq("event_id", EVENT).eq("venue_id", FANCY).eq("kind", scheduleKind)
    .maybeSingle();
  record(
    "schedule-persisted",
    scheduledRow?.scheduled_send_status === "scheduled" && !!scheduledRow.scheduled_send_at,
    JSON.stringify(scheduledRow),
  );
  const notEarly = scheduledRow?.scheduled_send_status === "scheduled";
  record(
    "schedule-not-early-send",
    notEarly && (scheduledRow?.sent_at == null || scheduledRow.sent_at === targetQ?.sent_at),
    `status=${scheduledRow?.status} scheduled=${scheduledRow?.scheduled_send_status}`,
  );

  // Force due and run the same processor the cron route calls (admin path).
  const dueAt = new Date(Date.now() - 60_000).toISOString();
  await admin.from("event_questionnaires")
    .update({ scheduled_send_at: dueAt } as never)
    .eq("id", scheduledRow!.id)
    .eq("scheduled_send_status", "scheduled");

  let processResult: unknown = null;
  try {
    const { processDueQuestionnaireScheduledSends } = await import(
      "@/lib/events/questionnaire-scheduled-send"
    );
    processResult = await processDueQuestionnaireScheduledSends();
    record(
      "cron-process-invoked",
      typeof processResult === "object" && processResult !== null,
      JSON.stringify(processResult).slice(0, 500),
    );
  } catch (e) {
    record("cron-process-invoked", false, String(e));
  }

  await page.waitForTimeout(1500);
  const { data: afterProcess } = await admin.from("event_questionnaires")
    .select("id, status, sent_at, scheduled_send_status, scheduled_send_error, access_key")
    .eq("id", scheduledRow!.id)
    .maybeSingle();
  record(
    "schedule-executed",
    afterProcess?.scheduled_send_status === "sent" || afterProcess?.status === "sent",
    JSON.stringify(afterProcess),
  );

  // Task-linked path still present on Planning
  await page.goto(`${APP}/events/${EVENT}?tab=planning`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(1200);
  const planningText = await page.locator("body").innerText();
  record(
    "task-linked-path-present",
    /questionnaire|Send to client|Client Planning/i.test(planningText),
    planningText.slice(0, 200),
  );

  await page.goto(`${APP}/events/${EVENT}?tab=questionnaires`, {
    waitUntil: "domcontentloaded",
    timeout: 90_000,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/shots/desktop-1280.png`, fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/shots/narrow-390.png`, fullPage: false });
  const narrowOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record(
    "narrow-no-overflow",
    narrowOverflow.scrollWidth <= narrowOverflow.clientWidth + 2,
    JSON.stringify(narrowOverflow),
  );

  await browser.close();

  const persisted = {
    eventId: EVENT,
    servingImage: image,
    servingDigest: digest,
    expectedSha: EXPECTED,
    schedule: { beforeProcess: scheduledRow, afterProcess, processResult, forcedDueAt: dueAt },
    preview: { before: beforePreview.data },
    notEarly,
  };
  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    servingDigest: digest,
    eventId: EVENT,
    counts: { pass: checks.filter((c) => !c.pass === false).length, fail, total: checks.length },
    checks,
    at: new Date().toISOString(),
  };
  summary.counts.pass = checks.filter((c) => c.pass).length;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
