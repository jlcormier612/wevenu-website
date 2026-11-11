/**
 * Browser + DB proof: follow-up save must not demote Bindi's confirmed tour.
 * Sandbox only. No Mark as Confirmed, no confirmation request, no customer send.
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "7e7a93597788770bb467f5e6d8a09d0d77ebb762").slice(0, 40);
const MEAD = "05f16a15-1752-4855-8a3b-aad5c593d8d9";
const LEAD = "5d33fcbe-e6c7-4163-9b5e-29db3389efca";
const TOUR = "555060cd-a188-4e2a-ae42-f0da64396e50";
/** Meadowbrook owner — jennifer@hellotocheers.com is Fancy-only for set_active_venue. */
const MEAD_EMAIL = "jlcormier612@gmail.com";
const OUT = "docs/qa/tour-unconfirmed-after-followup";

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
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function noteDeployment(link: string | undefined): string | null {
  if (!link) return null;
  const m = link.match(/dpl=([0-9a-f]{40})/i) || link.match(/deployment[=:]([a-f0-9]+)/i);
  return m?.[1] ?? null;
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

async function loadTour() {
  const { data, error } = await admin
    .from("tour_appointments")
    .select(
      "id, status, confirmed_at, confirmation_source, scheduled_at, lead_id, venue_id, is_archived, updated_at",
    )
    .eq("id", TOUR)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function hybridScan() {
  const { data, error } = await admin
    .from("tour_appointments")
    .select("id, lead_id, contact_name, status, confirmed_at")
    .eq("status", "scheduled")
    .not("confirmed_at", "is", null);
  if (error) throw error;
  return data ?? [];
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
  const cookies = [
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
  ];
  return { session: otpData.session, cookies };
}

async function setActiveVenue(session: { access_token: string; refresh_token: string }, venueId: string) {
  const userSb = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${session.access_token}` } },
  });
  await userSb.auth.setSession(session);
  const { data, error } = await userSb.rpc("set_active_venue", { p_venue_id: venueId });
  if (error) throw new Error(`set_active_venue: ${error.message}`);
  const payload = data as { ok?: boolean; error?: string } | null;
  if (!payload?.ok) throw new Error(`set_active_venue failed: ${payload?.error ?? "unknown"}`);
}

mkdirSync(OUT, { recursive: true });

const before = await loadTour();
const beforeConfirmedAt = before?.confirmed_at;
record(
  "pre_db_confirmed",
  before?.status === "confirmed" && before?.confirmation_source === "prospect_link",
  JSON.stringify(before),
);

const imageBefore = await servingImage();
console.log("serving image (pre):", imageBefore);

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const auth = await authFor(MEAD_EMAIL);
await setActiveVenue(auth.session, MEAD);
await context.addCookies(auth.cookies);
const page = await context.newPage();

const results: Record<string, unknown> = {
  expectedSha: EXPECTED,
  before,
};

try {
  const head = await page.goto(`${APP}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const serving = noteDeployment(head?.headers()?.link);
  results.servingFromLink = serving;
  results.servingImage = await servingImage();
  record(
    "serving_commit",
    Boolean(serving && EXPECTED.startsWith(serving.slice(0, 8))) ||
      String(results.servingImage).includes(EXPECTED.slice(0, 12)),
    `link=${serving} image=${results.servingImage}`,
  );

  await page.goto(`${APP}/leads/${LEAD}`, { waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-testid="lead-tour-followup-card"]', { timeout: 45_000 });
  await page.locator('[data-testid="lead-tour-followup-card"]').scrollIntoViewIfNeeded();

  const bodyBefore = await page.locator("body").innerText();
  record("ui_shows_confirmed_before", /Confirmed/i.test(bodyBefore), "badge text");
  record("ui_shows_bindi", /Bindi/i.test(bodyBefore), "lead name");
  record("ui_shows_follow_up", /Follow up after tour|Oct 19/i.test(bodyBefore), "follow-up retained");
  await page.screenshot({ path: `${OUT}/before-followup-save-1280.png`, fullPage: true });

  await page.getByTestId("tour-followup-edit").click();
  await page.waitForTimeout(400);
  const manualTourEdit = await page.getByTestId("tour-followup-manual-tour-edit").count();
  record("manual_tour_edit_hidden", manualTourEdit === 0, `count=${manualTourEdit}`);

  // Re-save existing follow-up fields unchanged — exercises the save path that previously demoted confirmed.
  // Prefer a tiny follow-up date toggle when the date input is present; otherwise Save as-is.
  const followUp = page.locator('input[type="date"]').first();
  if ((await followUp.count()) > 0) {
    const current = await followUp.inputValue();
    // Keep Oct 19 if already set; writing the same value still submits the form.
    await followUp.fill(current || "2026-10-19");
  }
  const card = page.getByTestId("lead-tour-followup-card");
  await card.getByRole("button", { name: "Save", exact: true }).click();
  await page.waitForTimeout(2500);

  const toastOk = await page.getByText("Follow-up details saved").count();
  record("followup_save_toast", toastOk > 0, `toast count=${toastOk}`);

  await page.reload({ waitUntil: "networkidle", timeout: 90_000 });
  await page.waitForSelector('[data-testid="lead-tour-followup-card"]', { timeout: 45_000 });
  const bodyAfter = await page.locator("body").innerText();
  record("ui_shows_confirmed_after", /Confirmed/i.test(bodyAfter), "badge after reload");
  record("ui_not_unconfirmed_after", !/Unconfirmed/i.test(bodyAfter.split("Tour")[1]?.slice(0, 400) ?? ""), "no unconfirmed in tour region");
  await page.screenshot({ path: `${OUT}/after-followup-save-1280.png`, fullPage: true });

  const after = await loadTour();
  results.after = after;
  record(
    "db_still_confirmed",
    after?.status === "confirmed",
    `status=${after?.status}`,
  );
  record(
    "db_confirmed_at_preserved",
    after?.confirmed_at === beforeConfirmedAt,
    `before=${beforeConfirmedAt} after=${after?.confirmed_at}`,
  );
  record(
    "db_source_preserved",
    after?.confirmation_source === "prospect_link",
    String(after?.confirmation_source),
  );
  record(
    "db_slot_unchanged",
    after?.scheduled_at === before?.scheduled_at,
    `before=${before?.scheduled_at} after=${after?.scheduled_at}`,
  );

  const hybrids = await hybridScan();
  results.hybridScan = hybrids;
  record("hybrid_scan_empty", hybrids.length === 0, `count=${hybrids.length}`);
} catch (err) {
  record("harness_error", false, err instanceof Error ? err.message : String(err));
  throw err;
} finally {
  await browser.close();
  results.checks = checks;
  results.observedAt = new Date().toISOString();
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  const failed = checks.filter((c) => !c.pass);
  console.log(failed.length ? `FAILED ${failed.length}` : "ALL PASS");
  if (failed.length) process.exitCode = 1;
}
