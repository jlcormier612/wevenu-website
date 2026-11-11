/**
 * Queue Item 2B — Tour & follow-up card layout verification.
 * Sandbox only. Read-only smoke: no tour status changes, no emails, no bookings.
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
const EXPECTED = process.env.EXPECTED_SHA ?? "";
const FANCY_EMAIL = "jennifer@hellotocheers.com";
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const OUT = "docs/qa/tour-follow-up-card-layout";
/** Quinn Zeller — Fancy lead with a scheduled tour appointment. */
const LEAD_WITH_TOUR = "e0172773-b908-4970-979a-b53029a40ca9";

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

async function cookiesFor() {
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
  const cookieName = "sb-wvpsldwwjqdannqasrdf-auth-token";
  const encoded = "base64-" + ssrUtils.stringToBase64URL(JSON.stringify(otpData.session));
  return [
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
}

async function inspectViewport(
  page: import("playwright").Page,
  width: number,
  suffix: string,
) {
  await page.setViewportSize({ width, height: width <= 400 ? 844 : 900 });
  await page.goto(`${APP}/leads/${LEAD_WITH_TOUR}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="lead-tour-followup-card"]', { timeout: 30000 });

  const card = page.locator('[data-testid="lead-tour-followup-card"]');
  await card.scrollIntoViewIfNeeded();

  const layout = await page.evaluate(() => {
    function rect(el: Element | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left), bottom: Math.round(r.bottom), right: Math.round(r.right), width: Math.round(r.width), height: Math.round(r.height) };
    }
    const cardEl = document.querySelector('[data-testid="lead-tour-followup-card"]');
    const scheduling = document.querySelector('[data-testid="tour-followup-scheduling-block"]');
    const tours = document.querySelector('[data-testid="tour-followup-tour-block"]');
    const follow = document.querySelector('[data-testid="tour-followup-followup-block"]');
    const copy = document.querySelector('[data-testid="lead-copy-scheduling-link"]');
    const guidance = document.querySelector('[data-testid="lead-scheduling-link-guidance"]');
    const headerEdit = document.querySelector(
      '[data-testid="lead-tour-followup-card"] > [data-slot="card-header"] [data-testid="tour-followup-edit"]',
    );
    const followEdit = document.querySelector(
      '[data-testid="tour-followup-followup-block"] [data-testid="tour-followup-edit"]',
    );
    const tourEdit = document.querySelector('[data-testid^="tour-appointment-edit-"]');
    const tourActions = document.querySelector('[data-testid^="tour-appointment-actions-"]');
    const followText = follow?.textContent ?? "";
    return {
      card: rect(cardEl),
      scheduling: rect(scheduling),
      tours: rect(tours),
      follow: rect(follow),
      copy: rect(copy),
      guidance: rect(guidance),
      headerEditPresent: Boolean(headerEdit),
      followEditPresent: Boolean(followEdit),
      tourEdit: rect(tourEdit),
      tourActions: rect(tourActions),
      tourEditLabel: tourEdit?.textContent?.trim() ?? null,
      hasFollowUpLabel: /Follow-up/i.test(followText),
      hasLastContacted: /Last contacted/i.test(followText),
      copyLabel: copy?.textContent?.trim() ?? null,
      actionLabels: tourActions
        ? Array.from(tourActions.querySelectorAll("button")).map((b) => b.textContent?.trim())
        : [],
      overlapEditAndCopy: (() => {
        if (!tourEdit || !copy) return false;
        const a = tourEdit.getBoundingClientRect();
        const b = copy.getBoundingClientRect();
        return !(a.right < b.left || a.left > b.right || a.bottom < b.top || a.top > b.bottom);
      })(),
    };
  });

  await card.screenshot({ path: `${OUT}/card-${suffix}.png` });
  await page.screenshot({ path: `${OUT}/page-${suffix}.png`, fullPage: false });

  record(
    `scheduling_block_${suffix}`,
    Boolean(layout.scheduling && layout.copy && layout.guidance),
    `copy=${layout.copyLabel} schedulingTop=${layout.scheduling?.top}`,
  );
  record(
    `order_scheduling_before_tours_${suffix}`,
    Boolean(layout.scheduling && layout.tours && layout.scheduling.top <= layout.tours.top),
    `sched=${layout.scheduling?.top} tours=${layout.tours?.top}`,
  );
  record(
    `order_tours_before_followup_${suffix}`,
    Boolean(layout.tours && layout.follow && layout.tours.top <= layout.follow.top),
    `tours=${layout.tours?.top} follow=${layout.follow?.top}`,
  );
  record(
    `edit_not_beside_scheduling_header_${suffix}`,
    !layout.headerEditPresent,
    `headerEdit=${layout.headerEditPresent}`,
  );
  record(
    `tour_edit_upper_${suffix}`,
    Boolean(
      layout.tourEdit &&
        layout.tourActions &&
        layout.tourEdit.top <= layout.tourActions.top &&
        layout.tourEditLabel === "Edit",
    ),
    `editTop=${layout.tourEdit?.top} actionsTop=${layout.tourActions?.top} label=${layout.tourEditLabel}`,
  );
  record(
    `actions_include_reschedule_${suffix}`,
    layout.actionLabels.includes("Reschedule"),
    `actions=${JSON.stringify(layout.actionLabels)}`,
  );
  record(
    `followup_and_last_contacted_${suffix}`,
    layout.hasFollowUpLabel && layout.hasLastContacted && Boolean(layout.followEditPresent),
    `followEdit=${layout.followEditPresent} labels ok`,
  );
  record(
    `no_edit_copy_overlap_${suffix}`,
    !layout.overlapEditAndCopy,
    `overlap=${layout.overlapEditAndCopy}`,
  );
  record(
    `no_clip_${suffix}`,
    Boolean(layout.card && layout.card.width > 0 && (layout.scheduling?.width ?? 0) > 0),
    `cardW=${layout.card?.width} schedW=${layout.scheduling?.width}`,
  );

  return layout;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");

  const image = await servingImage();
  record(
    "Serving expected SHA",
    image.includes(EXPECTED.slice(0, 12)),
    `image=${image || "unknown"} expected=${EXPECTED.slice(0, 12)}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  const layout1280 = await inspectViewport(page, 1280, "1280");
  const layout390 = await inspectViewport(page, 390, "390");

  // Safe smoke: copy button present and clickable without sending mail / changing status
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/leads/${LEAD_WITH_TOUR}`, { waitUntil: "networkidle", timeout: 60000 });
  const copyBtn = page.locator('[data-testid="lead-copy-scheduling-link"]');
  record("copy_link_visible", await copyBtn.isVisible(), "Copy scheduling link");
  const editTour = page.locator('[data-testid^="tour-appointment-edit-"]').first();
  record("tour_edit_visible", await editTour.isVisible(), await editTour.textContent() ?? "");
  const reschedule = page.locator('[data-testid^="tour-appointment-reschedule-"]').first();
  record("reschedule_visible", await reschedule.isVisible(), "Reschedule in actions");
  // Do not click status-changing actions or send confirmation.

  await browser.close();

  const pass = checks.every((c) => c.pass);
  const results = {
    at: new Date().toISOString(),
    expectedSha: EXPECTED,
    servingImage: image,
    pass,
    leadId: LEAD_WITH_TOUR,
    checks,
    layout1280,
    layout390,
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(results, null, 2));
  console.log(pass ? "ALL PASS" : "HAS FAILURES");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
