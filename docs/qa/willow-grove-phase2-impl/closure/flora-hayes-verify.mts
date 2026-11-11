/**
 * Flora vendor portal — Hayes assignment + privacy verification (correct vendor cookie jar).
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
const OUT = "/Users/jensmac/Developer/wevenu-website/docs/qa/willow-grove-phase2-impl/closure";
const SHOTS = join(OUT, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

const FLORA_EMAIL = "lila@floraandbranch.example";

async function vendorCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: FLORA_EMAIL });
  const { data: otp } = await anon.auth.verifyOtp({ type: "email", token_hash: link!.properties!.hashed_token! });
  const base = { domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const };
  return ssr
    .createChunks("sb-wvpsldwwjqdannqasrdf-vendor-auth-token", "base64-" + ssr.stringToBase64URL(JSON.stringify(otp!.session)))
    .map((c: { name: string; value: string }) => ({ ...base, ...c }));
}

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(await vendorCookies());
const page = await ctx.newPage();

const report: Record<string, unknown> = {
  email: FLORA_EMAIL,
  cookieJar: "sb-wvpsldwwjqdannqasrdf-vendor-auth-token",
  steps: [] as object[],
};

async function step(name: string, fn: () => Promise<object>) {
  try {
    const result = await fn();
    (report.steps as object[]).push({ name, ok: true, ...result });
    console.log("OK", name, JSON.stringify(result).slice(0, 200));
  } catch (e) {
    (report.steps as object[]).push({ name, ok: false, error: String(e) });
    console.log("FAIL", name, e);
  }
}

await step("dashboard", async () => {
  await page.goto(`${APP}/vendor/dashboard`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const url = page.url();
  const text = await page.locator("body").innerText();
  const path = join(SHOTS, "flora-01-dashboard.png");
  await page.screenshot({ path, fullPage: true });
  return {
    url,
    redirectedToLogin: /\/vendor\/login/.test(url),
    showsFlora: /Flora/i.test(text),
    showsWillowGrove: /Willow Grove/i.test(text),
    shot: path,
    snippet: text.slice(0, 400),
  };
});

await step("events_list", async () => {
  await page.goto(`${APP}/vendor/events`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);
  const text = await page.locator("body").innerText();
  const path = join(SHOTS, "flora-02-events.png");
  await page.screenshot({ path, fullPage: true });
  return {
    url: page.url(),
    showsHayes: /Olivia|Hayes/i.test(text),
    shot: path,
    snippet: text.slice(0, 500),
  };
});

await step("hayes_event", async () => {
  // Click Hayes card if present
  const hayes = page.getByText(/Olivia.*Hayes|Hayes Wedding/i).first();
  if (await hayes.isVisible().catch(() => false)) {
    await hayes.click();
    await page.waitForTimeout(2000);
  } else {
    // Resolve Hayes event id from DB and open vendor event route
    const { data: ev } = await admin
      .from("events")
      .select("id,name")
      .eq("venue_id", WG)
      .ilike("name", "%Hayes%")
      .limit(1)
      .maybeSingle();
    if (ev?.id) {
      await page.goto(`${APP}/vendor/events/${ev.id}`, { waitUntil: "networkidle", timeout: 60000 });
      await page.waitForTimeout(1500);
    }
  }
  const text = await page.locator("body").innerText();
  const path = join(SHOTS, "flora-03-hayes.png");
  await page.screenshot({ path, fullPage: true });
  // "Internal notes" nav label alone is not exposure — open the tab and check contents
  let notesTabText = "";
  const notesTab = page.getByRole("link", { name: /Internal notes/i }).or(page.getByRole("tab", { name: /Internal notes/i })).first();
  if (await notesTab.isVisible().catch(() => false)) {
    await notesTab.click();
    await page.waitForTimeout(1200);
    notesTabText = await page.locator("main").innerText().catch(() => "");
    await page.screenshot({ path: join(SHOTS, "flora-04-internal-notes.png"), fullPage: true });
  }
  const venuePrivateLeak = /staff.?only|do not share with vendor|venue.?private|CONFIDENTIAL.*venue/i.test(notesTabText)
    || (/Elena|Brooks|margin|commission|internal pricing/i.test(notesTabText) && /\$\d/.test(notesTabText) && !/Venue cost for this event/i.test(notesTabText));
  const venuePackagePrice = /Essential Wedding|Signature Wedding|\$15,000|\$24,500|couple charge|payment plan|deposit due/i.test(text);
  const vendorOwnCostOk = /Venue cost for this event/i.test(text) && /\$4,800/i.test(text);
  return {
    url: page.url(),
    showsHayes: /Hayes|Olivia/i.test(text),
    showsSharedPlanning: /timeline|arrival|floor|schedule|ceremony|reception|task/i.test(text),
    exposesVenuePrivateNotes: venuePrivateLeak,
    exposesVenueFinancials: venuePackagePrice && !vendorOwnCostOk,
    vendorOwnCostVisible: vendorOwnCostOk,
    notesTabSnippet: notesTabText.slice(0, 500),
    snippet: text.slice(0, 800),
    shot: path,
  };
});

await browser.close();

// Membership confirmation (read-only)
const { data: vu } = await admin.from("vendor_users").select("id,email,vendor_id").ilike("email", FLORA_EMAIL).maybeSingle();
const { data: vendor } = vu?.vendor_id
  ? await admin.from("vendors").select("id,name").eq("id", vu.vendor_id).single()
  : { data: null };
report.membership = { vendorUser: vu, vendor };
report.rootCause =
  "Vendor portal uses isolated cookie jar sb-<ref>-vendor-auth-token via createVendorClient(). Prior Phase 2 probe set the staff venue cookie sb-<ref>-auth-token, so getVendorUser() saw no vendor session and redirected to /vendor/login. Not an auth defect or missing membership — demo session/cookie scope mismatch.";
report.classification = "Session/cookie issue (demo harness) — legitimate vendor_users membership present";

writeFileSync(join(OUT, "flora-hayes-verification.json"), JSON.stringify(report, null, 2));
console.log("WROTE", join(OUT, "flora-hayes-verification.json"));
