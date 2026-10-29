/**
 * White Glove A/B — message-template + planning import browser acceptance.
 *
 * EXPECTED_SHA=<sha> npx tsx docs/qa/white-glove-content-import/verify-browser.mts
 *
 * Creates a disposable WG venue, uploads materials via the customer token API,
 * exercises HQ Review import in the browser, and verifies persisted rows.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
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
const HQ_EMAIL = "jennifer@hellotocheers.com";
const RUN = process.env.E2E_RUN_ID ?? `WGIMP${Date.now().toString(36).toUpperCase()}`;
const OUT = "docs/qa/white-glove-content-import";
const SHOTS = join(OUT, "shots");
mkdirSync(SHOTS, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string; kind?: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: unknown, kind?: string) {
  const text = typeof detail === "string" ? detail : JSON.stringify(detail ?? null);
  checks.push({ name, pass, detail: text.slice(0, 800), kind });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${text.slice(0, 200)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  try {
    const td = execSync(
      "aws ecs describe-services --cluster htc-sandbox --services htc-sandbox-venue-app --region us-east-1 --query 'services[0].deployments[?status==`PRIMARY`].taskDefinition | [0]' --output text",
      { encoding: "utf8" },
    ).trim();
    return execSync(
      `aws ecs describe-task-definition --task-definition '${td}' --region us-east-1 --query 'taskDefinition.containerDefinitions[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch (err) {
    return `error:${err instanceof Error ? err.message : String(err)}`;
  }
}

async function hqCookies() {
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: HQ_EMAIL,
  });
  if (linkErr || !link?.properties?.hashed_token) throw linkErr ?? new Error("no link");
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties.hashed_token,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return {
    cookies: ssrUtils.createChunks(cookieName, encoded).map(
      (c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      }),
    ),
  };
}

async function createDisposableEnrollment() {
  const stamp = Date.now();
  const venueName = `WG Import ${RUN} ${stamp}`;
  const ownerEmail = `jennifer+wg-import-${stamp}@hellotocheers.com`;
  const intakeToken = `intake_${randomBytes(24).toString("hex")}`;

  let ownerUserId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: ownerEmail,
    email_confirm: true,
    password: `WgImport-${randomBytes(12).toString("hex")}!aA1`,
  });
  if (created.data.user?.id) {
    ownerUserId = created.data.user.id;
  } else {
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: ownerEmail,
    });
    const uid = link?.user?.id;
    if (!uid) throw created.error ?? new Error("createUser/lookup failed");
    ownerUserId = uid;
  }

  const { data: enrollment, error: enrErr } = await admin
    .from("venue_enrollments")
    .insert({
      venue_name: venueName,
      owner_email: ownerEmail,
      owner_first_name: "WG",
      owner_last_name: "Import",
      onboarding_type: "white_glove",
      status: "pending",
      plan: "professional",
      intake_token: intakeToken,
      white_glove_status: "awaiting_provision",
      purchase_hold: false,
    })
    .select("id")
    .single();
  if (enrErr || !enrollment) throw enrErr ?? new Error("enrollment insert");

  const { data: venueId, error: provErr } = await admin.rpc("provision_enrollment_venue", {
    p_enrollment_id: enrollment.id,
    p_owner_user_id: ownerUserId,
    p_is_owner: true,
  });
  if (provErr || typeof venueId !== "string") {
    throw provErr ?? new Error("provision_enrollment_venue failed");
  }

  await admin.from("venues").update({ owner_user_id: ownerUserId }).eq("id", venueId);
  await admin.from("venue_staff").upsert(
    {
      venue_id: venueId,
      user_id: ownerUserId,
      full_name: "WG Import",
      email: ownerEmail,
      is_owner: true,
      role: "owner",
      access_title: "administrator",
      is_active: true,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "venue_id,user_id", ignoreDuplicates: false },
  ).then(async () => {
    const { data: staffExisting } = await admin
      .from("venue_staff")
      .select("id")
      .eq("venue_id", venueId)
      .eq("user_id", ownerUserId!)
      .maybeSingle();
    if (!staffExisting) {
      await admin.from("venue_staff").insert({
        venue_id: venueId,
        user_id: ownerUserId,
        full_name: "WG Import",
        email: ownerEmail,
        is_owner: true,
        role: "owner",
        access_title: "administrator",
        is_active: true,
        accepted_at: new Date().toISOString(),
      });
    }
  });

  await admin
    .from("venue_enrollments")
    .update({
      venue_id: venueId,
      status: "provisioned",
      intake_token: intakeToken,
      white_glove_status: "awaiting_intake",
    })
    .eq("id", enrollment.id);

  return { enrollmentId: enrollment.id, venueId, venueName, ownerEmail, intakeToken };
}

async function uploadMaterial(intakeToken: string, fileName: string, body: string | Buffer, mime: string) {
  const form = new FormData();
  form.set("intakeToken", intakeToken);
  const blob = typeof body === "string"
    ? new Blob([body], { type: mime })
    : new Blob([new Uint8Array(body)], { type: mime });
  form.set("file", new File([blob], fileName, { type: mime }));
  const res = await fetch(`${APP}/api/onboarding/white-glove/materials`, {
    method: "POST",
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

/** Minimal PDF with no extractable text (empty content stream). */
function emptyPdfBytes(): Buffer {
  const pdf = `%PDF-1.1
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>endobj
4 0 obj<< /Length 0 >>stream
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000214 00000 n 
trailer<< /Size 5 /Root 1 0 R >>
startxref
291
%%EOF
`;
  return Buffer.from(pdf, "utf8");
}

