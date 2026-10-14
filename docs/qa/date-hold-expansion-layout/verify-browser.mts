/**
 * Date hold expansion layout — form beneath Sales & availability control row.
 * Sandbox only. Opens form and Cancels — does not place a hold.
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
const OUT = "docs/qa/date-hold-expansion-layout";
/** Lead with preferred date for Place hold CTA — Quinn Zeller */
const LEAD_ID = "e0172773-b908-4970-979a-b53029a40ca9";

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

async function measure(page: import("playwright").Page) {
  return page.evaluate(() => {
    const box = (el: Element | null) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        top: Math.round(r.top),
        left: Math.round(r.left),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right),
        width: Math.round(r.width),
        height: Math.round(r.height),
      };
    };
    const card = document.querySelector('[data-testid="lead-sales-availability"]');
    const row = document.querySelector('[data-testid="lead-owner-hold-row"]');
    const owner = document.querySelector('[data-testid="lead-staff-assignment"]');
    const place = document.querySelector('[data-testid="date-hold-place"]');
    const form = document.querySelector('[data-testid="date-hold-form"]');
    const holdTitle = form?.querySelector("input");
    return {
      card: box(card),
      row: box(row),
      owner: box(owner),
      place: box(place),
      form: box(form),
      formLeftAligned:
        form && card
          ? Math.abs(form.getBoundingClientRect().left - card.getBoundingClientRect().left) < 48
          : null,
      hasHoldTitle: Boolean(holdTitle),
    };
  });
}

async function inspect(page: import("playwright").Page, width: number, suffix: string) {
  await page.setViewportSize({ width, height: width <= 400 ? 900 : 1000 });
  await page.goto(`${APP}/leads/${LEAD_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="lead-sales-availability"]', { timeout: 45000 });
  await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();

  const collapsed = await measure(page);
  await page.locator('[data-testid="lead-sales-availability"]').screenshot({
    path: `${OUT}/collapsed-${suffix}.png`,
  });

  const place = page.locator('[data-testid="date-hold-place"]');
  record(`place_visible_${suffix}`, await place.isVisible(), "Place hold CTA");
  await place.click();
  await page.waitForSelector('[data-testid="date-hold-form"]', { timeout: 10000 });

  const expanded = await measure(page);
  await page.locator('[data-testid="lead-sales-availability"]').screenshot({
    path: `${OUT}/expanded-${suffix}.png`,
  });

  record(
    `form_below_controls_${suffix}`,
    Boolean(
      expanded.form &&
        expanded.owner &&
        expanded.form.top >= expanded.owner.bottom - 8,
    ),
    `ownerBottom=${expanded.owner?.bottom} formTop=${expanded.form?.top}`,
  );
  record(
    `form_not_right_column_${suffix}`,
    Boolean(
      expanded.form &&
        expanded.owner &&
        !(
          expanded.form.left >= (expanded.owner.right ?? 0) - 4 &&
          expanded.form.top <= (expanded.owner.bottom ?? 0) + 20
        ),
    ),
    `ownerRight=${expanded.owner?.right} formLeft=${expanded.form?.left}`,
  );
  record(
    `form_left_aligned_${suffix}`,
    expanded.formLeftAligned === true,
    `formLeftAligned=${expanded.formLeftAligned} formW=${expanded.form?.width}`,
  );
  record(
    `form_sensible_width_${suffix}`,
    Boolean(expanded.form && expanded.form.width >= 280 && expanded.form.width <= 600),
    `width=${expanded.form?.width}`,
  );

  // Cancel without placing
  await page.locator('[data-testid="date-hold-form"] button:has-text("Cancel")').click();
  await page.waitForSelector('[data-testid="date-hold-form"]', { state: "detached", timeout: 10000 });
  record(`cancel_closes_${suffix}`, true, "form closed without Place Hold");

  return { collapsed, expanded };
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

  const desktop = await inspect(page, 1280, "1280");
  const mobile = await inspect(page, 390, "390");

  await browser.close();
  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      { at: new Date().toISOString(), expectedSha: EXPECTED, servingImage: image, pass, checks, desktop, mobile },
      null,
      2,
    ),
  );
  console.log(pass ? "ALL PASS" : "HAS FAILURES");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
