/**
 * Sandbox: Invoice & Payment Plan print contrast — Amount Due Now must clear WCAG AA
 * on Neutral (hero) and white (totals), including Meadowbrook pale Accent themes.
 *
 * Read-only: opens venue invoice summary + print document. Does not mutate invoice rows
 * or send client email.
 *
 * EXPECTED_SHA=<40-char> npx tsx scripts/qa/invoice-payment-plan-contrast.mts
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
const EXPECTED_SHA = process.env.EXPECTED_SHA ?? "";
const VENUE = "05f16a15-1752-4855-8a3b-aad5c593d8d9"; // Meadowbrook — pale brand that failed screenshots
/** Meadowbrook invoice with remaining balance (pale Accent/Neutral theme). Read-only. */
const INVOICE = process.env.INVOICE_ID ?? "3b9f4bb6-b44c-484a-b6dd-b2ee47c5d541";
const STAFF_EMAIL = "jlcormier612@gmail.com";
const OUT = "docs/qa/invoice-payment-plan-contrast";
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1200) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 320)}`);
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function lum(r: number, g: number, b: number) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function ratio(fg: { r: number; g: number; b: number }, bg: { r: number; g: number; b: number }) {
  const L1 = lum(fg.r, fg.g, fg.b);
  const L2 = lum(bg.r, bg.g, bg.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
function parseRgb(css: string): { r: number; g: number; b: number } | null {
  const m = css.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
  if (!m) return null;
  return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) };
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: STAFF_EMAIL });
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
      name: "htc_active_venue_id", value: VENUE,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function measureContrast(page: import("playwright").Page, selector: string, largeText: boolean) {
  return page.evaluate(({ selector, largeText }) => {
    const el = document.querySelector(selector) as HTMLElement | null;
    if (!el) return { ok: false, reason: "missing", selector };
    const cs = getComputedStyle(el);
    const color = cs.color;
    let bgEl: HTMLElement | null = el;
    let background = "rgba(0,0,0,0)";
    while (bgEl) {
      const b = getComputedStyle(bgEl).backgroundColor;
      if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") {
        background = b;
        break;
      }
      bgEl = bgEl.parentElement;
    }
    return {
      ok: true,
      selector,
      color,
      background,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      largeText,
      text: (el.textContent ?? "").trim().slice(0, 80),
    };
  }, { selector, largeText });
}

async function main() {
  if (!/^[a-f0-9]{40}$/.test(EXPECTED_SHA)) throw new Error("EXPECTED_SHA required");

  const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const servingSha = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1]
    ?? (loginHtml.match(/data-dpl-id="([a-f0-9]{40})"/) ?? [])[1]
    ?? null;
  record("serving_sha", servingSha === EXPECTED_SHA, `serving=${servingSha} expected=${EXPECTED_SHA}`);
  if (servingSha !== EXPECTED_SHA) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, servingSha, checks }, null, 2));
    console.log("\nNOT GREEN — wrong SHA");
    process.exit(1);
  }

  const { data: inv } = await admin.from("invoices")
    .select("id, invoice_number, venue_id, total, balance_due, status, branding_snapshot")
    .eq("id", INVOICE).eq("venue_id", VENUE).maybeSingle();
  record("fixture_invoice", !!inv, JSON.stringify({ id: inv?.id, num: inv?.invoice_number, status: inv?.status }));
  if (!inv) throw new Error("invoice missing");

  const { data: venue } = await admin.from("venues")
    .select("primary_color, secondary_color, accent_color, neutral_color")
    .eq("id", VENUE).maybeSingle();
  record(
    "venue_brand_loaded",
    !!venue?.accent_color && !!venue?.neutral_color,
    JSON.stringify(venue),
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());

  // Venue invoice summary (design-token surface — confirm financial values still render)
  const summary = await context.newPage();
  await summary.goto(`${APP}/invoices/${INVOICE}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await summary.waitForTimeout(2500);
  const summaryBody = await summary.locator("body").innerText();
  record(
    "summary_shows_financial_labels",
    /Total Contracted/i.test(summaryBody) && /Amount Due Now|Outstanding|Next payment|Paid in Full/i.test(summaryBody),
    summaryBody.match(/Total Contracted[\s\S]{0,200}/)?.[0] ?? summaryBody.slice(0, 200),
  );
  await summary.screenshot({ path: `${OUT}/summary-1280.png`, fullPage: true }).catch(() => undefined);
  await summary.setViewportSize({ width: 390, height: 844 });
  await summary.waitForTimeout(400);
  await summary.screenshot({ path: `${OUT}/summary-390.png`, fullPage: true }).catch(() => undefined);

  // Client-facing print document
  const print = await context.newPage();
  await print.goto(`${APP}/invoices/${INVOICE}/print`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await print.waitForTimeout(2500);
  await print.screenshot({ path: `${OUT}/print-1280.png`, fullPage: true }).catch(() => undefined);

  const hero = await measureContrast(print, "[data-testid=invoice-print-financial-hero-amount]", true);
  const totals = await measureContrast(print, "[data-testid=invoice-print-totals-amount-due-now]", false);

  function assertContrast(name: string, sample: Awaited<ReturnType<typeof measureContrast>>, min: number) {
    if (!sample.ok) {
      record(name, false, JSON.stringify(sample));
      return;
    }
    const fg = parseRgb(sample.color as string);
    const bg = parseRgb(sample.background as string);
    if (!fg || !bg) {
      record(name, false, `parse fail ${JSON.stringify(sample)}`);
      return;
    }
    const r = ratio(fg, bg);
    record(
      name,
      r >= min,
      JSON.stringify({ ratio: Number(r.toFixed(2)), min, fg: sample.color, bg: sample.background, text: sample.text }),
    );
  }

  assertContrast("print_hero_amount_contrast", hero, 4.5);
  // Totals row uses accent only when an installment is due; otherwise gray on white — still require ≥4.5.
  assertContrast("print_totals_row_contrast", totals, 4.5);

  const printBody = await print.locator("body").innerText();
  record(
    "print_shows_amount_or_balance",
    /Amount Due Now|Balance Remaining|Total Contracted/i.test(printBody),
    printBody.match(/Amount Due Now[\s\S]{0,120}|Balance Remaining[\s\S]{0,80}|Total Contracted[\s\S]{0,80}/)?.[0] ?? printBody.slice(0, 200),
  );

  // Cream Accent must not be the computed hero color on this venue's Neutral.
  if (hero.ok && venue?.accent_color && venue?.neutral_color) {
    const fg = parseRgb(hero.color as string);
    const cream = venue.accent_color.replace("#", "").toLowerCase();
    const approxCream = fg
      && Math.abs(fg.r - parseInt(cream.slice(0, 2), 16)) < 8
      && Math.abs(fg.g - parseInt(cream.slice(2, 4), 16)) < 8
      && Math.abs(fg.b - parseInt(cream.slice(4, 6), 16)) < 8;
    record("hero_not_raw_cream_accent", !approxCream, JSON.stringify({ fg: hero.color, accent: venue.accent_color }));
  } else {
    record("hero_not_raw_cream_accent", false, "hero missing — cannot prove Accent fallback");
  }

  await print.setViewportSize({ width: 390, height: 844 });
  await print.waitForTimeout(400);
  await print.screenshot({ path: `${OUT}/print-390.png`, fullPage: true }).catch(() => undefined);

  const heroMobile = await measureContrast(print, "[data-testid=invoice-print-financial-hero-amount]", true);
  assertContrast("print_hero_amount_contrast_390", heroMobile, 4.5);

  await browser.close();

  const passed = checks.filter((c) => c.pass).length;
  const failed = checks.filter((c) => !c.pass).length;
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    expectedSha: EXPECTED_SHA,
    invoiceId: INVOICE,
    venueId: VENUE,
    venueBrand: venue,
    passed,
    failed,
    checks,
  }, null, 2));
  writeFileSync(`${OUT}/browser-run.log`, checks.map((c) => `${c.pass ? "PASS" : "FAIL"} ${c.name} — ${c.detail}`).join("\n"));
  console.log(`\n${failed === 0 ? "GREEN" : "NOT GREEN"} passed=${passed} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
