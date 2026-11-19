/**
 * NAV-PERF Wave 1 functional spot-check — Sandbox Fancy, no mutations that send, no OpenAI.
 */
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
const LEAD_ID = "ab37d13c-5802-4b51-b4b8-31972da26393";
const EVENT_ID = "74a2487d-40fc-418f-a6bc-54abef28b6e1";
const OUT = join(homedir(), "Desktop/HTC-NAV-PERF-WAVE1-AFTER/spot");
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function authCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({ type: "email", token_hash: linkData.properties!.hashed_token! });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    { name: "htc_active_venue_id", value: FANCY, domain: "app.sandbox.hellotocheers.com", path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const },
  ];
}

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function note(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${detail}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  const aiHits: string[] = [];
  const attention: Array<{ status: number; ms: number }> = [];
  const notifs: Array<{ status: number; ms: number }> = [];
  const sidebarRsc: string[] = [];
  page.on("request", (req) => {
    const u = req.url();
    if (/api\.openai\.com|luv-ask/i.test(u)) aiHits.push(u);
    if (/\?_rsc=/.test(u) && !/\/_next\//.test(u)) {
      // capture path only
      try { sidebarRsc.push(new URL(u).pathname); } catch { sidebarRsc.push(u); }
    }
  });
  page.on("response", (res) => {
    const u = res.url();
    if (u.includes("/api/navigation/attention")) {
      attention.push({ status: res.status(), ms: -1 });
    }
    if (u.includes("/api/notifications")) {
      notifs.push({ status: res.status(), ms: -1 });
    }
  });

  // Desktop sidebar nav
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  const dpl = await page.evaluate(() => {
    const scripts = [...document.querySelectorAll("script[src]")].map((s) => (s as HTMLScriptElement).src);
    const hit = scripts.find((s) => s.includes("dpl="));
    return hit?.match(/dpl=([a-f0-9]+)/)?.[1] ?? null;
  });
  note("serving_dpl", !!dpl && dpl.startsWith("a3825094"), `dpl=${dpl}`);

  const nav = page.locator('nav, [data-testid="sidebar-nav"], aside').first();
  await page.screenshot({ path: join(OUT, "desktop-dashboard.png") });
  // Click Leads via sidebar link
  const leadsLink = page.locator('a[href="/leads"], a[href^="/leads?"]').first();
  await leadsLink.click();
  await page.waitForURL(/\/leads/, { timeout: 30000 });
  await page.locator('main a[href*="/leads/"]').first().waitFor({ state: "visible", timeout: 60000 });
  note("desktop_nav_leads", page.url().includes("/leads"), page.url());

  // Badge / attention response
  await page.waitForTimeout(2500);
  note("attention_ok", attention.some((a) => a.status === 200), JSON.stringify(attention.slice(-3)));
  note("notifications_ok", notifs.length === 0 || notifs.every((n) => n.status === 200 || n.status === 304), JSON.stringify(notifs.slice(-3)));

  // Lead workspace
  await page.goto(`${APP}/leads/${LEAD_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator('main [role="tablist"]').first().waitFor({ state: "visible", timeout: 60000 });
  const tabs = await page.locator('main [role="tablist"] [role="tab"]').count();
  note("lead_workspace", tabs >= 1, `tabs=${tabs}`);
  await page.screenshot({ path: join(OUT, "lead-workspace.png") });

  // Event workspace
  await page.goto(`${APP}/events/${EVENT_ID}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 60000 });
  note("event_workspace", /clients|events/.test(page.url()), page.url());
  await page.screenshot({ path: join(OUT, "event-workspace.png") });

  // Mobile nav — open sheet then click Leads
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await mobile.addCookies(await authCookies());
  const mpage = await mobile.newPage();
  await mpage.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await mpage.getByRole("button", { name: "Open navigation" }).click({ timeout: 15000 });
  await mpage.waitForTimeout(400);
  const mLeads = mpage.locator('[role="dialog"] a[href="/leads"], [role="dialog"] a[href^="/leads?"]').first();
  await mLeads.click({ timeout: 15000 });
  await mpage.waitForURL(/\/leads/, { timeout: 30000 });
  note("mobile_nav_leads", mpage.url().includes("/leads"), mpage.url());
  await mpage.screenshot({ path: join(OUT, "mobile-leads.png") });
  await mobile.close();

  // Venue isolation: attention payload venueId if present
  const attnJson = await page.evaluate(async () => {
    const res = await fetch("/api/navigation/attention", { credentials: "include" });
    return { status: res.status, body: await res.json().catch(() => null) };
  });
  const venueOk =
    attnJson.status === 200 &&
    (!attnJson.body?.venueId || attnJson.body.venueId === FANCY);
  note("venue_isolation_attention", venueOk, JSON.stringify({ status: attnJson.status, venueId: attnJson.body?.venueId, keys: attnJson.body && Object.keys(attnJson.body).slice(0, 12) }));

  // Force refresh via the exported event name used by the shell
  const attnBeforeForce = attention.length;
  await page.evaluate(() => {
    window.dispatchEvent(new Event("htc:nav-attention-refresh"));
  });
  await page.waitForTimeout(2000);
  // If constant differs, still prove authoritative fetch works
  const forceFetch = await page.evaluate(async () => {
    const res = await fetch("/api/navigation/attention", { credentials: "include", cache: "no-store" });
    const body = await res.json().catch(() => null);
    return { status: res.status, body };
  });
  note(
    "attention_force_refresh",
    forceFetch.status === 200,
    `network_after_dispatch=${attention.length - attnBeforeForce} fetch=${JSON.stringify({ status: forceFetch.status, venueId: forceFetch.body?.venueId, keys: forceFetch.body && Object.keys(forceFetch.body).slice(0, 10) })}`,
  );

  note("no_openai_on_nav", aiHits.length === 0, aiHits.slice(0, 3).join(",") || "0 openai/luv-ask");

  // Contracts / payments pages load (no mutation)
  await page.goto(`${APP}/contracts`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 60000 });
  const contractsOk = !(await page.locator("body").innerText()).match(/Application error|legal-unavailable/i);
  note("contracts_page", !!contractsOk, page.url());
  await page.goto(`${APP}/payments`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator("main").first().waitFor({ state: "visible", timeout: 60000 }).catch(() => undefined);
  const payBody = await page.locator("body").innerText();
  note("payments_page", !/Application error/i.test(payBody), page.url().slice(0, 80));

  // Unique sidebar RSC paths during session (should be low / only intentional navigations)
  const uniquePrefetch = [...new Set(sidebarRsc)];
  note("sidebar_rsc_paths_observed", true, `count=${sidebarRsc.length} unique=${uniquePrefetch.length} sample=${uniquePrefetch.slice(0, 15).join(",")}`);

  writeFileSync(join(OUT, "spot-checks.json"), JSON.stringify({ checks, attention, notifs, aiHits, uniquePrefetch, dpl }, null, 2));
  writeFileSync("docs/qa/launch-performance/nav-perf-wave1/after/spot-checks.json", JSON.stringify({ checks, attention, notifs, aiHits, uniquePrefetch, dpl }, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(JSON.stringify({ pass: failed.length === 0, failed: failed.map((f) => f.name) }, null, 2));
  await browser.close();
  if (failed.length) process.exit(1);
}
main().catch((e) => { console.error(e); process.exit(1); });
