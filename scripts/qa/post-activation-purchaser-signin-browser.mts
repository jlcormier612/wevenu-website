/**
 * Sandbox E2E: purchaser password sign-in after /login?activated=1 consumes
 * the onboarding handoff and lands in the purchased venue context.
 *
 * Disposable fixture only. Does not touch Meadowbrook ownership, Jennifer
 * memberships, or rotate any existing credentials.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const require = createRequire("/Users/jensmac/Developer/wevenu-website/marketing/package.json");
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECT_SHA = (process.env.EXPECT_SHA || "459d63fc").slice(0, 8);
const OUT = "docs/qa/meadowbrook-missing-venue-switcher";
const JENNIFER_EMAIL = "jennifer@hellotocheers.com";
const JENNIFER_ID = "2fa73101-337b-4530-8c77-f3c272c5463e";
const MEADOWBROOK_ID = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const PURCHASER_MEADOW_ID = "6721694e-3f38-45e6-9afa-383ba1fd7564";

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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail.slice(0, 420)}`);
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
  if (otpErr || !otpData.session) throw otpErr ?? new Error("no jennifer session");
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return ssrUtils.createChunks("sb-wvpsldwwjqdannqasrdf-auth-token", encoded).map((c: { name: string; value: string }) => ({
    name: c.name,
    value: c.value,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  }));
}

async function asUser(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

async function insertVenue(name: string, ownerId: string, email: string) {
  const { data, error } = await admin
    .from("venues")
    .insert({ owner_user_id: ownerId, name, email })
    .select("id,name,owner_user_id")
    .single();
  if (error || !data) throw error ?? new Error("venue insert failed");
  return data;
}

async function insertOwnerStaff(venueId: string, userId: string, email: string, fullName: string) {
  const { error } = await admin.from("venue_staff").insert({
    venue_id: venueId,
    user_id: userId,
    full_name: fullName,
    email,
    role: "owner",
    is_owner: true,
    is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator",
    title_basis: "administrator",
    capability_overrides: {},
    owner_invite_pending: false,
  });
  if (error) throw error;
}

async function invariantSnapshot(label: string) {
  const { data: meadow } = await admin
    .from("venues")
    .select("id, owner_user_id")
    .eq("id", MEADOWBROOK_ID)
    .maybeSingle();
  const { data: jenniferStaff } = await admin
    .from("venue_staff")
    .select("venue_id")
    .eq("user_id", JENNIFER_ID)
    .eq("is_active", true);
  const jenniferVenueIds = (jenniferStaff ?? []).map((r) => r.venue_id).sort();
  return {
    label,
    meadowOwnerIsPurchaser: meadow?.owner_user_id === PURCHASER_MEADOW_ID,
    jenniferVenueCount: jenniferVenueIds.length,
    jenniferHasMeadowbrook: jenniferVenueIds.includes(MEADOWBROOK_ID),
    jenniferVenueIds: jenniferVenueIds.map((id) => String(id).slice(0, 8) + "…"),
  };
}

async function handoffRow(userId: string, venueId: string) {
  const { data } = await admin
    .from("venue_onboarding_handoffs")
    .select("id, user_id, venue_id, intended_email, consumed_at, expires_at, origin")
    .eq("user_id", userId)
    .eq("venue_id", venueId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function main() {
  const observedAt = new Date().toISOString();
  const stamp = Date.now();
  const password = `Handoff-${stamp}-Kx7mP3`;
  const purchaserEmail = `handoff.buyer.${stamp}@hellotocheers-test.invalid`;
  const strangerEmail = `handoff.stranger.${stamp}@hellotocheers-test.invalid`;

  const beforeInvariant = await invariantSnapshot("before");
  record(
    "invariant_before",
    beforeInvariant.meadowOwnerIsPurchaser &&
      beforeInvariant.jenniferVenueCount === 3 &&
      !beforeInvariant.jenniferHasMeadowbrook,
    JSON.stringify(beforeInvariant),
  );

  // --- disposable fixture ---
  const { data: buyerCreated, error: buyerErr } = await admin.auth.admin.createUser({
    email: purchaserEmail,
    password,
    email_confirm: true,
  });
  if (buyerErr || !buyerCreated.user) throw buyerErr ?? new Error("create buyer failed");
  const buyerId = buyerCreated.user.id;

  const { data: strangerCreated, error: strangerErr } = await admin.auth.admin.createUser({
    email: strangerEmail,
    password: `Stranger-${stamp}-Qx2nL8`,
    email_confirm: true,
  });
  if (strangerErr || !strangerCreated.user) throw strangerErr ?? new Error("create stranger failed");
  const strangerId = strangerCreated.user.id;

  const prior = await insertVenue(`Handoff Prior ${stamp}`, buyerId, purchaserEmail);
  const purchased = await insertVenue(`Handoff Purchased ${stamp}`, buyerId, purchaserEmail);
  const strangerVenue = await insertVenue(`Handoff Stranger ${stamp}`, strangerId, strangerEmail);

  await insertOwnerStaff(prior.id, buyerId, purchaserEmail, "Handoff Buyer");
  await insertOwnerStaff(purchased.id, buyerId, purchaserEmail, "Handoff Buyer");
  await insertOwnerStaff(strangerVenue.id, strangerId, strangerEmail, "Handoff Stranger");

  // Active context on prior venue (simulates returning multi-venue user before consume)
  const { error: ctxErr } = await admin.from("venue_staff_active_context").upsert({
    user_id: buyerId,
    active_venue_id: prior.id,
    updated_at: new Date().toISOString(),
  });
  if (ctxErr) throw ctxErr;

  const { data: handoffCreate, error: hErr } = await admin.rpc("create_venue_onboarding_handoff", {
    p_user_id: buyerId,
    p_intended_email: purchaserEmail,
    p_venue_id: purchased.id,
    p_origin: "purchase_activation",
  });
  if (hErr || !(handoffCreate as { ok?: boolean })?.ok) {
    throw hErr ?? new Error("handoff create failed: " + JSON.stringify(handoffCreate));
  }

  const handoffBefore = await handoffRow(buyerId, purchased.id);
  record(
    "fixture_handoff_pending",
    Boolean(handoffBefore && !handoffBefore.consumed_at && handoffBefore.origin === "purchase_activation"),
    JSON.stringify({
      handoffId: handoffBefore?.id?.slice(0, 8) + "…",
      venueId: purchased.id.slice(0, 8) + "…",
      priorId: prior.id.slice(0, 8) + "…",
      buyerId: buyerId.slice(0, 8) + "…",
      email: purchaserEmail,
      consumed_at: handoffBefore?.consumed_at ?? null,
    }),
  );

  // Server-side: unauthenticated consume must fail
  const unauthConsume = await anon.rpc("consume_venue_onboarding_handoff");
  record(
    "unauth_consume_rejected",
    Boolean(unauthConsume.error || (unauthConsume.data as { ok?: boolean })?.ok === false),
    JSON.stringify(unauthConsume.data ?? unauthConsume.error?.message),
  );

  // Wrong account cannot consume (stranger JWT)
  const strangerClient = await asUser(strangerEmail, `Stranger-${stamp}-Qx2nL8`);
  const wrongConsume = await strangerClient.rpc("consume_venue_onboarding_handoff");
  const wrongPayload = wrongConsume.data as { ok?: boolean; error?: string } | null;
  record(
    "wrong_user_consume_rejected",
    wrongPayload?.ok === false && (wrongPayload.error === "no_handoff" || wrongPayload.error === "email_mismatch"),
    JSON.stringify(wrongPayload ?? wrongConsume.error),
  );

  // Activated URL alone must not grant venue (no auth)
  const activatedShell = await fetch(
    `${APP}/login?activated=1&next=${encodeURIComponent("/setup-hub")}&email=${encodeURIComponent(purchaserEmail)}`,
  );
  const activatedHtml = await activatedShell.text();
  const dpl = activatedHtml.match(/data-dpl-id="([a-f0-9]+)"/)?.[1] || "";
  record(
    "runtime_dpl",
    dpl.startsWith(EXPECT_SHA),
    `dpl=${dpl}`,
  );
  record(
    "activated_url_not_auth",
    activatedShell.status === 200 && /Welcome to Hello to Cheers|Sign in/i.test(activatedHtml),
    `http=${activatedShell.status}`,
  );

  // --- browser E2E ---
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  // 1) Jennifer (unrelated multi-venue) session
  await context.addCookies(await jenniferCookies());
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const jenText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 280);
  record(
    "jennifer_session_before",
    /Dashboard|Leads|Calendar/i.test(jenText) && !/Sign in · Hello to Cheers/i.test(jenText),
    `url=${page.url()} snippet=${jenText}`,
  );
  await page.screenshot({ path: `${OUT}/purchaser-signin-jennifer-before.png`, fullPage: false });

  // 2) Activation redirect state
  const handoffUrl = `${APP}/login?activated=1&next=${encodeURIComponent("/setup-hub")}&email=${encodeURIComponent(purchaserEmail)}`;
  await page.goto(handoffUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  const loginUrl = page.url();
  const loginText = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  const emailValue = await page.locator("#email").inputValue();
  record(
    "activated_stays_on_login",
    loginUrl.includes("/login") && loginUrl.includes("activated=1"),
    `url=${loginUrl}`,
  );
  record(
    "activated_handoff_copy",
    /Welcome to Hello to Cheers/i.test(loginText) && /email used for this purchase/i.test(loginText),
    loginText.slice(0, 220),
  );
  record(
    "email_prefill_only",
    emailValue.toLowerCase() === purchaserEmail.toLowerCase(),
    `prefill=${emailValue}`,
  );
  await page.screenshot({ path: `${OUT}/purchaser-signin-activated-login.png`, fullPage: false });

  // 3) Refresh before sign-in stays on login
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);
  record(
    "refresh_before_signin",
    page.url().includes("/login") && page.url().includes("activated=1"),
    `url=${page.url()}`,
  );

  // 4) Attempt dashboard before auth — must not open purchased venue
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  record(
    "dashboard_before_auth_blocked",
    page.url().includes("/login") || /Sign in|Welcome to Hello to Cheers|Welcome back/i.test(await page.locator("body").innerText()),
    `url=${page.url()}`,
  );

  // Return to activated login
  await page.goto(handoffUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(1500);

  // 5) Wrong password rejected
  await page.fill("#email", purchaserEmail);
  await page.fill("#password", "definitely-wrong-password-zz");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
  const wrongPwText = await page.locator("body").innerText();
  record(
    "wrong_password_rejected",
    page.url().includes("/login") && /wrong|invalid|error|try again|credentials/i.test(wrongPwText),
    `url=${page.url()} alert=${wrongPwText.slice(0, 180)}`,
  );

  // 6) Correct purchaser password sign-in
  await page.fill("#email", purchaserEmail);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(5000);
  // Wait for navigation away from login (full document assign)
  for (let i = 0; i < 20; i++) {
    if (!page.url().includes("/login")) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(2000);
  let afterAuthUrl = page.url();
  let afterAuthText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
  record(
    "purchaser_signin_landed",
    !afterAuthUrl.includes("/login"),
    `url=${afterAuthUrl} snippet=${afterAuthText}`,
  );
  await page.screenshot({ path: `${OUT}/purchaser-signin-after-auth.png`, fullPage: false });

  // New purchasers hit Welcome legal gate before app layout bootstrap (handoff consume).
  if (afterAuthUrl.includes("/welcome")) {
    record("welcome_gate_observed", true, afterAuthUrl);
    const agree = page.locator("#welcome-experience-agree");
    if (await agree.count()) {
      await agree.check({ force: true });
    } else {
      const fallback = page.locator("input[type='checkbox']").first();
      if (await fallback.count()) await fallback.check({ force: true });
    }
    const continueBtn = page.getByRole("button", { name: /^Continue$/i });
    await continueBtn.click();
    for (let i = 0; i < 30; i++) {
      if (!page.url().includes("/welcome")) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(2000);
    afterAuthUrl = page.url();
    afterAuthText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
    record(
      "welcome_continue_completed",
      !afterAuthUrl.includes("/welcome"),
      `url=${afterAuthUrl} snippet=${afterAuthText}`,
    );
    await page.screenshot({ path: `${OUT}/purchaser-signin-after-welcome.png`, fullPage: false });
  } else {
    record("welcome_gate_observed", true, `skipped_not_on_welcome url=${afterAuthUrl}`);
    record("welcome_continue_completed", true, "n/a");
  }

  // App layout bootstrap consumes handoff — hit dashboard explicitly.
  await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  // If Welcome redirects again, complete once more
  if (page.url().includes("/welcome")) {
    const agree2 = page.locator("input[type='checkbox']").first();
    if (await agree2.count()) await agree2.check({ force: true });
    const btn2 = page.getByRole("button", { name: /^Continue$/i });
    if (await btn2.count()) {
      await btn2.click();
      for (let i = 0; i < 30; i++) {
        if (!page.url().includes("/welcome")) break;
        await page.waitForTimeout(500);
      }
      await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(2500);
    }
  }
  const dashText = (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 400);
  record(
    "purchaser_dashboard_accessible",
    /Dashboard|Leads|Calendar|Setup|Overview|setup-hub|YOUR VENUE/i.test(dashText + page.url()) &&
      !/Sign in · Hello to Cheers/i.test(dashText) &&
      !page.url().includes("/login"),
    `url=${page.url()} snippet=${dashText}`,
  );
  await page.screenshot({ path: `${OUT}/purchaser-signin-dashboard.png`, fullPage: false });

  // 7) Persist: handoff consumed + active venue = purchased
  const handoffAfter = await handoffRow(buyerId, purchased.id);
  record(
    "handoff_consumed",
    Boolean(handoffAfter?.consumed_at),
    JSON.stringify({
      consumed_at: handoffAfter?.consumed_at ?? null,
      venueId: purchased.id.slice(0, 8) + "…",
    }),
  );

  const { data: activeCtx } = await admin
    .from("venue_staff_active_context")
    .select("active_venue_id")
    .eq("user_id", buyerId)
    .maybeSingle();
  record(
    "active_venue_is_purchased",
    activeCtx?.active_venue_id === purchased.id,
    `active=${activeCtx?.active_venue_id?.slice(0, 8)}… expected=${purchased.id.slice(0, 8)}…`,
  );

  // 8) Refresh after success keeps correct context
  await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  const { data: activeAfterRefresh } = await admin
    .from("venue_staff_active_context")
    .select("active_venue_id")
    .eq("user_id", buyerId)
    .maybeSingle();
  record(
    "refresh_after_consume_stable",
    activeAfterRefresh?.active_venue_id === purchased.id &&
      !page.url().includes("/login") &&
      !page.url().includes("/welcome"),
    `url=${page.url()} active=${activeAfterRefresh?.active_venue_id?.slice(0, 8)}…`,
  );
  await page.screenshot({ path: `${OUT}/purchaser-signin-refresh.png`, fullPage: false });

  // 9) Replay consume via RPC — already_consumed / no_handoff (after browser consume)
  const buyerClient = await asUser(purchaserEmail, password);
  const replay = await buyerClient.rpc("consume_venue_onboarding_handoff");
  const replayPayload = replay.data as { ok?: boolean; error?: string; venueId?: string } | null;
  record(
    "handoff_replay_rejected",
    replayPayload?.ok === false &&
      (replayPayload.error === "no_handoff" || replayPayload.error === "already_consumed"),
    JSON.stringify(replayPayload ?? replay.error),
  );

  // 10) Authorization: can set purchased; cannot set stranger
  const setOk = await buyerClient.rpc("set_active_venue", { p_venue_id: purchased.id });
  const setOkPayload = setOk.data as { ok?: boolean; venueId?: string } | null;
  record(
    "authz_intended_venue_ok",
    setOkPayload?.ok === true && setOkPayload.venueId === purchased.id,
    JSON.stringify(setOkPayload ?? setOk.error),
  );
  const setStranger = await buyerClient.rpc("set_active_venue", { p_venue_id: strangerVenue.id });
  const setStrangerPayload = setStranger.data as { ok?: boolean; error?: string } | null;
  record(
    "authz_stranger_venue_rejected",
    setStrangerPayload?.ok === false,
    JSON.stringify(setStrangerPayload ?? setStranger.error),
  );

  // Memberships: buyer has prior+purchased only; stranger unchanged; Jennifer unchanged
  const { data: buyerStaff } = await admin
    .from("venue_staff")
    .select("venue_id, is_owner, is_active")
    .eq("user_id", buyerId)
    .eq("is_active", true);
  const buyerVenueIds = new Set((buyerStaff ?? []).map((r) => r.venue_id));
  record(
    "buyer_memberships",
    buyerVenueIds.has(prior.id) &&
      buyerVenueIds.has(purchased.id) &&
      !buyerVenueIds.has(strangerVenue.id) &&
      !buyerVenueIds.has(MEADOWBROOK_ID),
    JSON.stringify([...(buyerVenueIds)].map((id) => id.slice(0, 8) + "…")),
  );

  const { data: jenniferOnPurchased } = await admin
    .from("venue_staff")
    .select("id")
    .eq("venue_id", purchased.id)
    .eq("user_id", JENNIFER_ID);
  record("jennifer_not_on_disposable", (jenniferOnPurchased ?? []).length === 0, `rows=${(jenniferOnPurchased ?? []).length}`);

  // 11) Repeated navigation to activated login after consume — must not re-grant or alter ownership
  await page.goto(handoffUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2000);
  // May clear session again (activated=1 sign-out) — that is designed; ownership must stay
  const { data: purchasedVenue } = await admin
    .from("venues")
    .select("owner_user_id")
    .eq("id", purchased.id)
    .maybeSingle();
  record(
    "ownership_immutable_after_replay_nav",
    purchasedVenue?.owner_user_id === buyerId,
    `owner=${purchasedVenue?.owner_user_id?.slice(0, 8)}…`,
  );

  // 12) Expired handoff branch (separate disposable handoff on prior venue)
  const { data: expiredCreate } = await admin.rpc("create_venue_onboarding_handoff", {
    p_user_id: buyerId,
    p_intended_email: purchaserEmail,
    p_venue_id: prior.id,
    p_origin: "purchase_activation",
    p_ttl_minutes: 1,
  });
  // Force expire
  await admin
    .from("venue_onboarding_handoffs")
    .update({ expires_at: new Date(Date.now() - 60_000).toISOString(), consumed_at: null })
    .eq("user_id", buyerId)
    .eq("venue_id", prior.id)
    .is("consumed_at", null);
  // Clear any open handoffs' consumed so only expired remains — create already invalidated others;
  // re-sign-in client and consume should get no_handoff for expired-only
  const buyer2 = await asUser(purchaserEmail, password);
  // Mark any non-prior open as consumed already; expire prior explicitly above
  const expiredConsume = await buyer2.rpc("consume_venue_onboarding_handoff");
  const expiredPayload = expiredConsume.data as { ok?: boolean; error?: string } | null;
  record(
    "expired_handoff_rejected",
    expiredPayload?.ok === false && expiredPayload.error === "no_handoff",
    JSON.stringify({ create: expiredCreate, consume: expiredPayload ?? expiredConsume.error }),
  );

  // Malformed email prefill still shows activated login (no auth grant; unsafe email stripped)
  const badEmailRes = await fetch(`${APP}/login?activated=1&email=not-an-email`);
  const badHtml = await badEmailRes.text();
  const badPrefillMatch = badHtml.match(/id="email"[^>]*value="([^"]*)"/i);
  const badPrefillValue = badPrefillMatch?.[1] ?? "";
  record(
    "malformed_email_prefill_safe",
    badEmailRes.status === 200 &&
      /Welcome to Hello to Cheers/i.test(badHtml) &&
      badPrefillValue === "",
    `http=${badEmailRes.status} prefill=${badPrefillValue || "(empty)"}`,
  );

  const afterInvariant = await invariantSnapshot("after");
  record(
    "invariant_after",
    afterInvariant.meadowOwnerIsPurchaser &&
      afterInvariant.jenniferVenueCount === 3 &&
      !afterInvariant.jenniferHasMeadowbrook &&
      JSON.stringify(afterInvariant.jenniferVenueIds) === JSON.stringify(beforeInvariant.jenniferVenueIds),
    JSON.stringify({ before: beforeInvariant, after: afterInvariant }),
  );

  await browser.close();

  const report = {
    observedAt,
    expectSha: EXPECT_SHA,
    dpl,
    fixture: {
      purchaserEmail,
      buyerIdPrefix: buyerId.slice(0, 8) + "…",
      priorVenueIdPrefix: prior.id.slice(0, 8) + "…",
      purchasedVenueIdPrefix: purchased.id.slice(0, 8) + "…",
      strangerVenueIdPrefix: strangerVenue.id.slice(0, 8) + "…",
      // password intentionally omitted from report
    },
    checks,
    hardFail: checks.filter((c) => !c.pass).map((c) => c.name),
    ok: checks.every((c) => c.pass),
  };
  writeFileSync(`${OUT}/purchaser-signin-handoff-results.json`, JSON.stringify(report, null, 2));
  console.log(report.ok ? "GREEN purchaser sign-in → handoff consume" : "NOT GREEN purchaser sign-in → handoff consume");
  console.log(JSON.stringify({ ok: report.ok, hardFail: report.hardFail }, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
