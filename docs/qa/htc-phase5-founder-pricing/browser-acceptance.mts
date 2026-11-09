/**
 * Phase 5 Founder CRM + Stripe Test acceptance (disposable venue).
 *
 * Requires deploy SHA 2077eb78 (or later with Phase 5), migration applied,
 * PRICING_FOUNDER_V1=true, and a disposable Sandbox venue with active sub.
 *
 *   VENUE_ID=... npx tsx docs/qa/htc-phase5-founder-pricing/browser-acceptance.mts
 */
import { chromium, type Page } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { config } from "dotenv";

config({ path: "/Users/jensmac/Developer/wevenu-website/.env.local", quiet: true });

const OUT =
  "/Users/jensmac/Developer/wevenu-website/docs/qa/htc-phase5-founder-pricing/browser";
mkdirSync(OUT, { recursive: true });
const APP = "https://app.sandbox.hellotocheers.com";
const WS = "https://workspace.sandbox.hellotocheers.com";
const EXPECTED_SHA_PREFIX = "2077eb78";
const EMAIL = "jennifer@hellotocheers.com";
const WS_PASSWORD = process.env.WORKSPACE_DEMO_PASSWORD || "cheers-demo";

const venueId = process.env.VENUE_ID?.trim();
if (!venueId) {
  console.error("VENUE_ID required (disposable Sandbox venue with Stripe Test sub)");
  process.exit(1);
}

const report: Record<string, unknown> = {
  expectedShaPrefix: EXPECTED_SHA_PREFIX,
  venueId,
  steps: [] as unknown[],
  ok: false,
};

function step(name: string, detail: Record<string, unknown> = {}) {
  (report.steps as unknown[]).push({ name, at: new Date().toISOString(), ...detail });
  console.log(`STEP ${name}`, detail);
}

function save(name: string, data: unknown) {
  writeFileSync(`${OUT}/${name}`, JSON.stringify(data, null, 2));
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
}

function productSyncApiKey(): string | null {
  if (process.env.PRODUCT_SYNC_API_KEY?.trim()) {
    return process.env.PRODUCT_SYNC_API_KEY.trim();
  }
  try {
    const raw = execFileSync(
      "aws",
      [
        "ssm",
        "get-parameter",
        "--name",
        "/htc/sandbox/PRODUCT_SYNC_API_KEY",
        "--with-decryption",
        "--query",
        "Parameter.Value",
        "--output",
        "text",
      ],
      { encoding: "utf8" },
    ).trim();
    return raw || null;
  } catch {
    return null;
  }
}

async function main() {
  const key = productSyncApiKey();
  if (!key) throw new Error("PRODUCT_SYNC_API_KEY unavailable");

  // Serving SHA check
  const health = await fetch(`${APP}/api/health`).catch(() => null);
  const healthJson = health?.ok ? await health.json().catch(() => ({})) : {};
  step("health", { healthJson });

  const before = await fetch(
    `${APP}/api/internal/pricing/founder-arrangements?venueId=${encodeURIComponent(venueId!)}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  const beforeJson = await before.json();
  save("01-before.json", beforeJson);
  step("before", {
    status: before.status,
    applied: beforeJson.appliedOffer,
    readiness: beforeJson.readiness,
  });
  if (!before.ok) throw new Error(`before failed: ${before.status}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // Founder CRM login (workspace password demo)
  await page.goto(`${WS}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"], input[name="email"]', EMAIL).catch(() => {});
  await page.fill('input[type="password"], input[name="password"]', WS_PASSWORD).catch(() => {});
  await page.click('button[type="submit"]').catch(() => {});
  await page.waitForTimeout(2500);
  await shot(page, "02-crm-after-login");

  await page.goto(`${WS}/custom-pricing`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "03-custom-pricing");
  step("crm_custom_pricing", { url: page.url() });

  // API create 15% arrangement
  const idem = `p5-browser-${venueId}-${Date.now()}`;
  const createRes = await fetch(`${APP}/api/internal/pricing/founder-arrangements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create",
      venueId,
      kind: "percent_off",
      percentOff: 15,
      effectiveAt: new Date().toISOString(),
      reason: "Phase 5 browser acceptance",
      customerFacingLabel: "Special pricing",
      createdByEmail: EMAIL,
      idempotencyKey: idem,
    }),
  });
  const createJson = await createRes.json();
  save("04-create.json", createJson);
  step("create", {
    status: createRes.status,
    stripeApplied: createJson.stripeApplied,
    amount: createJson.preview?.proposedAmountCents,
    arrangementId: createJson.arrangement?.id,
  });
  if (!createRes.ok) throw new Error(`create failed: ${JSON.stringify(createJson)}`);

  const after = await fetch(
    `${APP}/api/internal/pricing/founder-arrangements?venueId=${encodeURIComponent(venueId!)}`,
    { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" },
  );
  const afterJson = await after.json();
  save("05-after.json", afterJson);
  step("after", {
    applied: afterJson.appliedOffer,
    nextInvoice: afterJson.nextInvoicePreview,
  });

  // Venue Billing card
  await page.goto(`${APP}/settings/billing`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2000);
  await shot(page, "06-venue-billing");
  step("venue_billing", { url: page.url() });

  // End arrangement (restore best remaining offer)
  if (createJson.arrangement?.id) {
    const endRes = await fetch(`${APP}/api/internal/pricing/founder-arrangements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "end",
        venueId,
        arrangementId: createJson.arrangement.id,
        endReason: "Phase 5 browser acceptance cleanup",
        actorEmail: EMAIL,
      }),
    });
    const endJson = await endRes.json();
    save("07-end.json", endJson);
    step("end", { status: endRes.status, ok: endJson.ok });
  }

  // Fixed-rate smoke (preview only if create would need large confirm)
  const fixedPreview = await fetch(`${APP}/api/internal/pricing/founder-arrangements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "preview",
      venueId,
      kind: "fixed_rate",
      fixedRateCents: 14900,
      effectiveAt: new Date().toISOString(),
      reason: "Phase 5 fixed-rate preview",
    }),
  });
  const fixedJson = await fixedPreview.json();
  save("08-fixed-preview.json", fixedJson);
  step("fixed_preview", {
    status: fixedPreview.status,
    proposed: fixedJson.preview?.proposedAmountCents,
  });

  const tierFreeze = await fetch(`${APP}/api/internal/pricing/founder-arrangements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "create",
      venueId,
      kind: "tier_freeze",
      preventsTierUpgrade: true,
      effectiveAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      reason: "Phase 5 tier freeze acceptance",
      createdByEmail: EMAIL,
      idempotencyKey: `p5-tierfreeze-${venueId}-${Date.now()}`,
    }),
  });
  const tierJson = await tierFreeze.json();
  save("09-tier-freeze.json", tierJson);
  step("tier_freeze", {
    status: tierFreeze.status,
    hold: tierJson.arrangement?.relatedTierHoldId,
  });
  if (tierJson.arrangement?.id) {
    await fetch(`${APP}/api/internal/pricing/founder-arrangements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "end",
        venueId,
        arrangementId: tierJson.arrangement.id,
        endReason: "Phase 5 tier freeze cleanup",
        actorEmail: EMAIL,
      }),
    });
  }

  report.ok =
    createRes.ok &&
    Boolean(createJson.stripeApplied || createJson.deferredToSchedule) &&
    afterJson.appliedOffer?.source === "founder_override";

  await browser.close();
  save("REPORT.json", report);
  writeFileSync(
    `${OUT}/../FINAL-BROWSER-ACCEPTANCE.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  report.ok = false;
  report.error = String(err);
  save("REPORT.json", report);
  process.exit(1);
});
