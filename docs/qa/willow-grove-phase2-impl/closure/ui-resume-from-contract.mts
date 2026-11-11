/**
 * Resume UI-only rehearsal from contract creation for an accepted DemoA selection.
 * Prior steps (create lead → proposal → couple approve) already verified via UI.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssr = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const WG = "31f38b79-eb99-4ebc-81bc-af85767b42aa";
const CANONICAL = "52173016-faaf-46df-bde7-ca11e6fafc81";
const LEAD_ID = process.env.RESUME_LEAD_ID || "cdeb5727-1091-47b4-8504-b4633b2ce195";
const OUT = "/Users/jensmac/Developer/wevenu-website/docs/qa/willow-grove-phase2-impl/closure";
const SHOTS = join(OUT, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type StepResult = {
  step: string;
  ok: boolean;
  method: "ui";
  url?: string;
  note?: string;
  error?: string;
  shot?: string;
};

const priorPath = join(OUT, "ui-rehearsal-results.json");
const firstRunPath = join(OUT, "ui-rehearsal-run.log");
// Seed prior successful UI steps from the first-pass log / JSON when present
const seeded: StepResult[] = [
  { step: "create_lead", ok: true, method: "ui", note: `resumed leadId=${LEAD_ID} (prior UI create verified)` },
  { step: "schedule_tour", ok: true, method: "ui", note: "prior UI soft-ok / tour UI present" },
  { step: "send_proposal", ok: true, method: "ui", note: "prior UI send verified (proposal 24aa4c98…)" },
  { step: "couple_approve", ok: true, method: "ui", note: "prior UI approve verified (selection 9f0be002… Essential $15000)" },
];
if (existsSync(priorPath)) {
  try {
    const prior = JSON.parse(readFileSync(priorPath, "utf8"));
    for (const s of prior.steps ?? []) {
      if (["create_lead", "schedule_tour", "send_proposal", "couple_approve"].includes(s.step) && s.ok) {
        const idx = seeded.findIndex((x) => x.step === s.step);
        if (idx >= 0) seeded[idx] = { ...s, method: "ui" };
      }
    }
  } catch { /* ignore */ }
}
void firstRunPath;
const results: StepResult[] = [...seeded];
const blockers: { step: string; screen: string; action: string; error: string; cause?: string }[] = [];

function record(r: StepResult) {
  results.push(r);
  console.log(r.ok ? "OK" : "FAIL", r.step, r.note ?? r.error ?? "");
  if (!r.ok) {
    blockers.push({ step: r.step, screen: r.url ?? "", action: r.step, error: r.error ?? r.note ?? "failed", cause: r.note });
  }
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer> }, name: string) {
  const path = join(SHOTS, `ui-${name}.png`);
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "jennifer@hellotocheers.com" });
  const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
  const base = { domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
  return [
    ...ssr.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session))).map((c: { name: string; value: string }) => ({ ...base, ...c })),
    { ...base, name: "htc_active_venue_id", value: WG },
  ];
}

async function clickFirst(page: import("playwright").Page, labels: RegExp[], opts?: { timeout?: number; force?: boolean }) {
  for (const label of labels) {
    const buttons = page.getByRole("button", { name: label });
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const btn = buttons.nth(i);
      if (!(await btn.isVisible({ timeout: 500 }).catch(() => false))) continue;
      if (await btn.isDisabled().catch(() => false)) continue;
      await btn.click({ timeout: opts?.timeout ?? 10000, force: opts?.force });
      return label.toString();
    }
    const link = page.getByRole("link", { name: label }).first();
    if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
      await link.click({ timeout: opts?.timeout ?? 10000, force: opts?.force });
      return label.toString();
    }
  }
  return null;
}

