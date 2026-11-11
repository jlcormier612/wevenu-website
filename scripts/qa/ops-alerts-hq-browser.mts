/**
 * Sandbox browser proof: HQ Ops Alerts list + acknowledge for authorized admin.
 * Uses jennifer@ (hq_admins). Does not touch Production.
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
const EXPECTED_PREFIX = "0425c455";
const HQ_EMAIL = "jennifer@hellotocheers.com";
const OUT_DIR = "docs/qa/supabase-egress-quota-audit";
const OUT = `${OUT_DIR}/ops-alerts-hq-browser.json`;

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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Ensure at least one active incident for UI
  const dedupe = `qa:hq-browser:${Date.now()}`;
  const { data: inc, error } = await admin
    .from("ops_incidents")
    .insert({
      dedupe_key: dedupe,
      source_service: "resend",
      source_alarm: "htc-sandbox-qa-hq-browser",
      severity: "warning",
      status: "active",
      title: "QA HQ browser active alert",
      summary: "Disposable fixture for HQ Ops Alerts UI verification.",
      recommended_action: "Acknowledge in HQ; no customer impact.",
      observation_count: 1,
    })
    .select("id")
    .single();
  if (error || !inc) throw error ?? new Error("insert failed");

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  await ctx.addCookies(await cookiesFor(HQ_EMAIL));
  const page = await ctx.newPage();

  await page.goto(`${APP}/admin`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const html = await page.content();
  const sha = (html.match(/content="([0-9a-f]{40})"/i) || html.match(/dpl=([0-9a-f]{40})/))?.[1] ?? null;
  record("deployed_sha_prefix", !!sha && sha.startsWith(EXPECTED_PREFIX), `sha=${sha}`);

  const banner = await page.getByTestId("ops-alerts-banner").isVisible().catch(() => false);
  record("hq_home_banner", banner, banner ? "banner visible" : "banner missing");

  await page.goto(`${APP}/admin/ops-alerts`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const list = await page.getByTestId("ops-incident-list").isVisible().catch(() => false);
  const row = await page.getByText("QA HQ browser active alert").first().isVisible().catch(() => false);
  record("ops_list_visible", list && row, `list=${list} row=${row}`);

  await page.screenshot({ path: `${OUT_DIR}/ops-alerts-list.png`, fullPage: true });

  await page.goto(`${APP}/admin/ops-alerts/${inc.id}`, { waitUntil: "domcontentloaded", timeout: 60000 });
  const detail = await page.getByTestId("ops-incident-detail").isVisible().catch(() => false);
  record("ops_detail_visible", detail, detail ? "detail ok" : "detail missing");

  const ack = page.getByTestId("ops-acknowledge");
  if (await ack.isVisible().catch(() => false)) {
    await ack.click();
    await page.waitForTimeout(1500);
  }
  const { data: after } = await admin.from("ops_incidents").select("status,resolved_at,acknowledged_at").eq("id", inc.id).single();
  record(
    "acknowledge_not_resolve",
    after?.status === "acknowledged" && !after?.resolved_at,
    `status=${after?.status} resolved=${after?.resolved_at}`,
  );

  // Venue tenant cannot access: use a non-HQ venue staff if available — soft check via anon session to /admin
  // (layout redirects to /dashboard). Soft: page URL after goto.
  await page.goto(`${APP}/admin/ops-alerts`, { waitUntil: "domcontentloaded", timeout: 60000 });
  record("hq_still_authorized", page.url().includes("/admin/ops-alerts"), `url=${page.url()}`);

  await browser.close();

  // Mark fixture recovered so it does not linger as noise
  await admin
    .from("ops_incidents")
    .update({ status: "recovered", recovered_at: new Date().toISOString() })
    .eq("id", inc.id);

  const pass = checks.every((c) => c.pass);
  const result = { at: new Date().toISOString(), sha, expectedPrefix: EXPECTED_PREFIX, pass, checks, incidentId: inc.id };
  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (!pass) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
