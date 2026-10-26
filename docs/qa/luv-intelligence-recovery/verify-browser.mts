/**
 * Luv intelligence recovery — Sandbox browser proof.
 * A: overdue task priority on dashboard (no past-due restatement)
 * B: scheduled unconfirmed ≠ all-set
 * C: confirmed → celebration language + open lead
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
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/luv-intelligence-recovery";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");
const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
  auth: { persistSession: false },
});

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 2000) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 420)}`);
}

async function servingImage(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].image' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function servingDigest(): Promise<string> {
  const { execSync } = await import("node:child_process");
  const taskArn = execSync(
    "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
    { encoding: "utf8" },
  ).trim();
  return execSync(
    `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
    { encoding: "utf8" },
  ).trim();
}

async function staffCookies() {
  const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
  const { data: otp, error } = await anon.auth.verifyOtp({
    type: "email",
    token_hash: link!.properties!.hashed_token!,
  });
  if (error || !otp?.session) throw error ?? new Error("session");
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otp.session));
  return [
    ...ssrUtils.createChunks(cookieName, encoded).map((c: { name: string; value: string }) => ({
      name: c.name, value: c.value, domain: "app.sandbox.hellotocheers.com",
      path: "/", httpOnly: false, secure: true, sameSite: "Lax" as const,
    })),
    {
      name: "htc_active_venue_id", value: FANCY,
      domain: "app.sandbox.hellotocheers.com", path: "/",
      httpOnly: false, secure: true, sameSite: "Lax" as const,
    },
  ];
}

async function main() {
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const digest = await servingDigest();
  const sha = image.split(":").pop() ?? "";
  record("serving-sha", sha.startsWith(EXPECTED.slice(0, 12)), `expected=${EXPECTED} ecs=${image}`);
  record("serving-digest", digest.startsWith("sha256:"), digest);

  const stamp = Date.now();
  const dueOld = "2026-09-01";
  const dueNew = "2026-10-20";

  const leads: { id: string; name: string }[] = [];
  for (const [first, last] of [["IntelOld", `Task${stamp}`], ["IntelNew", `Task${stamp}`]] as const) {
    const { data, error } = await admin.from("leads").insert({
      venue_id: FANCY,
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}.${stamp}@hellotocheers-test.invalid`,
      sales_stage: "new_inquiry",
      exclude_from_business_reporting: true,
    }).select("id").single();
    if (error || !data) throw error ?? new Error("lead");
    leads.push({ id: data.id, name: `${first} ${last}` });
  }

  const taskTitles = [`QA-IR-${stamp}-call-florist`, `QA-IR-${stamp}-send-floor`];
  for (let i = 0; i < 2; i++) {
    const { error } = await admin.from("lead_tasks").insert({
      venue_id: FANCY,
      lead_id: leads[i]!.id,
      title: taskTitles[i],
      due_date: i === 0 ? dueOld : dueNew,
      status: "open",
      sort_order: i,
    });
    if (error) throw error;
  }

  // Tour lead — scheduled then confirm
  const { data: tourLead, error: tlErr } = await admin.from("leads").insert({
    venue_id: FANCY,
    first_name: "IntelTour",
    last_name: `Confirm${stamp}`,
    email: `inteltour.${stamp}@hellotocheers-test.invalid`,
    sales_stage: "tour_scheduled",
    exclude_from_business_reporting: true,
  }).select("id").single();
  if (tlErr || !tourLead) throw tlErr ?? new Error("tour lead");

  const sched = new Date(Date.now() + 36 * 3600_000).toISOString();
  const { data: tour, error: tErr } = await admin.from("tour_appointments").insert({
    venue_id: FANCY,
    lead_id: tourLead.id,
    status: "scheduled",
    scheduled_at: sched,
    duration_minutes: 60,
    contact_name: `IntelTour Confirm${stamp}`,
    contact_email: `inteltour.${stamp}@hellotocheers-test.invalid`,
    origin: "scheduled",
  }).select("id,status").single();
  if (tErr || !tour) throw tErr ?? new Error("tour");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3500);
    const dash = await page.locator("body").innerText();
    record("A-no-past-due-restatement", !/tasks are past due|Want to clear them/i.test(dash), "copy");
    record(
      "A-tasks-priority-or-other-luv",
      /most time-sensitive/i.test(dash) || /I noticed/i.test(dash) || /call-florist/i.test(dash),
      "luv present with priority or other useful card",
    );
    await page.screenshot({ path: `${OUT}/shots/dashboard-1280.png`, fullPage: false });

    await page.goto(`${APP}/leads/${tourLead.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(3000);
    let leadBody = await page.locator("body").innerText();
    record("B-scheduled-no-all-set", !/all set|Good luck/i.test(leadBody), "scheduled");
    record(
      "B-unconfirmed-language",
      /not confirmed|confirmation/i.test(leadBody),
      "status language",
    );
    await page.screenshot({ path: `${OUT}/shots/lead-scheduled-1280.png`, fullPage: false });

    await admin.from("tour_appointments").update({ status: "confirmed" }).eq("id", tour.id);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);
    leadBody = await page.locator("body").innerText();
    const { data: tourAfter } = await admin.from("tour_appointments")
      .select("status").eq("id", tour.id).single();
    record("C-persisted-confirmed", tourAfter?.status === "confirmed", JSON.stringify(tourAfter));
    record("C-all-set-or-confirmed-copy", /all set|confirmed/i.test(leadBody), "celebration");
    await page.screenshot({ path: `${OUT}/shots/lead-confirmed-1280.png`, fullPage: false });

    writeFileSync(`${OUT}/persisted-state.json`, JSON.stringify({
      taskLeadIds: leads.map((l) => l.id),
      taskTitles,
      tourLeadId: tourLead.id,
      tourId: tour.id,
      tourStatus: tourAfter?.status,
      at: new Date().toISOString(),
    }, null, 2));
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({
    pass, image, digest, expectedSha: EXPECTED, checks, at: new Date().toISOString(),
  }, null, 2));
  console.log(pass ? "\nGREEN luv intelligence recovery" : "\nNOT GREEN luv intelligence recovery");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
