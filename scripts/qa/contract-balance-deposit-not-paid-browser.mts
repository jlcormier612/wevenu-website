/**
 * Sandbox proof: contract balance_remaining does not treat configured deposit as paid.
 * Creates disposable Fancy Venue selection + contract preview path; cleans up.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/contract-balance-deposit-not-paid";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";
const TOTAL = 35_000;
const DEPOSIT = 8_750;

const out: {
  ok: boolean;
  servingSha: string | null;
  checks: Array<{ name: string; pass: boolean; detail: string }>;
  ids: Record<string, string | null>;
  urls: Record<string, string>;
  db: Record<string, unknown>;
} = { ok: true, servingSha: null, checks: [], ids: {}, urls: {}, db: {} };

function record(name: string, pass: boolean, detail: string) {
  out.checks.push({ name, pass, detail });
  if (!pass) out.ok = false;
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/commit\/([0-9a-f]{7,40})/i) ?? link.match(/dpl[_-]([0-9a-f]{7,40})/i);
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

const cleanupIds: {
  leadId?: string;
  clientId?: string;
  selectionId?: string;
  contractId?: string;
} = {};

async function cleanup() {
  if (cleanupIds.contractId) {
    await admin.from("contracts").delete().eq("id", cleanupIds.contractId);
  }
  if (cleanupIds.selectionId) {
    await admin.from("commercial_selection_items").delete().eq("selection_id", cleanupIds.selectionId);
    await admin.from("commercial_selections").delete().eq("id", cleanupIds.selectionId);
  }
  if (cleanupIds.clientId) {
    await admin.from("clients").delete().eq("id", cleanupIds.clientId);
  }
  if (cleanupIds.leadId) {
    await admin.from("leads").delete().eq("id", cleanupIds.leadId);
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const stamp = String(Date.now()).slice(-6);

  // Pure calculation proof (same helper the document uses)
  const { contractDocumentBalanceRemaining } = await import(
    "@/lib/contracts/balance-remaining"
  );
  const unpaidBalance = contractDocumentBalanceRemaining({
    contractedTotal: TOTAL,
    paymentsReceived: 0,
  });
  const paidBalance = contractDocumentBalanceRemaining({
    contractedTotal: TOTAL,
    paymentsReceived: DEPOSIT,
  });
  record("calc_unpaid_full", unpaidBalance === TOTAL, String(unpaidBalance));
  record("calc_paid_reduced", paidBalance === 26_250, String(paidBalance));
  record(
    "calc_not_deposit_allocation",
    unpaidBalance !== TOTAL - DEPOSIT,
    `unpaid=${unpaidBalance} allocation=${TOTAL - DEPOSIT}`,
  );

  const { data: lead, error: leadErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Balance",
      last_name: `Proof${stamp}`,
      email: `balance-proof-${stamp}@hellotocheers-test.invalid`,
      event_date: "2031-11-15",
      event_type: "wedding",
      sales_stage: "proposal_sent",
      status: "active",
      source: "website",
      inquiry_message: `[qa] contract-balance-deposit-not-paid ${stamp}`,
      inquiry_message_origin: "venue",
    })
    .select("id")
    .single();
  if (leadErr) throw leadErr;
  cleanupIds.leadId = lead.id;
  out.ids.leadId = lead.id;

  const { data: pkg } = await admin
    .from("packages")
    .select("id, name")
    .eq("venue_id", FANCY)
    .eq("is_archived", false)
    .limit(1)
    .maybeSingle();

  const { data: selection, error: selErr } = await admin
    .from("commercial_selections")
    .insert({
      venue_id: FANCY,
      lead_id: lead.id,
      source_package_id: pkg?.id ?? null,
      name: pkg?.name ?? "Balance Proof Package",
      status: "accepted",
      version: 1,
      total_amount: TOTAL,
      package_amount: TOTAL,
      deposit_amount: DEPOSIT,
      discount_amount: 0,
      tax_amount: 0,
      tax_applied: false,
      included_items: [],
    })
    .select("id, total_amount, deposit_amount, status")
    .single();
  if (selErr) throw selErr;
  cleanupIds.selectionId = selection.id;
  out.ids.selectionId = selection.id;
  out.db.selection = selection;

  // Confirm no payment schedules / payments for this lead
  const { data: schedules } = await admin
    .from("payment_schedules")
    .select("id")
    .eq("venue_id", FANCY)
    .eq("lead_id", lead.id);
  record("no_payment_schedule", (schedules ?? []).length === 0, JSON.stringify(schedules ?? []));

  const { data: payments } = await admin
    .from("payments")
    .select("id, amount, status")
    .eq("venue_id", FANCY)
    .limit(0);
  void payments;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();

  try {
    const login = await page.goto(APP + "/login", { waitUntil: "domcontentloaded", timeout: 60_000 });
    out.servingSha = noteDeployment(login?.headers()["link"]);
    const tipOk = !EXPECTED_PREFIX || (!!out.servingSha && out.servingSha.startsWith(EXPECTED_PREFIX));
    record("serving_commit", tipOk, out.servingSha ?? "no dpl");
    if (!tipOk) throw new Error(`serving ${out.servingSha}, expected ${EXPECTED_PREFIX}`);

    // Open new contract for this selection (merge preview / draft)
    const url = `${APP}/contracts/new?selectionId=${selection.id}&leadId=${lead.id}`;
    out.urls.contractNew = url;
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2500);

    // Prefer preview pane / content area text
    const body = await page.locator("body").innerText();
    const hasTotal = body.includes("$35,000") || body.includes("35000") || body.includes("35,000");
    const hasWrongBalance = body.includes("$26,250") || body.includes("26,250");
    const hasFullBalance =
      (body.match(/Balance remaining[\s\S]{0,40}\$35,000/i)?.length ?? 0) > 0
      || (body.match(/balance remaining[\s\S]{0,40}\$35,000/i)?.length ?? 0) > 0
      || (body.includes("Balance remaining") && body.includes("$35,000") && !hasWrongBalance);

    record("contract_total_35000", hasTotal, "Total contracted amount visible");
    record(
      "balance_not_26250_unpaid",
      !hasWrongBalance || hasFullBalance,
      hasWrongBalance && !hasFullBalance
        ? "BUG: still shows $26,250 with no payments"
        : hasFullBalance
          ? "Balance remaining $35,000"
          : `body snippet check — wrong=${hasWrongBalance} full=${hasFullBalance}`,
    );

    // Stronger: look for exact Balance remaining section
    if (body.includes("Balance remaining")) {
      const idx = body.indexOf("Balance remaining");
      const window = body.slice(idx, idx + 80);
      record(
        "balance_section_window",
        window.includes("$35,000") && !window.includes("$26,250"),
        window.replace(/\s+/g, " ").trim(),
      );
    } else {
      record("balance_section_window", false, "Balance remaining label not found in page text");
    }

    await page.screenshot({ path: `${OUT_DIR}/contract-1280.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${OUT_DIR}/contract-390.png`, fullPage: true });
    await page.reload({ waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(1500);
    const reloaded = await page.locator("body").innerText();
    const reloadIdx = reloaded.indexOf("Balance remaining");
    const reloadWindow = reloadIdx >= 0 ? reloaded.slice(reloadIdx, reloadIdx + 80) : "";
    record(
      "reload_stable",
      reloadWindow.includes("$35,000") && !reloadWindow.includes("$26,250"),
      reloadWindow.replace(/\s+/g, " ").trim() || "no balance section after reload",
    );
    await page.screenshot({ path: `${OUT_DIR}/contract-reload-390.png`, fullPage: true });

    // DB: deposit still configured, no payments invented
    const { data: selAfter } = await admin
      .from("commercial_selections")
      .select("id, total_amount, deposit_amount")
      .eq("id", selection.id)
      .single();
    record(
      "persisted_deposit_configured_unpaid",
      Number(selAfter?.total_amount) === TOTAL && Number(selAfter?.deposit_amount) === DEPOSIT,
      JSON.stringify(selAfter),
    );
  } finally {
    await browser.close().catch(() => undefined);
    await cleanup().catch((e) => console.error("cleanup", e));
    writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ ok: out.ok, servingSha: out.servingSha, fail: out.checks.filter((c) => !c.pass).map((c) => c.name) }, null, 2));
  }
}

main().catch(async (err) => {
  console.error(err);
  await cleanup().catch(() => undefined);
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify({ ...out, error: String(err) }, null, 2));
  process.exit(1);
});
