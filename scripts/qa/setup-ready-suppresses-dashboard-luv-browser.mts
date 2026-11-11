/**
 * Sandbox browser proof: ready_to_invite_couples suppresses Dashboard setup prompt.
 * Primary fixture: Meadowbrook Valley (declared ready, intro not dismissed).
 * Switches venues via set_active_venue (DB authoritative). Restores state after.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
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
const EXPECTED = process.env.EXPECT_SHA ?? "";
const MEADOW_OWNER_EMAIL = "jlcormier612@gmail.com";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const MEADOWBROOK = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = resolve("docs/qa/setup-ready-suppresses-dashboard-luv");
mkdirSync(OUT_DIR, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
type Session = { access_token: string; refresh_token: string };
const checks: Check[] = [];
const deploymentIds = new Set<string>();

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(linkHeader: string | undefined) {
  const match = linkHeader?.match(/dpl=([0-9a-f]{40})/);
  if (match) deploymentIds.add(match[1]);
  return match?.[1] ?? null;
}

async function sessionFor(email: string) {
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
  return {
    session: otpData.session as Session,
    cookies: ssrUtils.createChunks(cookieName, encoded).map(
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
  };
}

async function switchVenue(session: Session, venueId: string) {
  const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await userSb.auth.setSession(session);
  const { data, error } = await userSb.rpc("set_active_venue", { p_venue_id: venueId });
  if (error) throw new Error(`set_active_venue: ${error.message}`);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(`set_active_venue failed: ${payload?.error ?? "unknown"}`);
}

async function openDashboard(
  context: import("playwright").BrowserContext,
  page: import("playwright").Page,
  session: Session,
  venueId: string,
  expectedName: string,
) {
  await switchVenue(session, venueId);
  await context.addCookies([
    {
      name: "htc_active_venue_id",
      value: venueId,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ]);
  await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(1000);
  const body = await page.locator("body").innerText();
  if (!body.includes(expectedName)) {
    throw new Error(`expected active venue "${expectedName}" in dashboard body`);
  }
  return body;
}

function bodyHasSetupPrompt(text: string) {
  return text.includes("Let's finish setting up your venue");
}

async function main() {
  const healthRes = await fetch(`${APP}/api/health`);
  noteDeployment(healthRes.headers.get("link") ?? undefined);
  const loginRes = await fetch(`${APP}/login`, { method: "HEAD" });
  noteDeployment(loginRes.headers.get("link") ?? undefined);
  const serving = [...deploymentIds][0] ?? null;
  record(
    "serving_tip",
    !EXPECTED || serving === EXPECTED,
    `serving=${serving ?? "unknown"} expected=${EXPECTED || "(any)"}`,
  );

  const { data: hubBefore } = await admin
    .from("venue_setup_hub_state")
    .select("ready_to_invite_couples, ready_to_invite_couples_at, ready_to_invite_couples_declared_by")
    .eq("venue_id", MEADOWBROOK)
    .maybeSingle();
  const { data: venueBefore } = await admin
    .from("venues")
    .select("id, name, luv_intro_seen_at, created_at")
    .eq("id", MEADOWBROOK)
    .single();
  const { data: fancyBefore } = await admin
    .from("venues")
    .select("id, name, luv_intro_seen_at, created_at")
    .eq("id", FANCY)
    .single();
  const { data: fancyHubBefore } = await admin
    .from("venue_setup_hub_state")
    .select("ready_to_invite_couples, ready_to_invite_couples_at, ready_to_invite_couples_declared_by")
    .eq("venue_id", FANCY)
    .maybeSingle();

  const restoreHub = {
    ready_to_invite_couples: hubBefore?.ready_to_invite_couples ?? false,
    ready_to_invite_couples_at: hubBefore?.ready_to_invite_couples_at ?? null,
    ready_to_invite_couples_declared_by: hubBefore?.ready_to_invite_couples_declared_by ?? null,
  };
  const restoreIntro = venueBefore?.luv_intro_seen_at ?? null;
  const restoreFancy = {
    luv_intro_seen_at: fancyBefore?.luv_intro_seen_at ?? null,
    created_at: fancyBefore?.created_at ?? null,
  };
  const restoreFancyHub = {
    ready_to_invite_couples: fancyHubBefore?.ready_to_invite_couples ?? false,
    ready_to_invite_couples_at: fancyHubBefore?.ready_to_invite_couples_at ?? null,
    ready_to_invite_couples_declared_by: fancyHubBefore?.ready_to_invite_couples_declared_by ?? null,
  };

  try {
    await admin.from("venues").update({ luv_intro_seen_at: null }).eq("id", MEADOWBROOK);

    const meadowAuth = await sessionFor(MEADOW_OWNER_EMAIL);
    const fancyAuth = await sessionFor(FANCY_EMAIL);
    const browser = await chromium.launch({ headless: true });

    // --- Declared ready (authoritative Meadowbrook state) ---
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: true,
        ready_to_invite_couples_at: hubBefore?.ready_to_invite_couples_at ?? new Date().toISOString(),
        ready_to_invite_couples_declared_by: hubBefore?.ready_to_invite_couples_declared_by ?? null,
      })
      .eq("venue_id", MEADOWBROOK);

    const { data: hubReady } = await admin
      .from("venue_setup_hub_state")
      .select("ready_to_invite_couples, ready_to_invite_couples_at")
      .eq("venue_id", MEADOWBROOK)
      .single();
    record(
      "persisted_ready_true",
      hubReady?.ready_to_invite_couples === true,
      `ready_to_invite_couples=${hubReady?.ready_to_invite_couples} at=${hubReady?.ready_to_invite_couples_at}`,
    );

    const meadowCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await meadowCtx.addCookies(meadowAuth.cookies);
    const meadowPage = await meadowCtx.newPage();

    let body = await openDashboard(
      meadowCtx,
      meadowPage,
      meadowAuth.session,
      MEADOWBROOK,
      "Meadowbrook",
    );
    const readyHides = !bodyHasSetupPrompt(body);
    await meadowPage.screenshot({ path: `${OUT_DIR}/dashboard-ready.png`, fullPage: true });
    record(
      "ready_hides_setup_prompt",
      readyHides,
      readyHides ? "prompt absent when ready=true" : "prompt still visible when ready=true",
    );

    await meadowPage.reload({ waitUntil: "networkidle", timeout: 90000 });
    await meadowPage.waitForTimeout(1000);
    body = await meadowPage.locator("body").innerText();
    const reloadHides = !bodyHasSetupPrompt(body) && body.includes("Meadowbrook");
    await meadowPage.screenshot({ path: `${OUT_DIR}/dashboard-ready-reload.png`, fullPage: true });
    record(
      "reload_still_hides",
      reloadHides,
      reloadHides ? "still absent after reload" : "reappeared after reload or venue drifted",
    );

    await meadowPage.goto(`${APP}/setup-hub`, { waitUntil: "networkidle", timeout: 90000 });
    await meadowPage.waitForTimeout(800);
    const hubText = await meadowPage.locator("body").innerText();
    const hubConfirms =
      hubText.includes("Meadowbrook") &&
      hubText.includes("You've decided you're ready") &&
      hubText.includes("stop showing setup guidance");
    await meadowPage.screenshot({ path: `${OUT_DIR}/setup-hub-ready.png`, fullPage: true });
    record("setup_hub_confirmation", hubConfirms, hubConfirms ? "confirmation visible" : "missing confirmation");
    record(
      "setup_hub_still_accessible",
      /Setup|Your venue|Offerings|Lead|Team|Financial/i.test(hubText),
      "setup hub remains configurable",
    );

    // --- Reverse ---
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: false,
        ready_to_invite_couples_at: null,
        ready_to_invite_couples_declared_by: null,
      })
      .eq("venue_id", MEADOWBROOK);
    body = await openDashboard(
      meadowCtx,
      meadowPage,
      meadowAuth.session,
      MEADOWBROOK,
      "Meadowbrook",
    );
    const reversedShows = bodyHasSetupPrompt(body);
    await meadowPage.screenshot({ path: `${OUT_DIR}/dashboard-reversed.png`, fullPage: true });
    record(
      "reverse_restores_prompt",
      reversedShows,
      reversedShows ? "prompt returned after reverse" : "prompt did not return after reverse",
    );
    record(
      "not_ready_shows_setup_prompt",
      reversedShows,
      reversedShows ? "prompt visible when ready=false" : "prompt missing when ready=false",
    );

    // Restore Meadowbrook ready for isolation + leave owner declaration intact afterward.
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: true,
        ready_to_invite_couples_at: restoreHub.ready_to_invite_couples_at ?? new Date().toISOString(),
        ready_to_invite_couples_declared_by: restoreHub.ready_to_invite_couples_declared_by,
      })
      .eq("venue_id", MEADOWBROOK);
    body = await openDashboard(
      meadowCtx,
      meadowPage,
      meadowAuth.session,
      MEADOWBROOK,
      "Meadowbrook",
    );
    const meadowHides = !bodyHasSetupPrompt(body);
    await meadowPage.screenshot({ path: `${OUT_DIR}/dashboard-meadow-ready-isolation.png`, fullPage: true });
    await meadowCtx.close();

    // Fancy (separate account/venue): not ready + age-eligible → prompt shows
    await admin
      .from("venues")
      .update({ luv_intro_seen_at: null, created_at: new Date().toISOString() })
      .eq("id", FANCY);
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: false,
        ready_to_invite_couples_at: null,
        ready_to_invite_couples_declared_by: null,
      })
      .eq("venue_id", FANCY);

    const fancyCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await fancyCtx.addCookies(fancyAuth.cookies);
    const fancyPage = await fancyCtx.newPage();
    body = await openDashboard(fancyCtx, fancyPage, fancyAuth.session, FANCY, "Jen's Fancy Venue");
    const fancyShows = bodyHasSetupPrompt(body);
    await fancyPage.screenshot({ path: `${OUT_DIR}/dashboard-fancy-not-ready-isolation.png`, fullPage: true });
    await fancyCtx.close();
    record(
      "venue_isolation",
      meadowHides && fancyShows,
      `meadowHide=${meadowHides} fancyShow=${fancyShows}`,
    );

    await browser.close();
  } finally {
    await admin.from("venue_setup_hub_state").update(restoreHub).eq("venue_id", MEADOWBROOK);
    await admin.from("venues").update({ luv_intro_seen_at: restoreIntro }).eq("id", MEADOWBROOK);
    await admin.from("venue_setup_hub_state").update(restoreFancyHub).eq("venue_id", FANCY);
    await admin
      .from("venues")
      .update({
        luv_intro_seen_at: restoreFancy.luv_intro_seen_at,
        ...(restoreFancy.created_at ? { created_at: restoreFancy.created_at } : {}),
      })
      .eq("id", FANCY);
  }

  const ok = checks.every((c) => c.pass);
  const result = {
    ok,
    servingSha: serving,
    expectedSha: EXPECTED || null,
    primaryVenueId: MEADOWBROOK,
    primaryVenueName: venueBefore?.name ?? null,
    checks,
    hubBefore: restoreHub,
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(ok ? "GREEN" : "NOT GREEN");
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
