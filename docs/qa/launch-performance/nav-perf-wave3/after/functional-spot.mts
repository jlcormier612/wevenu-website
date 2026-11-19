import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require("/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js");

const APP = "https://app.sandbox.hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE3-AFTER/spot");
mkdirSync(OUT, { recursive: true });
mkdirSync("docs/qa/launch-performance/nav-perf-wave3/after", { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function cookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties!.hashed_token! });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${otpData.session.access_token}` } },
  });
  const { data: setRes, error: setErr } = await authed.rpc("set_active_venue", { p_venue_id: FANCY });
  if (setErr) throw setErr;
  const setPayload = setRes as { ok?: boolean; error?: string } | null;
  if (!setPayload?.ok) throw new Error(`set_active_venue failed: ${setPayload?.error ?? "unknown"}`);
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

type C = { name: string; pass: boolean; detail: string };
const checks: C[] = [];
const note = (name: string, pass: boolean, detail: string) => {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`);
};

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies(await cookies());
  const page = await ctx.newPage();
  const ai: string[] = [];
  const sidebarPrefetch: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.openai\.com|luv-ask/i.test(u)) ai.push(u);
    if (/\?_rsc=/.test(u) && !/\/_next\//.test(u)) {
      try { sidebarPrefetch.push(new URL(u).pathname); } catch { /* */ }
    }
  });

  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("h1.font-heading").filter({ hasText: /Good (morning|afternoon|evening)/i }).first().waitFor({ state: "visible", timeout: 60000 });
  const venueLine = await page.locator("p").filter({ hasText: /Jen's Fancy Venue/ }).first().innerText();
  note("greeting_venue", /Jen's Fancy Venue/.test(venueLine), venueLine.slice(0, 120));

  await page.getByText("Lead Flow", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
  await page.getByText("Booked Business", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Cash Collected", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  await page.getByText("Outstanding", { exact: true }).waitFor({ state: "visible", timeout: 30000 });
  const cash = await page.locator("text=Cash Collected").locator("xpath=ancestor::a|ancestor::div[contains(@class,'htc')]").first().innerText().catch(() => "");
  note("kpis_present", true, `cash_snip=${cash.replace(/\s+/g, " ").slice(0, 80)}`);

  await page.getByText("Today's Focus", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
  await page.locator('[data-testid="coming-up-section"]').waitFor({ state: "visible", timeout: 60000 });
  note("focus_and_coming_up", true, "visible");

  // Sidebar Wave 1: navigate Leads
  await page.locator('a[href="/leads"]').first().click();
  await page.waitForURL(/\/leads/, { timeout: 30000 });
  note("desktop_nav_leads", page.url().includes("/leads"), page.url());

  // Contracts page
  await page.goto(`${APP}/contracts`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 60000 });
  note("contracts_page", !/Application error/i.test(await page.locator("body").innerText()), page.url());

  // Attention API venue scope
  const attn = await page.evaluate(async () => {
    const res = await fetch("/api/navigation/attention", { credentials: "include" });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  note("attention_ok", attn.status === 200, JSON.stringify({ status: attn.status, keys: attn.body && Object.keys(attn.body) }));

  // Mobile nav
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mobile.addCookies(await cookies());
  const mp = await mobile.newPage();
  await mp.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await mp.getByRole("button", { name: "Open navigation" }).click({ timeout: 15000 });
  await mp.locator('[role="dialog"] a[href="/leads"]').first().click({ timeout: 15000 });
  await mp.waitForURL(/\/leads/, { timeout: 30000 });
  note("mobile_nav_leads", mp.url().includes("/leads"), mp.url());
  await mp.screenshot({ path: join(OUT, "mobile-leads.png") });
  await mobile.close();

  note("no_openai", ai.length === 0, String(ai.length));
  const hotSidebar = sidebarPrefetch.filter((p) =>
    ["/contracts", "/library", "/settings/referrals", "/library/documents"].includes(p),
  );
  note("wave1_no_hot_sidebar_rsc", hotSidebar.length === 0, `hot=${hotSidebar.join(",") || "none"} total_rsc_paths=${[...new Set(sidebarPrefetch)].length}`);

  await page.screenshot({ path: join(OUT, "desktop-dashboard.png") });
  writeFileSync(join(OUT, "functional.json"), JSON.stringify({ checks }, null, 2));
  writeFileSync("docs/qa/launch-performance/nav-perf-wave3/after/functional.json", JSON.stringify({ checks }, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, failed: failed.map((f) => f.name) }));
  await browser.close();
  if (failed.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
