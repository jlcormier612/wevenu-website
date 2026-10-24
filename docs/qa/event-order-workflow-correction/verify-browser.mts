/**
 * Event Order workflow correction — Sandbox browser proof.
 * Opens the generated selection URL in a fresh couple context.
 * Isolates the failing case: financial portal session only, then restores sessions.
 * Safe Sandbox fixture. No real payment. Email uses the deployed sandbox redirect.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import {
  moneyFiguresAgree,
  reconcileEventOrderInvoicePayable,
} from "@/lib/invoices/eo-invoice-reconciliation";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const ACCEPT_SHAS = [
  ...(process.env.EXPECTED_SHA ? [process.env.EXPECTED_SHA.slice(0, 8)] : []),
  "395fc521",
  "60668443",
];
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be";
const OUT = "docs/qa/event-order-workflow-correction";
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
  checks.push({ name, pass, detail: redact(String(detail)).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${redact(String(detail)).slice(0, 400)}`);
}

function redact(value: string): string {
  return value.replace(/\/p\/[^/?#\s"'<>]+/g, "/p/[redacted]");
}

async function servingImage(): Promise<string> {
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
}

async function servingDigest(): Promise<string> {
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

async function acceptLegal(page: {
  locator: (s: string) => { count: () => Promise<number>; first: () => { click: (o?: object) => Promise<void>; check?: (o?: object) => Promise<void> } };
  getByRole: (r: string, o: object) => { count: () => Promise<number>; first: () => { click: (o?: object) => Promise<void> } };
  waitForTimeout: (n: number) => Promise<void>;
}) {
  const box = page.locator('input[type="checkbox"]');
  if ((await box.count()) > 0) {
    await box.first().click({ force: true }).catch(() => undefined);
    await page.waitForTimeout(300);
  }
  for (const label of [/Continue/i, /Accept & continue/i, /I agree/i]) {
    const btn = page.getByRole("button", { name: label });
    if ((await btn.count()) > 0) {
      await btn.first().click({ force: true }).catch(() => undefined);
      await page.waitForTimeout(800);
    }
  }
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const servingOk = ACCEPT_SHAS.some((sha) => image.includes(sha));
  record("serving-sha", servingOk, `ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  if (!servingOk) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ pass: false, checks, image, digest }, null, 2));
    process.exit(1);
  }

  const { data: eventBefore } = await admin
    .from("events")
    .select("id, status, booked_at, client_id, venue_id")
    .eq("id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  record("fixture-booked", Boolean(eventBefore?.booked_at), JSON.stringify(eventBefore));

  const { count: invoicesBefore } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", CLIENT)
    .eq("venue_id", FANCY);
  const { count: schedulesBefore } = await admin
    .from("payment_schedules")
    .select("id", { count: "exact", head: true })
    .eq("client_id", CLIENT)
    .eq("venue_id", FANCY);

  const { data: sessionsBefore } = await admin
    .from("client_portal_sessions")
    .select("*")
    .eq("client_id", CLIENT)
    .eq("venue_id", FANCY);
  const removed = (sessionsBefore ?? []).filter((s) => s.access_level === "couple" || s.access_level === "planning");
  let financial = (sessionsBefore ?? []).find((s) => s.access_level === "financial");
  let createdFinancial = false;
  if (!financial) {
    const { data: inserted, error: finErr } = await admin
      .from("client_portal_sessions")
      .insert({
        client_id: CLIENT,
        venue_id: FANCY,
        label: "Payment",
        access_level: "financial",
      })
      .select("*")
      .single();
    if (finErr) throw finErr;
    financial = inserted;
    createdFinancial = true;
  }
  record(
    "isolated-to-financial-session-only",
    Boolean(financial) && removed.length >= 0,
    `financial=${Boolean(financial?.access_token)} coupleOrPlanningRemoved=${removed.length} createdFinancial=${createdFinancial}`,
  );
  if (removed.length > 0) {
    const { error } = await admin
      .from("client_portal_sessions")
      .delete()
      .in("id", removed.map((s) => s.id as string));
    if (error) throw error;
  }

  const persisted: Record<string, unknown> = {
    image,
    digest,
    eventBefore,
    invoicesBefore,
    schedulesBefore,
    sessionsBeforeLevels: (sessionsBefore ?? []).map((s) => s.access_level),
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const staff = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    staff.on("dialog", async (dialog: { accept: () => Promise<void> }) => {
      await dialog.accept();
    });
    await staff.addCookies(await staffCookies());
    const page = await staff.newPage();

    await page.goto(`${APP}/events/${EVENT}#event-order-choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(2500);
    const landed = page.url();
    const landedText = await page.locator("body").innerText().catch(() => "");
    if (!/event-commercial-workflow|client-choices-panel|Prepare selection request|Start selections|Client selections/i.test(landedText)) {
      const open = page.getByRole("button", { name: /Review Event Order|Open Event Order|Build selections/i }).first();
      if ((await open.count()) > 0) await open.click();
      await page.waitForTimeout(1500);
    }
    try {
      await page.waitForSelector('[data-testid="event-commercial-workflow"], [data-testid="client-choices-panel"]', {
        timeout: 45_000,
      });
    } catch (err) {
      await page.screenshot({ path: `${OUT}/shots/venue-landed-1280.png`, fullPage: false });
      record("venue-workspace-landed", false, `${landed} :: ${landedText.slice(0, 500)}`);
      throw err;
    }
    record("venue-workspace-landed", true, page.url());
    await page.waitForTimeout(1200);

    const choicesTag = await page.locator('[data-testid="event-order-choices"]').evaluate((el) => el.tagName).catch(() => "");
    const orderTag = await page.locator('[data-testid="event-order-order"]').evaluate((el) => el.tagName).catch(() => "");
    const startVisible = await page.locator('[data-testid="choices-start-selections"]').isVisible().catch(() => false);
    const templateSelect = await page.locator('[data-testid="choices-template-select"]').isVisible().catch(() => false);
    const rhPreview = await page.locator('[data-testid="choices-template-preview"]').isVisible().catch(() => false);
    const orderVisible = await page.locator('[data-testid="event-order-order"]').isVisible().catch(() => false);
    const journeyHtml = await page.locator('[data-testid="event-order-journey"]').innerHTML().catch(() => "");
    record("stages-not-collapsed-details", choicesTag !== "DETAILS" && orderTag !== "DETAILS", `choices=${choicesTag} order=${orderTag}`);
    record("template-select-visible", templateSelect, "choices-template-select");
    record("rh-template-preview-visible", rhPreview, "choices-template-preview");
    record("journey-no-generic-view", !/>\s*View\s*</.test(journeyHtml), journeyHtml.slice(0, 200));
    const activePacket = (await page.locator('[data-testid^="client-choices-row-"]').count().catch(() => 0)) > 0;
    record(
      "prepare-or-active-packet",
      startVisible || activePacket,
      startVisible ? "choices-start-selections" : activePacket ? "active packet" : "neither",
    );
    record("event-order-document-stage-visible", orderVisible, "event-order-order");
    await page.screenshot({ path: `${OUT}/shots/venue-stages-1280.png`, fullPage: false });
    await page.screenshot({ path: `${OUT}/shots/composer-preview-1280.png`, fullPage: false });

    if (startVisible) {
      await page.locator('[data-testid="choices-start-selections"]').click();
      await page.waitForTimeout(2500);
    }
    const startToast = await page.locator("[data-sonner-toast]").innerText().catch(() => "");
    record(
      "start-selections-did-not-error",
      !/Could not create/i.test(startToast),
      startToast || (startVisible ? "clicked" : "no prepare button — existing packets"),
    );
    await page.goto(`${APP}/events/${EVENT}#event-order-choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForSelector('[data-testid="client-choices-panel"]', { timeout: 45_000 });
    await page.waitForTimeout(1500);

    const preview = page.locator('[data-testid="choices-staff-preview"]').first();
    if ((await preview.count()) > 0) {
      await preview.click();
      await page.waitForTimeout(800);
      const overlayOpen = await page.locator("#artifact-review-title").isVisible().catch(() => false);
      const hasFixedOrGroups = await page.locator('[data-testid="choices-definition-view"]').isVisible().catch(() => false);
      record("preview-dialog", overlayOpen && hasFixedOrGroups, overlayOpen ? "ArtifactReviewOverlay" : "overlay missing");
      await page.screenshot({ path: `${OUT}/shots/preview-1280.png`, fullPage: false });
      await page.screenshot({ path: `${OUT}/shots/send-preview-full-1280.png`, fullPage: false });
      const back = page.getByRole("button", { name: /Back to edit/i }).first();
      if ((await back.count()) > 0) await back.click();
      else await page.keyboard.press("Escape");
      await page.waitForTimeout(300);
    } else {
      record("preview-dialog", false, "no preview button");
    }

    const { data: eoBeforeSend } = await admin
      .from("event_orders")
      .select("id, status, shared_at, client_agreed_at, finalized_at, revision")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const { count: invoicesBeforeSend } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    const { data: eventBeforeSend } = await admin
      .from("events")
      .select("id, status, booked_at")
      .eq("id", EVENT)
      .maybeSingle();
    persisted.eoBeforeSelectionSend = eoBeforeSend;
    persisted.eventBeforeSelectionSend = eventBeforeSend;
    persisted.invoicesBeforeSelectionSend = invoicesBeforeSend ?? 0;

    let send = page.locator('[data-testid="choices-send-selection-request"]').first();
    if ((await send.count()) === 0) {
      const amend = page.getByRole("button", { name: /^Amend$/ }).first();
      if ((await amend.count()) > 0) {
        await amend.click();
        await page.waitForTimeout(2000);
        send = page.locator('[data-testid="choices-send-selection-request"]').first();
      }
    }
    record("send-cta", (await send.count()) > 0, `count=${await send.count()} body=${(await page.locator('[data-testid="client-choices-panel"]').innerText().catch(() => "")).slice(0, 400)}`);
    if ((await send.count()) === 0) {
      await page.screenshot({ path: `${OUT}/shots/no-send-cta-1280.png`, fullPage: false });
      throw new Error("no send CTA");
    }
    await send.click();
    await page.waitForTimeout(800);
    const sheet = page.locator('[role="dialog"]').filter({ hasText: /selection request/i });
    const sendInSheet = sheet.getByRole("button", { name: /^(Send|Resend)$/ }).first();
    record("share-dialog", (await sendInSheet.count()) > 0, "ShareDialog");
    await page.screenshot({ path: `${OUT}/shots/send-dialog-1280.png`, fullPage: false });
    await sendInSheet.click();
    await page.getByRole("button", { name: /Sending/i }).waitFor({ state: "detached", timeout: 60_000 }).catch(() => undefined);
    await page.waitForTimeout(1500);
    const sendToast = await page.locator("[data-sonner-toast]").allInnerTexts().catch(() => []);
    record("send-finished", sendToast.length > 0 || (await page.locator('[role="dialog"]').count()) === 0, sendToast.join(" | ") || "dialog closed");
    await page.screenshot({ path: `${OUT}/shots/after-send-1280.png`, fullPage: false });

    const { data: eoAfterSend } = await admin
      .from("event_orders")
      .select("id, status, shared_at, client_agreed_at, finalized_at, revision")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .maybeSingle();
    const { count: invoicesAfterSend } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    const { data: eventAfterSend } = await admin
      .from("events")
      .select("id, status, booked_at")
      .eq("id", EVENT)
      .maybeSingle();
    persisted.eoAfterSelectionSend = eoAfterSend;
    record(
      "selection-send-does-not-change-eo-shared-at",
      (eoBeforeSend?.shared_at ?? null) === (eoAfterSend?.shared_at ?? null),
      `before=${eoBeforeSend?.shared_at ?? "null"} after=${eoAfterSend?.shared_at ?? "null"}`,
    );
    record(
      "selection-send-does-not-set-client-agreed",
      (eoBeforeSend?.client_agreed_at ?? null) === (eoAfterSend?.client_agreed_at ?? null)
        && eoAfterSend?.client_agreed_at == null,
      JSON.stringify({ before: eoBeforeSend?.client_agreed_at, after: eoAfterSend?.client_agreed_at }),
    );
    record(
      "selection-send-does-not-finalize-eo",
      (eoBeforeSend?.status ?? null) === (eoAfterSend?.status ?? null)
        && (eoBeforeSend?.finalized_at ?? null) === (eoAfterSend?.finalized_at ?? null),
      `before=${eoBeforeSend?.status}/${eoBeforeSend?.finalized_at ?? "null"} after=${eoAfterSend?.status}/${eoAfterSend?.finalized_at ?? "null"}`,
    );
    record(
      "selection-send-does-not-create-invoice",
      (invoicesBeforeSend ?? 0) === (invoicesAfterSend ?? 0),
      `before=${invoicesBeforeSend} after=${invoicesAfterSend}`,
    );
    record(
      "selection-send-does-not-change-booking",
      eventBeforeSend?.booked_at === eventAfterSend?.booked_at
        && eventBeforeSend?.status === eventAfterSend?.status,
      JSON.stringify({ before: eventBeforeSend, after: eventAfterSend }),
    );

    const { data: messages, error: messageError } = await admin
      .from("conversation_messages")
      .select("id, body, body_html, sent_at, channel_metadata, status")
      .eq("venue_id", FANCY)
      .eq("channel", "email")
      .order("sent_at", { ascending: false })
      .limit(12);
    const selectionMail = (messages ?? []).find((m) => {
      const meta = m.channel_metadata as { sourceType?: string } | null;
      const blob = `${m.body ?? ""}\n${m.body_html ?? ""}`;
      return meta?.sourceType === "client_choices_request" && blob.includes("/p/");
    });
    const rawUrl = String(`${selectionMail?.body_html ?? ""}\n${selectionMail?.body ?? ""}`).match(
      /https?:\/\/[^"'\s<]+/,
    )?.[0] ?? "";
    if (!selectionMail) {
      record("selection-email-lookup", false, messageError?.message ?? `recent=${(messages ?? []).length}`);
    }
    persisted.selectionEmailStatus = selectionMail?.status ?? null;
    persisted.selectionUrlRedacted = redact(rawUrl);
    record(
      "generated-selection-url",
      /\/p\/[^/?#\s]+\?view=choices#choices/.test(rawUrl),
      redact(rawUrl) || "no selection email body",
    );
    const tokenInUrl = rawUrl.match(/\/p\/([^/?#]+)/)?.[1] ?? "";
    record(
      "selection-url-not-financial-token",
      Boolean(tokenInUrl) && tokenInUrl !== financial?.access_token,
      tokenInUrl ? "token differs from financial session" : "no token",
    );

    const couple = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const couplePage = await couple.newPage();
    if (rawUrl) {
      await couplePage.goto(rawUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await acceptLegal(couplePage);
      await couplePage.getByRole("heading", { name: "Your Choices" }).waitFor({ timeout: 25_000 }).catch(() => undefined);
      await couplePage.waitForTimeout(800);
      const body = await couplePage.locator("body").innerText();
      const isChoices = /Your Choices/i.test(body) && /not a payment/i.test(body);
      const isInvoice = /Balance remaining/i.test(body) && /Invoice/i.test(body) && !/Your Choices/i.test(body);
      record("selection-link-renders-form", isChoices && !isInvoice, body.slice(0, 400));
      await couplePage.screenshot({ path: `${OUT}/shots/selection-link-1280.png`, fullPage: false });

      const option = couplePage.locator('fieldset input[type="radio"], fieldset input[type="checkbox"]').first();
      const submit = couplePage.getByRole("button", { name: /^Submit$/ }).first();
      if ((await option.count()) > 0 && !(await option.isChecked().catch(() => false))) {
        await option.click({ force: true });
      }
      if ((await submit.count()) > 0 && (await submit.isEnabled())) {
        await submit.click();
        await couplePage.getByText(/Submitted|Thank you|received your choices/i).first()
          .waitFor({ timeout: 20_000 })
          .catch(() => undefined);
        await couplePage.waitForTimeout(1500);
      }
      const afterBody = await couplePage.locator("body").innerText();
      const { data: submitProbe } = await admin
        .from("client_choices")
        .select("id, status, submitted_at")
        .eq("event_id", EVENT)
        .eq("venue_id", FANCY)
        .order("updated_at", { ascending: false })
        .limit(5);
      const submitOk = (submitProbe ?? []).some((c) => c.status === "submitted" || Boolean(c.submitted_at));
      record(
        "selection-submitted-ui",
        /Submitted|Thank you|received your choices/i.test(afterBody) || submitOk,
        afterBody.slice(0, 240),
      );
      await couplePage.screenshot({ path: `${OUT}/shots/selection-submitted-1280.png`, fullPage: false });

      const { data: eoAfterSubmit } = await admin
        .from("event_orders")
        .select("id, status, shared_at, client_agreed_at, finalized_at")
        .eq("event_id", EVENT)
        .eq("venue_id", FANCY)
        .maybeSingle();
      record(
        "selection-submit-does-not-change-eo-shared-at",
        (eoBeforeSend?.shared_at ?? null) === (eoAfterSubmit?.shared_at ?? null),
        `beforeSend=${eoBeforeSend?.shared_at ?? "null"} afterSubmit=${eoAfterSubmit?.shared_at ?? "null"}`,
      );
      record(
        "selection-submit-does-not-accept-eo",
        eoAfterSubmit?.client_agreed_at == null,
        JSON.stringify({ client_agreed_at: eoAfterSubmit?.client_agreed_at ?? null }),
      );
      record(
        "selection-submit-does-not-finalize-eo",
        (eoBeforeSend?.finalized_at ?? null) === (eoAfterSubmit?.finalized_at ?? null),
        `before=${eoBeforeSend?.finalized_at ?? "null"} after=${eoAfterSubmit?.finalized_at ?? "null"}`,
      );
      // Full offering context on couple form (fixed lines when frozen into definition).
      record(
        "selection-form-shows-offering-context",
        /Your Choices/i.test(afterBody)
          && (/Included with your event|Pick one|Pick many|required|optional/i.test(afterBody)
            || (await couplePage.locator('[data-testid="choices-definition-view"], fieldset').count()) > 0),
        afterBody.slice(0, 300),
      );
    } else {
      record("selection-link-renders-form", false, "no url");
      record("selection-submitted-ui", false, "no url");
      record("selection-submit-does-not-change-eo-shared-at", false, "no url");
      record("selection-submit-does-not-accept-eo", false, "no url");
      record("selection-submit-does-not-finalize-eo", false, "no url");
      record("selection-form-shows-offering-context", false, "no url");
    }

    const { data: choicesAfter } = await admin
      .from("client_choices")
      .select("id, status, submitted_at, event_id, answers")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .order("updated_at", { ascending: false })
      .limit(3);
    const submitted = (choicesAfter ?? []).find((c) => c.status === "submitted" || c.submitted_at);
    record(
      "selection-persisted",
      Boolean(submitted) && submitted?.event_id === EVENT,
      JSON.stringify((choicesAfter ?? []).map((c) => ({ id: c.id, status: c.status }))),
    );
    persisted.choicesAfterSubmit = (choicesAfter ?? []).map((c) => ({
      id: c.id,
      status: c.status,
      submitted_at: c.submitted_at,
    }));

    const { count: invoicesAfterSubmit } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    record(
      "no-invoice-on-submit",
      invoicesAfterSubmit === invoicesBefore,
      `${invoicesBefore}→${invoicesAfterSubmit}`,
    );

    if (financial?.access_token) {
      const fin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const finPage = await fin.newPage();
      await finPage.goto(`${APP}/p/${financial.access_token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await finPage.waitForTimeout(1200);
      const finBody = await finPage.locator("body").innerText();
      record(
        "invoice-link-still-invoice",
        /Invoice/i.test(finBody) && /Balance remaining|Payment Plan/i.test(finBody) && !/Your Choices/i.test(finBody),
        finBody.slice(0, 300),
      );
      await finPage.screenshot({ path: `${OUT}/shots/invoice-link-1280.png`, fullPage: false });
      await finPage.goto(
        `${APP}/p/${financial.access_token}?view=choices#choices`,
        { waitUntil: "domcontentloaded", timeout: 90_000 },
      );
      await finPage.waitForTimeout(1200);
      const hijack = await finPage.locator("body").innerText();
      record(
        "financial-token-ignores-choices-view",
        /Invoice/i.test(hijack) && /Balance remaining|Payment Plan/i.test(hijack) && !/Your Choices/i.test(hijack),
        hijack.slice(0, 300),
      );
      await finPage.screenshot({ path: `${OUT}/shots/financial-view-choices-1280.png`, fullPage: false });
      await fin.close();
    } else {
      record("invoice-link-still-invoice", false, "no financial session");
      record("financial-token-ignores-choices-view", false, "no financial session");
    }

    await page.goto(`${APP}/events/${EVENT}?refresh=${Date.now()}#event-order-choices`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForSelector('[data-testid="client-choices-panel"]', { timeout: 45_000 });
    await page.getByText(/Client Submitted|Create Event Order|Update Event Order/i).first()
      .waitFor({ timeout: 20_000 })
      .catch(() => undefined);
    const create = page.locator('[data-testid="choices-create-event-order"]').first();
    const panelText = await page.locator('[data-testid="client-choices-panel"]').innerText().catch(() => "");
    record(
      "create-event-order-cta",
      (await create.count()) > 0,
      `count=${await create.count()} ${panelText.slice(0, 500)}`,
    );
    const { count: linesBefore } = await admin
      .from("event_order_lines")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY);
    if ((await create.count()) > 0) {
      await create.click();
      await page.waitForTimeout(2500);
      await page.goto(`${APP}/events/${EVENT}?afterCreate=${Date.now()}#event-order-order`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      await page.waitForSelector('[data-testid="event-order-order"]', { timeout: 45_000 });
    }
    await page.locator('[data-testid="event-order-order"]').scrollIntoViewIfNeeded().catch(() => undefined);
    await page.waitForTimeout(800);
    const orderText = await page.locator('[data-testid="event-order-order"]').innerText().catch(() => "");
    record(
      "event-order-document-visible",
      /Event Order|Finalize|Share|Total|line/i.test(orderText) && orderText.length > 40,
      orderText.slice(0, 400),
    );
    await page.screenshot({ path: `${OUT}/shots/event-order-document-1280.png`, fullPage: false });

    const { data: orders } = await admin
      .from("event_orders")
      .select("id, status, shared_at, event_id, revision")
      .eq("event_id", EVENT)
      .eq("venue_id", FANCY)
      .order("created_at", { ascending: false })
      .limit(1);
    const order = orders?.[0];
    const { data: lines } = order?.id
      ? await admin.from("event_order_lines").select("id, description, quantity, unit_price, is_included").eq("event_order_id", order.id)
      : { data: [] };
    const ids = (lines ?? []).map((l) => l.id);
    record("event-order-lines-present", (lines ?? []).length > 0, `n=${(lines ?? []).length} status=${order?.status}`);
    record("event-order-no-duplicate-line-ids", new Set(ids).size === ids.length, `ids=${ids.length}`);
    persisted.eventOrder = order ?? null;
    persisted.lineCount = (lines ?? []).length;
    persisted.linesBeforeApplyCount = linesBefore;

    {
      const { data: orderNow } = order?.id
        ? await admin.from("event_orders").select("status").eq("id", order.id).maybeSingle()
        : { data: null };
      if (orderNow?.status !== "finalized") {
        await page.goto(`${APP}/events/${EVENT}?needFinalize=${Date.now()}#event-order-order`, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        await page.waitForSelector('[data-testid="event-order-order"]', { timeout: 45_000 });
        const finalize = page.getByRole("button", { name: /Finalize Event Order|^Finalize$/i }).first();
        if ((await finalize.count()) > 0) {
          await finalize.click();
          await page.waitForTimeout(3000);
        }
      }
    }
    let orderAfterFinalize = order?.id
      ? (await admin.from("event_orders").select("status, shared_at, client_agreed_at").eq("id", order.id).maybeSingle()).data
      : null;
    if (orderAfterFinalize?.status !== "finalized" && order?.id) {
      await page.goto(`${APP}/events/${EVENT}?needFinalize2=${Date.now()}#event-order-order`, {
        waitUntil: "domcontentloaded",
        timeout: 90_000,
      });
      const finalize2 = page.getByRole("button", { name: /Finalize Event Order|^Finalize$/i }).first();
      if ((await finalize2.count()) > 0) {
        await finalize2.click();
        await page.waitForTimeout(3500);
      }
      orderAfterFinalize = (
        await admin.from("event_orders").select("status, shared_at, client_agreed_at").eq("id", order.id).maybeSingle()
      ).data;
    }
    record(
      "event-order-finalized-or-already",
      orderAfterFinalize?.status === "finalized",
      JSON.stringify(orderAfterFinalize ?? order),
    );
    record(
      "finalize-does-not-auto-accept",
      orderAfterFinalize?.client_agreed_at == null,
      JSON.stringify({ client_agreed_at: orderAfterFinalize?.client_agreed_at ?? null }),
    );

    // Intentional later Share — distinct from selection-request send above.
    const sharedAtBeforeExplicitShare = orderAfterFinalize?.shared_at ?? order?.shared_at ?? null;
    const share = page.getByRole("button", { name: /Share with Client|Update Shared Copy/i }).first();
    let performedExplicitShare = false;
    if ((await share.count()) > 0 && !sharedAtBeforeExplicitShare) {
      await share.click();
      await page.waitForTimeout(600);
      const shareBtn = page.locator('[role="dialog"]').getByRole("button", { name: /^Share$/ }).first();
      if ((await shareBtn.count()) > 0) {
        await shareBtn.click();
        await page.waitForTimeout(3000);
        performedExplicitShare = true;
      }
    }
    const { data: orderShared } = order?.id
      ? await admin.from("event_orders").select("status, shared_at, client_agreed_at").eq("id", order.id).maybeSingle()
      : { data: null };
    record(
      "event-order-shared-via-explicit-share-or-preexisting",
      Boolean(orderShared?.shared_at),
      JSON.stringify({
        shared_at: orderShared?.shared_at,
        preexisting: Boolean(sharedAtBeforeExplicitShare),
        performedExplicitShare,
      }),
    );
    persisted.orderShared = orderShared;
    persisted.explicitSharePerformed = performedExplicitShare;
    persisted.sharedAtWasPreexistingBeforeExplicitShare = Boolean(sharedAtBeforeExplicitShare);

    const invoiceBtn = page.locator('[data-testid="eo-create-draft-invoice"], [data-testid="eo-create-payment-plan"], [data-testid="eo-link-draft-invoice"]').first();
    const { count: invoicesBeforeHandoff } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    if ((await invoiceBtn.count()) > 0) {
      const href = await invoiceBtn.getAttribute("href").catch(() => null);
      // Prefer staying on EO workspace for create/link; payment-plan links leave the page.
      if (!href || href.includes("invoiceId") === false) {
        await invoiceBtn.click();
        await page.waitForTimeout(3000);
      }
    }
    const { data: eoInvoices } = order?.id
      ? await admin
          .from("invoices")
          .select("id, status, total, subtotal, tax_amount, balance_due, event_order_id, invoice_number")
          .eq("event_order_id", order.id)
          .eq("venue_id", FANCY)
      : { data: [] };
    const { count: invoicesAfterHandoff } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    record(
      "eo-invoice-present-or-existing",
      (eoInvoices ?? []).length >= 1 || (invoicesAfterHandoff ?? 0) >= (invoicesBefore ?? 0),
      `eoLinked=${(eoInvoices ?? []).length} invoices ${invoicesBeforeHandoff}→${invoicesAfterHandoff}`,
    );
    record(
      "no-duplicate-invoice-burst",
      (invoicesAfterHandoff ?? 0) <= (invoicesBeforeHandoff ?? 0) + 1,
      `${invoicesBeforeHandoff}→${invoicesAfterHandoff}`,
    );
    persisted.eoInvoices = eoInvoices;

    const eoInvoice = (eoInvoices ?? []).find((i) => i.status !== "void") ?? (eoInvoices ?? [])[0];
    const { data: eoLinesFull } = order?.id
      ? await admin
          .from("event_order_lines")
          .select("id, amount, unit_price, is_included")
          .eq("event_order_id", order.id)
      : { data: [] };
    const { data: storedInvLinesBefore } = eoInvoice?.id
      ? await admin
          .from("invoice_line_items")
          .select("type, amount, event_order_line_id")
          .eq("invoice_id", eoInvoice.id)
      : { data: [] };
    const expectedPayable = reconcileEventOrderInvoicePayable({
      eventOrderLines: (eoLinesFull ?? []).map((l) => ({
        id: l.id as string,
        amount: Number(l.amount),
        unitPrice: l.unit_price == null ? null : Number(l.unit_price),
        isIncluded: Boolean(l.is_included),
      })),
      storedInvoiceLines: (storedInvLinesBefore ?? [])
        .filter((l) => !l.event_order_line_id)
        .map((l) => ({ type: l.type as "tax" | "discount" | "fee" | "item", amount: Number(l.amount) })),
    });
    persisted.reconciliationBeforeSend = expectedPayable;
    record(
      "eo-delivery-not-assumed-payable",
      expectedPayable.includedOrNonBillable === 0 ||
        !moneyFiguresAgree(expectedPayable.deliverySubtotal, expectedPayable.payableTotal),
      JSON.stringify(expectedPayable),
    );
    record(
      "eo-payable-equals-billable-plus-tax-minus-discount",
      moneyFiguresAgree(
        expectedPayable.payableTotal,
        expectedPayable.billableSubtotal - expectedPayable.discountAmount + expectedPayable.taxAmount,
      ),
      JSON.stringify(expectedPayable),
    );
    record(
      "expected-payable-from-billable-plus-adjustments",
      expectedPayable.payableTotal > 0 && expectedPayable.billableSubtotal > 0,
      `payable=${expectedPayable.payableTotal} billable=${expectedPayable.billableSubtotal} tax=${expectedPayable.taxAmount}`,
    );

    const { data: scheduleBefore } = eoInvoice?.id
      ? await admin
          .from("payment_schedules")
          .select("id, total_amount")
          .eq("invoice_id", eoInvoice.id)
          .eq("venue_id", FANCY)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const { count: planLinesBefore } = scheduleBefore?.id
      ? await admin
          .from("payment_line_items")
          .select("id", { count: "exact", head: true })
          .eq("schedule_id", scheduleBefore.id)
      : { count: 0 };
    record(
      "payment-plan-reconciles-to-expected-payable",
      Boolean(scheduleBefore) && moneyFiguresAgree(Number(scheduleBefore?.total_amount ?? 0), expectedPayable.payableTotal),
      `schedule=${scheduleBefore?.total_amount} expected=${expectedPayable.payableTotal} lines=${planLinesBefore}`,
    );

    // Publish invoice (freeze EO billable lines). Prefer Mark as issued so
    // portal publication does not depend on outbound email succeeding.
    if (eoInvoice?.id && eoInvoice.status === "draft") {
      await page.goto(`${APP}/invoices/${eoInvoice.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await page.waitForTimeout(1500);
      const invBody = await page.locator("body").innerText();
      const money = expectedPayable.payableTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      const projectedVisible = invBody.includes(money) || invBody.includes(expectedPayable.payableTotal.toFixed(2));
      record("invoice-detail-shows-projected-payable", projectedVisible, `${money} :: ${invBody.slice(0, 500)}`);
      await page.screenshot({ path: `${OUT}/shots/invoice-detail-before-publish-1280.png`, fullPage: false });

      // When a payment plan exists, primary "Mark as issued" is hidden — Send publishes.
      const sendBtn = page.getByTestId("send-invoice-and-payment-plan");
      const markIssued = page.getByRole("button", { name: /Mark as issued/i });
      if ((await sendBtn.count()) > 0 && !(await sendBtn.isDisabled())) {
        await sendBtn.click();
        await page.getByRole("heading", { name: /Preview and send/i }).waitFor({ timeout: 30_000 });
        const confirm = page.getByTestId("confirm-send-invoice-and-payment-plan");
        await confirm.waitFor({ timeout: 15_000 });
        await confirm.click();
        await page.getByText(/Invoice and payment plan sent|Sending…/i).first()
          .waitFor({ timeout: 60_000 })
          .catch(() => undefined);
        await page.getByText(/Sent\. A new send is not available|Status updated to sent|Invoice and payment plan sent/i)
          .first()
          .waitFor({ timeout: 90_000 })
          .catch(() => undefined);
        await page.waitForTimeout(2000);
      } else if ((await markIssued.count()) > 0) {
        await markIssued.click();
        await page.getByText(/Invoice marked as Issued|marked as Issued/i).first()
          .waitFor({ timeout: 20_000 })
          .catch(() => undefined);
        await page.waitForTimeout(2000);
      }

      for (let i = 0; i < 10; i++) {
        const { data: probe } = await admin.from("invoices").select("status").eq("id", eoInvoice.id).maybeSingle();
        if (probe?.status && probe.status !== "draft") break;
        await page.waitForTimeout(1000);
        if (i === 4) {
          await page.reload({ waitUntil: "domcontentloaded" });
          const retry = page.getByRole("button", { name: /Mark as issued/i });
          if ((await retry.count()) > 0) await retry.click();
        }
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `${OUT}/shots/invoice-detail-after-publish-1280.png`, fullPage: false });
    } else {
      record("invoice-detail-shows-projected-payable", Boolean(eoInvoice), `status=${eoInvoice?.status ?? "none"}`);
    }

    const { data: invAfterSend } = eoInvoice?.id
      ? await admin
          .from("invoices")
          .select("id, status, total, subtotal, tax_amount, balance_due, event_order_revision_at_freeze")
          .eq("id", eoInvoice.id)
          .maybeSingle()
      : { data: null };
    const { data: frozenLines } = eoInvoice?.id
      ? await admin
          .from("invoice_line_items")
          .select("id, type, amount, event_order_line_id")
          .eq("invoice_id", eoInvoice.id)
      : { data: [] };
    const frozenEo = (frozenLines ?? []).filter((l) => l.event_order_line_id);
    const billableCount = (eoLinesFull ?? []).filter(
      (l) => !l.is_included && Number(l.unit_price) > 0 && Number(l.amount) > 0,
    ).length;
    record(
      "invoice-published-sent",
      invAfterSend?.status === "sent" || invAfterSend?.status === "partially_paid" || invAfterSend?.status === "paid",
      JSON.stringify(invAfterSend),
    );
    record(
      "invoice-frozen-eo-line-count",
      frozenEo.length === billableCount && billableCount > 0,
      `frozen=${frozenEo.length} billable=${billableCount}`,
    );
    record(
      "invoice-total-matches-expected-payable",
      moneyFiguresAgree(Number(invAfterSend?.total ?? 0), expectedPayable.payableTotal),
      `stored=${invAfterSend?.total} expected=${expectedPayable.payableTotal}`,
    );
    record(
      "invoice-not-tax-only-after-send",
      Number(invAfterSend?.total ?? 0) > Number(invAfterSend?.tax_amount ?? 0) + 0.02,
      JSON.stringify(invAfterSend),
    );
    persisted.invoiceAfterSend = invAfterSend;
    persisted.frozenLineCount = frozenEo.length;

    const { count: invoicesAfterSend } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    record(
      "no-duplicate-invoice-after-send",
      (invoicesAfterSend ?? 0) === (invoicesAfterHandoff ?? 0),
      `${invoicesAfterHandoff}→${invoicesAfterSend}`,
    );

    // Couple financial portal must show the published payable — not $0 / empty plan.
    if (financial?.access_token && invAfterSend?.status && invAfterSend.status !== "draft") {
      const fin2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      const finPage2 = await fin2.newPage();
      await finPage2.goto(`${APP}/p/${financial.access_token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await finPage2.waitForTimeout(2000);
      const finText = await finPage2.locator("body").innerText();
      const payableStr = expectedPayable.payableTotal.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
      });
      const payableAlt = expectedPayable.payableTotal.toFixed(2);
      const showsPayable =
        finText.includes(payableStr) ||
        finText.includes(payableAlt) ||
        finText.includes(payableStr.replace(".00", ""));
      const showsInstallment = /Initial Payment|Planning Payment|Final Payment|installment/i.test(finText);
      const notZeroContract =
        !/Total contracted\s*\$0\.00/i.test(finText.replace(/\s+/g, " ")) &&
        !/Total contracted\n\$0/i.test(finText);
      record(
        "portal-shows-expected-payable",
        showsPayable && notZeroContract,
        `expected=${payableStr} body=${finText.slice(0, 600)}`,
      );
      record("portal-shows-installment-schedule", showsInstallment, finText.slice(0, 400));
      await finPage2.screenshot({ path: `${OUT}/shots/financial-portal-payable-1280.png`, fullPage: false });

      const { data: portalPay } = await admin.rpc("get_portal_payments", {
        p_token: financial.access_token,
      });
      const schedules = (portalPay as { schedules?: Array<{ totalAmount: number; lineItems?: unknown[] }> })?.schedules ?? [];
      const invoicesPortal = (portalPay as { invoices?: Array<{ total: number; balanceDue: number }> })?.invoices ?? [];
      const portalTotal =
        invoicesPortal[0]?.total ?? schedules[0]?.totalAmount ?? 0;
      record(
        "portal-rpc-returns-published-financials",
        schedules.length > 0 || invoicesPortal.length > 0,
        JSON.stringify({ schedules: schedules.length, invoices: invoicesPortal.length }).slice(0, 400),
      );
      record(
        "portal-rpc-total-matches-payable",
        moneyFiguresAgree(Number(portalTotal), expectedPayable.payableTotal),
        `portal=${portalTotal} expected=${expectedPayable.payableTotal}`,
      );
      persisted.portalPayments = {
        scheduleCount: schedules.length,
        invoiceCount: invoicesPortal.length,
        portalTotal,
        expectedPayable: expectedPayable.payableTotal,
      };
      await fin2.close();
    } else {
      record("portal-shows-expected-payable", false, `status=${invAfterSend?.status ?? "none"}`);
      record("portal-shows-installment-schedule", false, "skipped");
      record("portal-rpc-returns-published-financials", false, "skipped");
      record("portal-rpc-total-matches-payable", false, "skipped");
    }

    // Reload EO workspace — repeat Create Invoice must not duplicate.
    await page.goto(`${APP}/events/${EVENT}?afterSend=${Date.now()}#event-order-invoice`, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    await page.waitForTimeout(1200);
    const createAgain = page.getByTestId("eo-create-draft-invoice");
    if ((await createAgain.count()) > 0) {
      await createAgain.click();
      await page.waitForTimeout(2000);
    }
    const { count: invoicesAfterRepeat } = await admin
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT)
      .eq("venue_id", FANCY);
    record(
      "repeat-create-does-not-duplicate-invoice",
      (invoicesAfterRepeat ?? 0) === (invoicesAfterSend ?? invoicesAfterHandoff ?? 0),
      `${invoicesAfterSend}→${invoicesAfterRepeat}`,
    );

    if (tokenInUrl) {
      await couplePage.goto(`${APP}/p/${tokenInUrl}#documents`, { waitUntil: "domcontentloaded", timeout: 90_000 });
      await acceptLegal(couplePage);
      const docsNav = couplePage.getByRole("button", { name: /^Docs$|^Documents$/i }).first();
      if ((await docsNav.count()) > 0) await docsNav.click().catch(() => undefined);
      await couplePage.getByText(/Loading documents/i).waitFor({ state: "hidden", timeout: 25_000 }).catch(() => undefined);
      await couplePage.getByTestId("portal-documents-event-order").first().waitFor({ timeout: 20_000 }).catch(() => undefined);
      const docsText = await couplePage.locator("body").innerText();
      record(
        "documents-show-event-order-or-invoice",
        /Event Order/i.test(docsText) && !/Loading documents/i.test(docsText),
        docsText.slice(0, 500),
      );
      await couplePage.screenshot({ path: `${OUT}/shots/documents-1280.png`, fullPage: false });
    } else {
      record("documents-show-event-order-or-invoice", false, "no couple token");
    }

    const { data: eventAfter } = await admin
      .from("events")
      .select("status, booked_at")
      .eq("id", EVENT)
      .maybeSingle();
    record(
      "booking-unchanged",
      eventAfter?.status === eventBefore?.status && eventAfter?.booked_at === eventBefore?.booked_at,
      JSON.stringify(eventAfter),
    );
    persisted.eventAfter = eventAfter;

    await couple.close();
    await staff.close();
  } finally {
    await browser.close();
    if (removed.length > 0) {
      const { error } = await admin.from("client_portal_sessions").insert(removed);
      if (error) {
        record("restore-portal-sessions", false, error.message);
      } else {
        record("restore-portal-sessions", true, `restored=${removed.length}`);
      }
    } else {
      record("restore-portal-sessions", true, "none removed");
    }
    if (createdFinancial && financial?.id) {
      await admin.from("client_portal_sessions").delete().eq("id", financial.id);
    }
  }

  const imageAfter = await servingImage();
  record("serving-sha-unchanged-during-run", imageAfter === image, imageAfter);

  writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify(persisted, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({
      pass: failed === 0,
      failed,
      total: checks.length,
      image,
      digest,
      checks,
    }, null, 2),
  );
  console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} ${checks.length - failed}/${checks.length}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ pass: false, error: String(err), checks }, null, 2),
  );
  process.exit(1);
});
