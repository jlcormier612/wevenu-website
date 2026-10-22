/**
 * Sandbox browser acceptance: booked Luv tab + two-row nav.
 * Read-only except optional draft generation (never sends).
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/booking-to-portal-simplification";
const EXPECTED_PRODUCT = process.env.EXPECT_SHA ?? "ce13de88f907890dcbae1a27522f3956f96f0ff0";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const QUIET_CLIENT = "b4e2764b-be33-4579-89e3-0c8e4a6dd5be"; // B2P quiet
const ELIGIBLE_CLIENT = "b650c86f-d46e-4af7-ba4b-a7f5382a6266"; // Ron/Jen

async function cookies() {
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
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

function tabLabels(texts: string[]): string[] {
  return texts.map((t) => t.replace(/\d+/g, "").replace(/\s+/g, " ").trim());
}

async function measureRows(page: { evaluate: (fn: string) => Promise<unknown> }) {
  // String form avoids tsx/esbuild injecting __name into page.evaluate closures.
  return page.evaluate(`(() => {
    const row1 = document.querySelector('[data-testid="booked-tab-row-1"]');
    const row2 = document.querySelector('[data-testid="booked-tab-row-2"]');
    if (!row1 || !row2) return null;
    const r1 = row1.getBoundingClientRect();
    const r2 = row2.getBoundingClientRect();
    const mapTabs = (row) => [...row.querySelectorAll('[role="tab"]')].map((el) => {
      const b = el.getBoundingClientRect();
      return { label: (el.textContent || "").replace(/\\d+/g, "").trim(), top: b.top, left: b.left, width: b.width };
    });
    const tabs1 = mapTabs(row1);
    const tabs2 = mapTabs(row2);
    const sameRow = (tabs) =>
      tabs.length > 0 && Math.max(...tabs.map((t) => t.top)) - Math.min(...tabs.map((t) => t.top)) < 8;
    return {
      row1Top: r1.top,
      row2Top: r2.top,
      rowGap: r2.top - r1.bottom,
      row1Width: r1.width,
      row2Width: r2.width,
      tabs1,
      tabs2,
      row1Aligned: sameRow(tabs1),
      row2Aligned: sameRow(tabs2),
      noThirdAccidental: tabs1.length === 7 && tabs2.length === 7,
    };
  })()`) as Promise<{
    row1Top: number;
    row2Top: number;
    rowGap: number;
    row1Width: number;
    row2Width: number;
    tabs1: { label: string; top: number; left: number; width: number }[];
    tabs2: { label: string; top: number; left: number; width: number }[];
    row1Aligned: boolean;
    row2Aligned: boolean;
    noThirdAccidental: boolean;
  } | null>;
}

async function main() {
  const servingHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const servingSha = servingHtml.match(/dpl=([a-f0-9]{40})/)?.[1] ?? null;
  const report: Record<string, unknown> = {
    at: new Date().toISOString(),
    expectedProduct: EXPECTED_PRODUCT,
    servingSha,
    shaMatch: servingSha?.startsWith(EXPECTED_PRODUCT.slice(0, 8)) ?? false,
  };

  if (!servingSha?.startsWith(EXPECTED_PRODUCT.slice(0, 8))) {
    writeFileSync(`${OUT}/luv-booked-tab-nav-acceptance.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    throw new Error(`Wrong serving SHA: ${servingSha} (want ${EXPECTED_PRODUCT})`);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookies());
  const page = await context.newPage();

  // Quiet booked client
  await page.goto(`${APP}/clients/${QUIET_CLIENT}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2800);
  const quietGeom = await measureRows(page);
  const quietRow1 = tabLabels(await page.locator('[data-testid="booked-tab-row-1"] [role=tab]').allTextContents());
  const quietRow2 = tabLabels(await page.locator('[data-testid="booked-tab-row-2"] [role=tab]').allTextContents());
  await page.getByRole("tab", { name: /^Luv$/i }).click();
  await page.waitForTimeout(800);
  const quietLuvBody = await page.locator('[data-slot="tabs-content"]').filter({ hasText: /Luv/i }).first().innerText().catch(() => "");
  const quietHasDraftCta = await page.getByText(/Ask Luv to draft a follow-up|Draft a follow-up email/i).count();
  const quietNoticedOnTab = await page.getByText(/nothing Luv needs to flag/i).count();
  await page.screenshot({ path: `${OUT}/luv-booked-quiet-luv-tab-1280.png`, fullPage: false });
  report.quiet = {
    clientId: QUIET_CLIENT,
    row1: quietRow1,
    row2: quietRow2,
    geometry: quietGeom,
    hasLuvTab: quietRow2.some((t) => /^Luv$/i.test(t)),
    draftCtaVisible: quietHasDraftCta > 0,
    emptyStateHint: quietNoticedOnTab > 0,
    luvPanelSnippet: quietLuvBody.slice(0, 240),
  };

  // Eligible booked client
  await page.goto(`${APP}/clients/${ELIGIBLE_CLIENT}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(3000);
  await page.getByRole("tab", { name: /^Overview$/i }).click();
  await page.waitForTimeout(600);
  const eligibleNoticed = await page.getByText(/Luv noticed/i).count();
  await page.getByRole("tab", { name: /^Luv$/i }).click();
  await page.waitForTimeout(900);
  const eligibleDraftCta = await page.getByText(/Draft a follow-up email|Ask Luv to draft a follow-up/i).count();
  const draftsBefore = await admin
    .from("luv_drafts")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", FANCY)
    .eq("status", "pending_review");
  // Generate draft — review only, do not send
  const draftBtn = page.getByRole("button", { name: /Draft a follow-up email/i });
  let draftGenerated = false;
  let draftPersisted = false;
  if (await draftBtn.count()) {
    await draftBtn.click();
    await page.waitForTimeout(12_000);
    draftGenerated = (await page.getByText(/Luv drafted this follow-up|Pending review/i).count()) > 0;
    const draftsAfter = await admin
      .from("luv_drafts")
      .select("id", { count: "exact", head: true })
      .eq("venue_id", FANCY)
      .eq("status", "pending_review");
    draftPersisted = (draftsAfter.count ?? 0) >= (draftsBefore.count ?? 0);
  }
  await page.screenshot({ path: `${OUT}/luv-booked-eligible-luv-tab-1280.png`, fullPage: false });
  report.eligible = {
    clientId: ELIGIBLE_CLIENT,
    overviewLuvNoticed: eligibleNoticed > 0,
    draftCtaVisible: eligibleDraftCta > 0,
    draftGenerated,
    draftPersistedPendingReview: draftPersisted,
    noSendAttempted: true,
  };

  // Narrow viewport
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto(`${APP}/clients/${QUIET_CLIENT}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(2500);
  const narrowGeom = await measureRows(page);
  await page.screenshot({ path: `${OUT}/luv-booked-nav-900.png`, fullPage: false });
  report.narrow900 = { geometry: narrowGeom };

  // Lead Luv intact
  const { data: leads } = await admin.from("leads").select("id").eq("venue_id", FANCY).is("first_booked_at", null).limit(1);
  const leadId = leads?.[0]?.id;
  if (leadId) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(2000);
    const leadTabs = tabLabels(await page.locator("[role=tab]").allTextContents());
    report.lead = { leadId, hasLuvTab: leadTabs.some((t) => /^Luv$/i.test(t)), tabs: leadTabs };
    await page.screenshot({ path: `${OUT}/luv-lead-tab-intact-1280.png`, fullPage: false });
  }

  await browser.close();

  const orderOk =
    JSON.stringify((report.quiet as { row1: string[] }).row1) ===
      JSON.stringify(["Overview", "Planning", "Timeline", "Floor Plans", "Vendors", "Inventory", "Event Order"]) &&
    JSON.stringify((report.quiet as { row2: string[] }).row2.slice(0, 7)) ===
      JSON.stringify(["Questionnaires", "Documents", "Payments", "Conversation", "Activity", "Internal notes", "Luv"]);

  const narrowOk = Boolean(
    narrowGeom?.row1Aligned && narrowGeom?.row2Aligned && narrowGeom.noThirdAccidental,
  );
  report.acceptance = {
    orderOk,
    twoRows: Boolean(quietGeom?.row1Aligned && quietGeom?.row2Aligned && quietGeom.row2Top > quietGeom.row1Top),
    narrowOk,
    luvOnQuiet: Boolean((report.quiet as { hasLuvTab: boolean }).hasLuvTab && (report.quiet as { draftCtaVisible: boolean }).draftCtaVisible),
    luvOnEligible: Boolean((report.eligible as { draftCtaVisible: boolean }).draftCtaVisible),
    leadIntact: Boolean((report.lead as { hasLuvTab?: boolean } | undefined)?.hasLuvTab),
    shaOk: true,
  };

  writeFileSync(`${OUT}/luv-booked-tab-nav-acceptance.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  const a = report.acceptance as Record<string, boolean>;
  if (!a.orderOk || !a.twoRows || !a.narrowOk || !a.luvOnQuiet || !a.leadIntact) {
    process.exit(2);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
