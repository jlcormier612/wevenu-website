/**
 * Sandbox proof: Nicole/Colby invoice balance counts partial installment payments.
 * Does not create or alter payment records — read-only against persisted state.
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
const INVOICE_ID = "3b9f4bb6-b44c-484a-b6dd-b2ee47c5d541";
const OUT_DIR = "docs/qa/invoice-partial-payment-balance";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

const TOTAL = 36_656.25;
const RECEIVED = 7_164.06;
const BALANCE = 29_492.19;
const INSTALLMENT = 9_164.06;
const REMAINDER = 2_000;

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  urls: Record<string, string>;
  db: Record<string, unknown>;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
} = { ok: true, servingSha: null, checks: [], ids: { invoiceId: INVOICE_ID }, urls: {}, db: {} };

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

function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
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

async function loadPersisted() {
  const { data: inv } = await admin
    .from("invoices")
    .select("id, invoice_number, total, balance_due, status, client_id, venue_id")
    .eq("id", INVOICE_ID)
    .single();
  const { data: schedules } = await admin
    .from("payment_schedules")
    .select("id")
    .eq("invoice_id", INVOICE_ID);
  const scheduleIds = (schedules ?? []).map((s) => s.id);
  const { data: lines } = scheduleIds.length
    ? await admin
        .from("payment_line_items")
        .select("id, label, amount, status, paid_amount, refunded_amount, sort_order")
        .in("schedule_id", scheduleIds)
        .order("sort_order")
    : { data: [] as Array<Record<string, unknown>> };
  const { data: paidRpc } = await admin.rpc("_compute_invoice_total_paid" as never, {
    p_invoice_id: INVOICE_ID,
  });
  return { inv, lines: lines ?? [], paidRpc };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const { computeInvoiceBalanceDue, computeNetPaid } = await import(
    "@/lib/payments/invoice-balance"
  );

  const persisted = await loadPersisted();
  out.db = persisted as unknown as Record<string, unknown>;
  out.before = {
    total: persisted.inv?.total,
    balance_due: persisted.inv?.balance_due,
    status: persisted.inv?.status,
    paidRpc: persisted.paidRpc,
  };

  const lines = (persisted.lines as Array<{
    amount: number;
    status: string;
    paid_amount: number | null;
    refunded_amount: number | null;
    label: string;
  }>).map((l) => ({
    amount: Number(l.amount),
    status: l.status,
    paidAmount: l.paid_amount != null ? Number(l.paid_amount) : null,
    refundedAmount: l.refunded_amount != null ? Number(l.refunded_amount) : null,
    label: l.label,
  }));

  const net = computeNetPaid(lines);
  const bal = computeInvoiceBalanceDue(Number(persisted.inv!.total), lines);
  const initial = lines.find((l) => /initial/i.test(l.label)) ?? lines[0]!;

  record("db_invoice_total_unchanged", Number(persisted.inv!.total) === TOTAL, String(persisted.inv!.total));
  record("db_payment_received_unchanged", Number(initial.paidAmount) === RECEIVED, String(initial.paidAmount));
  record("db_installment_partial", initial.status === "partially_paid", initial.status);
  record(
    "db_installment_remainder",
    Math.round((Number(initial.amount) - Number(initial.paidAmount ?? 0)) * 100) / 100 === REMAINDER,
    String(Math.round((Number(initial.amount) - Number(initial.paidAmount ?? 0)) * 100) / 100),
  );
  record("db_net_paid", net === RECEIVED, String(net));
  record("db_balance_due", Number(persisted.inv!.balance_due) === BALANCE, String(persisted.inv!.balance_due));
  record("db_rpc_paid", Number(persisted.paidRpc) === RECEIVED, String(persisted.paidRpc));
  record("calc_balance", bal === BALANCE, String(bal));
  record(
    "no_extra_payment_rows",
    lines.filter((l) => l.status === "partially_paid" || l.status === "paid").length === 1
      && Number(initial.paidAmount) === RECEIVED,
    `qualifyingLines=${lines.filter((l) => l.status === "partially_paid" || l.status === "paid").length}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(STAFF_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    out.servingSha = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${out.servingSha}, expected ${EXPECTED_PREFIX}`);

    const url = `${APP}/invoices/${INVOICE_ID}`;
    out.urls.invoice = url;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByText(/INV-2026-3B9F4B|Balance remaining|Paid to date/i).first().waitFor({ timeout: 60_000 });
    const body = await page.locator("body").innerText();

    record(
      "ui_paid_to_date",
      body.includes(money(RECEIVED)) || body.includes("$7,164.06"),
      money(RECEIVED),
    );
    record(
      "ui_balance_remaining",
      body.includes(money(BALANCE)) || body.includes("$29,492.19"),
      money(BALANCE),
    );
    record(
      "ui_not_full_balance",
      !body.includes("Balance remaining") || !/Balance remaining[\s\S]{0,40}\$36,656\.25/.test(body),
      "balance must not show full $36,656.25",
    );
    record(
      "ui_partial_installment",
      /Partially Paid/i.test(body)
        && (/\$2,000(?:\.00)?\s*due/i.test(body) || body.includes(money(REMAINDER)))
        && (/\$7,164(?:\.06)?\s*received/i.test(body) || body.includes(money(RECEIVED))),
      "installment Partially Paid + $2,000 due + $7,164.06 received",
    );
    record(
      "ui_total_unchanged",
      body.includes(money(TOTAL)) || body.includes("$36,656.25"),
      money(TOTAL),
    );

    await page.screenshot({ path: `${OUT_DIR}/invoice-detail-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/invoice-detail-390.png`, fullPage: true });

    // Preview / print document
    await page.setViewportSize({ width: 1280, height: 900 });
    const printUrl = `${APP}/invoices/${INVOICE_ID}/print`;
    out.urls.print = printUrl;
    await page.goto(printUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const printBody = await page.locator("body").innerText();
    record(
      "print_paid_to_date",
      printBody.includes(money(RECEIVED)) || printBody.includes("$7,164.06"),
      money(RECEIVED),
    );
    record(
      "print_balance_remaining",
      printBody.includes(money(BALANCE)) || printBody.includes("$29,492.19"),
      money(BALANCE),
    );
    record(
      "print_not_full_as_balance",
      !/Balance remaining[\s\S]{0,40}\$36,656\.25/.test(printBody),
      "print balance not full total",
    );
    await page.screenshot({ path: `${OUT_DIR}/invoice-print-1280.png`, fullPage: true });

    const after = await loadPersisted();
    out.after = {
      total: after.inv?.total,
      balance_due: after.inv?.balance_due,
      status: after.inv?.status,
      paidRpc: after.paidRpc,
      initial_paid: (after.lines as Array<{ paid_amount: number | null }>)[0]?.paid_amount,
    };
    record(
      "persisted_unchanged_by_browser",
      Number(after.inv?.total) === TOTAL
        && Number((after.lines as Array<{ paid_amount: number | null }>)[0]?.paid_amount) === RECEIVED
        && Number(after.inv?.balance_due) === BALANCE,
      JSON.stringify(out.after),
    );
  } finally {
    await browser.close().catch(() => undefined);
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({
      ok: out.ok,
      servingSha: out.servingSha,
      fail: out.checks.filter((c) => !c.pass).map((c) => c.name),
    }, null, 2));
  }
}

main().catch(async (err) => {
  console.error(err);
  out.ok = false;
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify({ ...out, error: String(err) }, null, 2));
  process.exit(1);
});
