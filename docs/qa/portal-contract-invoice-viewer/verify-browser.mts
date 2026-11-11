/**
 * Live local: couple Docs Open for signed contract + invoice → viewer Print/Download.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

const ORIG = "/Users/jensmac/Developer/wevenu-website";
config({ path: `${ORIG}/.env.local`, quiet: true });
const require = createRequire(`${ORIG}/marketing/package.json`);
const { chromium } = require("playwright");

const OUT = `${ORIG}/docs/qa/portal-contract-invoice-viewer`;
mkdirSync(OUT, { recursive: true });
const APP = process.env.HTC_CAPTURE_BASE ?? "http://127.0.0.1:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const { data: session } = await admin
  .from("client_portal_sessions")
  .select("access_token")
  .eq("id", "1450b036-fbc7-4e86-9b19-7d2e80bfa4bb")
  .single();
const token = session!.access_token as string;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const results: Record<string, unknown>[] = [];

await page.goto(`${APP}/p/${token}?view=documents`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(3500);

const openButtons = page.getByTestId("portal-document-open");
const openCount = await openButtons.count();
results.push({ step: "docs-loaded", openCount, url: page.url() });
await page.screenshot({ path: join(OUT, "01-docs.png"), fullPage: false });

// First Open should be the signed contract (Contracts section above invoices).
await openButtons.first().click();
await page.waitForTimeout(2500);
const viewer = page.getByTestId("portal-document-viewer");
const printBtn = page.getByTestId("portal-document-viewer-print");
const downloadBtn = page.getByTestId("portal-document-viewer-download");
results.push({
  step: "contract-open",
  viewerVisible: await viewer.isVisible().catch(() => false),
  printVisible: await printBtn.isVisible().catch(() => false),
  downloadVisible: await downloadBtn.isVisible().catch(() => false),
  downloadLabel: (await downloadBtn.textContent().catch(() => ""))?.trim() ?? null,
  frameCount: await page.getByTestId("portal-document-viewer-frame").count(),
});
await page.screenshot({ path: join(OUT, "02-contract-viewer.png"), fullPage: false });

await page.keyboard.press("Escape");
await page.waitForTimeout(800);

// Open an invoice — last Open in Contracts+Invoices list may vary; click Open near Invoice heading.
const invoiceSection = page.locator("section").filter({ hasText: /^Invoices/ });
const invoiceOpen = invoiceSection.getByTestId("portal-document-open").first();
if (await invoiceOpen.count()) {
  await invoiceOpen.click();
  await page.waitForTimeout(3000);
  results.push({
    step: "invoice-open",
    viewerVisible: await viewer.isVisible().catch(() => false),
    printVisible: await printBtn.isVisible().catch(() => false),
    downloadLabel: (await downloadBtn.textContent().catch(() => ""))?.trim() ?? null,
    frameSrc: await page.getByTestId("portal-document-viewer-frame").getAttribute("src").catch(() => null),
  });
  await page.screenshot({ path: join(OUT, "03-invoice-viewer.png"), fullPage: false });
} else {
  results.push({ step: "invoice-open", error: "no invoice Open button" });
}

writeFileSync(join(OUT, "browser-results.json"), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
await browser.close();