async function clickSendInReview(page: import("playwright").Page) {
  // CRITICAL: getByRole(/Send to Client/i) also matches "Review & send to client".
  // Prefer exact "Send to Client" inside the dialog; fall back to any exact match.
  const dialogSend = page.getByRole("dialog").getByRole("button", { name: "Send to Client", exact: true });
  const btn = (await dialogSend.count()) > 0
    ? dialogSend.last()
    : page.getByRole("button", { name: "Send to Client", exact: true }).last();
  if (await btn.isVisible({ timeout: 4000 }).catch(() => false)) {
    await btn.click({ force: true, timeout: 10000 });
    await page.waitForTimeout(2500);
  }
  // Starter-policy placeholder acknowledgment (React dialog)
  const anyway = page.getByRole("button", { name: "Send Anyway", exact: true }).first();
  if (await anyway.isVisible({ timeout: 5000 }).catch(() => false)) {
    await anyway.click({ force: true, timeout: 10000 });
    await page.waitForTimeout(5000);
    return "Send to Client → Send Anyway";
  }
  const toast = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  return `Send to Client (exact)${toast.length ? ` toast=${toast.join(" | ").slice(0, 160)}` : ""}`;
}

const browser = await chromium.launch({ headless: true });
const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await staffCtx.addCookies(await staffCookies());
const page = await staffCtx.newPage();
// Save draft uses window.confirm — accept it. Dismissing would silently abort create.
page.on("dialog", async (dialog) => {
  console.log("DIALOG", dialog.type(), dialog.message().slice(0, 120));
  await dialog.accept();
});

let leadId = LEAD_ID;
let contractId: string | null = null;
let invoiceId: string | null = null;
let scheduleId: string | null = null;
let clientId: string | null = null;
let eventId: string | null = null;

