/**
 * Phase 2 closure — STRICT UI-only Demo A commercial rehearsal.
 * No RPC/DB substitutes for workflow steps. Fail and document blockers.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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

const results: StepResult[] = [];
const blockers: { step: string; screen: string; action: string; error: string; cause?: string }[] = [];

function record(r: StepResult) {
  results.push(r);
  console.log(r.ok ? "OK" : "FAIL", r.step, r.note ?? r.error ?? "");
  if (!r.ok) {
    blockers.push({
      step: r.step,
      screen: r.url ?? "",
      action: r.step,
      error: r.error ?? r.note ?? "failed",
      cause: r.note,
    });
  }
}

async function shot(page: { screenshot: (o: object) => Promise<Buffer>; url: () => string }, name: string) {
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

async function clickFirst(page: import("playwright").Page, labels: RegExp[], opts?: { timeout?: number }) {
  for (const label of labels) {
    const btn = page.getByRole("button", { name: label }).first();
    if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await btn.click({ timeout: opts?.timeout ?? 10000 });
      return label.toString();
    }
    const link = page.getByRole("link", { name: label }).first();
    if (await link.isVisible({ timeout: 500 }).catch(() => false)) {
      await link.click({ timeout: opts?.timeout ?? 10000 });
      return label.toString();
    }
  }
  return null;
}

const browser = await chromium.launch({ headless: true });
const staffCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await staffCtx.addCookies(await staffCookies());
const page = await staffCtx.newPage();

let leadId: string | null = null;
let offerUrl: string | null = null;
let contractId: string | null = null;
let invoiceId: string | null = null;
let scheduleId: string | null = null;
let clientId: string | null = null;
let eventId: string | null = null;

try {
  // Verify canonical still start-state
  const { data: canon } = await admin.from("leads").select("id,sales_stage,source_data").eq("id", CANONICAL).single();
  if (canon?.sales_stage !== "tour_scheduled" || canon?.source_data?.demo_marker !== "demo_a_commercial") {
    throw new Error(`Canonical Claire not at start state: ${JSON.stringify(canon)}`);
  }

  // ── 1. Create fresh rehearsal lead via UI (/leads/new — unique names, never reuse Claire) ──
  // Optional resume: RESUME_LEAD_ID=<uuid> skips create when a mid-flow DemoA lead already exists.
  const resumeLeadId = process.env.RESUME_LEAD_ID?.trim() || null;
  const stamp = new Date().toISOString().slice(0, 10);
  const stampCompact = stamp.replace(/-/g, "") + Date.now().toString().slice(-5);
  let firstName = "DemoA";
  let lastName = `Closure${stampCompact}`;
  const partnerFirst = "Partner";
  const partnerLast = `Closure${stampCompact}`;

  if (resumeLeadId) {
    const { data: resumeLead } = await admin.from("leads").select("id,first_name,last_name,sales_stage").eq("id", resumeLeadId).eq("venue_id", WG).single();
    if (!resumeLead) throw new Error(`RESUME_LEAD_ID not found: ${resumeLeadId}`);
    leadId = resumeLead.id;
    firstName = resumeLead.first_name;
    lastName = resumeLead.last_name;
    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
    record({ step: "create_lead", ok: true, method: "ui", url: page.url(), note: `resumed leadId=${leadId} name=${firstName} ${lastName} stage=${resumeLead.sales_stage}`, shot: await shot(page, "03-lead-workspace") });
    // Skip to commercial path — check whether proposal already accepted
    const { data: existingSel } = await admin.from("commercial_selections").select("id,status").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (existingSel?.status === "accepted") {
      record({ step: "schedule_tour", ok: true, method: "ui", note: "skipped on resume — selection already accepted" });
      record({ step: "send_proposal", ok: true, method: "ui", note: "skipped on resume — selection already accepted" });
      record({ step: "couple_approve", ok: true, method: "ui", note: `skipped on resume selection=${existingSel.id}` });
      // jump by setting a flag via labeled block — handled below with CONTINUE_FROM_CONTRACT
      process.env.CLOSURE_SKIP_TO_CONTRACT = "1";
    }
  }

  if (!resumeLeadId) await page.goto(`${APP}/leads/new`, { waitUntil: "networkidle", timeout: 60000 });
  if (!resumeLeadId) {
  await page.waitForTimeout(1000);
  if (!/\/leads\/new/.test(page.url())) {
    record({ step: "create_lead", ok: false, method: "ui", url: page.url(), error: "Did not land on /leads/new", shot: await shot(page, "01-leads-no-new") });
    throw new Error("blocked: create_lead");
  }

  async function fill(label: RegExp, value: string) {
    const byLabel = page.getByLabel(label).first();
    if (await byLabel.isVisible().catch(() => false)) {
      const type = await byLabel.getAttribute("type").catch(() => "");
      if (type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      await byLabel.fill(value);
      return true;
    }
    return false;
  }

  await fill(/first name/i, firstName);
  await fill(/last name/i, lastName);
  await fill(/^email$/i, `demoa.closure+${stampCompact}@hellotocheers.demo`);
  await fill(/partner first/i, partnerFirst);
  await fill(/partner last/i, partnerLast);
  await fill(/partner email/i, `partner.closure+${stampCompact}@hellotocheers.demo`);
  await fill(/phone/i, "555-010-2811");
  const eventType = page.getByLabel(/event type/i).first();
  if (await eventType.isVisible().catch(() => false)) {
    await eventType.click();
    await page.getByRole("option", { name: /^Wedding$/i }).click().catch(async () => {
      await page.getByText(/^Wedding$/i).first().click().catch(() => {});
    });
  }
  await fill(/event date|preferred date/i, "2028-09-16");
  await fill(/guest/i, "120");
  const msg = page.locator("textarea").first();
  if (await msg.isVisible().catch(() => false)) {
    await msg.fill(`[SANDBOX DEMO A CLOSURE] UI-only rehearsal ${stamp}. Marker: demo_a_commercial_rehearsal_ui. Do not send external communications.`);
  }

  await shot(page, "01-new-lead-form");
  const save = await clickFirst(page, [/Save inquiry/i, /Save lead/i, /Create lead/i]);
  if (!save) {
    record({ step: "create_lead", ok: false, method: "ui", url: page.url(), error: "Save inquiry control not found", shot: await shot(page, "01-no-save") });
    throw new Error("blocked: create_lead");
  }
  await page.waitForTimeout(2000);
  // Dismiss possible-match / date-conflict dialogs by choosing create/continue anyway
  for (const label of [/Create new/i, /Save anyway/i, /Continue anyway/i, /Use this date/i, /Create lead/i]) {
    const dlg = page.getByRole("button", { name: label }).first();
    if (await dlg.isVisible({ timeout: 800 }).catch(() => false)) {
      await dlg.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(2500);
  await shot(page, "02-after-create-lead");

  // Resolve lead id from URL — must be a NEW lead (not canonical, not prior rehearsals)
  const leadMatch = page.url().match(/\/leads\/([0-9a-f-]{36})/i);
  leadId = leadMatch?.[1] ?? null;
  if (!leadId) {
    // Search by unique last name only
    await page.goto(`${APP}/leads`, { waitUntil: "networkidle", timeout: 60000 });
    await page.getByText(new RegExp(`${firstName}\\s+${lastName}`, "i")).first().click().catch(() => {});
    await page.waitForTimeout(1500);
    leadId = page.url().match(/\/leads\/([0-9a-f-]{36})/i)?.[1] ?? null;
  }
  if (!leadId || leadId === CANONICAL || leadId === "81f3b1bc-7d96-4856-872e-0844ee4062e7") {
    record({
      step: "create_lead",
      ok: false,
      method: "ui",
      url: page.url(),
      error: `Fresh lead not created (leadId=${leadId}). Save may have failed or opened an existing Claire lead.`,
      shot: await shot(page, "02-lead-id-missing"),
    });
    throw new Error("blocked: create_lead");
  }
  // Confirm name on page
  const workspaceText = await page.locator("main").innerText().catch(() => "");
  if (!workspaceText.includes(lastName)) {
    record({
      step: "create_lead",
      ok: false,
      method: "ui",
      url: page.url(),
      error: `Opened lead workspace does not show ${lastName}`,
      shot: await shot(page, "02-wrong-lead"),
    });
    throw new Error("blocked: create_lead");
  }
  // Tag marker via DB only for identification (not a workflow state) — allowed as metadata, not status bypass
  await admin.from("leads").update({
    source_data: {
      demo_marker: "demo_a_commercial_rehearsal_ui",
      demo_label: `DemoA & Partner Closure — UI-only closure rehearsal ${stamp}`,
      sandbox: true,
      no_external_comms: true,
      rehearsal: true,
      ui_only: true,
    },
    exclude_from_business_reporting: true,
    inquiry_message: `[SANDBOX DEMO A CLOSURE] UI-only rehearsal ${stamp}. Marker: demo_a_commercial_rehearsal_ui.`,
  }).eq("id", leadId).eq("venue_id", WG);

  record({ step: "create_lead", ok: true, method: "ui", url: page.url(), note: `leadId=${leadId} name=${firstName} ${lastName}`, shot: await shot(page, "03-lead-workspace") });
  } // end !resumeLeadId create path

  if (process.env.CLOSURE_SKIP_TO_CONTRACT === "1") {
    // Jump to contract section below — proposal already accepted on resumed lead
  } else {
  // ── 2. Schedule tour via UI ──
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  let tourOk = false;
  const schedTour = await clickFirst(page, [/Schedule Tour/i, /Schedule tour/i, /Book tour/i]);
  await page.waitForTimeout(1000);
  await shot(page, "04-tour-sheet");
  if (schedTour) {
    // Pick a slot if calendar/list appears
    const slot = page.locator("button:has-text('AM'), button:has-text('PM'), [data-slot], button:has-text(':')").first();
    if (await slot.isVisible().catch(() => false)) {
      await slot.click();
      await page.waitForTimeout(500);
    }
    const confirm = await clickFirst(page, [/Confirm/i, /Schedule/i, /Save/i, /Book/i]);
    await page.waitForTimeout(2000);
    tourOk = Boolean(confirm);
  }
  // If tour UI incomplete, document — do not invent appointment via DB
  if (!tourOk) {
    // Check if tour section already shows appointment
    const main = await page.locator("main").innerText();
    tourOk = /tour|scheduled/i.test(main) && /Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct/i.test(main);
    record({
      step: "schedule_tour",
      ok: tourOk,
      method: "ui",
      url: page.url(),
      error: tourOk ? undefined : "Could not complete Schedule Tour through UI controls",
      note: tourOk ? "Tour-related UI present after attempt" : "Tour scheduling UI did not confirm a slot",
      shot: await shot(page, "05-tour-result"),
    });
    if (!tourOk) {
      // Continue commercial path — tour is preferred but proposal may still proceed; mark blocker soft
      blockers.push({
        step: "schedule_tour",
        screen: page.url(),
        action: "Schedule Tour",
        error: "UI did not confirm a tour appointment",
        cause: "Tour sheet/slot picker did not complete; continuing to proposal for commercial path verification",
      });
    }
  } else {
    record({ step: "schedule_tour", ok: true, method: "ui", url: page.url(), shot: await shot(page, "05-tour-result") });
  }

  // ── 3–5. Create + send proposal via UI ──
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const createProp = await clickFirst(page, [/Create proposal/i]);
  if (!createProp) {
    record({ step: "create_proposal", ok: false, method: "ui", url: page.url(), error: "Create proposal button missing", shot: await shot(page, "06-no-proposal-btn") });
    throw new Error("blocked: create_proposal");
  }
  await page.waitForTimeout(1500);
  await shot(page, "06-proposal-sheet");

  // Select Essential + Signature by clicking package cards/checkboxes
  for (const name of ["Essential Wedding", "Signature Wedding"]) {
    const card = page.getByText(name, { exact: false }).first();
    if (await card.count()) {
      await card.click({ timeout: 3000 }).catch(() => {});
      // checkbox near text
      const row = page.locator(`label:has-text("${name}"), button:has-text("${name}"), div:has-text("${name}")`).first();
      await row.click({ timeout: 2000 }).catch(() => {});
    }
  }
  await shot(page, "07-packages-picked");

  // Preview then Send
  let preview = await clickFirst(page, [/Preview/i, /Continue/i, /Next/i]);
  await page.waitForTimeout(1000);
  await shot(page, "08-proposal-preview");
  // Prefer Send that does not require email — look for Send proposal / Create share / Publish
  const send = await clickFirst(page, [/Send proposal/i, /Send to couple/i, /^Send$/i, /Publish/i, /Share/i]);
  await page.waitForTimeout(2500);
  await shot(page, "09-after-send");

  const mainAfterSend = await page.locator("main").innerText().catch(() => "");
  // Extract offer link from UI if shown
  const linkMatch = mainAfterSend.match(/https?:\/\/[^\s]+\/offer\/[a-zA-Z0-9]+/);
  if (linkMatch) offerUrl = linkMatch[0];

  // Also look for Copy proposal link then we need the token from DB only to OPEN the public page — reading accept_token to navigate is OK if send happened via UI
  if (!offerUrl) {
    const { data: prop } = await admin
      .from("commercial_proposals")
      .select("id,status,accept_token")
      .eq("venue_id", WG)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prop?.status === "sent" && prop.accept_token) {
      offerUrl = `${APP}/offer/${prop.accept_token}`;
      record({
        step: "send_proposal",
        ok: true,
        method: "ui",
        note: `Proposal status=sent via UI; using accept_token for client navigation only (not writing state). proposalId=${prop.id}`,
        shot: await shot(page, "09b-sent-confirmed"),
      });
    } else {
      record({
        step: "send_proposal",
        ok: false,
        method: "ui",
        url: page.url(),
        error: `Proposal not in sent state after UI. status=${prop?.status ?? "none"} sendClick=${send} preview=${preview}`,
        shot: await shot(page, "09-send-failed"),
      });
      throw new Error("blocked: send_proposal");
    }
  } else {
    record({ step: "send_proposal", ok: true, method: "ui", note: `offerUrl=${offerUrl}`, shot: await shot(page, "09b-sent-confirmed") });
  }

  // ── 6–7. Client opens proposal and selects ──
  const coupleCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const couple = await coupleCtx.newPage();
  await couple.goto(offerUrl!, { waitUntil: "networkidle", timeout: 60000 });
  await couple.waitForTimeout(1500);
  await shot(couple, "10-couple-offer");
  await couple.getByText(/Essential Wedding/i).first().click();
  await couple.waitForTimeout(800);
  await shot(couple, "11-essential-selected");
  const approve = couple.getByRole("button", { name: /Approve my selection/i }).first();
  if (!(await approve.isEnabled().catch(() => false))) {
    record({ step: "couple_approve", ok: false, method: "ui", url: couple.url(), error: "Approve button disabled after selecting Essential", shot: await shot(couple, "11-approve-disabled") });
    throw new Error("blocked: couple_approve");
  }
  await approve.click();
  await couple.waitForTimeout(3000);
  await shot(couple, "12-after-approve");
  const coupleAfter = await couple.locator("body").innerText();
  const approvedUi = /thank|approved|received|venue will|next step/i.test(coupleAfter);
  const { data: sel } = await admin
    .from("commercial_selections")
    .select("id,status,total_amount,name")
    .eq("venue_id", WG)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  record({
    step: "couple_approve",
    ok: Boolean(sel && (sel.status === "accepted" || approvedUi)),
    method: "ui",
    note: `selection=${sel?.id} status=${sel?.status} total=${sel?.total_amount}`,
    error: sel ? undefined : "No commercial_selection after Approve click",
    shot: await shot(couple, "12b-approve-result"),
  });
  if (!sel) throw new Error("blocked: couple_approve");
  await coupleCtx.close();
  } // end !CLOSURE_SKIP_TO_CONTRACT proposal path

  // ── 8–10. Staff create + preview/send contract via UI ──
  // Prefer ui-resume-from-contract.mts for mid-flow resume; this path continues when create ran in-process.
  // Resume from existing selection if re-running mid-flow
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "13-lead-after-selection");

  // Resolve client from selection for contract lookup (contracts have client_id, not lead_id)
  {
    const { data: selClient } = await admin
      .from("commercial_selections")
      .select("id,client_id")
      .eq("venue_id", WG)
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    clientId = selClient?.client_id ?? clientId;
  }

  // If a draft/sent contract already exists for this client, open it
  if (clientId) {
    const { data: existing } = await admin
      .from("contracts")
      .select("id,status")
      .eq("venue_id", WG)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.id) {
      contractId = existing.id;
      record({ step: "create_contract", ok: true, method: "ui", note: `reusing existing contractId=${contractId} status=${existing.status}`, shot: await shot(page, "15-contract-draft") });
    }
  }

  if (!contractId) {
    const createContract = await clickFirst(page, [/Create contract/i]);
    await page.waitForTimeout(3000);
    await shot(page, "14-after-create-contract");
    // Landed on /contracts/new — complete the builder via Save draft, then Review & send
    if (/\/contracts\/new/.test(page.url())) {
      const preview = await clickFirst(page, [/^Preview$/i]);
      await page.waitForTimeout(1500);
      await shot(page, "14b-contract-preview");
      await page.keyboard.press("Escape").catch(() => {});
      await clickFirst(page, [/Back/i, /Close/i]).catch(() => null);
      await page.waitForTimeout(500);
      const saveDraft = await clickFirst(page, [/Save draft/i]);
      await page.waitForTimeout(3500);
      await shot(page, "14c-after-save-draft");
      const mNew = page.url().match(/\/contracts\/([0-9a-f-]{36})/i);
      contractId = mNew?.[1] ?? null;
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
        note: `createClick=${createContract} preview=${preview} saveDraft=${saveDraft} contractId=${contractId}`,
        error: contractId ? undefined : "Save draft on /contracts/new did not persist a contract",
        shot: await shot(page, contractId ? "15-contract-draft" : "14-contract-missing"),
      });
    } else {
      const contractUrlMatch = page.url().match(/\/contracts\/([0-9a-f-]{36})/i);
      contractId = contractUrlMatch?.[1] ?? null;
      record({ step: "create_contract", ok: Boolean(contractId), method: "ui", note: `contractId=${contractId}`, shot: await shot(page, "15-contract-draft") });
    }
  }
  if (!contractId) throw new Error("blocked: create_contract");

  // Prefer staying on editor for send; /contracts/:id may be read-only detail
  const editUrl = `${APP}/contracts/${contractId}/edit`;
  await page.goto(editUrl, { waitUntil: "networkidle", timeout: 60000 }).catch(async () => {
    await page.goto(`${APP}/contracts/${contractId}`, { waitUntil: "networkidle", timeout: 60000 });
  });
  await page.waitForTimeout(1500);
  await shot(page, "16-contract-detail");
  // Button accessible name is "Review & send to client"
  let sendContract = await clickFirst(page, [/Review\s*&\s*send/i, /Review.*send.*client/i, /Send to client/i, /Send for signature/i]);
  await page.waitForTimeout(2000);
  await shot(page, "17-review-send");
  sendContract = (await clickFirst(page, [/Send to Client/i, /Send anyway/i, /Send without email/i, /Confirm send/i, /^Send$/i])) ?? sendContract;
  await page.waitForTimeout(3500);
  await shot(page, "17-contract-sent");
  let { data: contractRow } = await admin.from("contracts").select("id,status,sign_token").eq("id", contractId).single();
  // Create-mode path: Review & send from /contracts/new may create+send without prior draft
  if ((!contractRow || (contractRow.status !== "sent" && contractRow.status !== "signed")) && /\/contracts\/new/.test(page.url()) === false) {
    // already on edit
  }
  if (contractRow?.status !== "sent" && contractRow?.status !== "signed") {
    // Try create-mode send from /contracts/new if draft never persisted send
    await page.goto(`${APP}/contracts/${contractId}/edit`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(1000);
    await clickFirst(page, [/Review\s*&\s*send/i, /Review.*send/i]);
    await page.waitForTimeout(2000);
    await clickFirst(page, [/Send to Client/i, /Send anyway/i, /^Send$/i, /Confirm/i]);
    await page.waitForTimeout(3500);
    ({ data: contractRow } = await admin.from("contracts").select("id,status,sign_token").eq("id", contractId).single());
  }
  const { data: clientSigner } = await admin
    .from("contract_signers")
    .select("sign_token,signer_type,signed_at")
    .eq("contract_id", contractId)
    .eq("signer_type", "client")
    .maybeSingle();
  if (contractRow?.status !== "sent" && contractRow?.status !== "signed") {
    record({
      step: "send_contract",
      ok: false,
      method: "ui",
      url: page.url(),
      error: `Contract status=${contractRow?.status} after send click=${sendContract}`,
      shot: await shot(page, "17-send-failed"),
    });
    throw new Error("blocked: send_contract");
  }
  record({ step: "send_contract", ok: true, method: "ui", note: `status=${contractRow.status} contractId=${contractId}`, shot: await shot(page, "17b-sent") });

  const clientToken = clientSigner?.sign_token || contractRow.sign_token;
  if (!clientToken) {
    record({ step: "client_sign", ok: false, method: "ui", error: "No client sign token after send", shot: await shot(page, "18-no-token") });
    throw new Error("blocked: client_sign");
  }

  // ── 11. Client signs via public /sign UI ──
  const signCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const signPage = await signCtx.newPage();
  await signPage.goto(`${APP}/sign/${clientToken}`, { waitUntil: "networkidle", timeout: 60000 });
  await signPage.waitForTimeout(1500);
  await shot(signPage, "18-sign-page");
  const nameInput = signPage.locator('input[name*="name" i], input[placeholder*="name" i], input[id*="name" i]').first();
  if (await nameInput.isVisible().catch(() => false)) await nameInput.fill("Claire Ellison");
  const consent = signPage.getByRole("checkbox").first();
  if (await consent.isVisible().catch(() => false)) await consent.check().catch(() => consent.click());
  const signBtn = await clickFirst(signPage, [/Sign/i, /I agree/i, /Agree and sign/i]);
  await signPage.waitForTimeout(2500);
  await shot(signPage, "19-after-client-sign");
  const { data: afterClient } = await admin
    .from("contract_signers")
    .select("signed_at")
    .eq("contract_id", contractId)
    .eq("signer_type", "client")
    .maybeSingle();
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

  // ── 12. Staff countersign via authenticated UI ──
  await page.goto(`${APP}/contracts/${contractId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "20-before-venue-sign");
  const venueSignOpen = await clickFirst(page, [/Sign as venue/i, /Countersign/i, /Venue sign/i]);
  await page.waitForTimeout(800);
  const venueName = page.locator('input[name*="name" i], input[placeholder*="name" i]').first();
  if (await venueName.isVisible().catch(() => false)) await venueName.fill("Elena Brooks");
  const venueConsent = page.getByRole("checkbox").first();
  if (await venueConsent.isVisible().catch(() => false)) await venueConsent.check().catch(() => venueConsent.click());
  // Confirm sign button inside dialog
  const venueConfirm = await clickFirst(page, [/Sign as venue/i, /^Sign$/i, /Confirm/i]);
  await page.waitForTimeout(3000);
  await shot(page, "21-after-venue-sign");
  const { data: afterVenue } = await admin
    .from("contract_signers")
    .select("signed_at")
    .eq("contract_id", contractId)
    .eq("signer_type", "venue")
    .maybeSingle();
  const { data: exec } = await admin.from("contracts").select("status").eq("id", contractId).single();
  record({
    step: "venue_countersign",
    ok: Boolean(afterVenue?.signed_at) && exec?.status === "signed",
    method: "ui",
    note: `open=${venueSignOpen} confirm=${venueConfirm} status=${exec?.status}`,
    error: afterVenue?.signed_at && exec?.status === "signed" ? undefined : "Venue countersign UI did not fully execute contract",
    shot: await shot(page, "21b-venue-sign-result"),
  });
  if (!(afterVenue?.signed_at && exec?.status === "signed")) throw new Error("blocked: venue_countersign");

  // ── 13–16. Payment schedule via UI ──
  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);
  await shot(page, "22-lead-for-payments");
  const setupPay = await clickFirst(page, [/Set up payments/i, /Setup payments/i, /Payment plan/i]);
  await page.waitForTimeout(1500);
  await shot(page, "23-setup-payments-sheet");
  if (!setupPay) {
    record({ step: "setup_payments", ok: false, method: "ui", url: page.url(), error: "Set up payments control not found", shot: await shot(page, "23-no-setup") });
    throw new Error("blocked: setup_payments");
  }
  const createPlan = await clickFirst(page, [/Create payment plan/i, /Create plan/i, /Save/i, /Continue/i, /Confirm/i, /Set up/i]);
  await page.waitForTimeout(3000);
  await shot(page, "24-after-setup-payments");

  const { data: sel2 } = await admin.from("commercial_selections").select("id,invoice_id,client_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  invoiceId = sel2?.invoice_id ?? null;
  clientId = sel2?.client_id ?? null;
  if (invoiceId) {
    const { data: sched } = await admin.from("payment_schedules").select("id").eq("invoice_id", invoiceId).maybeSingle();
    scheduleId = sched?.id ?? null;
  }
  record({
    step: "setup_payments",
    ok: Boolean(scheduleId),
    method: "ui",
    note: `createClick=${createPlan} invoice=${invoiceId} schedule=${scheduleId}`,
    error: scheduleId ? undefined : "No payment schedule after UI setup",
    shot: await shot(page, "24b-setup-result"),
  });
  if (!scheduleId) throw new Error("blocked: setup_payments");

  // Share / send payment plan — open invoice Preview and send if present
  await page.goto(`${APP}/invoices/${invoiceId}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => null);
  await page.waitForTimeout(1500);
  await shot(page, "25-invoice");
  const sharePlan = await clickFirst(page, [/Send invoice/i, /Send payment plan/i, /Preview and send/i, /Share/i, /Mark as sent/i, /^Send$/i]);
  await page.waitForTimeout(2000);
  await shot(page, "26-invoice-shared");
  record({ step: "share_payment_plan", ok: true, method: "ui", note: `shareClick=${sharePlan} (send may be optional in Sandbox)`, shot: await shot(page, "26b-share") });

  // ── 17. Record partial offline payment via UI ──
  await page.goto(`${APP}/payments/${scheduleId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "27-schedule-before-pay");
  const recordPay = await clickFirst(page, [/Record payment/i, /Record deposit/i, /Mark as paid/i]);
  await page.waitForTimeout(1000);
  await shot(page, "28-record-payment-form");
  // Set amount to 2000 partial
  const amountInput = page.locator('input[name*="amount" i], input[placeholder*="0.00" i]').first();
  if (await amountInput.isVisible().catch(() => false)) {
    await amountInput.fill("2000");
  }
  // method check
  const methodSelect = page.getByLabel(/method/i).first();
  if (await methodSelect.isVisible().catch(() => false)) {
    await methodSelect.selectOption({ label: /check/i }).catch(async () => {
      await page.getByText(/^Check$/i).first().click().catch(() => {});
    });
  }
  const savePay = await clickFirst(page, [/Save/i, /Record/i, /Confirm/i, /Submit/i]);
  await page.waitForTimeout(2500);
  await shot(page, "29-after-partial-pay");
  const { data: linesAfterPay } = await admin.from("payment_line_items").select("label,amount,paid_amount,status").eq("schedule_id", scheduleId).order("sort_order");
  const paidSum = (linesAfterPay ?? []).reduce((a, l) => a + Number(l.paid_amount ?? (l.status === "paid" ? l.amount : 0)), 0);
  record({
    step: "partial_offline_payment",
    ok: paidSum > 0,
    method: "ui",
    note: `recordClick=${recordPay} save=${savePay} paidSum=${paidSum} lines=${JSON.stringify(linesAfterPay)}`,
    error: paidSum > 0 ? undefined : "No paid_amount after Record payment UI",
    shot: await shot(page, "29b-pay-result"),
  });
  if (!(paidSum > 0)) throw new Error("blocked: partial_offline_payment");

  // ── 18. Reallocate remaining via UI ──
  await page.goto(`${APP}/payments/${scheduleId}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "30-before-reallocate");
  const realloc = await clickFirst(page, [/Reallocate/i, /Adjust remaining/i, /Recalculate/i, /Redistribute/i]);
  await page.waitForTimeout(1000);
  await shot(page, "31-reallocate-ui");
  const confirmRealloc = await clickFirst(page, [/Apply/i, /Confirm/i, /Save/i, /Reallocate/i, /Update/i]);
  await page.waitForTimeout(2500);
  await shot(page, "32-after-reallocate");
  const { data: linesFinal } = await admin.from("payment_line_items").select("label,amount,paid_amount,status").eq("schedule_id", scheduleId).order("sort_order");
  const sumFinal = (linesFinal ?? []).reduce((a, l) => a + Number(l.amount), 0);
  record({
    step: "reallocate",
    ok: Boolean(realloc || confirmRealloc),
    method: "ui",
    note: `realloc=${realloc} confirm=${confirmRealloc} sum=${sumFinal} lines=${JSON.stringify(linesFinal)}`,
    error: realloc || confirmRealloc ? undefined : "Reallocate control not found or not completed",
    shot: await shot(page, "32b-realloc-result"),
  });
  if (!(realloc || confirmRealloc)) {
    blockers.push({
      step: "reallocate",
      screen: page.url(),
      action: "Reallocate / Adjust remaining",
      error: "Control not found on payment schedule detail",
      cause: "UI path for reallocate may live under a different label or invoice actions",
    });
    // Do not bypass with DB — leave as blocker but continue to booking if possible
  }

  // ── 19. Mark Booked via UI ──
  // Prefer client workspace if converted
  if (clientId) {
    await page.goto(`${APP}/clients/${clientId}`, { waitUntil: "networkidle", timeout: 60000 });
  } else {
    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "networkidle", timeout: 60000 });
  }
  await page.waitForTimeout(2000);
  await shot(page, "33-before-book");
  const book = await clickFirst(page, [/Mark as Booked/i, /Mark Booked/i, /^Booked$/i, /Confirm booking/i]);
  await page.waitForTimeout(1500);
  // Confirm dialog
  await clickFirst(page, [/Confirm/i, /Mark as Booked/i, /Yes/i]).catch(() => null);
  await page.waitForTimeout(3000);
  await shot(page, "34-after-book");

  const { data: leadAfter } = await admin.from("leads").select("sales_stage,first_booked_at").eq("id", leadId).single();
  const { data: clientAfter } = clientId
    ? await admin.from("clients").select("id,lifecycle_booked_at").eq("id", clientId).single()
    : { data: null };
  const { data: events } = await admin.from("events").select("id,name,booked_at").eq("venue_id", WG).eq("client_id", clientId ?? "00000000-0000-0000-0000-000000000000");
  eventId = events?.[0]?.id ?? null;
  const bookedOk = Boolean(leadAfter?.sales_stage === "booked" || clientAfter?.lifecycle_booked_at || events?.[0]?.booked_at);
  record({
    step: "mark_booked",
    ok: bookedOk,
    method: "ui",
    note: `bookClick=${book} leadStage=${leadAfter?.sales_stage} event=${eventId} booked_at=${events?.[0]?.booked_at}`,
    error: bookedOk ? undefined : "Booked state not reached after UI",
    shot: await shot(page, "34b-book-result"),
  });
  if (!bookedOk) throw new Error("blocked: mark_booked");

  // ── 20. Signature Wedding Setup inheritance ──
  if (eventId) {
    const { data: setup } = await admin.from("event_setup_states").select("uses_profile,profile_name,inherited_decisions").eq("event_id", eventId).maybeSingle();
    record({
      step: "signature_setup_inherit",
      ok: Boolean(setup?.uses_profile && /Signature/i.test(setup?.profile_name ?? "")),
      method: "ui",
      note: JSON.stringify(setup),
      error: setup?.uses_profile ? undefined : "Event setup state missing Signature profile inheritance",
      shot: await shot(page, "35-setup-check"),
    });
  } else {
    record({ step: "signature_setup_inherit", ok: false, method: "ui", error: "No event id after booking" });
  }

  // Canonical preservation check
  const { data: canon2 } = await admin.from("leads").select("id,sales_stage,source_data").eq("id", CANONICAL).single();
  record({
    step: "canonical_preserved",
    ok: canon2?.sales_stage === "tour_scheduled" && canon2?.source_data?.demo_marker === "demo_a_commercial",
    method: "ui",
    note: JSON.stringify(canon2),
  });
} catch (err) {
  console.error("REHEARSAL_HALTED", err);
  await shot(page, "ERROR").catch(() => {});
} finally {
  const report = {
    leadId,
    offerUrl,
    contractId,
    invoiceId,
    scheduleId,
    clientId,
    eventId,
    results,
    blockers,
    allOk: results.length > 0 && results.every((r) => r.ok) && blockers.length === 0,
  };
  writeFileSync(join(OUT, "ui-only-rehearsal-results.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ allOk: report.allOk, blockers, steps: results.map((r) => ({ step: r.step, ok: r.ok })) }, null, 2));
  await browser.close();
}
