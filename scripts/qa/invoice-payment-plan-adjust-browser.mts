/**
 * Sandbox proof: Adjust remaining payment plan after a true partial payment,
 * preview, and send revised arrangement to a controlled test email.
 * Does not mutate Nicole/Colby dogfood; uses a disposable Meadowbrook fixture.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const STAFF_EMAIL = "jlcormier612@gmail.com";
const VENUE_ID = "05f16a15-1752-4855-8a3b-aad5c593d8d9"; // Meadowbrook
const OUT_DIR = "docs/qa/invoice-payment-plan-adjust";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

const TOTAL = 10_000;
const INSTALLMENT = 4_000;
const RECEIVED = 2_500;
const BALANCE = TOTAL - RECEIVED; // 7500
const SHORTFALL = INSTALLMENT - RECEIVED; // 1500

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  urls: Record<string, string>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  send?: Record<string, unknown>;
} = {
  ok: true,
  servingSha: null,
  checks: [],
  ids: { invoiceId: null, scheduleId: null, clientId: null },
  urls: {},
};

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/dpl=([0-9a-f]{40})/i) ?? link.match(/commit\/([0-9a-f]{7,40})/i);
  return m?.[1] ?? null;
}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const anon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } },
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox");
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
  const encoded =
    "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
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

async function seedDisposable() {
  const stamp = Date.now();
  const email = `plan-adjust-${stamp}@hellotocheers.test`;
  const SPACE_ID = "6366187b-e7f5-45d0-b9bd-5534a48f6650"; // Meadowbrook Barn
  const { data: lead, error: leadErr } = await admin.from("leads").insert({
    venue_id: VENUE_ID,
    first_name: "Plan",
    last_name: `Adjust${stamp}`,
    email,
    sales_stage: "new_inquiry",
    status: "active",
    source: "website",
  }).select("id").single();
  if (leadErr || !lead) throw leadErr ?? new Error("lead");

  const { data: client, error: clientErr } = await admin.from("clients").insert({
    venue_id: VENUE_ID,
    lead_id: lead.id,
    first_name: "Plan",
    last_name: `Adjust${stamp}`,
    email: STAFF_EMAIL, // controlled Resend destination
  }).select("id").single();
  if (clientErr || !client) throw clientErr ?? new Error("client");

  // Unique far-future date per run to avoid Meadowbrook Barn occupancy collisions.
  const dayOffset = stamp % 400;
  const eventDate = new Date(Date.UTC(2029, 0, 1 + dayOffset)).toISOString().slice(0, 10);
  const { data: booked, error: bookErr } = await admin.rpc("book_relationship", {
    p_venue_id: VENUE_ID,
    p_client_id: client.id,
    p_space_id: SPACE_ID,
    p_name: `Plan Adjust ${stamp}`,
    p_event_type: "wedding",
    p_event_date: eventDate,
  });
  if (bookErr || !booked?.ok) throw bookErr ?? new Error(booked?.message ?? "book failed");
  const eventId = booked.event_id as string;
  await admin.from("events").update({ exclude_from_business_reporting: true }).eq("id", eventId);

  const { data: relationshipId, error: relErr } = await admin.rpc("find_or_create_relationship", {
    p_venue_id: VENUE_ID,
    p_email: STAFF_EMAIL,
    p_first_name: "Plan",
    p_last_name: `Adjust${stamp}`,
  });
  if (relErr || !relationshipId) throw relErr ?? new Error("relationship");
  await admin.from("clients").update({ relationship_id: relationshipId }).eq("id", client.id);
  await admin.from("leads").update({ relationship_id: relationshipId }).eq("id", lead.id);

  const invoiceNumber = `INV-ADJ-${String(stamp).slice(-8)}`;
  const { data: invoice, error: invErr } = await admin.from("invoices").insert({
    venue_id: VENUE_ID,
    client_id: client.id,
    event_id: eventId,
    invoice_number: invoiceNumber,
    display_name: `Plan Adjust disposable ${stamp}`,
    status: "partially_paid",
    issued_at: new Date().toISOString(),
    subtotal: TOTAL,
    discount_amount: 0,
    tax_amount: 0,
    total: TOTAL,
    balance_due: BALANCE,
    notes: "Disposable fixture for invoice-payment-plan-adjust QA",
  }).select("id, invoice_number, total, balance_due, status").single();
  if (invErr || !invoice) throw invErr ?? new Error("invoice");

  const { error: lineErr } = await admin.from("invoice_line_items").insert({
    venue_id: VENUE_ID,
    invoice_id: invoice.id,
    description: "Venue rental",
    quantity: 1,
    unit_price: TOTAL,
    amount: TOTAL,
    type: "package",
    sort_order: 0,
  });
  if (lineErr) throw lineErr;

  const { data: schedule, error: schErr } = await admin.from("payment_schedules").insert({
    venue_id: VENUE_ID,
    client_id: client.id,
    event_id: eventId,
    invoice_id: invoice.id,
    title: "Plan Adjust payments",
    total_amount: TOTAL,
    currency: "USD",
  }).select("id").single();
  if (schErr || !schedule) throw schErr ?? new Error("schedule");

  const { data: items, error: itemsErr } = await admin.from("payment_line_items").insert([
    {
      venue_id: VENUE_ID,
      schedule_id: schedule.id,
      label: "Initial Payment",
      amount: INSTALLMENT,
      due_date: "2026-10-01",
      status: "partially_paid",
      paid_amount: RECEIVED,
      payment_method: "check",
      reference_number: `ADJ-${stamp}`,
      paid_at: "2026-10-01T15:00:00Z",
      obligation_kind: "deposit",
      sort_order: 0,
    },
    {
      venue_id: VENUE_ID,
      schedule_id: schedule.id,
      label: "Planning Payment",
      amount: 3000,
      due_date: "2027-02-01",
      status: "pending",
      obligation_kind: "installment",
      sort_order: 1,
    },
    {
      venue_id: VENUE_ID,
      schedule_id: schedule.id,
      label: "Final Payment",
      amount: 3000,
      due_date: "2027-08-01",
      status: "pending",
      obligation_kind: "final",
      sort_order: 2,
    },
  ]).select("id, label, amount, status, paid_amount, due_date, sort_order");
  if (itemsErr || !items) throw itemsErr ?? new Error("items");

  // Seed a first payment-request send-once so revision sourceType is distinct.
  let { data: conv } = await admin
    .from("conversations")
    .select("id")
    .eq("venue_id", VENUE_ID)
    .eq("relationship_id", relationshipId)
    .eq("conversation_kind", "venue_couple")
    .maybeSingle();
  if (!conv?.id) {
    const { data: created, error: cErr } = await admin.from("conversations").insert({
      venue_id: VENUE_ID,
      relationship_id: relationshipId,
      conversation_kind: "venue_couple",
      inbox_owner_kind: "client",
      inbox_owner_client_id: client.id,
    }).select("id").single();
    if (cErr || !created) throw cErr ?? new Error("conversation");
    conv = created;
  }
  const { error: msgErr } = await admin.from("conversation_messages").insert({
    venue_id: VENUE_ID,
    conversation_id: conv.id,
    sender_type: "system",
    channel: "email",
    body: "Seeded first payment request (send-once).",
    status: "accepted",
    channel_metadata: { sourceType: "invoice_email", sourceId: invoice.id, qaSeed: true },
  });
  if (msgErr) throw msgErr;

  return {
    invoiceId: invoice.id as string,
    scheduleId: schedule.id as string,
    clientId: client.id as string,
    invoiceNumber,
    items,
    receivedPaymentId: items.find((i) => i.status === "partially_paid")!.id as string,
  };
}

async function loadPlan(invoiceId: string, scheduleId: string) {
  const { data: inv } = await admin
    .from("invoices")
    .select("id, total, balance_due, status")
    .eq("id", invoiceId)
    .single();
  const { data: lines } = await admin
    .from("payment_line_items")
    .select("id, label, amount, status, paid_amount, due_date, sort_order, payment_method, reference_number")
    .eq("schedule_id", scheduleId)
    .order("sort_order");
  const { data: activities } = await admin
    .from("payment_activities")
    .select("type, title, description, created_at")
    .eq("schedule_id", scheduleId)
    .order("created_at", { ascending: false })
    .limit(5);
  // Prefer conversation-scoped lookup — jsonb contains filters are brittle across statuses.
  const { data: invoiceRow } = await admin.from("invoices").select("client_id").eq("id", invoiceId).single();
  const { data: client } = await admin
    .from("clients")
    .select("relationship_id")
    .eq("id", invoiceRow?.client_id ?? "")
    .maybeSingle();
  let messages: Array<Record<string, unknown>> = [];
  if (client?.relationship_id) {
    const { data: conv } = await admin
      .from("conversations")
      .select("id")
      .eq("venue_id", VENUE_ID)
      .eq("relationship_id", client.relationship_id)
      .eq("conversation_kind", "venue_couple")
      .maybeSingle();
    if (conv?.id) {
      const { data: msgs } = await admin
        .from("conversation_messages")
        .select("id, status, channel_metadata, sent_at, body")
        .eq("conversation_id", conv.id)
        .order("sent_at", { ascending: false });
      messages = (msgs ?? []).filter((m) => {
        const meta = m.channel_metadata as { sourceId?: string } | null;
        return meta?.sourceId === invoiceId;
      });
    }
  }
  return { inv, lines: lines ?? [], activities: activities ?? [], messages };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const fixture = await seedDisposable();
  out.ids = {
    invoiceId: fixture.invoiceId,
    scheduleId: fixture.scheduleId,
    clientId: fixture.clientId,
    receivedPaymentId: fixture.receivedPaymentId,
  };
  out.urls.invoice = `${APP}/invoices/${fixture.invoiceId}`;
  out.before = await loadPlan(fixture.invoiceId, fixture.scheduleId);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(STAFF_EMAIL));
  await context.addCookies([{
    name: "htc_active_venue_id",
    value: VENUE_ID,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    secure: true,
    sameSite: "Lax",
  }]);
  const page = await context.newPage();

  await page.goto(out.urls.invoice, { waitUntil: "networkidle", timeout: 90_000 });
  const dpl = noteDeployment(await page.locator('link[rel="deployment"]').getAttribute("href").catch(() => null)
    ?? await page.evaluate(() => {
      const m = document.documentElement.innerHTML.match(/dpl=([0-9a-f]{40})/i);
      return m ? `dpl=${m[1]}` : null;
    }));
  out.servingSha = dpl;
  if (EXPECTED_PREFIX) {
    record("serving_commit", Boolean(dpl?.startsWith(EXPECTED_PREFIX)), dpl ?? "missing");
  } else {
    record("serving_commit", Boolean(dpl), dpl ?? "missing");
  }

  const adjustBtn = page.getByTestId("adjust-invoice-payment-plan");
  await adjustBtn.waitFor({ state: "visible", timeout: 30_000 });
  record("adjust_button_visible", await adjustBtn.isVisible(), "Adjust invoice / payment plan");
  await adjustBtn.click();
  await page.getByTestId("adjust-payment-plan-dialog").waitFor({ state: "visible" });
  await page.screenshot({ path: `${OUT_DIR}/adjust-dialog.png`, fullPage: true });

  // Redistribute equally across remaining, then bump due dates slightly for proof.
  await page.getByRole("button", { name: "Split equally" }).click();
  await page.waitForTimeout(800);
  const reconciled = page.getByTestId("adjust-plan-reconciled");
  const discrepancy = page.getByTestId("adjust-plan-discrepancy");
  const okReconcile = await reconciled.isVisible().catch(() => false);
  const badReconcile = await discrepancy.isVisible().catch(() => false);
  record("preview_reconciles", okReconcile && !badReconcile, okReconcile ? "reconciled" : await discrepancy.textContent() ?? "no reconcile");

  // Custom dates on first remaining line
  const due0 = page.getByTestId("adjust-line-due-0");
  if (await due0.count()) await due0.fill("2027-03-15");

  await page.getByTestId("adjust-plan-save").click();
  await page.getByTestId("revised-send-preview").waitFor({ state: "visible", timeout: 45_000 });
  await page.screenshot({ path: `${OUT_DIR}/send-preview.png`, fullPage: true });

  const previewText = await page.getByTestId("revised-send-preview").innerText();
  record("send_preview_total", /\$10,000/.test(previewText), previewText.slice(0, 200));
  record("send_preview_paid", /\$2,500/.test(previewText), "paid to date in preview");
  record("send_preview_outstanding", /\$7,500/.test(previewText), "outstanding in preview");
  record(
    "send_preview_contract_note",
    /signed contract is not changed/i.test(previewText),
    "contract separation note",
  );

  await page.getByTestId("send-revised-plan").click();
  // Server action may resolve slowly after Resend; prefer DB revision proof over dialog animation.
  let dialogClosed = false;
  try {
    await page.getByTestId("adjust-payment-plan-dialog").waitFor({ state: "hidden", timeout: 20_000 });
    dialogClosed = true;
  } catch {
    dialogClosed = false;
  }
  // Allow webhook/status settle
  await page.waitForTimeout(2000);
  const mid = await loadPlan(fixture.invoiceId, fixture.scheduleId);
  const revisionNow = mid.messages.filter(
    (m) => (m.channel_metadata as { sourceType?: string })?.sourceType === "invoice_plan_revision",
  );
  record(
    "send_revised_completed",
    revisionNow.length >= 1 || dialogClosed,
    revisionNow.length
      ? `revision recorded status=${revisionNow[0]?.status}; dialogClosed=${dialogClosed}`
      : `no revision yet; dialogClosed=${dialogClosed}`,
  );

  await page.reload({ waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT_DIR}/invoice-after-adjust.png`, fullPage: true });
  const body = await page.locator("body").innerText();
  record("ui_paid_unchanged", body.includes("$2,500.00") || body.includes("$2,500"), "paid to date still $2,500");
  record("ui_balance", body.includes("$7,500.00") || body.includes("$7,500"), "balance $7,500");
  record("ui_initial_not_partial_shortfall", !body.includes("$1,500 due") && !/Initial Payment[\s\S]{0,80}\$4,000/.test(body), "initial shortfall closed in UI");

  out.after = await loadPlan(fixture.invoiceId, fixture.scheduleId);
  const after = out.after as Awaited<ReturnType<typeof loadPlan>>;
  const paidLine = after.lines.find((l) => l.id === fixture.receivedPaymentId);
  record(
    "db_receipt_immutable",
    paidLine?.paid_amount === RECEIVED && paidLine?.status === "paid" && paidLine?.amount === RECEIVED,
    JSON.stringify(paidLine),
  );
  record("db_invoice_total", after.inv?.total === TOTAL, String(after.inv?.total));
  record("db_balance_due", Number(after.inv?.balance_due) === BALANCE, String(after.inv?.balance_due));
  const pending = after.lines.filter((l) => l.status === "pending" || l.status === "overdue");
  const pendingSum = Math.round(pending.reduce((s, l) => s + Number(l.amount), 0) * 100) / 100;
  record("db_remaining_sum", pendingSum === BALANCE, `pendingSum=${pendingSum} balance=${BALANCE}`);
  record(
    "db_activity",
    after.activities.some((a) => a.type === "remaining_plan_adjusted"),
    after.activities[0]?.type ?? "none",
  );
  const revisionMsgs = after.messages.filter(
    (m) => (m.channel_metadata as { sourceType?: string })?.sourceType === "invoice_plan_revision",
  );
  const firstSend = after.messages.filter(
    (m) => (m.channel_metadata as { sourceType?: string })?.sourceType === "invoice_email",
  );
  record("db_first_send_preserved", firstSend.length >= 1, `invoice_email=${firstSend.length}`);
  record(
    "db_revision_sent",
    revisionMsgs.length >= 1
      && revisionMsgs.some((m) => m.status === "accepted" || m.status === "delivered"),
    `invoice_plan_revision=${revisionMsgs.length} status=${revisionMsgs[0]?.status ?? "none"}`,
  );
  out.send = { firstSend: firstSend.length, revisionMsgs: revisionMsgs.length, revision: revisionMsgs[0] ?? null };

  // Read-only: Nicole invoice still shows Adjust (no mutation)
  await page.goto(`${APP}/invoices/3b9f4bb6-b44c-484a-b6dd-b2ee47c5d541`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  const nicoleBtn = page.getByTestId("adjust-invoice-payment-plan");
  record("nicole_adjust_reachable", await nicoleBtn.isVisible().catch(() => false), "Nicole/Colby Adjust visible");
  await page.screenshot({ path: `${OUT_DIR}/nicole-adjust-entry.png`, fullPage: true });

  await browser.close();
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, ids: out.ids }, null, 2));
  if (!out.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify({ ...out, fatal: String(err) }, null, 2));
  process.exit(1);
});
