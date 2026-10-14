/**
 * Preferred badge dark-mode contrast — Sandbox browser verify.
 * Read-only. Does not change vendor preference.
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
const OUT = "docs/qa/vendor-preferred-dark-contrast";

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

  await page.goto(`${APP}/vendors`, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("table", { timeout: 45000 });

  // Light mode first
  await page.evaluate(() => {
    document.documentElement.classList.remove("dark");
  });
  await page.waitForTimeout(400);
  const light = await page.evaluate(() => {
    const preferred = document.querySelector('[data-testid="vendor-preference-preferred"]');
    const required = Array.from(document.querySelectorAll("table [data-slot='badge'], table .inline-flex"))
      .find((el) => (el.textContent || "").trim() === "Required");
    const cs = preferred ? getComputedStyle(preferred) : null;
    const rcs = required ? getComputedStyle(required) : null;
    return {
      preferredText: preferred?.textContent?.trim() ?? null,
      preferredColor: cs?.color ?? null,
      requiredBg: rcs?.backgroundColor ?? null,
      requiredColor: rcs?.color ?? null,
      htmlDark: document.documentElement.classList.contains("dark"),
    };
  });
  await page.screenshot({ path: `${OUT}/vendors-light.png` });
  record(
    "light_preferred_present",
    light.preferredText === "Preferred" && Boolean(light.preferredColor),
    JSON.stringify(light),
  );
  const lightLum = light.preferredColor ? luminance(light.preferredColor) : null;
  record(
    "light_preferred_stays_dark_sage",
    lightLum != null && lightLum < 0.35,
    `color=${light.preferredColor} lum=${lightLum}`,
  );

  // Dark mode
  await page.evaluate(() => {
    document.documentElement.classList.add("dark");
  });
  await page.waitForTimeout(500);
  const dark = await page.evaluate(() => {
    const preferred = document.querySelector('[data-testid="vendor-preference-preferred"]');
    const required = Array.from(document.querySelectorAll("table [data-slot='badge'], table .inline-flex"))
      .find((el) => (el.textContent || "").trim() === "Required");
    const cs = preferred ? getComputedStyle(preferred) : null;
    const rcs = required ? getComputedStyle(required) : null;
    const card = preferred?.closest('[data-slot="card"], main, body');
    const bg = card ? getComputedStyle(card).backgroundColor : getComputedStyle(document.body).backgroundColor;
    return {
      preferredText: preferred?.textContent?.trim() ?? null,
      preferredColor: cs?.color ?? null,
      requiredBg: rcs?.backgroundColor ?? null,
      requiredColor: rcs?.color ?? null,
      surfaceBg: bg,
      htmlDark: document.documentElement.classList.contains("dark"),
    };
  });
  await page.locator('[data-testid="vendor-preference-preferred"]').first().scrollIntoViewIfNeeded().catch(() => {});
  await page.screenshot({ path: `${OUT}/vendors-dark.png` });

  const darkLum = dark.preferredColor ? luminance(dark.preferredColor) : null;
  record(
    "dark_preferred_light_foreground",
    darkLum != null && darkLum > 0.7,
    `color=${dark.preferredColor} lum=${darkLum}`,
  );
  record(
    "required_unchanged_presence",
    Boolean(dark.requiredBg && light.requiredBg),
    `lightReq=${light.requiredBg} darkReq=${dark.requiredBg}`,
  );

  await browser.close();
  const pass = checks.every((c) => c.pass);
  writeFileSync(
    `${OUT}/browser-results.json`,
    JSON.stringify({ at: new Date().toISOString(), expectedSha: EXPECTED, servingImage: image, pass, checks, light, dark }, null, 2),
  );
  console.log(pass ? "ALL PASS" : "HAS FAILURES");
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
