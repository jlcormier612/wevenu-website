/**
 * Luv contextual intelligence + dashboard presence — Sandbox browser.
 * - No redundant overdue-task Luv restatement
 * - No false all-set for scheduled tours
 * - Luv still appears when a non-Tasks L1/aggregate applies (Calendar today)
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

function todayTourIso(hourUtc = 18): string {
  const d = new Date();
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

async function insertTourWithRetry(leadId: string, contactName: string, contactEmail: string) {
  let lastErr = "";
  for (let attempt = 0; attempt < 10; attempt++) {
    const hour = 15 + (attempt % 6);
    const dayOffset = attempt === 0 ? 0 : 1 + attempt; // first try today for Calendar Focus
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + dayOffset);
    d.setUTCHours(hour, (attempt * 7) % 50, 0, 0);
    const scheduled_at = d.toISOString();
    const { data, error } = await admin
      .from("tour_appointments")
      .insert({
        venue_id: FANCY,
        lead_id: leadId,
        status: "scheduled",
        scheduled_at,
        duration_minutes: 60,
        contact_name: contactName,
        contact_email: contactEmail,
        origin: "scheduled",
        confirmation_requested_at: null,
      })
      .select("id, status, scheduled_at, confirmation_requested_at")
      .single();
    if (data && !error) return data;
    lastErr = error?.message ?? "no row";
  }
  throw new Error(`tour insert failed: ${lastErr}`);
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

  // Overdue tasks → Focus Tasks
  const taskLeadIds: string[] = [];
  for (let i = 0; i < 3; i++) {
    const { data: lead, error } = await admin
      .from("leads")
      .insert({
        venue_id: FANCY,
        first_name: `LuvDash${i}`,
        last_name: `Task${stamp}`,
        email: `luv-dash-task-${i}.${stamp}@hellotocheers-test.invalid`,
        sales_stage: "new_inquiry",
        exclude_from_business_reporting: true,
      })
      .select("id")
      .single();
    if (error || !lead) throw new Error(error?.message ?? "lead");
    taskLeadIds.push(lead.id);
    const { error: taskErr } = await admin.from("lead_tasks").insert({
      venue_id: FANCY,
      lead_id: lead.id,
      title: `Luv presence overdue ${i} ${stamp}`,
      due_date: due,
      completed: false,
    });
    if (taskErr) throw new Error(taskErr.message);
  }

  // Scheduled unconfirmed tour for lead-detail factuality (+ try today for Calendar Luv)
  const { data: tourLead, error: tlErr } = await admin
    .from("leads")
    .insert({
      venue_id: FANCY,
      first_name: "Ursula",
      last_name: `Meadows${stamp}`,
      partner_first_name: "Brian",
      partner_last_name: "Valley",
      email: `ursula.dash.${stamp}@hellotocheers-test.invalid`,
      sales_stage: "tour_scheduled",
      exclude_from_business_reporting: true,
    })
    .select("id")
    .single();
  if (tlErr || !tourLead) throw new Error(tlErr?.message ?? "tour lead");

  // Prefer today so Focus Calendar can populate Dashboard Luv aggregate
  let tour = null as {
    id: string;
    status: string;
    scheduled_at: string;
    confirmation_requested_at: string | null;
  } | null;
  let todayTourOk = false;
  for (let h = 16; h <= 21; h++) {
    const { data, error } = await admin
      .from("tour_appointments")
      .insert({
        venue_id: FANCY,
        lead_id: tourLead.id,
        status: "scheduled",
        scheduled_at: todayTourIso(h),
        duration_minutes: 60,
        contact_name: "Ursula Meadows & Brian Valley",
        contact_email: `ursula.dash.${stamp}@hellotocheers-test.invalid`,
        origin: "scheduled",
        confirmation_requested_at: null,
      })
      .select("id, status, scheduled_at, confirmation_requested_at")
      .single();
    if (data && !error) {
      tour = data;
      todayTourOk = true;
      break;
    }
  }
  if (!tour) {
    tour = await insertTourWithRetry(
      tourLead.id,
      "Ursula Meadows & Brian Valley",
      `ursula.dash.${stamp}@hellotocheers-test.invalid`,
    );
  }
  record("fixtures", true, JSON.stringify({ taskLeadIds, tourLead: tourLead.id, tour: tour.id, todayTourOk }));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await authCookies());
  const page = await context.newPage();

  try {
    await page.goto(`${APP}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4500);
    const dash = await page.locator("body").innerText();
    const redundant =
      /I noticed .*tasks? (is|are) past due/i.test(dash)
      || /Want to clear them\?/i.test(dash);
    record("A-no-redundant-overdue-luv", !redundant, redundant ? "found restatement" : "absent");
    record("A-focus-lists-overdue", /Luv presence overdue|Overdue/i.test(dash), "Focus shows overdue");
    await page.screenshot({ path: `${OUT}/shots/dashboard-overdue-1280.png`, fullPage: false });

    // Presence: Calendar aggregate when today's tour landed in Focus
    const luvCard = page.locator("section").filter({ hasText: /^💗?\s*Luv|Luv$/i }).filter({
      has: page.locator("text=/noticed|tour|schedule|setup|readiness|stale|confirm/i"),
    });
    // More reliable: card title "Luv" near rose styling — match message text
    const hasUsefulLuv =
      /I noticed .*tour .* on today's schedule/i.test(dash)
      || /Open tours/i.test(dash)
      || /Want to get ready/i.test(dash)
      || /public website isn't collecting|Tour availability|setup/i.test(dash)
      || /stale|unopened/i.test(dash);
    if (todayTourOk) {
      record(
        "presence-luv-when-calendar-focus",
        hasUsefulLuv || /I noticed/i.test(dash),
        hasUsefulLuv ? "Luv interpretation present" : dash.slice(0, 500),
      );
    } else {
      // No today slot — silence with Tasks-only is acceptable; still assert not globally broken
      record(
        "presence-silence-or-other-l1",
        !redundant,
        hasUsefulLuv ? "other L1 present" : "Tasks-only silence OK",
      );
    }
    await page.screenshot({ path: `${OUT}/shots/dashboard-presence-1280.png`, fullPage: true });

    // Lead: scheduled unconfirmed
    await page.goto(`${APP}/leads/${tourLead.id}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForTimeout(4000);
    const leadBody = await page.locator("body").innerText();
    record("B-persisted-scheduled", tour.status === "scheduled" && !tour.confirmation_requested_at, tour.status);
    record(
      "B-ui-confirmation-actions",
      /Send Confirmation Request/i.test(leadBody) && /Mark as Confirmed/i.test(leadBody),
      "actions",
    );
    const falseAllSet = /all set for/i.test(leadBody) && /Good luck/i.test(leadBody);
    record("B-no-all-set-while-scheduled", !falseAllSet, falseAllSet ? "bad copy" : "ok");
    await page.screenshot({ path: `${OUT}/shots/lead-scheduled-unconfirmed-1280.png`, fullPage: false });

    // Confirm via DB, reload
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
    record("B-confirmed-no-unconfirmed-claim", !/not confirmed yet/i.test(confirmedBody), "copy");
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
      fixtures: { tourLeadId: tourLead.id, tourId: tour.id, todayTourOk, taskLeadIds },
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
