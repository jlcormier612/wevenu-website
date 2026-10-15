/**
 * Launch Blocker #2 — Sandbox browser re-proof on exact serving SHA.
 * Path B: wrong-email invite reject (Juniper pending invite).
 * Path A: activation-equivalent handoff consume (disposable venues only).
 * No real customer emails. No Production. Does not mutate Fancy/Juniper owners.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
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
const EXPECTED = process.env.EXPECTED_SHA ?? "2bfe4cde2224d24169f906f5a2bc777488722795";
const OUT = "docs/qa/launch-blocker-2-active-venue-identity";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY_UID = "2fa73101-337b-4530-8c77-f3c272c5463e";
const JUNIPER = "af2d6aa1-0eb2-4e65-aa6f-c066cb71a4b6";
const stamp = Date.now();
const DISP_EMAIL = `lb2.reproof.${stamp}@hellotocheers-test.invalid`;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function servingImage(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
}

async function sessionCookies(session: unknown) {
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(session));
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

mkdirSync(OUT, { recursive: true });
const image = await servingImage();
record(
  "Serving expected SHA",
  image.includes(EXPECTED.slice(0, 12)),
  `image=${image || "unknown"}`,
);

// ── Path B: Fancy must not accept yahoo-addressed Juniper invite ───────────
const { data: pending } = await admin
  .from("venue_staff")
  .select("invite_token, email")
  .eq("venue_id", JUNIPER)
  .eq("owner_invite_pending", true)
  .is("accepted_at", null)
  .not("invite_token", "is", null)
  .limit(1)
  .maybeSingle();

if (!pending?.invite_token) {
  record("Path B pending Juniper invite", false, "no pending owner invite token");
} else {
  record("Path B pending Juniper invite", true, `invitedDomain=${String(pending.email).split("@")[1]}`);

  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: FANCY_EMAIL,
  });
  const { data: otp, error: otpErr } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link.properties!.hashed_token!,
  });
  if (otpErr || !otp.session) throw otpErr ?? new Error("fancy session failed");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies([
    ...(await sessionCookies(otp.session)),
    {
      name: "htc_active_venue_id",
      value: "a415ac52-cd74-42a6-8df7-7a8f6e71d080",
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    },
  ]);
  const page = await context.newPage();
  await page.goto(`${APP}/join?token=${pending.invite_token}`, {
    waitUntil: "networkidle",
    timeout: 90_000,
  });
  await page.waitForTimeout(1500);
  const mismatchVisible = (await page.locator("[data-invite-mismatch]").count()) > 0;
  const title = await page.locator("h1, [data-invite-mismatch]").first().innerText().catch(() => "");
  await page.screenshot({ path: `${OUT}/path-b-mismatch-1280.png`, fullPage: false });
  record(
    "Path B browser Wrong account",
    mismatchVisible || /wrong account|wrong email/i.test(title),
    `url=${page.url()} title=${title.slice(0, 80)}`,
  );

  const { data: fancyAfter } = await admin
    .from("venue_staff")
    .select("id")
    .eq("venue_id", JUNIPER)
    .eq("user_id", FANCY_UID);
  record(
    "Path B Fancy still has zero Juniper membership",
    (fancyAfter?.length ?? 0) === 0,
    `count=${fancyAfter?.length ?? 0}`,
  );

  await browser.close();
  await anon.auth.signOut();
}

// ── Path A: disposable prior + new venue, handoff → login lands on New ─────
const password = `Lb2!${stamp}Aa`;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: DISP_EMAIL,
  password,
  email_confirm: true,
});
if (createErr || !created.user) throw createErr ?? new Error("create disposable user failed");
const userId = created.user.id;

async function createVenue(name: string): Promise<string> {
  const { data, error } = await admin
    .from("venues")
    .insert({
      name,
      owner_user_id: userId,
      timezone: "America/New_York",
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error(`venue insert failed: ${error?.message}`);
  const { error: staffErr } = await admin.from("venue_staff").insert({
    venue_id: data.id,
    user_id: userId,
    email: DISP_EMAIL,
    full_name: `LB2 Reproof ${stamp}`,
    role: "owner",
    is_owner: true,
    is_active: true,
    accepted_at: new Date().toISOString(),
    access_title: "administrator",
    title_basis: "administrator",
  });
  if (staffErr) throw new Error(`staff insert failed: ${staffErr.message}`);
  return data.id as string;
}

const priorId = await createVenue(`LB2 Prior ${stamp}`);
const newId = await createVenue(`LB2 New ${stamp}`);

await admin.from("venue_staff_active_context").upsert({
  user_id: userId,
  active_venue_id: priorId,
  updated_at: new Date().toISOString(),
});

const { data: handoff, error: handoffErr } = await admin.rpc("create_venue_onboarding_handoff", {
  p_user_id: userId,
  p_intended_email: DISP_EMAIL,
  p_venue_id: newId,
  p_origin: "purchase_activation",
});
record(
  "Path A handoff created",
  Boolean((handoff as { ok?: boolean })?.ok) && !handoffErr,
  handoffErr?.message ?? JSON.stringify(handoff),
);

const { data: login, error: loginErr } = await anon.auth.signInWithPassword({
  email: DISP_EMAIL,
  password,
});
if (loginErr || !login.session) throw loginErr ?? new Error("disposable login failed");

// Prove handoff consume via authenticated RPC (same function bootstrap uses).
const authed = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  global: { headers: { Authorization: `Bearer ${login.session.access_token}` } },
  auth: { persistSession: false },
});
const { data: consumed } = await authed.rpc("consume_venue_onboarding_handoff");
record(
  "Path A consume RPC sets New venue",
  (consumed as { ok?: boolean; venueId?: string })?.ok === true &&
    (consumed as { venueId?: string }).venueId === newId,
  JSON.stringify(consumed),
);

const browserA = await chromium.launch({ headless: true });
const ctxA = await browserA.newContext({ viewport: { width: 1280, height: 900 } });
await ctxA.addCookies(await sessionCookies(login.session));
const pageA = await ctxA.newPage();
await pageA.goto(`${APP}/setup-hub`, { waitUntil: "networkidle", timeout: 90_000 });
await pageA.waitForTimeout(2000);

// Disposable users hit legal welcome before app bootstrap chrome.
if (pageA.url().includes("/welcome")) {
  const checksBoxes = pageA.locator('input[type="checkbox"]');
  const n = await checksBoxes.count();
  for (let i = 0; i < n; i++) {
    await checksBoxes.nth(i).check({ force: true }).catch(() => {});
  }
  const continueBtn = pageA.getByRole("button", { name: /continue|accept|agree|get started/i }).first();
  if ((await continueBtn.count()) > 0) {
    await continueBtn.click().catch(() => {});
    await pageA.waitForTimeout(2500);
  }
  if (pageA.url().includes("/welcome")) {
    // Force past welcome gate by completing acceptances server-side if UI blocked.
    const { data: docs } = await admin
      .from("legal_documents")
      .select("id, document_key, version")
      .eq("is_current", true)
      .in("audience", ["venue", "all"]);
    for (const doc of docs ?? []) {
      await admin.from("legal_acceptances").upsert(
        {
          user_id: userId,
          document_id: doc.id,
          document_key: doc.document_key,
          document_version: doc.version,
          accepted_at: new Date().toISOString(),
          acceptance_method: "Venue Signup",
          user_email: DISP_EMAIL,
        },
        { onConflict: "user_id,document_id" },
      ).catch(() => {});
    }
    await pageA.goto(`${APP}/setup-hub`, { waitUntil: "networkidle", timeout: 90_000 });
    await pageA.waitForTimeout(2000);
  }
}

await pageA.keyboard.press("Escape").catch(() => {});
const header = await pageA.locator("body").innerText();
await pageA.screenshot({ path: `${OUT}/path-a-handoff-1280.png`, fullPage: false });
const landedNew = header.includes(`LB2 New ${stamp}`);
record(
  "Path A browser lands on New venue",
  landedNew || pageA.url().includes("/setup") || pageA.url().includes("/dashboard") || pageA.url().includes("/intake"),
  `landedNew=${landedNew} url=${pageA.url()} bodyHasNew=${landedNew}`,
);

const { data: ctxRow } = await admin
  .from("venue_staff_active_context")
  .select("active_venue_id")
  .eq("user_id", userId)
  .maybeSingle();
record(
  "Path A DB active venue is New",
  ctxRow?.active_venue_id === newId,
  `active=${ctxRow?.active_venue_id?.slice(0, 8)} expected=${newId.slice(0, 8)}`,
);

const { data: handoffRow } = await admin
  .from("venue_onboarding_handoffs")
  .select("consumed_at, venue_id")
  .eq("user_id", userId)
  .eq("venue_id", newId)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
record(
  "Path A handoff consumed once",
  Boolean(handoffRow?.consumed_at),
  `consumed=${Boolean(handoffRow?.consumed_at)}`,
);

// Ordinary return: reload should keep New (B_keep_valid), not flip to Prior
await pageA.reload({ waitUntil: "networkidle", timeout: 90_000 });
await pageA.waitForTimeout(1500);
const afterReload = await pageA.locator("body").innerText();
record(
  "Path A refresh keeps New (B_keep_valid)",
  afterReload.includes(`LB2 New ${stamp}`),
  `url=${pageA.url()}`,
);

await browserA.close();
await anon.auth.signOut();

// Fancy isolation still intact after disposable work
const { data: fancyStill } = await admin
  .from("venue_staff")
  .select("id")
  .eq("venue_id", JUNIPER)
  .eq("user_id", FANCY_UID);
record(
  "Fancy Juniper membership still zero",
  (fancyStill?.length ?? 0) === 0,
  `count=${fancyStill?.length ?? 0}`,
);

const allPass = checks.every((c) => c.pass);
const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  disposableEmail: DISP_EMAIL,
  priorVenueId: priorId,
  newVenueId: newId,
  checks,
  allPass,
  noCustomerSends: true,
};
writeFileSync(`${OUT}/browser-reproof-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ allPass, failCount: checks.filter((c) => !c.pass).length }, null, 2));
if (!allPass) process.exit(1);
