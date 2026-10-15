/**
 * Group B Sandbox verify — no sends.
 * Confirms serving SHA, D4/D6 render parity, and CTA destinations in Fancy.
 * Also spot-checks Group A thank-you helper still present in source deploy ancestry.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import { buildPublicIntakeThankYouEmail } from "../../../lib/lead-intake/public-intake-emails.ts";
import { buildSavedReportReadyEmail } from "../../../lib/saved-reports/schedule-engine.ts";
import { buildTourProtectionAlertEmail } from "../../../lib/tours/booked-side-effects.ts";

config({ path: ".env.local", quiet: true });

const require = createRequire(
  "/Users/jensmac/Developer/wevenu-website/marketing/package.json",
);
const { chromium } = require("playwright");
const ssrUtils = require(
  "/Users/jensmac/Developer/wevenu-website/node_modules/@supabase/ssr/dist/main/utils/index.js",
);

const APP = "https://app.sandbox.hellotocheers.com";
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const OUT = "docs/qa/email-consistency-audit";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const LEAD_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("refusing non-sandbox supabase");
if (!EXPECTED) throw new Error("EXPECTED_SHA required");

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

mkdirSync(OUT, { recursive: true });
const image = await servingImage();
record(
  "Serving expected SHA",
  image.includes(EXPECTED.slice(0, 12)),
  `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
);

const protection = buildTourProtectionAlertEmail({
  venueName: "Jen's Fancy Venue",
  contactName: "Nicole Bethune",
  contactEmail: "nicole@example.com",
  slotStart: "2026-10-15T20:00:00.000Z",
  leadId: LEAD_ID,
  appOrigin: APP,
});
record(
  "D4 HTML shell + dual CTAs",
  /hello-to-cheers-logo-primary-transparent/.test(protection.html) &&
    /View tours/.test(protection.html) &&
    /View this lead/.test(protection.html) &&
    protection.html.includes(`${APP}/tours`) &&
    protection.html.includes(`${APP}/leads/${LEAD_ID}`),
  `subject=${protection.subject}`,
);
record(
  "D4 text parity essentials",
  /Requested time:/.test(protection.text) &&
    /Contact: Nicole Bethune/.test(protection.text) &&
    /View tours\n/.test(protection.text) &&
    protection.text.includes(`${APP}/leads/${LEAD_ID}`),
  "tours + lead URLs labeled in text",
);

const saved = buildSavedReportReadyEmail({
  reportName: "Weekly sales",
  reportLabel: "Sales",
  rangeLabel: "Last 7 days",
  reportPath: "/reporting/sales",
  datePreset: "last_7_days",
  appOrigin: APP,
});
record(
  "D6 HTC shell + report link",
  /hello-to-cheers-logo-primary-transparent/.test(saved.html) &&
    saved.href === `${APP}/reporting/sales?range=last_7_days` &&
    /Open in Hello to Cheers/.test(saved.html),
  `href=${saved.href}`,
);

const thankYou = buildPublicIntakeThankYouEmail({
  kind: "inquiry",
  venueName: "Jen's Fancy Venue",
  firstName: "Alice",
  brandSource: { name: "Jen's Fancy Venue", primaryColor: "#5D6F5D" },
});
record(
  "Group A thank-you helper preserved",
  /Jen's Fancy Venue/.test(thankYou.html) && thankYou.html.includes("<!DOCTYPE html>"),
  "buildPublicIntakeThankYouEmail still returns branded HTML",
);

const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: FANCY_EMAIL,
});
if (linkErr) throw linkErr;
const { data: otpData, error: otpErr } = await anon.auth.verifyOtp({
  type: "email",
  token_hash: linkData.properties!.hashed_token!,
});
if (otpErr || !otpData.session) throw otpErr ?? new Error("no session");
record("Fancy login", true, FANCY_EMAIL);

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
    value: FANCY,
    domain: "app.sandbox.hellotocheers.com",
    path: "/",
    httpOnly: false,
    secure: true,
    sameSite: "Lax" as const,
  },
];

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await context.addCookies(cookies);
const page = await context.newPage();

await page.goto(`${APP}/tours`, { waitUntil: "networkidle", timeout: 90_000 });
const toursOk = !page.url().includes("/login");
record("CTA destination /tours loads", toursOk, `url=${page.url()}`);
await page.screenshot({ path: `${OUT}/group-b-tours-1280.png`, fullPage: false });

await page.goto(`${APP}/reporting/sales?range=last_7_days`, {
  waitUntil: "networkidle",
  timeout: 90_000,
});
const reportOk = !page.url().includes("/login");
record("CTA destination /reporting/sales loads", reportOk, `url=${page.url()}`);
await page.screenshot({ path: `${OUT}/group-b-reporting-1280.png`, fullPage: false });

// Match Group A lead lookup — do not require deleted_at IS NULL (column/filter
// can exclude every Fancy row even when leads exist for CTA destination checks).
const { data: lead } = await admin
  .from("leads")
  .select("id")
  .eq("venue_id", FANCY)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();
if (lead?.id) {
  await page.goto(`${APP}/leads/${lead.id}`, { waitUntil: "networkidle", timeout: 90_000 });
  const leadOk = !page.url().includes("/login") && page.url().includes("/leads/");
  record("CTA destination /leads/{id} loads", leadOk, `url=${page.url()}`);
  await page.screenshot({ path: `${OUT}/group-b-lead-1280.png`, fullPage: false });
} else {
  record("CTA destination /leads/{id} loads", false, "no Fancy lead found");
}

await browser.close();

const allPass = checks.every((c) => c.pass);
const results = {
  at: new Date().toISOString(),
  expectedSha: EXPECTED,
  servingImage: image,
  checks,
  allPass,
  noSends: true,
};
writeFileSync(`${OUT}/group-b-browser-results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify({ allPass, failCount: checks.filter((c) => !c.pass).length }, null, 2));
if (!allPass) process.exit(1);
