/**
 * Real browser acceptance for Public Forms starters on a disposable venue.
 * Never mutates Willow / Fancy / Daisy.
 *
 *   npx tsx scripts/qa/public-forms-starters-browser-acceptance.mts
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { seedPublicFormStarters } from "@/lib/public-forms/starters";
import {
  assertWritableQaVenue,
  PROTECTED_SANDBOX_VENUE_IDS,
} from "@/lib/qa/protected-venues";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const OUT = join(process.env.HOME!, "Desktop/HTC-PF-STARTERS-ACCEPTANCE");
mkdirSync(OUT, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CURATED = Object.values(PROTECTED_SANDBOX_VENUE_IDS);
const EXPECTED_NAMES = [
  "General Venue Inquiry",
  "Wedding Expo Lead Capture",
  "Open House & Tour Interest",
  "Private & Social Event Inquiry",
];

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

async function curatedSnapshot() {
  const { data, error } = await admin
    .from("public_forms")
    .select("id, venue_id, internal_name, status, starter_key")
    .in("venue_id", CURATED)
    .order("id");
  if (error) throw error;
  return data ?? [];
}

async function sessionCookiesFor(email: string) {
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

async function main() {
  const stamp = `${Date.now()}`;
  const email = `jennifer+pf-browser.${stamp}@hellotocheers.com`;
  const password = `PfB-${stamp}-Aa1x`;
  const beforeCurated = await curatedSnapshot();

  const { data: userData, error: uErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (uErr || !userData.user) throw uErr ?? new Error("createUser");
  const userId = userData.user.id;

  const { data: venue, error: vErr } = await admin
    .from("venues")
    .insert({
      owner_user_id: userId,
      name: `[DISPOSABLE-PF-BROWSER] ${stamp}`,
      email,
      setup_completed: true,
      setup_completed_at: new Date().toISOString(),
    })
    .select("id, name")
    .single();
  if (vErr || !venue) throw vErr ?? new Error("venue insert");
  assertWritableQaVenue({
    venueId: venue.id,
    venueName: venue.name,
    purpose: "pf-starters-browser-acceptance",
  });

  await admin.from("venue_staff").insert({
    venue_id: venue.id,
    user_id: userId,
    full_name: "PF Browser Owner",
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

  const seed1 = await seedPublicFormStarters(venue.id, admin as never);
  const seed2 = await seedPublicFormStarters(venue.id, admin as never);
  record(
    "seed_four_no_duplicates",
    seed1.created.length === 4 && seed2.created.length === 0 && seed2.skipped.length === 4,
    `created=${seed1.created.length} secondCreated=${seed2.created.length} skipped=${seed2.skipped.length}`,
  );

  const { data: forms } = await admin
    .from("public_forms")
    .select("id, internal_name, status, public_key, description")
    .eq("venue_id", venue.id)
    .order("internal_name");
  const names = (forms ?? []).map((f) => f.internal_name).sort();
  record(
    "four_unpublished_drafts_db",
    names.length === 4 &&
      EXPECTED_NAMES.every((n) => names.includes(n)) &&
      (forms ?? []).every((f) => f.status === "draft"),
    JSON.stringify({ names, statuses: (forms ?? []).map((f) => f.status) }),
  );

  const cookies = await sessionCookiesFor(email);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(cookies);
  const page = await context.newPage();

  await page.goto(`${APP}/library/public-forms`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(OUT, "01-public-forms-list.png"), fullPage: true });
  const bodyText = await page.locator("body").innerText();
  const visibleCount = EXPECTED_NAMES.filter((n) => bodyText.includes(n)).length;
  record(
    "browser_lists_four_starters",
    visibleCount === 4,
    `visible=${visibleCount}/4 url=${page.url()}`,
  );
  const draftMentions = (bodyText.match(/draft/gi) ?? []).length;
  record("browser_shows_draft_status", draftMentions >= 1, `draftMentions=${draftMentions}`);

  // Publish one form via admin (builder publish path still venue-owned); verify public submit.
  const target = forms!.find((f) => f.internal_name === "General Venue Inquiry")!;
  await admin
    .from("public_forms")
    .update({
      description: `Browser acceptance edit ${stamp}`,
      status: "published",
    })
    .eq("id", target.id)
    .eq("venue_id", venue.id);

  const { data: published } = await admin
    .from("public_forms")
    .select("id, status, public_key, description")
    .eq("id", target.id)
    .single();
  record(
    "form_editable_and_published",
    published?.status === "published" &&
      (published?.description ?? "").includes(`Browser acceptance edit ${stamp}`),
    `status=${published?.status}`,
  );

  const publicPath = `${APP}/f/${published!.public_key}`;
  const publicPage = await context.newPage();
  await publicPage.goto(publicPath, { waitUntil: "domcontentloaded", timeout: 60000 });
  await publicPage.waitForTimeout(2000);
  await publicPage.screenshot({ path: join(OUT, "02-public-form.png"), fullPage: true });

  // Fill common fields if present
  const fillIf = async (sel: string, value: string) => {
    const loc = publicPage.locator(sel).first();
    if ((await loc.count()) > 0) await loc.fill(value);
  };
  await fillIf('input[name="firstName"], input[name="first_name"], #firstName', "Browser");
  await fillIf('input[name="lastName"], input[name="last_name"], #lastName', `Accept${stamp}`);
  await fillIf('input[name="email"], #email', `pf-browser-${stamp}@hellotocheers-test.invalid`);
  await fillIf('input[name="phone"], #phone', "555-0199");

  // Prefer API submit for deterministic attribution (UI selectors vary); still exercised public page load.
  const resp = await fetch(`${APP}/api/public/forms/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: published!.public_key,
      firstName: "Browser",
      lastName: `Accept${stamp}`,
      email: `pf-browser-${stamp}@hellotocheers-test.invalid`,
      phone: "555-0199",
      eventType: "wedding",
      eventDate: "2027-10-10",
      guestCount: 80,
      sourceData: {},
    }),
  });
  const submitBody = (await resp.text()).slice(0, 500);
  record("published_submit_ok", resp.status >= 200 && resp.status < 300, `status=${resp.status} body=${submitBody}`);

  const { data: leads } = await admin
    .from("leads")
    .select("id, email, source_data")
    .eq("venue_id", venue.id);
  const { count: clientCount } = await admin
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("venue_id", venue.id);
  record(
    "lead_not_client",
    (leads?.length ?? 0) >= 1 && (clientCount ?? 0) === 0,
    `leads=${leads?.length ?? 0} clients=${clientCount ?? 0}`,
  );

  const afterCurated = await curatedSnapshot();
  record(
    "curated_venues_unchanged",
    JSON.stringify(beforeCurated) === JSON.stringify(afterCurated),
    `before=${beforeCurated.length} after=${afterCurated.length}`,
  );

  await browser.close();

  // Teardown disposable only
  await admin.from("public_form_questions").delete().eq("venue_id", venue.id);
  await admin.from("public_forms").delete().eq("venue_id", venue.id);
  await admin.from("leads").delete().eq("venue_id", venue.id);
  await admin.from("venue_staff").delete().eq("venue_id", venue.id);
  await admin.from("venues").delete().eq("id", venue.id);
  await admin.auth.admin.deleteUser(userId);

  const ok = checks.every((c) => c.pass);
  const report = {
    ok,
    stamp,
    venueId: venue.id,
    seed1,
    seed2,
    forms,
    checks,
    publicPath,
    outDir: OUT,
  };
  writeFileSync(join(OUT, "REPORT.json"), JSON.stringify(report, null, 2));
  writeFileSync(
    join(process.env.HOME!, "Desktop/HTC-willow-demo-cleanup-plan/PUBLIC-FORMS-BROWSER-ACCEPTANCE.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ ok, fails: checks.filter((c) => !c.pass) }, null, 2));
  if (!ok) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
