/**
 * Sandbox browser proof: ready_to_invite_couples suppresses Dashboard setup prompt.
 * Restores Fancy venue hub/intro state afterward. Production untouched.
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
const FANCY_EMAIL = "jennifer@hellotocheers.com";
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
  return ssrUtils.createChunks(cookieName, encoded).map(
    (c: { name: string; value: string }) => ({
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    }),
  );
}

async function setActiveVenue(
  context: import("playwright").BrowserContext,
  venueId: string,
) {
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
}

async function bodyHasSetupPrompt(page: import("playwright").Page) {
  const text = await page.locator("body").innerText();
  // Unique CTA on the Dashboard setup-guidance intro card.
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
    .eq("venue_id", FANCY)
    .maybeSingle();
  const { data: venueBefore } = await admin
    .from("venues")
    .select("id, name, luv_intro_seen_at, created_at")
    .eq("id", FANCY)
    .single();

  // Second venue Jennifer can open (Meadowbrook Valley).
  const { data: meadow } = await admin
    .from("venues")
    .select("id, name, luv_intro_seen_at, created_at")
    .ilike("name", "%Meadowbrook%")
    .limit(1)
    .maybeSingle();
  const otherVenueId = meadow?.id ?? null;

  const restoreHub = {
    ready_to_invite_couples: hubBefore?.ready_to_invite_couples ?? false,
    ready_to_invite_couples_at: hubBefore?.ready_to_invite_couples_at ?? null,
    ready_to_invite_couples_declared_by: hubBefore?.ready_to_invite_couples_declared_by ?? null,
  };
  const restoreIntro = venueBefore?.luv_intro_seen_at ?? null;
  const restoreCreatedAt = venueBefore?.created_at ?? null;
  const restoreOtherIntro = meadow?.luv_intro_seen_at ?? null;
  const restoreOtherCreatedAt = meadow?.created_at ?? null;
  let otherHubBefore: boolean | null = null;

  try {
    // Make Fancy age-eligible for the intro so readiness is the only suppressor.
    const recent = new Date().toISOString();
    await admin
      .from("venues")
      .update({ luv_intro_seen_at: null, created_at: recent })
      .eq("id", FANCY);
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: false,
        ready_to_invite_couples_at: null,
        ready_to_invite_couples_declared_by: null,
      })
      .eq("venue_id", FANCY);

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addCookies(await cookiesFor(FANCY_EMAIL));
    const page = await context.newPage();

    await setActiveVenue(context, FANCY);
    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    const notReadyShows = await bodyHasSetupPrompt(page);
    await page.screenshot({ path: `${OUT_DIR}/dashboard-not-ready.png`, fullPage: true });
    record(
      "not_ready_shows_setup_prompt",
      notReadyShows,
      notReadyShows ? "prompt visible when ready=false" : "prompt missing when ready=false",
    );

    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: true,
        ready_to_invite_couples_at: new Date().toISOString(),
        ready_to_invite_couples_declared_by: null,
      })
      .eq("venue_id", FANCY);

    const { data: hubReady } = await admin
      .from("venue_setup_hub_state")
      .select("ready_to_invite_couples")
      .eq("venue_id", FANCY)
      .single();
    record(
      "persisted_ready_true",
      hubReady?.ready_to_invite_couples === true,
      `ready_to_invite_couples=${hubReady?.ready_to_invite_couples}`,
    );

    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    const readyHides = !(await bodyHasSetupPrompt(page));
    await page.screenshot({ path: `${OUT_DIR}/dashboard-ready.png`, fullPage: true });
    record(
      "ready_hides_setup_prompt",
      readyHides,
      readyHides ? "prompt absent when ready=true" : "prompt still visible when ready=true",
    );

    await page.reload({ waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    const reloadHides = !(await bodyHasSetupPrompt(page));
    await page.screenshot({ path: `${OUT_DIR}/dashboard-ready-reload.png`, fullPage: true });
    record(
      "reload_still_hides",
      reloadHides,
      reloadHides ? "still absent after reload" : "reappeared after reload",
    );

    await page.goto(`${APP}/setup-hub`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    const hubText = await page.locator("body").innerText();
    const hubConfirms =
      hubText.includes("You've decided you're ready") &&
      hubText.includes("stop showing setup guidance");
    const hubStillConfigurable =
      hubText.includes("Setup") || hubText.includes("Your venue") || hubText.includes("Getting Started");
    await page.screenshot({ path: `${OUT_DIR}/setup-hub-ready.png`, fullPage: true });
    record("setup_hub_confirmation", hubConfirms, hubConfirms ? "confirmation visible" : "missing confirmation");
    record(
      "setup_hub_still_accessible",
      hubStillConfigurable,
      hubStillConfigurable ? "setup items still reachable" : "setup hub looks empty/blocked",
    );

    // Reverse
    await admin
      .from("venue_setup_hub_state")
      .update({
        ready_to_invite_couples: false,
        ready_to_invite_couples_at: null,
        ready_to_invite_couples_declared_by: null,
      })
      .eq("venue_id", FANCY);
    await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(800);
    const reversedShows = await bodyHasSetupPrompt(page);
    await page.screenshot({ path: `${OUT_DIR}/dashboard-reversed.png`, fullPage: true });
    record(
      "reverse_restores_prompt",
      reversedShows,
      reversedShows ? "prompt returned after reverse" : "prompt did not return after reverse",
    );

    if (otherVenueId) {
      const { data: otherHub } = await admin
        .from("venue_setup_hub_state")
        .select("ready_to_invite_couples")
        .eq("venue_id", otherVenueId)
        .maybeSingle();
      otherHubBefore = otherHub?.ready_to_invite_couples === true;
      await admin
        .from("venues")
        .update({ luv_intro_seen_at: null, created_at: new Date().toISOString() })
        .eq("id", otherVenueId);
      await admin
        .from("venue_setup_hub_state")
        .update({ ready_to_invite_couples: true })
        .eq("venue_id", otherVenueId);

      await setActiveVenue(context, otherVenueId);
      await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(800);
      const otherHides = !(await bodyHasSetupPrompt(page));
      await page.screenshot({ path: `${OUT_DIR}/dashboard-other-venue-ready.png`, fullPage: true });
      record(
        "other_venue_ready_hides",
        otherHides,
        `otherVenue=${otherVenueId} ready=true hides=${otherHides}`,
      );

      // Fancy remains independent (currently false → should show)
      await setActiveVenue(context, FANCY);
      await page.goto(`${APP}/dashboard`, { waitUntil: "networkidle", timeout: 90000 });
      await page.waitForTimeout(800);
      const fancyIndependent = await bodyHasSetupPrompt(page);
      await page.screenshot({ path: `${OUT_DIR}/dashboard-fancy-independent.png`, fullPage: true });
      record(
        "venue_isolation",
        fancyIndependent,
        fancyIndependent
          ? "Fancy (ready=false) still shows while other venue ready=true"
          : "Fancy incorrectly suppressed by other venue",
      );

      await admin
        .from("venue_setup_hub_state")
        .update({ ready_to_invite_couples: otherHubBefore === true })
        .eq("venue_id", otherVenueId);
    } else {
      record("venue_isolation", false, "no second venue available for Jennifer");
    }

    await browser.close();
  } finally {
    await admin.from("venue_setup_hub_state").update(restoreHub).eq("venue_id", FANCY);
    await admin
      .from("venues")
      .update({
        luv_intro_seen_at: restoreIntro,
        ...(restoreCreatedAt ? { created_at: restoreCreatedAt } : {}),
      })
      .eq("id", FANCY);
    if (otherVenueId) {
      await admin
        .from("venues")
        .update({
          luv_intro_seen_at: restoreOtherIntro,
          ...(restoreOtherCreatedAt ? { created_at: restoreOtherCreatedAt } : {}),
        })
        .eq("id", otherVenueId);
      if (otherHubBefore !== null) {
        await admin
          .from("venue_setup_hub_state")
          .update({ ready_to_invite_couples: otherHubBefore })
          .eq("venue_id", otherVenueId);
      }
    }
  }

  const ok = checks.every((c) => c.pass);
  const result = {
    ok,
    servingSha: serving,
    expectedSha: EXPECTED || null,
    fancyVenueId: FANCY,
    checks,
    hubBefore: restoreHub,
    venueName: venueBefore?.name ?? null,
  };
  writeFileSync(`${OUT_DIR}/browser-results.json`, JSON.stringify(result, null, 2));
  console.log(ok ? "GREEN" : "NOT GREEN");
  if (!ok) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
