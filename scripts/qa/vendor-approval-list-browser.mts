/**
 * Sandbox browser proof: Approved preference visible on vendor list;
 * claim state remains independent. Meadowbrook disposable-safe read of
 * Baker's Dozen + Nail Studio (already Approved in DB).
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
const EXPECTED = "PENDING_SHA"; // replaced at commit time
/** Meadowbrook owner — jennifer@hellotocheers.com is Fancy-only for set_active_venue. */
const MEAD_EMAIL = "jlcormier612@gmail.com";
const MEAD = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT_DIR = "docs/qa/vendor-approval-list-reflect";
const OUT = `${OUT_DIR}/browser-results.json`;

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

async function authFor(email: string) {
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
    session: otpData.session,
    cookies: [
      ...ssrUtils.createChunks(cookieName, encoded).map(
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
      {
        name: "htc_active_venue_id",
        value: MEAD,
        domain: "app.sandbox.hellotocheers.com",
        path: "/",
        httpOnly: false,
        secure: true,
        sameSite: "Lax" as const,
      },
    ],
  };
}

async function setActiveVenue(session: { access_token: string; refresh_token: string }, venueId: string) {
  const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  await userSb.auth.setSession(session);
  const { data, error } = await userSb.rpc("set_active_venue", { p_venue_id: venueId });
  if (error) throw new Error(`set_active_venue: ${error.message}`);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(`set_active_venue failed: ${payload?.error ?? "unknown"}`);
}

const EXPECTED_SHA = process.env.EXPECTED_SHA ?? EXPECTED;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const auth = await authFor(MEAD_EMAIL);
await setActiveVenue(auth.session, MEAD);
await context.addCookies(auth.cookies);
const page = await context.newPage();

const dbProof: Record<string, unknown> = {};

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  record("serving_commit", serving === EXPECTED_SHA, serving ?? "missing dpl");
  if (serving !== EXPECTED_SHA) throw new Error(`wrong runtime ${serving}; expected ${EXPECTED_SHA}`);

  // DB truth for the two Approved vendors + peers
  const { data: rels } = await admin
    .from("venue_vendor_relationships")
    .select("preference_level,status,vendor_id,vendors(business_name,is_claimed)")
    .eq("venue_id", MEAD)
    .in("vendors.business_name", ["Baker's Dozen", "Nail Studio", "Harah's Hair", "Cuppity Cakes"]);
  // PostgREST nested filter can be picky — load then filter
  const { data: allRels } = await admin
    .from("venue_vendor_relationships")
    .select("preference_level,status,vendors(business_name,is_claimed)")
    .eq("venue_id", MEAD);
  const four = (allRels ?? []).filter((r) =>
    /Dozen|Nail Studio|Harah|Cuppity/i.test((r.vendors as { business_name?: string } | null)?.business_name ?? ""),
  );
  dbProof.meadowbrook = four;
  const bakers = four.find((r) => /Dozen/i.test((r.vendors as { business_name: string }).business_name));
  const nails = four.find((r) => /Nail Studio/i.test((r.vendors as { business_name: string }).business_name));
  record(
    "db_bakers_approved_unclaimed",
    bakers?.preference_level === "standard"
      && bakers?.status === "active"
      && (bakers?.vendors as { is_claimed: boolean }).is_claimed === false,
    JSON.stringify(bakers),
  );
  record(
    "db_nails_approved_unclaimed",
    nails?.preference_level === "standard"
      && nails?.status === "active"
      && (nails?.vendors as { is_claimed: boolean }).is_claimed === false,
    JSON.stringify(nails),
  );

  // Fancy Cuppity stays preferred/claimed — venue isolation smoke
  const { data: fancyCuppity } = await admin
    .from("venue_vendor_relationships")
    .select("preference_level,status,vendors!inner(business_name,is_claimed)")
    .eq("venue_id", FANCY)
    .ilike("vendors.business_name", "Cuppity Cakes")
    .maybeSingle();
  dbProof.fancyCuppity = fancyCuppity;
  record(
    "fancy_cuppity_unaffected",
    fancyCuppity?.preference_level === "preferred"
      && (fancyCuppity?.vendors as { is_claimed?: boolean } | null)?.is_claimed === true,
    JSON.stringify(fancyCuppity),
  );

  const dashResp = await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  noteDeployment(dashResp?.headers()?.link);
  await page.waitForTimeout(800);
  const dash = await page.locator("body").innerText();
  record("active_venue_meadowbrook", /Meadowbrook/i.test(dash), dash.includes("Fancy") ? "still Fancy" : "ok");

  const resp = await page.goto(`${APP}/vendors`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  noteDeployment(resp?.headers()?.link);
  await page.getByRole("table").waitFor({ timeout: 30_000 });
  const body = await page.locator("body").innerText();

  // Find rows roughly: Baker's Dozen should show Approved + Not claimed
  const hasApprovedBadge = (body.match(/Approved/g) ?? []).length >= 2;
  record("list_shows_approved_badges", hasApprovedBadge, `Approved count≈${(body.match(/Approved/g) ?? []).length}`);
  record("list_shows_bakers", /Baker'?s Dozen/i.test(body), "name");
  record("list_shows_nails", /Nail Studio/i.test(body), "name");
  record("list_shows_not_claimed", /Not claimed/i.test(body), "claim column");
  record("list_shows_preferred_peer", /Preferred/i.test(body) && /Cuppity/i.test(body), "Cuppity preferred");
  record("list_shows_recommended_peer", /Recommended/i.test(body) && /Harah/i.test(body), "Harah recommended");

  // Hard reload
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("table").waitFor({ timeout: 30_000 });
  const after = await page.locator("body").innerText();
  record(
    "reload_still_shows_approved",
    (after.match(/Approved/g) ?? []).length >= 2 && /Baker'?s Dozen/i.test(after) && /Nail Studio/i.test(after),
    `Approved count≈${(after.match(/Approved/g) ?? []).length}`,
  );

  const end = await page.goto(`${APP}/vendors`, { waitUntil: "domcontentloaded" });
  const endDpl = noteDeployment(end?.headers()?.link);
  record(
    "runtime_stayed_expected",
    endDpl === EXPECTED_SHA && [...deploymentIds].every((d) => d === EXPECTED_SHA),
    [...deploymentIds].join(","),
  );
} catch (err) {
  record("script_error", false, err instanceof Error ? err.message : String(err));
} finally {
  await browser.close();
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT, JSON.stringify({ expected: EXPECTED_SHA, checks, dbProof, deploymentIds: [...deploymentIds] }, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed → ${OUT}`);
  process.exit(failed.length ? 1 : 0);
}
