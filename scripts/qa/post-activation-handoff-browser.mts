/**
 * Sandbox acceptance: post-purchase /login?activated=1 must clear a prior
 * Jennifer Fancy session and show purchaser-email handoff — not bounce into Fancy.
 * Does NOT re-purchase Meadowbrook or alter ownership/memberships.
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
const EXPECT_SHA = (process.env.EXPECT_SHA || "4e3ea24a").slice(0, 8);
const PURCHASER_EMAIL = "jlcormier612@gmail.com";
const JENNIFER_EMAIL = "jennifer@hellotocheers.com";
const MEADOWBROOK_ID = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const JENNIFER_ID = "2fa73101-337b-4530-8c77-f3c272c5463e";
const PURCHASER_ID = "6721694e-3f38-45e6-9afa-383ba1fd7564";
const OUT = "docs/qa/meadowbrook-missing-venue-switcher";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("wvpsldwwjqdannqasrdf")) {
  throw new Error("Not Sandbox Supabase");
}

mkdirSync(OUT, { recursive: true });

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 400)}`);
}

async function jenniferCookies() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: JENNIFER_EMAIL,
  });
  if (linkErr) throw linkErr;
  const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties!.hashed_token!,
  });
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return {
    cookies: ssrUtils
      .createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", encoded)
      .map((c: { name: string; value: string }) => ({
        name: c.name,
        value: c.value,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      })),
    userId: otpData.session.user.id as string,
  };
}

async function dbSnapshot(label: string) {
  const { data: venue } = await admin
    .from("venues")
    .select("id, name, owner_user_id, account_status")
    .eq("id", MEADOWBROOK_ID)
    .maybeSingle();
  const { data: ownerStaff } = await admin
    .from("venue_staff")
    .select("user_id, email, role, is_owner, is_active")
    .eq("venue_id", MEADOWBROOK_ID)
    .eq("is_owner", true);
  const { data: jenniferStaff } = await admin
    .from("venue_staff")
    .select("venue_id, role, is_owner, is_active")
    .eq("user_id", JENNIFER_ID)
    .eq("is_active", true);
  const { data: handoff } = await admin
    .from("venue_onboarding_handoffs")
    .select("id, user_id, venue_id, intended_email, consumed_at, expires_at")
    .eq("venue_id", MEADOWBROOK_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  return {
    label,
    venue: venue
      ? {
          id: String(venue.id).slice(0, 8) + "…",
          name: venue.name,
          owner_user_id: String(venue.owner_user_id).slice(0, 8) + "…",
          account_status: venue.account_status,
          owner_is_purchaser: venue.owner_user_id === PURCHASER_ID,
        }
      : null,
    ownerStaff: (ownerStaff ?? []).map((r) => ({
      user_id: String(r.user_id).slice(0, 8) + "…",
      email: r.email,
      role: r.role,
      is_owner: r.is_owner,
      is_purchaser: r.user_id === PURCHASER_ID,
      is_jennifer: r.user_id === JENNIFER_ID,
    })),
    jenniferVenueCount: (jenniferStaff ?? []).length,
    jenniferHasMeadowbrook: (jenniferStaff ?? []).some((r) => r.venue_id === MEADOWBROOK_ID),
    handoffs: (handoff ?? []).map((h) => ({
      id: String(h.id).slice(0, 8) + "…",
      user_id: String(h.user_id).slice(0, 8) + "…",
      intended_email: h.intended_email,
      consumed: Boolean(h.consumed_at),
      expires_at: h.expires_at,
    })),
  };
}

async function resolveDeployedSha(): Promise<{ healthOk: boolean; dpl: string }> {
  const health = (await fetch(`${APP}/api/health`).then((r) => r.json())) as { ok?: boolean };
  const loginHtml = await fetch(`${APP}/login`).then((r) => r.text());
  const dpl = (loginHtml.match(/dpl=([a-f0-9]{40})/) ?? [])[1] ?? "";
  return { healthOk: Boolean(health?.ok), dpl };
}

async function main() {
  const { healthOk, dpl } = await resolveDeployedSha();
  record(
    "deployed_revision",
    healthOk && dpl.startsWith(EXPECT_SHA),
    `dpl=${dpl || "missing"} expect=${EXPECT_SHA} healthOk=${healthOk}`,
  );

  const before = await dbSnapshot("before");
  record(
    "ownership_before",
    Boolean(before.venue?.owner_is_purchaser) &&
      !before.jenniferHasMeadowbrook &&
      (before.ownerStaff ?? []).every((s) => s.is_purchaser),
    JSON.stringify(before),
  );

  const { cookies, userId } = await jenniferCookies();
  record("jennifer_session_minted", userId === JENNIFER_ID, `userId=${userId.slice(0, 8)}…`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const dashText = await page.locator("body").innerText();
  const onFancyBefore =
    /Fancy|Sweet Daisy|Texting E2E/i.test(dashText) && !/Sign in to your Hello to Cheers/i.test(dashText);
  record("jennifer_session_active_before", onFancyBefore, `url=${page.url()} snippet=${dashText.slice(0, 180)}`);
  await page.screenshot({ path: `${OUT}/handoff-jennifer-before.png`, fullPage: true });

  const handoffUrl = `${APP}/login?activated=1&next=${encodeURIComponent("/setup-hub")}&email=${encodeURIComponent(PURCHASER_EMAIL)}`;
  await page.goto(handoffUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const afterUrl = page.url();
  const afterText = await page.locator("body").innerText();
  const emailValue = await page.locator('input[type="email"], input[name="email"]').inputValue().catch(() => "");
  const stayedOnLogin = afterUrl.includes("/login") && afterUrl.includes("activated=1");
  const notDashboard = !/\/dashboard/.test(new URL(afterUrl).pathname);
  const copyOk =
    /email used for this purchase|Sign in with jlcormier612@gmail.com/i.test(afterText) ||
    /has been signed out/i.test(afterText);
  const prefillOk = emailValue.trim().toLowerCase() === PURCHASER_EMAIL;
  const noFancyShell =
    !/Jen'?s Fancy Venue/i.test(afterText) || /Welcome to Hello to Cheers|Sign in with/i.test(afterText);

  record("stays_on_login_activated", stayedOnLogin && notDashboard, `url=${afterUrl}`);
  record("handoff_copy", copyOk, afterText.slice(0, 240));
  record("email_prefill", prefillOk, `emailValue=${emailValue}`);
  record("not_fancy_shell", noFancyShell, afterText.slice(0, 200));
  await page.screenshot({ path: `${OUT}/handoff-activated-login.png`, fullPage: true });

  // Refresh / callback replay must not restore Jennifer into the app.
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const replayUrl = page.url();
  record(
    "refresh_stays_login",
    replayUrl.includes("/login") && replayUrl.includes("activated=1"),
    `url=${replayUrl}`,
  );
  await page.screenshot({ path: `${OUT}/handoff-activated-refresh.png`, fullPage: true });

  // Ordinary /login without activated=1 after sign-out should not auto-enter Fancy
  // (session cleared). Navigate to bare login.
  await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  const bareUrl = page.url();
  const bareText = await page.locator("body").innerText();
  record(
    "cleared_session_no_bounce",
    bareUrl.includes("/login") && !/dashboard|setup-hub/i.test(new URL(bareUrl).pathname),
    `url=${bareUrl} text=${bareText.slice(0, 160)}`,
  );

  await browser.close();

  const after = await dbSnapshot("after");
  record(
    "ownership_unchanged",
    JSON.stringify(before.venue) === JSON.stringify(after.venue) &&
      JSON.stringify(before.ownerStaff) === JSON.stringify(after.ownerStaff) &&
      before.jenniferHasMeadowbrook === after.jenniferHasMeadowbrook &&
      before.jenniferVenueCount === after.jenniferVenueCount,
    JSON.stringify({ before, after }).slice(0, 800),
  );

  const green = checks.every((c) => c.pass);
  const results = {
    at: new Date().toISOString(),
    expectSha: EXPECT_SHA,
    green,
    checks,
    before,
    after,
  };
  writeFileSync(`${OUT}/handoff-browser-results.json`, JSON.stringify(results, null, 2));
  console.log(green ? "GREEN post-activation handoff acceptance" : "NOT GREEN post-activation handoff acceptance");
  if (!green) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