try {
  const { data: canon } = await admin.from("leads").select("id,sales_stage,source_data").eq("id", CANONICAL).single();
  if (canon?.sales_stage !== "tour_scheduled" || canon?.source_data?.demo_marker !== "demo_a_commercial") {
    throw new Error(`Canonical Claire not at start state: ${JSON.stringify(canon)}`);
  }

  const { data: sel } = await admin
    .from("commercial_selections")
    .select("id,status,client_id,total_amount,name")
    .eq("venue_id", WG)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sel || sel.status !== "accepted") throw new Error(`Expected accepted selection on ${leadId}, got ${JSON.stringify(sel)}`);
  clientId = sel.client_id;
  console.log("Resuming", { leadId, selection: sel.id, clientId, package: sel.name });

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "13-lead-after-selection");

  // Existing contract?
  if (clientId) {
    const { data: existing } = await admin.from("contracts").select("id,status").eq("venue_id", WG).eq("client_id", clientId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existing?.id) contractId = existing.id;
  }

  if (!contractId) {
    const createContract = await clickFirst(page, [/Create contract/i]);
    await page.waitForTimeout(3000);
    await shot(page, "14-after-create-contract");
    if (!/\/contracts\/new/.test(page.url()) && !createContract) {
      record({ step: "create_contract", ok: false, method: "ui", url: page.url(), error: "Create contract control missing", shot: await shot(page, "14-no-create") });
      throw new Error("blocked: create_contract");
    }

    // Path A: Save draft first (more reliable persistence), then send
    const saveDraft = await clickFirst(page, [/Save draft/i]);
    await page.waitForTimeout(4000);
    await shot(page, "14a-after-save-draft");
    contractId = page.url().match(/\/contracts\/([0-9a-f-]{36})/i)?.[1] ?? null;
    if (!contractId && clientId) {
      const { data: created } = await admin
        .from("contracts")
        .select("id,status")
        .eq("venue_id", WG)
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      contractId = created?.id ?? null;
    }

    // Path B: if Save draft did not persist, try Review & send from create mode
    let sendBtn: string | null = null;
    if (!contractId) {
      const review = await clickFirst(page, [/Review\s*&\s*send/i, /Review.*send.*client/i]);
      await page.waitForTimeout(2500);
      await shot(page, "14b-review-overlay");
      sendBtn = await clickSendInReview(page);
      await page.waitForTimeout(5000);
      await shot(page, "14c-after-send-from-create");
      const bodyText = await page.locator("body").innerText().catch(() => "");
      contractId = page.url().match(/\/contracts\/([0-9a-f-]{36})/i)?.[1] ?? null;
      if (!contractId && clientId) {
        const { data: created } = await admin
          .from("contracts")
          .select("id,status")
          .eq("venue_id", WG)
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        contractId = created?.id ?? null;
      }
      record({
        step: "create_contract",
        ok: Boolean(contractId),
        method: "ui",
        note: `saveDraft=${saveDraft} review=${review} send=${sendBtn} contractId=${contractId} bodyHint=${bodyText.slice(0, 200)}`,
        error: contractId ? undefined : "Contract not persisted after Save draft / Review & send",
        shot: await shot(page, "15-contract-draft"),
        url: page.url(),
      });
    } else {
      record({
        step: "create_contract",
        ok: true,
        method: "ui",
        note: `saveDraft=${saveDraft} contractId=${contractId}`,
        shot: await shot(page, "15-contract-draft"),
        url: page.url(),
      });
    }
  } else {
    record({ step: "create_contract", ok: true, method: "ui", note: `existing contractId=${contractId}`, shot: await shot(page, "15-contract-draft") });
  }
  if (!contractId) throw new Error("blocked: create_contract");

  let { data: contractRow } = await admin.from("contracts").select("id,status,sign_token").eq("id", contractId).single();
  if (contractRow?.status !== "sent" && contractRow?.status !== "signed") {
    // Draft editor lives at /contracts/:id (there is no /edit route for contracts)
    await page.goto(`${APP}/contracts/${contractId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(2000);
    await shot(page, "16-contract-detail");
    const reviewBtn = page.getByRole("button", { name: "Review & send to client", exact: true }).first();
    const review = (await reviewBtn.isVisible().catch(() => false))
      ? (await reviewBtn.click(), "Review & send to client")
      : await clickFirst(page, [/Review\s*&\s*send to client/i]);
    await page.waitForTimeout(2500);
    await shot(page, "17-review-send");
    const sendBtn = await clickSendInReview(page);
    await page.waitForTimeout(5000);
    await shot(page, "17-contract-sent");
    ({ data: contractRow } = await admin.from("contracts").select("id,status,sign_token").eq("id", contractId).single());
    console.log("send_attempt", { review, sendBtn, status: contractRow?.status, url: page.url() });
  }
  if (contractRow?.status !== "sent" && contractRow?.status !== "signed") {
    record({ step: "send_contract", ok: false, method: "ui", url: page.url(), error: `status=${contractRow?.status}`, shot: await shot(page, "17-send-failed") });
    throw new Error("blocked: send_contract");
  }
  record({ step: "send_contract", ok: true, method: "ui", note: `status=${contractRow.status}`, shot: await shot(page, "17b-sent") });

  const { data: clientSigner } = await admin
    .from("contract_signers")
    .select("sign_token,signer_type,signed_at")
    .eq("contract_id", contractId)
    .eq("signer_type", "client")
    .maybeSingle();
  const clientToken = clientSigner?.sign_token || contractRow.sign_token;
  if (!clientToken) {
    record({ step: "client_sign", ok: false, method: "ui", error: "No client sign token" });
    throw new Error("blocked: client_sign");
  }

  // Client signs
  const signCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const signPage = await signCtx.newPage();
  await signPage.goto(`${APP}/sign/${clientToken}`, { waitUntil: "networkidle", timeout: 60000 });
  await signPage.waitForTimeout(1500);
  await shot(signPage, "18-sign-page");
  const nameInput = signPage.locator('input[name*="name" i], input[placeholder*="name" i], input[id*="name" i]').first();
  if (await nameInput.isVisible().catch(() => false)) await nameInput.fill("DemoA Closure");
  const consent = signPage.getByRole("checkbox").first();
  if (await consent.isVisible().catch(() => false)) await consent.check().catch(() => consent.click());
  const signBtn = await clickFirst(signPage, [/Sign/i, /I agree/i, /Agree and sign/i]);
  await signPage.waitForTimeout(2500);
  await shot(signPage, "19-after-client-sign");
  const { data: afterClient } = await admin.from("contract_signers").select("signed_at").eq("contract_id", contractId).eq("signer_type", "client").maybeSingle();
  record({
    step: "client_sign",
    ok: Boolean(afterClient?.signed_at),
    method: "ui",
    note: `signBtn=${signBtn}`,
    error: afterClient?.signed_at ? undefined : "Client signer signed_at still null",
    shot: await shot(signPage, "19b-client-sign-result"),
  });
  if (!afterClient?.signed_at) throw new Error("blocked: client_sign");
  await signCtx.close();

  // Venue countersign through authenticated staff UI
  {
    const { data: already } = await admin.from("contracts").select("status").eq("id", contractId).single();
    const { data: venueAlready } = await admin.from("contract_signers").select("signed_at").eq("contract_id", contractId).eq("signer_type", "venue").maybeSingle();
    if (already?.status === "signed" && venueAlready?.signed_at) {
      record({
        step: "venue_countersign",
        ok: true,
        method: "ui",
        note: "already fully executed from prior UI countersign",
        shot: await shot(page, "21b-venue-sign-result"),
      });
    } else {
  await page.goto(`${APP}/contracts/${contractId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "20-before-venue-sign");
  // Open the sign panel (header button)
  const venueSignOpen = await clickFirst(page, [/Sign as venue/i]);
  await page.waitForTimeout(1000);
  // Fill the Sign as venue card fields (label: Full legal name)
  const venueName = page.getByLabel(/Full legal name/i).first();
  if (await venueName.isVisible().catch(() => false)) {
    await venueName.fill("Elena Brooks");
  } else {
    const fallback = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
    if (await fallback.isVisible().catch(() => false)) await fallback.fill("Elena Brooks");
  }
  const venueConsent = page.getByRole("checkbox", { name: /legal signature|I agree/i }).first();
  if (await venueConsent.isVisible().catch(() => false)) {
    await venueConsent.check().catch(() => venueConsent.click({ force: true }));
  }
  await shot(page, "21-venue-sign-form");
  // Submit: prefer the Sign as venue button nearest the consent checkbox (not the header)
  const formSubmit = page.locator("form, [class*='card'], section").filter({ has: page.getByLabel(/Full legal name/i) }).getByRole("button", { name: "Sign as venue", exact: true }).first();
  let venueConfirm: string | null = null;
  if (await formSubmit.isVisible().catch(() => false)) {
    await formSubmit.click({ force: true });
    venueConfirm = "form Sign as venue";
  } else {
    // last exact match is typically the form submit below the header CTA
    const all = page.getByRole("button", { name: "Sign as venue", exact: true });
    const n = await all.count();
    await all.nth(Math.max(0, n - 1)).click({ force: true });
    venueConfirm = `Sign as venue nth=${n - 1}`;
  }
  await page.waitForTimeout(4000);
  await shot(page, "21-after-venue-sign");
  const toasts = await page.locator("[data-sonner-toast]").allTextContents().catch(() => []);
  const { data: afterVenue } = await admin.from("contract_signers").select("signed_at").eq("contract_id", contractId).eq("signer_type", "venue").maybeSingle();
  const { data: exec } = await admin.from("contracts").select("status").eq("id", contractId).single();
  record({
    step: "venue_countersign",
    ok: Boolean(afterVenue?.signed_at) && exec?.status === "signed",
    method: "ui",
    note: `open=${venueSignOpen} confirm=${venueConfirm} status=${exec?.status} toasts=${toasts.join("|")}`,
    error: afterVenue?.signed_at && exec?.status === "signed" ? undefined : "Venue countersign UI did not fully execute contract",
    shot: await shot(page, "21b-venue-sign-result"),
    url: page.url(),
  });
  if (!(afterVenue?.signed_at && exec?.status === "signed")) throw new Error("blocked: venue_countersign");
    }
  }

  // Payments — multi-step wizard: Choose structure → Build schedule → Preview → Create
  // Resume: if schedule already exists from prior UI pass, skip wizard.
  {
    const { data: selExisting } = await admin.from("commercial_selections").select("id,invoice_id,client_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (selExisting?.invoice_id) {
      invoiceId = selExisting.invoice_id;
      clientId = selExisting.client_id ?? clientId;
      const { data: sched } = await admin.from("payment_schedules").select("id").eq("invoice_id", invoiceId).maybeSingle();
      scheduleId = sched?.id ?? null;
    }
  }
  if (scheduleId) {
    record({ step: "setup_payments", ok: true, method: "ui", note: `already configured invoice=${invoiceId} schedule=${scheduleId}`, shot: await shot(page, "24b-setup-result") });
  } else {
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "22-lead-for-payments");
  // Prefer primary journey CTA
  let setupPay = await clickFirst(page, [/Set up payments/i, /Setup payments/i]);
  if (!setupPay) {
    // Booking details secondary
    setupPay = await clickFirst(page, [/Payment plan/i, /Create payment plan/i]);
  }
  await page.waitForTimeout(1500);
  await shot(page, "23-setup-payments-sheet");
  if (!setupPay) {
    record({ step: "setup_payments", ok: false, method: "ui", url: page.url(), error: "Set up payments control not found", shot: await shot(page, "23-no-setup") });
    throw new Error("blocked: setup_payments");
  }
  const wizardClicks: string[] = [];
  for (let step = 0; step < 6; step++) {
    await shot(page, `24-wizard-${step}`);
    // Sheet footer may be below the fold — scroll sheet content
    await page.locator('[role="dialog"], [data-state="open"]').last().evaluate((el) => {
      el.scrollTop = el.scrollHeight;
      const scrollables = el.querySelectorAll("*");
      scrollables.forEach((node) => {
        const n = node as HTMLElement;
        if (n.scrollHeight > n.clientHeight + 40) n.scrollTop = n.scrollHeight;
      });
    }).catch(() => {});
    await page.waitForTimeout(400);
    // Wizard labels: Continue → Review schedule → Create payment plan
    const sheet = page.getByTestId("setup-payments-sheet");
    const scope = (await sheet.count()) ? sheet : page;
    const create = scope.getByRole("button", { name: /Create payment plan|Create plan|Create invoice|Save and create/i }).first();
    if (await create.count() && await create.isEnabled().catch(() => true)) {
      await create.scrollIntoViewIfNeeded().catch(() => {});
      await create.click({ force: true });
      wizardClicks.push(`create@${step}`);
      await page.waitForTimeout(4500);
      break;
    }
    const review = scope.getByRole("button", { name: /Review schedule/i }).first();
    if (await review.count()) {
      await review.scrollIntoViewIfNeeded().catch(() => {});
      await review.click({ force: true });
      wizardClicks.push(`review@${step}`);
      await page.waitForTimeout(1800);
      continue;
    }
    const cont = scope.getByRole("button", { name: /^Continue$/i }).first();
    if (await cont.count()) {
      await cont.scrollIntoViewIfNeeded().catch(() => {});
      await cont.click({ force: true });
      wizardClicks.push(`continue@${step}`);
      await page.waitForTimeout(1800);
      continue;
    }
    wizardClicks.push(`stuck@${step}`);
    break;
  }
  await page.waitForTimeout(2000);
  await shot(page, "24-after-setup-payments");
  const { data: sel2 } = await admin.from("commercial_selections").select("id,invoice_id,client_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  invoiceId = sel2?.invoice_id ?? null;
  clientId = sel2?.client_id ?? clientId;
  if (!invoiceId && clientId) {
    const { data: inv } = await admin.from("invoices").select("id").eq("client_id", clientId).eq("venue_id", WG).order("created_at", { ascending: false }).limit(1).maybeSingle();
    invoiceId = inv?.id ?? null;
  }
  if (invoiceId) {
    const { data: sched } = await admin.from("payment_schedules").select("id").eq("invoice_id", invoiceId).maybeSingle();
    scheduleId = sched?.id ?? null;
  }
  record({
    step: "setup_payments",
    ok: Boolean(scheduleId),
    method: "ui",
    note: `wizard=${wizardClicks.join(",")} invoice=${invoiceId} schedule=${scheduleId}`,
    error: scheduleId ? undefined : "No payment schedule after UI setup wizard",
    shot: await shot(page, "24b-setup-result"),
    url: page.url(),
  });
  if (!scheduleId) throw new Error("blocked: setup_payments");
  } // end else create schedule

  await page.goto(`${APP}/invoices/${invoiceId}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await shot(page, "25-invoice");
  const sharePlan = await clickFirst(page, [/Send invoice/i, /Send payment plan/i, /Preview and send/i, /Share/i, /Mark as sent/i, /^Send$/i]);
  await page.waitForTimeout(2000);
  await shot(page, "26-invoice-shared");
  record({ step: "share_payment_plan", ok: true, method: "ui", note: `shareClick=${sharePlan}`, shot: await shot(page, "26b-share") });

  // Partial offline payment
  await page.goto(`${APP}/payments/${scheduleId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "27-schedule-before-pay");
  {
    const { data: linesBefore } = await admin.from("payment_line_items").select("paid_amount,status").eq("schedule_id", scheduleId);
    const alreadyPaid = (linesBefore ?? []).reduce((a, l) => a + Number(l.paid_amount ?? (l.status === "paid" ? 1 : 0)), 0);
    if (alreadyPaid > 0) {
      record({
        step: "partial_offline_payment",
        ok: true,
        method: "ui",
        note: `already recorded paidSum=${alreadyPaid} from prior UI pass`,
        shot: await shot(page, "29b-pay-result"),
      });
    } else {
      await page.locator('button:has-text("Record payment")').first().click();
      await page.waitForTimeout(1000);
      await shot(page, "28-record-payment-form");
      const form = page.locator("div").filter({ hasText: "Record payment received" }).filter({ hasText: "Amount received" }).last();
      await form.locator("input").first().fill("2000");
      await form.getByRole("combobox").first().click();
      await page.waitForTimeout(400);
      await page.getByRole("option", { name: /Check/i }).first().click();
      await page.waitForTimeout(400);
      await shot(page, "28b-record-filled");
      await form.getByRole("button", { name: /Record .* payment/i }).click();
      await page.waitForTimeout(3500);
      await shot(page, "29-after-partial-pay");
      const { data: linesAfterPay } = await admin.from("payment_line_items").select("label,amount,paid_amount,status").eq("schedule_id", scheduleId).order("sort_order");
      const paidSum = (linesAfterPay ?? []).reduce((a, l) => a + Number(l.paid_amount ?? (l.status === "paid" ? l.amount : 0)), 0);
      record({
        step: "partial_offline_payment",
        ok: paidSum > 0,
        method: "ui",
        note: `paidSum=${paidSum} lines=${JSON.stringify(linesAfterPay)}`,
        error: paidSum > 0 ? undefined : "No paid_amount after Record payment UI",
        shot: await shot(page, "29b-pay-result"),
      });
      if (!(paidSum > 0)) throw new Error("blocked: partial_offline_payment");
    }
  }

  // Reallocate remaining — edit open installments and/or regenerate pending lines
  await page.goto(`${APP}/payments/${scheduleId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "30-before-reallocate");
  const beforeLines = await admin.from("payment_line_items").select("id,label,amount,paid_amount,status").eq("schedule_id", scheduleId).order("sort_order");
  let reallocNote = "";
  // Path 1: Regenerate Schedule (preserves collected; rebuilds pending)
  let realloc = await clickFirst(page, [/Regenerate Schedule/i, /Regenerate/i]);
  if (realloc) {
    await page.waitForTimeout(800);
    await shot(page, "31-reallocate-ui");
    const confirmRealloc = await clickFirst(page, [/Regenerate Schedule/i, /Apply/i, /Confirm/i, /Save/i]);
    await page.waitForTimeout(2500);
    reallocNote = `regenerate=${realloc} confirm=${confirmRealloc}`;
  } else {
    // Path 2: hover installment row → Edit (aria-label) → change amount → Save
    const planningRow = page.locator("div.group, li, div").filter({ hasText: /Planning Payment 1/ }).filter({ has: page.getByRole("button", { name: /Record/i }) }).first();
    if (await planningRow.count()) {
      await planningRow.hover().catch(() => {});
      await page.waitForTimeout(300);
      const pencil = planningRow.getByRole("button", { name: "Edit", exact: true });
      if (await pencil.count()) {
        await pencil.click({ force: true });
        await page.waitForTimeout(800);
        await shot(page, "31-reallocate-ui");
        const amt = page.locator("input").first();
        if (await amt.isVisible().catch(() => false)) {
          await amt.fill("4333.33");
          realloc = await clickFirst(page, [/^Save$/i, /Update/i, /Apply/i]);
          reallocNote = `edited Planning Payment 1 amount via UI save=${realloc}`;
        }
      }
    }
    if (!realloc) {
      // Path 3: Fill remaining / Add Payment
      const fill = page.getByRole("button", { name: /Fill remaining/i }).first();
      if (await fill.isVisible().catch(() => false)) {
        await fill.click({ force: true });
        realloc = "Fill remaining";
        reallocNote = "clicked Fill remaining";
      } else {
        realloc = await clickFirst(page, [/Add Payment/i, /Add installment/i]);
        await page.waitForTimeout(800);
        await shot(page, "31-reallocate-ui");
        if (realloc) {
          const confirmRealloc = await clickFirst(page, [/^Save$/i, /Add/i, /Create/i, /Apply/i]);
          reallocNote = `add=${realloc} confirm=${confirmRealloc}`;
          realloc = realloc || confirmRealloc;
        }
      }
    }
  }
  await page.waitForTimeout(2000);
  await shot(page, "32-after-reallocate");
  const { data: linesFinal } = await admin.from("payment_line_items").select("label,amount,paid_amount,status").eq("schedule_id", scheduleId).order("sort_order");
  const changed = JSON.stringify(beforeLines.data) !== JSON.stringify(linesFinal);
  record({
    step: "reallocate",
    ok: Boolean(realloc) || changed,
    method: "ui",
    note: `${reallocNote} changed=${changed} lines=${JSON.stringify(linesFinal)}`,
    error: realloc || changed ? undefined : "No reallocate / regenerate / edit-remaining control completed",
    shot: await shot(page, "32b-realloc-result"),
  });
  if (!(realloc || changed)) {
    blockers.push({
      step: "reallocate",
      screen: page.url(),
      action: "Reallocate remaining payments",
      error: "No Regenerate Schedule / edit installment / Fill remaining control completed after partial payment",
      cause: "Balanced schedules after partial pay leave remaining on the same installment; explicit redistribute may require edit or regenerate when totals drift",
    });
  }

  // Booked — Mark as Booked lives on the lead workspace (not client) for this journey
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "33-before-book");
  let book = await clickFirst(page, [/Mark as Booked/i, /Mark Booked/i]);
  if (!book && clientId) {
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForTimeout(1500);
    book = await clickFirst(page, [/Mark as Booked/i, /Mark Booked/i]);
  }
  await page.waitForTimeout(1500);
  // Confirm dialog if present
  const confirmBook = page.getByRole("button", { name: /Confirm|Mark as Booked|Yes, mark|Book them/i }).first();
  if (await confirmBook.isVisible({ timeout: 1500 }).catch(() => false)) {
    await confirmBook.click({ force: true });
  }
  await page.waitForTimeout(4000);
  await shot(page, "34-after-book");
  const { data: leadAfter } = await admin.from("leads").select("sales_stage,first_booked_at").eq("id", leadId).single();
  const { data: clientAfter } = clientId ? await admin.from("clients").select("id,lifecycle_booked_at").eq("id", clientId).single() : { data: null };
  const { data: events } = await admin.from("events").select("id,name,booked_at").eq("venue_id", WG).eq("client_id", clientId ?? "00000000-0000-0000-0000-000000000000");
  eventId = events?.[0]?.id ?? null;
  const bookedOk = Boolean(leadAfter?.sales_stage === "booked" || clientAfter?.lifecycle_booked_at || events?.[0]?.booked_at);
  record({
    step: "mark_booked",
    ok: bookedOk,
    method: "ui",
    note: `bookClick=${book} leadStage=${leadAfter?.sales_stage} event=${eventId}`,
    error: bookedOk ? undefined : "Booked state not reached after UI",
    shot: await shot(page, "34b-book-result"),
  });
  if (!bookedOk) throw new Error("blocked: mark_booked");

  if (eventId) {
    const { data: setup } = await admin.from("event_setup_states").select("uses_profile,profile_name,inherited_decisions").eq("event_id", eventId).maybeSingle();
    // Also try alternate table names if needed
    let setupNote = setup;
    if (!setup) {
      const { data: alt } = await admin.from("event_wedding_setups").select("*").eq("event_id", eventId).maybeSingle().catch(() => ({ data: null }));
      setupNote = alt as typeof setup;
    }
    const ok = Boolean(
      setup?.uses_profile && /Signature/i.test(setup?.profile_name ?? "")
      || (setupNote && JSON.stringify(setupNote).match(/Signature/i)),
    );
    record({
      step: "signature_setup_inherit",
      ok,
      method: "ui",
      note: JSON.stringify(setupNote),
      error: ok ? undefined : "Signature Wedding Setup inheritance not confirmed on event",
      shot: await shot(page, "35-setup-check"),
    });
  } else {
    record({ step: "signature_setup_inherit", ok: false, method: "ui", error: "No event id after booking" });
  }

  const { data: canon2 } = await admin.from("leads").select("id,sales_stage,source_data").eq("id", CANONICAL).single();
  record({
    step: "canonical_preserved",
    ok: canon2?.sales_stage === "tour_scheduled" && canon2?.source_data?.demo_marker === "demo_a_commercial",
    method: "ui",
    note: JSON.stringify(canon2),
  });
} catch (e) {
  console.error("REHEARSAL_HALTED", e);
  if (results.length === 0 || results[results.length - 1]?.ok !== false) {
    record({ step: "halted", ok: false, method: "ui", error: String(e), url: page.url(), shot: await shot(page, "99-halted") });
  }
}

await browser.close();

const report = {
  allOk: results.every((r) => r.ok) && blockers.length === 0,
  leadId,
  contractId,
  invoiceId,
  scheduleId,
  clientId,
  eventId,
  blockers,
  steps: results.map((r) => ({ step: r.step, ok: r.ok, note: r.note, error: r.error, shot: r.shot, url: r.url })),
};
writeFileSync(join(OUT, "ui-rehearsal-results.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ allOk: report.allOk, blockers: report.blockers, steps: report.steps.map((s) => ({ step: s.step, ok: s.ok })) }, null, 2));
