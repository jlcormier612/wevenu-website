/**
 * Date hold HELD label/icon dark-mode contrast — Sandbox browser verify.
 * Read-only. Does not create, edit, or release holds.
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
/** Lead with an existing active hold (do not mutate). */
const LEAD_ID = "907693d8-2694-4bd4-8de7-1fcbfd748848";
const OUT = "docs/qa/date-hold-held-dark-contrast";

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

function luminance(rgb: string): number | null {
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
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

async function measureHeld(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const bar = document.querySelector('[data-testid="date-hold-active"]');
    if (!bar) return null;
    const held = Array.from(bar.querySelectorAll("p")).find((p) =>
      /held/i.test((p.textContent || "").trim()),
    );
    const icon = bar.querySelector("svg");
    const date = bar.querySelector('[data-testid="date-hold-summary-date"]');
    const edit = bar.querySelector('[data-testid="date-hold-edit"]');
    const release = bar.querySelector('[data-testid="date-hold-release"]');
    const heldCs = held ? getComputedStyle(held) : null;
    const iconCs = icon ? getComputedStyle(icon) : null;
    const barCs = getComputedStyle(bar);
    return {
      heldText: held ? (held.textContent || "").trim() : null,
      heldColor: heldCs ? heldCs.color : null,
      iconColor: iconCs ? iconCs.color : null,
      dateColor: date ? getComputedStyle(date).color : null,
      barBg: barCs.backgroundColor,
      barBorder: barCs.borderColor,
      barHeight: Math.round(bar.getBoundingClientRect().height),
      hasEdit: Boolean(edit),
      hasRelease: Boolean(release),
      htmlDark: document.documentElement.classList.contains("dark"),
    };
  })()`);
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
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  await page.goto(`${APP}/leads/${LEAD_ID}`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector('[data-testid="date-hold-active"]', { timeout: 45000 });
  await page.locator('[data-testid="lead-sales-availability"]').scrollIntoViewIfNeeded();

  await page.evaluate(`(() => { document.documentElement.classList.remove("dark"); })()`);
  await page.waitForTimeout(400);
  const light = await measureHeld(page);
  await page.locator('[data-testid="lead-sales-availability"]').screenshot({
    path: `${OUT}/held-light.png`,
  });
  record("light_held_present", Boolean(light?.heldText && /held/i.test(light.heldText)), JSON.stringify(light));
  const lightHeldLum = light?.heldColor ? luminance(light.heldColor) : null;
  const lightIconLum = light?.iconColor ? luminance(light.iconColor) : null;
  record(
    "light_held_stays_dark_sage",
    lightHeldLum != null && lightHeldLum < 0.35,
    `held=${light?.heldColor} lum=${lightHeldLum}`,
  );
  record(
    "light_icon_stays_dark_sage",
    lightIconLum != null && lightIconLum < 0.35,
    `icon=${light?.iconColor} lum=${lightIconLum}`,
  );
  record(
    "light_actions_present",
    Boolean(light?.hasEdit && light?.hasRelease),
    `edit=${light?.hasEdit} release=${light?.hasRelease}`,
  );

  await page.evaluate(`(() => { document.documentElement.classList.add("dark"); })()`);
  await page.waitForTimeout(500);
  const dark = await measureHeld(page);
  await page.locator('[data-testid="lead-sales-availability"]').screenshot({
    path: `${OUT}/held-dark.png`,
  });
  record("dark_held_present", Boolean(dark?.heldText && /held/i.test(dark.heldText)), JSON.stringify(dark));
  const darkHeldLum = dark?.heldColor ? luminance(dark.heldColor) : null;
  const darkIconLum = dark?.iconColor ? luminance(dark.iconColor) : null;
  record(
    "dark_held_readable_light",
    darkHeldLum != null && darkHeldLum > 0.7,
    `held=${dark?.heldColor} lum=${darkHeldLum}`,
  );
  record(
    "dark_icon_readable_light",
    darkIconLum != null && darkIconLum > 0.7,
    `icon=${dark?.iconColor} lum=${darkIconLum}`,
  );
  record(
    "dark_actions_present",
    Boolean(dark?.hasEdit && dark?.hasRelease),
    `edit=${dark?.hasEdit} release=${dark?.hasRelease}`,
  );
  record(
    "bar_height_unchanged",
    light?.barHeight === dark?.barHeight && (light?.barHeight ?? 0) > 0,
    `lightH=${light?.barHeight} darkH=${dark?.barHeight}`,
  );

  await browser.close();
  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify(
      {
        at: new Date().toISOString(),
        expectedSha: EXPECTED,
        servingImage: image,
        leadId: LEAD_ID,
        pass,
        checks,
        light,
        dark,
      },
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
