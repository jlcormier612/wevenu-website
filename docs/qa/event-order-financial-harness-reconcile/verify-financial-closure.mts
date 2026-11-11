/**
 * Focused financial closure on serving Sandbox image.
 * Completes reopen → freeze if invoice still draft; asserts EO/invoice/plan/portal.
 * Does not silently rewrite a sent invoice — uses Update Draft Invoice / Mark as issued only.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "b2377f578c48be0c226d5323c8a635cdd10c59b1").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const EVENT = "ebf74f77-2944-474a-b735-48762ecb6842";
const INV = "4489c869-38fd-4ae1-8cad-cc7043d1d527";
const OUT = "docs/qa/event-order-financial-harness-reconcile";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
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

async function loadPayable() {
  const { data: eo } = await admin
    .from("event_orders")
    .select("id,revision,status")
    .eq("event_id", EVENT)
    .eq("venue_id", FANCY)
    .maybeSingle();
  const { data: lines } = await admin
    .from("event_order_lines")
    .select("id,description,amount,unit_price,is_included,provenance")
    .eq("event_order_id", eo!.id)
    .order("sort_order");
  const { data: inv } = await admin.from("invoices").select("*").eq("id", INV).maybeSingle();
  const { data: ilines } = await admin
    .from("invoice_line_items")
    .select("type,amount,event_order_line_id,description")
    .eq("invoice_id", INV);
  const expected = reconcileEventOrderInvoicePayable({
    eventOrderLines: (lines ?? []).map((l) => ({
      id: l.id,
      amount: Number(l.amount),
      unitPrice: l.unit_price == null ? null : Number(l.unit_price),
      isIncluded: Boolean(l.is_included),
    })),
    storedInvoiceLines: (ilines ?? [])
      .filter((l) => !l.event_order_line_id)
      .map((l) => ({ type: l.type as "tax" | "discount" | "fee" | "item", amount: Number(l.amount) })),
  });
  return { eo, lines: lines ?? [], inv, ilines: ilines ?? [], expected };
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);
  record("financial-fix-in-lineage", image.includes("b2377f57") || image.includes("e8f621bf"), image);
  record("production-untouched", url.includes("wvpsldwwjqdannqasrdf"), "sandbox only");

  let snap = await loadPayable();
  const dinners = snap.lines.filter((l) => /plated|buffet/i.test(l.description));
  const plated = dinners.filter((l) => /plated dinner/i.test(l.description) && !l.is_included);
  const buffet = dinners.filter((l) => /buffet dinner/i.test(l.description) && !l.is_included);
  record("eo-single-plated-dinner", plated.length === 1, JSON.stringify(plated));
  record("eo-no-billable-buffet", buffet.length === 0, JSON.stringify(buffet));
  record(
    "eo-payable-computed",
    snap.expected.payableTotal > 0,
    JSON.stringify(snap.expected),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context.on("dialog", async (d: { accept: () => Promise<void> }) => {
    await d.accept();
  });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/invoices/${INV}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForTimeout(2000);

  // If still sent with drift, reopen.
  snap = await loadPayable();
  if (snap.inv?.status === "sent") {
    const freezeRev = Number(snap.inv.event_order_revision_at_freeze ?? 0);
    const liveRev = Number(snap.eo?.revision ?? 0);
    if (liveRev > freezeRev || !moneyFiguresAgree(Number(snap.inv.total), snap.expected.payableTotal)) {
      const updateDraft = page.getByRole("button", { name: /Update Draft Invoice/i });
      if ((await updateDraft.count()) > 0) {
        await updateDraft.click();
        for (let i = 0; i < 20; i++) {
          const { data: probe } = await admin.from("invoices").select("status").eq("id", INV).maybeSingle();
          if (probe?.status === "draft") break;
          await page.waitForTimeout(1000);
        }
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.waitForTimeout(1500);
    }
  }

  snap = await loadPayable();
  if (snap.inv?.status === "draft") {
    await page.goto(`${APP}/invoices/${INV}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(1500);
    const body = await page.locator("body").innerText();
    const money = snap.expected.payableTotal.toLocaleString("en-US", { style: "currency", currency: "USD" });
    record(
      "draft-shows-projected-payable",
      body.includes(money) || body.includes(snap.expected.payableTotal.toFixed(2)),
      `${money} :: ${body.slice(0, 400)}`,
    );
    await page.screenshot({ path: `${OUT}/shots/closure-draft-before-issue-1280.png`, fullPage: false });

    const sendBtn = page.getByTestId("send-invoice-and-payment-plan");
    const alreadySentNote = page.getByTestId("payment-request-already-sent");
    const markIssued = page.getByRole("button", { name: /Mark as issued/i });
    const publishPath =
      (await alreadySentNote.count()) > 0 && (await markIssued.count()) > 0
        ? "mark-issued"
        : (await sendBtn.count()) > 0
          ? "send"
          : (await markIssued.count()) > 0
            ? "mark-issued"
            : "none";
    record("publish-path", publishPath !== "none", publishPath);

    if (publishPath === "send") {
      await sendBtn.click();
      await page.getByRole("heading", { name: /Preview and send/i }).waitFor({ timeout: 30_000 });
      const confirm = page.getByTestId("confirm-send-invoice-and-payment-plan");
      await confirm.waitFor({ timeout: 15_000 });
      await confirm.click();
      await page.waitForTimeout(3000);
    } else if (publishPath === "mark-issued") {
      await markIssued.first().click();
      await page.waitForTimeout(2000);
    }

    for (let i = 0; i < 25; i++) {
      const { data: probe } = await admin
        .from("invoices")
        .select("status,total,event_order_revision_at_freeze")
        .eq("id", INV)
        .maybeSingle();
      if (probe?.status === "sent") break;
      await page.waitForTimeout(1000);
      if (i === 8 || i === 16) {
        await page.reload({ waitUntil: "domcontentloaded" });
        const retrySend = page.getByTestId("send-invoice-and-payment-plan");
        const retryMark = page.getByRole("button", { name: /Mark as issued/i });
        if ((await retrySend.count()) > 0) {
          await retrySend.click();
          const confirm = page.getByTestId("confirm-send-invoice-and-payment-plan");
          if ((await confirm.count()) > 0) await confirm.click();
        } else if ((await retryMark.count()) > 0) {
          await retryMark.first().click();
        }
      }
    }
  }

  snap = await loadPayable();
  const frozenEo = snap.ilines.filter((l) => l.event_order_line_id);
  const billable = snap.lines.filter(
    (l) => !l.is_included && Number(l.unit_price) > 0 && Number(l.amount) > 0,
  );
  record("invoice-published-sent", snap.inv?.status === "sent", JSON.stringify({
    status: snap.inv?.status,
    total: snap.inv?.total,
    freezeRev: snap.inv?.event_order_revision_at_freeze,
    eoRev: snap.eo?.revision,
  }));
  record(
    "invoice-total-matches-eo-payable",
    moneyFiguresAgree(Number(snap.inv?.total ?? 0), snap.expected.payableTotal),
    `stored=${snap.inv?.total} expected=${snap.expected.payableTotal}`,
  );
  record(
    "invoice-frozen-eo-line-count",
    frozenEo.length === billable.length && billable.length > 0,
    `frozen=${frozenEo.length} billable=${billable.length}`,
  );
  record(
    "invoice-not-tax-only",
    Number(snap.inv?.total ?? 0) > Number(snap.inv?.tax_amount ?? 0) + 0.02,
    JSON.stringify({ total: snap.inv?.total, tax: snap.inv?.tax_amount }),
  );

  const { data: schedule } = await admin
    .from("payment_schedules")
    .select("id,total_amount")
    .eq("invoice_id", INV)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  record(
    "payment-plan-matches-payable",
    Boolean(schedule) && moneyFiguresAgree(Number(schedule?.total_amount ?? 0), snap.expected.payableTotal),
    `schedule=${schedule?.total_amount} expected=${snap.expected.payableTotal}`,
  );

  // Portal financial session
  const { data: financial } = await admin
    .from("client_portal_sessions")
    .select("access_token,access_level")
    .eq("client_id", "b4e2764b-be33-4579-89e3-0c8e4a6dd5be")
    .eq("venue_id", FANCY)
    .eq("access_level", "financial")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (financial?.access_token && snap.inv?.status === "sent") {
    const fin = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const finPage = await fin.newPage();
    await finPage.goto(`${APP}/p/${financial.access_token}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await finPage.waitForTimeout(2000);
    const text = await finPage.locator("body").innerText();
    const money = snap.expected.payableTotal.toLocaleString("en-US", { style: "currency", currency: "USD" });
    record(
      "portal-shows-payable",
      text.includes(money) || text.includes(snap.expected.payableTotal.toFixed(2)),
      `expected=${money} body=${text.slice(0, 500)}`,
    );
    await finPage.screenshot({ path: `${OUT}/shots/closure-portal-1280.png`, fullPage: false });
    const { data: portalPay } = await admin.rpc("get_portal_payments", { p_token: financial.access_token });
    const invoicesPortal = (portalPay as { invoices?: Array<{ total: number }> })?.invoices ?? [];
    const portalTotal = invoicesPortal[0]?.total ?? 0;
    record(
      "portal-rpc-matches-payable",
      moneyFiguresAgree(Number(portalTotal), snap.expected.payableTotal),
      `portal=${portalTotal} expected=${snap.expected.payableTotal}`,
    );
    await fin.close();
  } else {
    record("portal-shows-payable", false, `status=${snap.inv?.status} financial=${Boolean(financial)}`);
    record("portal-rpc-matches-payable", false, "skipped");
  }

  await page.screenshot({ path: `${OUT}/shots/closure-invoice-after-1280.png`, fullPage: false });
  await browser.close();

  const evidence = {
    capturedAt: new Date().toISOString(),
    image,
    digest,
    expectedSha: EXPECTED,
    note:
      "Correct EO payable after single-select conflict cleanup is live reconcile (≈$2194.31), not the prior drifted $2351.31 that included a duplicate Plated line.",
    eo: snap.eo,
    expectedPayable: snap.expected,
    invoice: {
      status: snap.inv?.status,
      total: snap.inv?.total,
      subtotal: snap.inv?.subtotal,
      tax: snap.inv?.tax_amount,
      freezeRev: snap.inv?.event_order_revision_at_freeze,
    },
    schedule,
    dinners: dinners.map((d) => ({
      description: d.description,
      amount: d.amount,
      is_included: d.is_included,
      provenance: d.provenance,
    })),
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
    pass: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT}/closure-results.json`, JSON.stringify(evidence, null, 2));
  writeFileSync(`${OUT}/persisted-after-closure.json`, JSON.stringify({
    eo: snap.eo,
    dinners,
    invoice: evidence.invoice,
    schedule,
    expectedPayable: snap.expected,
  }, null, 2));
  console.log(`\nRESULT ${evidence.pass ? "PASS" : "FAIL"} ${evidence.passCount}/${checks.length}`);
  process.exit(evidence.pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