async function main() {
  const image = await servingImage();
  record(
    "serving_sha",
    Boolean(EXPECTED) && image.includes(EXPECTED.slice(0, 12)),
    `expected=${EXPECTED} ecs=${image}`,
    "deploy",
  );

  const beforeTemplatesOtherVenue = await admin
    .from("message_templates")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", "a415ac52-cd74-42a6-8df7-7a8f6e71d080");
  const fancyCountBefore = beforeTemplatesOtherVenue.count ?? -1;

  const ctx = await createDisposableEnrollment();
  record(
    "disposable_enrollment",
    Boolean(ctx.venueId),
    JSON.stringify({ venueId: ctx.venueId, enrollmentId: ctx.enrollmentId }),
    "setup",
  );

  // Seed one existing template to prove intact + conflict handling.
  const existingName = `Existing Intact ${RUN}`;
  const { data: existingRow, error: existingErr } = await admin
    .from("message_templates")
    .insert({
      venue_id: ctx.venueId,
      name: existingName,
      category: "general",
      email_subject: "Keep me",
      email_body: "This existing template must remain untouched.",
      sms_body: null,
    })
    .select("id, name, email_body")
    .single();
  record(
    "seed_existing_template",
    Boolean(existingRow?.id) && !existingErr,
    existingErr?.message ?? `id=${existingRow?.id}`,
    "setup",
  );

  const msgFile = `message-templates-${RUN}.txt`;
  const msgBody = [
    "---",
    `Name: WG Tour Follow-up ${RUN}`,
    "Category: tour",
    "Subject: Thanks for touring with us",
    "Channel: email",
    "Body:",
    "We loved meeting you. Here are next steps for your date.",
    "---",
    `Name: ${existingName}`,
    "Category: general",
    "Subject: Conflict",
    "Channel: email",
    "Body:",
    "Different body that must not overwrite.",
    "---",
  ].join("\n");

  const unsupportedFile = `unsupported-meta-${RUN}.txt`;
  const unsupportedBody = JSON.stringify([
    {
      name: `WG Unsupported Meta ${RUN}`,
      category: "not_a_real_category",
      emailSubject: "Check warnings",
      emailBody: "Body for unsupported category warning.",
      mailchimpId: "should-surface",
    },
  ], null, 2);

  const planFile = `planning-checklist-${RUN}.md`;
  const planBody = [
    "# Catering",
    "- Confirm guest count estimate 90 days before",
    "- Book preferred caterer 60 days before",
    "- Undated vendor call that needs operator timing",
    "- Open doors for vendors day of",
  ].join("\n");

  const badJsonFile = `bad-templates-${RUN}.txt`;
  const badJson = "[{name: not-valid-json";

  const scanPdf = `scan-only-${RUN}.pdf`;

  const upMsg = await uploadMaterial(ctx.intakeToken, msgFile, msgBody, "text/plain");
  const upUnsupported = await uploadMaterial(ctx.intakeToken, unsupportedFile, unsupportedBody, "text/plain");
  const upPlan = await uploadMaterial(ctx.intakeToken, planFile, planBody, "text/markdown");
  const upBad = await uploadMaterial(ctx.intakeToken, badJsonFile, badJson, "text/plain");
  const upScan = await uploadMaterial(ctx.intakeToken, scanPdf, emptyPdfBytes(), "application/pdf");

  record("upload_messages", upMsg.status < 300, JSON.stringify(upMsg), "materials");
  record("upload_unsupported_meta", upUnsupported.status < 300, JSON.stringify(upUnsupported), "materials");
  record("upload_planning", upPlan.status < 300, JSON.stringify(upPlan), "materials");
  record("upload_malformed_json", upBad.status < 300, JSON.stringify(upBad), "materials");
  record("upload_scan_pdf", upScan.status < 300, JSON.stringify(upScan), "materials");

  const { data: materials } = await admin
    .from("venue_onboarding_materials")
    .select("id, file_name")
    .eq("venue_id", ctx.venueId);
  const byName = new Map((materials ?? []).map((m) => [m.file_name, m.id]));
  const msgId = byName.get(msgFile);
  const unsupportedId = byName.get(unsupportedFile);
  const planId = byName.get(planFile);
  const badId = byName.get(badJsonFile);
  const scanId = byName.get(scanPdf);
  record(
    "materials_rows",
    Boolean(msgId && unsupportedId && planId && badId && scanId),
    JSON.stringify([...byName.keys()]),
    "materials",
  );

  const browser = await chromium.launch({ headless: true });
  try {
    const { cookies } = await hqCookies();
    const hqCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await hqCtx.addCookies(cookies);
    const page = await hqCtx.newPage();
    await page.goto(`${APP}/admin/onboarding/${ctx.venueId}`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1500);
    const panelText = await page.locator("body").innerText();
    record(
      "hq_panel_lists_materials",
      panelText.includes(msgFile) && panelText.includes(planFile),
      panelText.slice(0, 400),
      "hq",
    );
    await page.screenshot({ path: join(SHOTS, "01-hq-materials-1280.png"), fullPage: false });

    // --- A: Message templates ---
    if (msgId) {
      await page.getByTestId(`wg-material-review-${msgId}`).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Message templates" }).click();
      await page.waitForTimeout(2500);
      const review = page.getByTestId("wg-material-review");
      const reviewText = await review.innerText();
      const proposal0Name = await page.getByTestId("wg-msg-proposal-0").locator("input").nth(1).inputValue().catch(() => "");
      const proposal1Name = await page.getByTestId("wg-msg-proposal-1").locator("input").nth(1).inputValue().catch(() => "");
      record(
        "messages_preview_shows_proposals",
        proposal0Name.includes(`WG Tour Follow-up ${RUN}`) && proposal1Name === existingName,
        JSON.stringify({ proposal0Name, proposal1Name, reviewText: reviewText.slice(0, 300) }),
        "A",
      );
      await page.screenshot({ path: join(SHOTS, "02-messages-preview-1280.png"), fullPage: false });

      await page.getByTestId("wg-import-apply").click();
      await page.waitForTimeout(2500);
      const resultText = await page.getByTestId("wg-import-result").innerText();
      let resultJson: {
        created?: { id: string; name: string }[];
        skipped?: { name: string; reason: string }[];
        rejected?: { name: string; reason: string }[];
      } = {};
      try {
        resultJson = JSON.parse(resultText);
      } catch {
        /* keep empty */
      }
      const createdNames = (resultJson.created ?? []).map((c) => c.name);
      const rejectedNames = (resultJson.rejected ?? []).map((r) => r.name);
      record(
        "messages_apply_creates_new",
        createdNames.some((n) => n.includes(`WG Tour Follow-up ${RUN}`)),
        resultText.slice(0, 600),
        "A",
      );
      record(
        "messages_conflict_not_overwritten",
        rejectedNames.includes(existingName) ||
          (resultJson.rejected ?? []).some((r) => /already exists|not overwritten/i.test(r.reason)),
        resultText.slice(0, 600),
        "A",
      );
      await page.screenshot({ path: join(SHOTS, "03-messages-apply-1280.png"), fullPage: false });

      // Identical retry
      await page.getByTestId("wg-import-apply").click();
      await page.waitForTimeout(2500);
      const retryText = await page.getByTestId("wg-import-result").innerText();
      let retryJson: { created?: unknown[]; skipped?: { reason: string }[] } = {};
      try {
        retryJson = JSON.parse(retryText);
      } catch {
        /* */
      }
      record(
        "messages_identical_retry_no_duplicate",
        (retryJson.created?.length ?? 0) === 0 &&
          (retryJson.skipped ?? []).some((s) => /already imported|not duplicated/i.test(s.reason)),
        retryText.slice(0, 600),
        "A",
      );

      const { data: persisted } = await admin
        .from("message_templates")
        .select("id, name, category, email_subject, email_body, venue_id")
        .eq("venue_id", ctx.venueId)
        .order("name");
      const tour = (persisted ?? []).find((t) => t.name.includes(`WG Tour Follow-up ${RUN}`));
      const intact = (persisted ?? []).find((t) => t.name === existingName);
      record(
        "messages_persisted_venue",
        Boolean(tour?.id) && tour?.venue_id === ctx.venueId && tour.category === "tour",
        JSON.stringify(tour),
        "A",
      );
      record(
        "messages_existing_intact",
        intact?.email_body === "This existing template must remain untouched.",
        JSON.stringify(intact),
        "A",
      );
    }

    // --- Unsupported metadata / unknown category ---
    if (unsupportedId) {
      await page.getByRole("button", { name: "Close" }).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId(`wg-material-review-${unsupportedId}`).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Message templates" }).click();
      await page.waitForTimeout(2500);
      const unsupportedText = await page.getByTestId("wg-material-review").innerText();
      record(
        "messages_unsupported_reported",
        /mailchimpId|not_a_real_category|drip|unsupported|general/i.test(unsupportedText),
        unsupportedText.slice(0, 500),
        "A",
      );
      await page.getByTestId("wg-import-apply").click();
      await page.waitForTimeout(2500);
      const unsupportedResult = await page.getByTestId("wg-import-result").innerText();
      const { data: unsupportedRow } = await admin
        .from("message_templates")
        .select("id, name, category")
        .eq("venue_id", ctx.venueId)
        .ilike("name", `%WG Unsupported Meta ${RUN}%`)
        .maybeSingle();
      record(
        "messages_unknown_category_stored_as_general",
        unsupportedRow?.category === "general",
        JSON.stringify({ unsupportedRow, unsupportedResult: unsupportedResult.slice(0, 300) }),
        "A",
      );
    }

    // --- Malformed JSON ---
    if (badId) {
      await page.getByRole("button", { name: "Close" }).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId(`wg-material-review-${badId}`).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Message templates" }).click();
      await page.waitForTimeout(2500);
      const err = await page.getByTestId("wg-import-error").innerText().catch(() => "");
      const countBeforeBad = (
        await admin
          .from("message_templates")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", ctx.venueId)
      ).count ?? 0;
      record(
        "malformed_json_honest_error",
        /not valid|Nothing was imported|JSON/i.test(err),
        err.slice(0, 400),
        "A",
      );
      await page.screenshot({ path: join(SHOTS, "04-malformed-json-1280.png"), fullPage: false });
      const countAfterBad = (
        await admin
          .from("message_templates")
          .select("id", { count: "exact", head: true })
          .eq("venue_id", ctx.venueId)
      ).count ?? -1;
      record(
        "malformed_json_no_false_rows",
        countAfterBad === countBeforeBad,
        `before=${countBeforeBad} after=${countAfterBad}`,
        "A",
      );
    }

    // --- Scan PDF ---
    if (scanId) {
      await page.getByRole("button", { name: "Close" }).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId(`wg-material-review-${scanId}`).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Planning checklist" }).click();
      await page.waitForTimeout(3000);
      const scanErr = await page.getByTestId("wg-import-error").innerText().catch(() => "");
      record(
        "scan_pdf_honest_error",
        /no extractable text|scan|Nothing was imported/i.test(scanErr),
        scanErr.slice(0, 400),
        "B",
      );
      await page.screenshot({ path: join(SHOTS, "05-scan-pdf-1280.png"), fullPage: false });
    }

    // --- B: Planning ---
    if (planId) {
      await page.getByRole("button", { name: "Close" }).click().catch(() => undefined);
      await page.waitForTimeout(300);
      await page.getByTestId(`wg-material-review-${planId}`).click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Planning checklist" }).click();
      await page.waitForTimeout(2500);
      const planReview = page.getByTestId("wg-material-review");
      const planText = await planReview.innerText();
      const planTitles: string[] = [];
      for (let i = 0; i < 4; i++) {
        const val = await page.getByTestId(`wg-plan-proposal-${i}`).locator("input").nth(1).inputValue().catch(() => "");
        if (val) planTitles.push(val);
      }
      record(
        "planning_preview_proposals",
        planTitles.some((t) => /Confirm guest count/i.test(t)) &&
          planTitles.some((t) => /Book preferred caterer/i.test(t)) &&
          planTitles.some((t) => /Undated vendor call/i.test(t)) &&
          planTitles.some((t) => /Open doors/i.test(t)),
        JSON.stringify({ planTitles, planText: planText.slice(0, 300) }),
        "B",
      );
      record(
        "planning_undated_flagged",
        /No timing in the source/i.test(planText),
        planText.slice(0, 400),
        "B",
      );

      const templateName = `WG Planning ${RUN}`;
      await page.getByTestId("wg-planning-template-name").fill(templateName);

      // Exclude undated item (index 2)
      const undated = page.getByTestId("wg-plan-include-2");
      if (await undated.count()) {
        if (await undated.isChecked()) await undated.uncheck();
      }

      // Edit first title
      const firstTitle = page.getByTestId("wg-plan-proposal-0").locator("input").nth(1);
      await firstTitle.fill(`Edited guest count ${RUN}`);

      await page.screenshot({ path: join(SHOTS, "06-planning-review-1280.png"), fullPage: false });
      await page.getByTestId("wg-import-apply").click();
      await page.waitForTimeout(3000);
      const planResult = await page.getByTestId("wg-import-result").innerText();
      let planJson: {
        ok?: boolean;
        duplicate?: boolean;
        templateId?: string;
        created?: number;
        excluded?: number;
        message?: string;
      } = {};
      try {
        planJson = JSON.parse(planResult);
      } catch {
        /* */
      }
      record(
        "planning_apply_ok",
        planJson.ok === true && planJson.duplicate === false && (planJson.created ?? 0) >= 2,
        planResult.slice(0, 600),
        "B",
      );
      record(
        "planning_excluded_undated",
        (planJson.excluded ?? 0) >= 1,
        planResult.slice(0, 400),
        "B",
      );
      await page.screenshot({ path: join(SHOTS, "07-planning-apply-1280.png"), fullPage: false });

      const templateId = planJson.templateId;
      if (templateId) {
        const { data: tmpl } = await admin
          .from("playbook_templates")
          .select("id, name, venue_id, kind")
          .eq("id", templateId)
          .maybeSingle();
        record(
          "planning_template_persisted",
          tmpl?.venue_id === ctx.venueId && tmpl?.name === templateName,
          JSON.stringify(tmpl),
          "B",
        );
        const { data: tasks } = await admin
          .from("playbook_tasks")
          .select("id, title, days_offset, needs_review")
          .eq("template_id", templateId);
        const titles = (tasks ?? []).map((t) => t.title);
        record(
          "planning_only_approved_tasks",
          titles.includes(`Edited guest count ${RUN}`) &&
            !titles.some((t) => /Undated vendor call/i.test(t)) &&
            (tasks ?? []).every((t) => t.days_offset != null),
          JSON.stringify(tasks),
          "B",
        );
        record(
          "planning_no_invented_null_offsets",
          (tasks ?? []).every((t) => typeof t.days_offset === "number"),
          JSON.stringify((tasks ?? []).map((t) => ({ title: t.title, days_offset: t.days_offset }))),
          "B",
        );
      }

      // Duplicate retry
      await page.getByTestId("wg-import-apply").click();
      await page.waitForTimeout(2500);
      const dupText = await page.getByTestId("wg-import-result").innerText();
      let dupJson: { ok?: boolean; duplicate?: boolean; templateId?: string } = {};
      try {
        dupJson = JSON.parse(dupText);
      } catch {
        /* */
      }
      record(
        "planning_duplicate_retry",
        dupJson.ok === true && dupJson.duplicate === true && dupJson.templateId === templateId,
        dupText.slice(0, 400),
        "B",
      );
      const { count: tmplCount } = await admin
        .from("playbook_templates")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", ctx.venueId)
        .eq("name", templateName)
        .eq("is_archived", false);
      record("planning_no_second_template", tmplCount === 1, `count=${tmplCount}`, "B");
    }

    const afterFancy = await admin
      .from("message_templates")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", "a415ac52-cd74-42a6-8df7-7a8f6e71d080");
    record(
      "cross_venue_templates_untouched",
      fancyCountBefore === (afterFancy.count ?? -2),
      `before=${fancyCountBefore} after=${afterFancy.count}`,
      "isolation",
    );
  } finally {
    await browser.close();
  }

  const pass = checks.filter((c) => c.pass).length;
  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    run: RUN,
    expectedSha: EXPECTED,
    servingImage: image,
    venueId: ctx.venueId,
    enrollmentId: ctx.enrollmentId,
    pass,
    fail,
    checks,
  };
  writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(summary, null, 2));
  writeFileSync(
    join(OUT, "browser-run.log"),
    checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n") +
      `\nTOTAL ${pass}/${pass + fail}\n`,
  );
  console.log(`\nTOTAL ${pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
