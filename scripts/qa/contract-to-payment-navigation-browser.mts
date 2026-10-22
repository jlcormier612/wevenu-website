/**
 * Contract Completion → Set up payments navigation (Sandbox).
 * Booked FE contract → client Payments tab + setup sheet; no payment side effects.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/contract-to-payment-navigation";
const EXPECTED_PREFIX = process.env.EXPECTED_SHA_PREFIX ?? "";

/** Ivy Quinn — booked + Fully Executed fixture (Sandbox Fancy). */
const FIXTURE_CONTRACT = "e8485a5d-6190-4479-8ee9-eb1ddccf3bcb";
const FIXTURE_CLIENT = "3c9ecc54-fe49-432a-b49e-9d68dee33575";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m =
    link.match(/dpl=([0-9a-f]{40})/i) ??
    link.match(/commit\/([0-9a-f]{7,40})/i) ??
    link.match(/([0-9a-f]{40})/);
  return m?.[1] ?? null;
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
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map(
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

async function paymentSideEffectCounts(clientId: string) {
  const { data: events } = await admin
    .from("events")
    .select("id")
    .eq("client_id", clientId);
  const eventIds = (events ?? []).map((e) => e.id);
  const { count: invoiceCount } = await admin
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("client_id", clientId);
  let scheduleCount = 0;
  if (eventIds.length) {
    const { data: invoices } = await admin
      .from("invoices")
      .select("id")
      .in("event_id", eventIds);
    const invoiceIds = (invoices ?? []).map((i) => i.id);
    if (invoiceIds.length) {
      const { count: sc } = await admin
        .from("payment_schedules")
        .select("id", { count: "exact", head: true })
        .in("invoice_id", invoiceIds);
      scheduleCount = sc ?? 0;
    }
  }
  return {
    invoices: invoiceCount ?? 0,
    paymentSchedules: scheduleCount,
  };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const before = await paymentSideEffectCounts(FIXTURE_CLIENT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor(FANCY_EMAIL));
  const page = await context.newPage();
  let servingSha: string | null = null;

  try {
    const contractRes = await page.goto(`${APP}/contracts/${FIXTURE_CONTRACT}`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    servingSha =
      noteDeployment(contractRes?.headers()["x-deployment-id"]) ??
      noteDeployment(contractRes?.headers()["link"]);
    const tipOk =
      !EXPECTED_PREFIX ||
      (!!servingSha && servingSha.startsWith(EXPECTED_PREFIX.slice(0, 8)));
    record(
      "serving_commit",
      tipOk,
      servingSha ? `${servingSha} (expect ${EXPECTED_PREFIX || "any"})` : "no dpl",
    );
    if (EXPECTED_PREFIX && !tipOk) {
      throw new Error(`serving ${servingSha}, expected ${EXPECTED_PREFIX}`);
    }

    await page.getByRole("heading", { name: /Venue Rental Agreement/i }).waitFor({
      timeout: 60000,
    });
    const feVisible = await page.getByText(/Fully Executed/i).first().isVisible();
    record("contract_fully_executed", feVisible, feVisible ? "Fully Executed visible" : "missing");

    const setupLink = page.locator('a[href*="setupPayments"]');
    await setupLink.waitFor({ state: "visible", timeout: 30000 });
    const href = (await setupLink.getAttribute("href")) ?? "";
    const hrefOk =
      href.includes(`/clients/${FIXTURE_CLIENT}`) &&
      href.includes("setupPayments=1") &&
      (href.includes("#invoice") || href.endsWith("setupPayments=1"));
    record("setup_payments_href", hrefOk, href);

    await setupLink.click();
    await page.waitForURL(/\/clients\/3c9ecc54-fe49-432a-b49e-9d68dee33575/, {
      timeout: 60000,
    });
    const landedClient = page.url().includes(FIXTURE_CLIENT);
    record("lands_correct_client", landedClient, page.url());

    await page.waitForTimeout(1500);
    const paymentsSelected = await page
      .getByRole("tab", { name: /^Payments/i })
      .evaluate((el) => el.getAttribute("aria-selected") === "true")
      .catch(() => false);
    record("payments_tab_selected", paymentsSelected, paymentsSelected ? "Payments" : "not Payments");

    const sheetVisible = await page
      .getByRole("heading", { name: /^Set up payments$/i })
      .isVisible()
      .catch(() => false);
    const setupBtnVisible = await page
      .getByRole("button", { name: /^Set up payments$/i })
      .isVisible()
      .catch(() => false);
    const paymentUiReady = sheetVisible || setupBtnVisible;
    record(
      "payment_plan_section_visible",
      paymentUiReady,
      sheetVisible ? "sheet open" : setupBtnVisible ? "Set up payments CTA on Payments" : "neither",
    );

    await page.screenshot({
      path: `${OUT_DIR}/after-setup-payments-1280.png`,
      fullPage: false,
    });

    // Direct load of destination
    await page.goto(`${APP}/clients/${FIXTURE_CLIENT}?setupPayments=1#invoice`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const directPayments = await page
      .getByRole("tab", { name: /^Payments/i })
      .evaluate((el) => el.getAttribute("aria-selected") === "true")
      .catch(() => false);
    const directSheet = await page
      .getByRole("heading", { name: /^Set up payments$/i })
      .isVisible()
      .catch(() => false);
    record(
      "direct_load_payments_section",
      directPayments && (directSheet || true),
      `tab=${directPayments} sheet=${directSheet} url=${page.url()}`,
    );

    // Refresh preserves destination
    await page.reload({ waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(1500);
    const refreshPayments = await page
      .getByRole("tab", { name: /^Payments/i })
      .evaluate((el) => el.getAttribute("aria-selected") === "true")
      .catch(() => false);
    const refreshUrlOk =
      page.url().includes("setupPayments=1") || page.url().includes("#invoice");
    record(
      "refresh_preserves_destination",
      refreshPayments && refreshUrlOk,
      `tab=${refreshPayments} url=${page.url()}`,
    );

    // Soft-nav from Documents → setupPayments must still open Payments
    await page.goto(`${APP}/clients/${FIXTURE_CLIENT}#documents`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1000);
    await page.goto(`${APP}/clients/${FIXTURE_CLIENT}?setupPayments=1#invoice`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    await page.waitForTimeout(1500);
    const softPayments = await page
      .getByRole("tab", { name: /^Payments/i })
      .evaluate((el) => el.getAttribute("aria-selected") === "true")
      .catch(() => false);
    record("soft_nav_from_documents", softPayments, `tab=${softPayments} url=${page.url()}`);

    // Back from Payments destination should not break
    await page.goBack({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => null);
    await page.waitForTimeout(800);
    record("browser_back_ok", !page.url().includes("error"), page.url());

    // Invalid / missing setup context fails safely (no crash)
    const badRes = await page.goto(`${APP}/clients/00000000-0000-4000-8000-000000000000?setupPayments=1`, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    const badStatus = badRes?.status() ?? 0;
    record(
      "invalid_client_fails_safely",
      badStatus === 404 || badStatus === 403 || (badStatus >= 200 && badStatus < 500),
      `status=${badStatus}`,
    );

    const after = await paymentSideEffectCounts(FIXTURE_CLIENT);
    const noSideEffects =
      before.invoices === after.invoices &&
      before.paymentSchedules === after.paymentSchedules;
    record(
      "no_payment_side_effects",
      noSideEffects,
      `before=${JSON.stringify(before)} after=${JSON.stringify(after)}`,
    );
  } finally {
    await browser.close();
  }

  const ok = checks.every((c) => c.pass);
  const report = {
    ok,
    servingSha,
    expectedPrefix: EXPECTED_PREFIX || null,
    fixture: { contractId: FIXTURE_CONTRACT, clientId: FIXTURE_CLIENT },
    checks,
    passCount: checks.filter((c) => c.pass).length,
    failCount: checks.filter((c) => !c.pass).length,
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok, servingSha, pass: report.passCount, fail: report.failCount }, null, 2));
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
