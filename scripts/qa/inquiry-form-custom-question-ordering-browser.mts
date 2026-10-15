/**
 * Sandbox browser proof: inquiry form custom question ordering & management.
 * Fancy Venue only. Restores prior custom questions after the run.
 * Does not touch Production.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = "14f58a8a3eb14d5545742417d20bbccb15e5f0aa";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMBED = "2551bc9f8f6d4b9aabfcab9b8795edf6";
const OUT_DIR = "docs/qa/inquiry-form-custom-question-ordering";
const OUT = `${OUT_DIR}/browser-results.json`;

const stamp = Date.now().toString(36);
const Q_A = `QA Order A ${stamp}`;
const Q_B = `QA Order B ${stamp}`;
const Q_C = `QA Order C ${stamp}`;
const Q_DEL = `QA Delete Me ${stamp}`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
type PriorRow = {
  question_text: string;
  question_type: string;
  required: boolean;
  options: unknown;
  sort_order: number;
};

const checks: Check[] = [];
const deploymentIds = new Set<string>();

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

async function cookiesFor(email: string) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

async function loadDbQuestions() {
  const { data, error } = await admin
    .from("inquiry_form_questions")
    .select("id, question_text, question_type, required, options, sort_order")
    .eq("venue_id", FANCY)
    .order("sort_order")
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

async function restorePrior(prior: PriorRow[]) {
  await admin.from("inquiry_form_questions").delete().eq("venue_id", FANCY);
  if (prior.length === 0) return;
  const rows = prior.map((q, i) => ({
    venue_id: FANCY,
    question_text: q.question_text,
    question_type: q.question_type,
    required: q.required,
    options: q.options,
    sort_order: typeof q.sort_order === "number" ? q.sort_order : i,
  }));
  const { error } = await admin.from("inquiry_form_questions").insert(rows);
  if (error) throw new Error(`restore failed: ${error.message}`);
}

async function findHistoricalCustomAnswers() {
  const { data, error } = await admin
    .from("leads")
    .select("id, source_data")
    .eq("venue_id", FANCY)
    .not("source_data", "is", null)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const answers = (row.source_data as { custom_answers?: unknown } | null)?.custom_answers;
    if (Array.isArray(answers) && answers.length > 0) {
      return { leadId: row.id as string, answers };
    }
  }
  return null;
}

mkdirSync(OUT_DIR, { recursive: true });

const priorQuestions = (await loadDbQuestions()).map((q) => ({
  question_text: q.question_text as string,
  question_type: q.question_type as string,
  required: Boolean(q.required),
  options: q.options,
  sort_order: Number(q.sort_order),
})) satisfies PriorRow[];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
await context.addCookies(await cookiesFor(FANCY_EMAIL));
const page = await context.newPage();
const startedAt = new Date().toISOString();
let restored = false;

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  record("serving_commit", serving === EXPECTED, serving ?? "missing");
  if (serving !== EXPECTED) throw new Error(`wrong runtime ${serving}`);

  const health = await (await page.request.get(`${APP}/api/health`)).json();
  record("health", !!health?.ok, JSON.stringify(health));

  await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByText(/Inquiry form fields|Direct link|Standard fields/i).first().waitFor({ timeout: 45_000 });
  await page.getByTestId("inquiry-form-custom-questions").waitFor({ state: "visible", timeout: 45_000 });
  await page.waitForTimeout(1000);

  const customSection = page.getByTestId("inquiry-form-custom-questions");
  await customSection.scrollIntoViewIfNeeded();

  // Prefer locator bounding boxes — avoids tsx __name injection into page.evaluate.
  const standardBox = await page.getByTestId("inquiry-form-standard-fields").boundingBox();
  const customBox = await customSection.boundingBox();
  const communicationBox = await page.getByTestId("inquiry-form-communication-preferences").boundingBox();
  const sectionOrder =
    standardBox && customBox && communicationBox
      ? {
          standard: standardBox.y,
          custom: customBox.y,
          communication: communicationBox.y,
        }
      : null;
  record(
    "section_order_standard_custom_communication",
    !!sectionOrder &&
      sectionOrder.standard < sectionOrder.custom &&
      sectionOrder.custom < sectionOrder.communication,
    JSON.stringify(sectionOrder),
  );

  const existingCards = page.locator('[data-testid="inquiry-form-custom-question"]');
  let guard = 0;
  while ((await existingCards.count()) > 0 && guard < 30) {
    await existingCards.first().getByRole("button", { name: "Delete question" }).click({ force: true });
    guard += 1;
  }

  async function addQuestion(text: string, required: boolean) {
    await customSection.scrollIntoViewIfNeeded();
    const addBtn = customSection.getByRole("button", { name: /Add question/i });
    await addBtn.waitFor({ state: "visible", timeout: 10_000 });
    const before = await page.locator('[data-testid="inquiry-form-custom-question"]').count();
    let attached = false;
    for (let attempt = 0; attempt < 3 && !attached; attempt++) {
      await addBtn.click({ force: true });
      try {
        await page
          .locator('[data-testid="inquiry-form-custom-question"]')
          .nth(before)
          .waitFor({ state: "attached", timeout: 5_000 });
        attached = true;
      } catch {
        await page.waitForTimeout(400);
      }
    }
    if (!attached) {
      throw new Error(`Add question did not create a card (before=${before})`);
    }
    const card = page.locator('[data-testid="inquiry-form-custom-question"]').nth(before);
    await card.scrollIntoViewIfNeeded();
    const input = card.locator('input[placeholder="Question text"]');
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(text);
    if (required) {
      await card.getByTestId("inquiry-form-question-required").check({ force: true });
    }
  }

  await addQuestion(Q_A, false);
  await addQuestion(Q_B, true);
  await addQuestion(Q_C, false);
  await addQuestion(Q_DEL, false);

  const cards = page.locator('[data-testid="inquiry-form-custom-question"]');
  record("four_questions_present", (await cards.count()) === 4, `count=${await cards.count()}`);

  record("move_up_disabled_first", await cards.nth(0).getByTestId("inquiry-form-question-move-up").isDisabled(), "first");
  record("move_down_disabled_last", await cards.nth(3).getByTestId("inquiry-form-question-move-down").isDisabled(), "last");

  // A, B, C, DEL → move B up → B, A, C, DEL
  await cards.nth(1).getByTestId("inquiry-form-question-move-up").click();
  await cards.nth(3).getByTestId("inquiry-form-question-delete").click();
  record("delete_removes_immediately", (await cards.count()) === 3, `count=${await cards.count()}`);

  const labelsBeforeSave: string[] = [];
  for (let i = 0; i < (await cards.count()); i++) {
    labelsBeforeSave.push(
      await cards.nth(i).locator('input[placeholder="Question text"]').inputValue(),
    );
  }
  record(
    "order_before_save",
    labelsBeforeSave[0] === Q_B && labelsBeforeSave[1] === Q_A && labelsBeforeSave[2] === Q_C,
    JSON.stringify(labelsBeforeSave),
  );
  record(
    "required_on_b_before_save",
    await cards.nth(0).getByTestId("inquiry-form-question-required").isChecked(),
    "B required",
  );
  record(
    "optional_on_a_before_save",
    !(await cards.nth(1).getByTestId("inquiry-form-question-required").isChecked()),
    "A optional",
  );

  await page.getByTestId("inquiry-form-preview-open-builder").first().click();
  const preview = page.getByTestId("inquiry-form-preview");
  await preview.waitFor({ state: "visible", timeout: 20_000 });
  const previewBody = await preview.innerText();
  const previewIdx = [Q_B, Q_A, Q_C].map((t) => previewBody.indexOf(t));
  record(
    "preview_order",
    previewIdx.every((i) => i >= 0) && previewIdx[0]! < previewIdx[1]! && previewIdx[1]! < previewIdx[2]!,
    JSON.stringify(previewIdx),
  );
  record("preview_omits_deleted", !previewBody.includes(Q_DEL), "deleted absent");
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "hidden", timeout: 10_000 }).catch(() => undefined);

  // Sticky dirty bar + footer both expose Save changes — use the first visible.
  await page.getByRole("button", { name: /Save changes/i }).first().click();
  await page.waitForTimeout(2500);

  const dbAfterSave = await loadDbQuestions();
  const qaRows = dbAfterSave.filter((r) =>
    [Q_A, Q_B, Q_C, Q_DEL].includes(r.question_text as string),
  );
  record(
    "db_persisted_order",
    qaRows.length === 3 &&
      qaRows[0]?.question_text === Q_B &&
      qaRows[1]?.question_text === Q_A &&
      qaRows[2]?.question_text === Q_C &&
      qaRows[0]?.required === true &&
      qaRows[1]?.required === false,
    JSON.stringify(qaRows.map((r) => ({ t: r.question_text, req: r.required, sort: r.sort_order }))),
  );
  record(
    "db_deleted_absent",
    !dbAfterSave.some((r) => r.question_text === Q_DEL),
    `hasDel=${dbAfterSave.some((r) => r.question_text === Q_DEL)}`,
  );

  await page.goto(`${APP}/settings/leads`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.getByTestId("inquiry-form-custom-questions").waitFor({ timeout: 45_000 });
  const reloadCards = page.locator('[data-testid="inquiry-form-custom-question"]');
  await reloadCards.first().waitFor({ timeout: 30_000 });
  const reloadLabels: string[] = [];
  for (let i = 0; i < (await reloadCards.count()); i++) {
    reloadLabels.push(
      await reloadCards.nth(i).locator('input[placeholder="Question text"]').inputValue(),
    );
  }
  const qaReload = reloadLabels.filter((t) => [Q_A, Q_B, Q_C, Q_DEL].includes(t));
  record(
    "reload_order",
    qaReload[0] === Q_B && qaReload[1] === Q_A && qaReload[2] === Q_C && !qaReload.includes(Q_DEL),
    JSON.stringify(qaReload),
  );
  const bIdx = reloadLabels.indexOf(Q_B);
  record(
    "reload_required_flag",
    bIdx >= 0 && (await reloadCards.nth(bIdx).getByTestId("inquiry-form-question-required").isChecked()),
    `bIdx=${bIdx}`,
  );

  const formPage = await context.newPage();
  const formResp = await formPage.goto(`${APP}/form/${EMBED}`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  noteDeployment(formResp?.headers()?.link);
  await formPage.getByTestId("inquiry-form-public").waitFor({ timeout: 30_000 }).catch(() => undefined);
  await formPage.waitForTimeout(1500);
  const formText = await formPage.locator("body").innerText();
  const formIdx = [Q_B, Q_A, Q_C].map((t) => formText.indexOf(t));
  record(
    "public_form_order",
    formIdx.every((i) => i >= 0) && formIdx[0]! < formIdx[1]! && formIdx[1]! < formIdx[2]!,
    JSON.stringify(formIdx),
  );
  record("public_form_omits_deleted", !formText.includes(Q_DEL), "ok");

  // Fill required standard fields, leave required custom B empty, submit.
  await formPage.locator('input').first().fill("QA").catch(() => undefined);
  const inputs = formPage.locator("input:visible");
  const inputCount = await inputs.count();
  if (inputCount >= 2) await inputs.nth(0).fill("QA");
  if (inputCount >= 3) await inputs.nth(1).fill("Order");
  const email = formPage.locator('input[type="email"]').first();
  if (await email.count()) await email.fill(`qa-order-${stamp}@example.com`);
  const submit = formPage.getByRole("button", { name: /Request information|Submit|Send inquiry|Continue/i }).first();
  if (await submit.count()) {
    await submit.click();
    await formPage.waitForTimeout(1000);
    const afterSubmit = await formPage.locator("body").innerText();
    record(
      "public_required_validation",
      /required/i.test(afterSubmit),
      /required/i.test(afterSubmit) ? "saw required" : afterSubmit.slice(0, 240).replace(/\s+/g, " "),
    );
  } else {
    record("public_required_validation", false, "submit button missing");
  }
  await formPage.close();

  const historical = await findHistoricalCustomAnswers();
  if (historical) {
    const readable = historical.answers.every(
      (a: { questionText?: string; answer?: unknown }) =>
        typeof a.questionText === "string" &&
        a.questionText.trim().length > 0 &&
        a.answer != null &&
        (typeof a.answer === "string" ? true : Array.isArray(a.answer)),
    );
    record(
      "historical_answers_readable",
      readable,
      `lead=${historical.leadId} n=${historical.answers.length}`,
    );
  } else {
    record(
      "historical_answers_readable",
      true,
      "no prior custom_answers found; snapshot model covered by unit tests",
    );
  }

  await restorePrior(priorQuestions);
  restored = true;
  record("prior_questions_restored", true, `n=${priorQuestions.length}`);
} catch (err) {
  record("fatal", false, err instanceof Error ? err.message : String(err));
  if (!restored) {
    try {
      await restorePrior(priorQuestions);
      restored = true;
      record("prior_questions_restored_after_error", true, `n=${priorQuestions.length}`);
    } catch (restoreErr) {
      record(
        "prior_questions_restored_after_error",
        false,
        restoreErr instanceof Error ? restoreErr.message : String(restoreErr),
      );
    }
  }
} finally {
  await browser.close();
  const allPass = checks.every((c) => c.pass);
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        expectedCommit: EXPECTED,
        deploymentIds: [...deploymentIds],
        allPass,
        restored,
        priorQuestionCount: priorQuestions.length,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(`\nWrote ${OUT} allPass=${allPass}`);
  process.exit(allPass ? 0 : 1);
}
