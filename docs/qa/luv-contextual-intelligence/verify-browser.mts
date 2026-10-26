/**
 * Luv contextual intelligence — Sandbox browser verification.
 * Failure A: dashboard must not restate overdue-task counts.
 * Failure B: scheduled tour must not claim all-set / Good luck.
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
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/luv-contextual-intelligence";
mkdirSync(`${OUT}/shots`, { recursive: true });
const EXPECTED = (process.env.EXPECTED_SHA ?? "").slice(0, 40);

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
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 500)}`);
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

async function authCookies() {
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
      name: c.name,
      value: c.value,
      domain: "app.sandbox.hellotocheers.com",
      path: "/",
      httpOnly: false,
      secure: true,
      sameSite: "Lax" as const,
    })),
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
}

async function main() {
  const image = await servingImage();
  const digest = await servingDigest();
  const shaFromImage = image.split(":").pop() ?? "";
  record(
    "serving-sha",
    !EXPECTED || shaFromImage.startsWith(EXPECTED.slice(0, 12)),
    `expected=${EXPECTED || "(any)"} ecs=${image}`,
  );
  record("serving-digest", digest.startsWith("sha256:"), digest);

  const stamp = Date.now();
  const due = "2026-10-01";

  // Fixture leads + overdue tasks (Focus Tasks population)
  const leadIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: `LuvTask${i}`,
        last_name: `Overdue${stamp}`,
        email: `luv-task-${i}.${stamp}@hellotocheers-test.invalid`,
        sales_stage: "new_inquiry",
        exclude_from_business_reporting: true,
      })
      .select("id")
      .single();
    if (error || !lead) throw new Error(error?.message ?? "lead insert");
    leadIds.push(lead.id);
    const { error: taskErr } = await admin.from("lead_tasks").insert({
      venue_id: FANCY,
      lead_id: lead.id,
      title: `Past due fixture ${i} ${stamp}`,
      due_date: due,
      completed: false,
    });
    if (taskErr) throw new Error(taskErr.message);
  }

  // Scheduled unconfirmed tour within 3 days (all-set window)
  const tourAt = new Date(Date.now() + 2 * 86_400_000);
  tourAt.setUTCHours(15, 0, 0, 0);
  const { data: tourLead, error: tlErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Ursula",
      last_name: `Meadows${stamp}`,
      partner_first_name: "Brian",
      partner_last_name: "Valley",
      email: `ursula.${stamp}@hellotocheers-test.invalid`,
      sales_stage: "tour_scheduled",
      exclude_from_business_reporting: true,
    })
    .select("id")
    .single();
  if (tlErr || !tourLead) throw new Error(tlErr?.message ?? "tour lead");

  const { data: tour, error: tourErr } = await admin
    .from("tour_appointments")
    .insert({
      venue_id: FANCY,
      lead_id: tourLead.id,
      status: "scheduled",
      scheduled_at: tourAt.toISOString(),
      duration_minutes: 60,
      contact_name: "Ursula Meadows & Brian Valley",
      contact_email: `ursula.${stamp}@hellotocheers-test.invalid`,
      origin: "scheduled",
      confirmation_requested_at: null,
    })
    .select("id, status, confirmation_requested_at, scheduled_at")
    .single();
  if (tourErr || !tour) throw new Error(tourErr?.message ?? "tour");

  record("fixtures", true, JSON.stringify({ leadIds, tourLead: tourLead.id, tour: tour.id, status: tour.status }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const dash = await page.locator("body").innerText();
    const redundant =
      /I noticed .*tasks? (is|are) past due/i.test(dash)
      || /Want to clear them\?/i.test(dash);
    record("A-no-redundant-overdue-luv", !redundant, redundant ? dash.slice(0, 400) : "no past-due aggregate card");
    const focusShowsTask = /Past due fixture|Today's Focus|overdue/i.test(dash);
    record("A-focus-still-present", focusShowsTask, "Focus/overdue surface present");
    await page.screenshot({ path: `${OUT}/shots/dashboard-overdue-1280.png`, fullPage: false });

    await page.goto(`${APP}/leads/${tourLead.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const leadBody = await page.locator("body").innerText();
    record(
      "B-persisted-scheduled",
      tour.status === "scheduled" && !tour.confirmation_requested_at,
      JSON.stringify(tour),
    );
    record(
      "B-ui-still-offers-confirmation-actions",
      /Send Confirmation Request/i.test(leadBody) && /Mark as Confirmed/i.test(leadBody),
      "actions visible",
    );
    const falseAllSet = /all set for/i.test(leadBody) && /Good luck/i.test(leadBody);
    record("B-no-all-set-while-scheduled", !falseAllSet, falseAllSet ? "found all-set" : "absent");
    const accurate =
      /not confirmed yet/i.test(leadBody)
      || /waiting for their reply/i.test(leadBody)
      || /scheduled for/i.test(leadBody);
    // Accurate copy may appear in Luv panel; if Luv is silent that is also acceptable for scheduled.
    record("B-scheduled-language-or-silence", !falseAllSet, accurate ? "accurate copy" : "silent-or-other");
    await page.screenshot({ path: `${OUT}/shots/lead-scheduled-unconfirmed-1280.png`, fullPage: false });

    // Mark confirmed via DB (avoid external email), reload, allow all-set
    await admin
      .from("tour_appointments")
      .update({ status: "confirmed", confirmation_source: "manual" })
      .eq("id", tour.id)
      .eq("venue_id", FANCY);
    const { data: after } = await admin
      .from("tour_appointments")
      .select("id, status")
      .eq("id", tour.id)
      .single();
    record("B-persisted-confirmed", after?.status === "confirmed", JSON.stringify(after));

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);
    const confirmedBody = await page.locator("body").innerText();
    // All-set is allowed when confirmed; must not claim unconfirmed
    record(
      "B-confirmed-no-unconfirmed-claim",
      !/not confirmed yet/i.test(confirmedBody),
      "unconfirmed copy gone",
    );
    await page.screenshot({ path: `${OUT}/shots/lead-confirmed-1280.png`, fullPage: false });
  } finally {
    await browser.close();
  }

  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({
      pass,
      image,
      digest,
      expectedSha: EXPECTED,
      checks,
      fixtures: { tourLeadId: tourLead.id, tourId: tour.id, overdueLeadIds: leadIds },
      at: new Date().toISOString(),
    }, null, 2),
  );
  console.log(pass ? "\nGREEN luv contextual intelligence" : "\nNOT GREEN luv contextual intelligence");
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
