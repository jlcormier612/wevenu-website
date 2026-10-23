/**
 * Lead-detail header compact layout — desktop + narrow Sandbox proof.
 * Layout only; Place hold / Start booking presence checks; no customer email.
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
const PREFERRED_LEAD = "907693d8-2694-4bd4-8de7-1fcbfd748848";
const OUT = "docs/qa/lead-header-compact";
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
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${String(detail).slice(0, 400)}`);
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

async function servingDigest(): Promise<string> {
  try {
    const { execSync } = await import("node:child_process");
    const taskArn = execSync(
      "aws ecs list-tasks --cluster htc-sandbox --service-name htc-sandbox-venue-app --desired-status RUNNING --query 'taskArns[0]' --output text",
      { encoding: "utf8" },
    ).trim();
    if (!taskArn || taskArn === "None") return "";
    return execSync(
      `aws ecs describe-tasks --cluster htc-sandbox --tasks ${taskArn} --query 'tasks[0].containers[0].imageDigest' --output text`,
      { encoding: "utf8" },
    ).trim();
  } catch {
    return "";
  }
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
  if (!EXPECTED) throw new Error("EXPECTED_SHA required");
  const image = await servingImage();
  const digest = await servingDigest();
  record("serving-sha", image.includes(EXPECTED.slice(0, 12)), `expected=${EXPECTED.slice(0, 12)} ecs=${image}`);
  if (!image.includes(EXPECTED.slice(0, 12))) {
    writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ checks, image, digest }, null, 2));
    process.exit(1);
  }

  const { data: lead } = await admin
    .from("leads")
    .select("id, first_name, last_name, event_date")
    .eq("id", PREFERRED_LEAD)
    .eq("venue_id", FANCY)
    .maybeSingle();
  const leadId = lead?.id ?? PREFERRED_LEAD;
  record("fixture-lead", Boolean(lead?.id), `leadId=${leadId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await staffCookies());
  const page = await context.newPage();

  await page.goto(`${APP}/leads/${leadId}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForSelector('[data-testid="lead-sales-availability"]', { timeout: 60_000 });
  await page.waitForTimeout(1500);

  const salesBox = await page.getByTestId("lead-sales-availability").boundingBox();
  const ownerHold = page.getByTestId("lead-owner-hold-row");
  const ownerBox = await ownerHold.boundingBox();
  record(
    "desktop-sales-section-present",
    Boolean(salesBox && ownerBox),
    `salesH=${salesBox?.height ?? null} rowH=${ownerBox?.height ?? null}`,
  );
  // Compact target: sales band should not be a tall stacked block (~>220px typical before).
  record(
    "desktop-sales-compact-height",
    (salesBox?.height ?? 999) < 200,
    `height=${salesBox?.height}`,
  );

  const owner = page.getByTestId("lead-staff-assignment");
  const holdBand = page.getByTestId("date-hold-compact-band");
  const divider = page.getByTestId("lead-owner-hold-divider");
  record("desktop-owner-present", (await owner.count()) > 0, "staff assignment");
  record("desktop-hold-band", (await holdBand.count()) > 0, "date-hold-compact-band");
  record("desktop-divider", (await divider.count()) > 0, "owner-hold divider");

  // Same-row check: hold band starts to the right of owner (not stacked), with overlapping Y ranges.
  const o = await owner.boundingBox();
  const h = await holdBand.boundingBox();
  if (o && h) {
    const midO = o.y + o.height / 2;
    const midH = h.y + h.height / 2;
    const sideBySide = h.x >= o.x + o.width - 8;
    const yOverlap = midO >= h.y - 4 && midO <= h.y + h.height + 4;
    record(
      "desktop-owner-hold-same-row",
      sideBySide && yOverlap,
      `owner=${JSON.stringify({ x: o.x, y: o.y, w: o.width, h: o.height })} hold=${JSON.stringify({ x: h.x, y: h.y, w: h.width, h: h.height })} midDelta=${Math.abs(midO - midH).toFixed(0)}`,
    );
  } else {
    record("desktop-owner-hold-same-row", false, "missing boxes");
  }

  const banner = page.getByTestId("date-hold-protection-banner");
  const headline = page.getByTestId("date-hold-protection-headline").first();
  const place = page.getByTestId("date-hold-place");
  const active = page.getByTestId("date-hold-active");
  const unprotected = (await banner.count()) > 0 && (await banner.getAttribute("data-protected")) === "false";
  const protectedActive = (await active.count()) > 0;
  record(
    "protection-status-visible",
    unprotected || protectedActive,
    `unprotected=${unprotected} active=${protectedActive} headline=${((await headline.innerText().catch(() => "")) || "").slice(0, 80)}`,
  );
  if (unprotected) {
    const t = await headline.innerText();
    record("unprotected-copy", /Not protected/i.test(t), t);
    const detail = await page.getByTestId("date-hold-protection-detail").innerText().catch(() => "");
    record(
      "unprotected-detail",
      /No active hold is protecting this event date/i.test(detail),
      detail.slice(0, 120),
    );
  } else {
    record("unprotected-copy", true, "N/A — active hold on fixture");
    record("unprotected-detail", true, "N/A");
  }
  record("place-hold-cta", (await place.count()) > 0 || protectedActive, `place=${await place.count()}`);

  const mgmt = page.getByTestId("lead-management-actions");
  const next = page.getByTestId("lead-booking-tour-actions");
  const mgmtText = await mgmt.innerText();
  const nextText = await next.innerText();
  record(
    "management-row",
    /Change stage/i.test(mgmtText) && /Edit/i.test(mgmtText) && /Archive|Restore/i.test(mgmtText),
    mgmtText.slice(0, 200),
  );
  record(
    "next-actions-row",
    /Schedule Tour/i.test(nextText) && /Start booking file|Continue setup|Mark as Booked/i.test(nextText),
    nextText.slice(0, 200),
  );

  // Overflow check
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="lead-detail-header"]');
    if (!el) return { scrollWidth: 0, clientWidth: 0 };
    return { scrollWidth: (el as HTMLElement).scrollWidth, clientWidth: (el as HTMLElement).clientWidth };
  });
  record(
    "desktop-no-horizontal-overflow",
    overflow.scrollWidth <= overflow.clientWidth + 2,
    JSON.stringify(overflow),
  );

  await page.screenshot({ path: `${OUT}/shots/desktop-1280.png`, fullPage: false });

  // Narrow
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/shots/narrow-390.png`, fullPage: false });
  const salesNarrow = await page.getByTestId("lead-sales-availability").boundingBox();
  const narrowOverflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  record(
    "narrow-sales-present",
    (await page.getByTestId("lead-owner-hold-row").count()) > 0,
    `salesH=${salesNarrow?.height ?? null}`,
  );
  record(
    "narrow-no-page-overflow",
    narrowOverflow.scrollWidth <= narrowOverflow.clientWidth + 2,
    JSON.stringify(narrowOverflow),
  );
  record(
    "narrow-actions-readable",
    (await page.getByTestId("lead-management-actions").count()) > 0
      && (await page.getByTestId("lead-booking-tour-actions").count()) > 0,
    "rows present at 390",
  );

  await browser.close();

  const fail = checks.filter((c) => !c.pass).length;
  const summary = {
    expectedSha: EXPECTED,
    servingImage: image,
    servingDigest: digest,
    leadId,
    counts: { pass: checks.filter((c) => c.pass).length, fail, total: checks.length },
    checks,
    at: new Date().toISOString(),
  };
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify(summary, null, 2));
  console.log(`\n${summary.counts.pass} pass / ${fail} fail`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
