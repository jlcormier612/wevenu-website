/**
 * Payments “Needs Attention” badge dark-mode contrast — Sandbox.
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
const EXPECTED_SHA = (process.env.EXPECTED_SHA ?? "").slice(0, 40);
const FANCY = "a415ac52-cd74-42a6-8df7-7a8f6e71d080";
const EMAIL = "jennifer@hellotocheers.com";
const OUT = "docs/qa/payment-status-badge-contrast";
mkdirSync(`${OUT}/shots`, { recursive: true });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
if (!url.includes("wvpsldwwjqdannqasrdf")) throw new Error("not sandbox");

const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anon = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];
function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail: String(detail).slice(0, 1500) });
  console.log(`${pass ? "PASS" : "FAIL"} ${name} — ${detail}`);
}

function parseRgb(s: string): [number, number, number] | null {
  const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function relLum([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function ratio(fg: string, bg: string): number | null {
  const a = parseRgb(fg);
  const b = parseRgb(bg);
  if (!a || !b) return null;
  const L1 = relLum(a);
  const L2 = relLum(b);
  const light = Math.max(L1, L2);
  const dark = Math.min(L1, L2);
  return (light + 0.05) / (dark + 0.05);
}

async function cookiesFor() {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: EMAIL,
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

async function measureNeedsAttention(page: import("playwright").Page) {
  return page.evaluate(`(() => {
    const badges = Array.from(document.querySelectorAll('[data-slot="badge"]'));
    const target = badges.find((el) => /needs attention/i.test(el.textContent || ""));
    if (!target) return null;
    const cs = getComputedStyle(target);
    return { color: cs.color, backgroundColor: cs.backgroundColor, text: (target.textContent || "").trim() };
  })()`);
}

async function main() {
  const image = await servingImage();
  record(
    "serving-sha",
    !EXPECTED_SHA || image.includes(EXPECTED_SHA.slice(0, 12)),
    `expected=${EXPECTED_SHA.slice(0, 12)} ecs=${image}`,
  );

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addCookies(await cookiesFor());
  const page = await context.newPage();

  await page.goto(`${APP}/payments`, { waitUntil: "networkidle", timeout: 90000 });
  await page.emulateMedia({ colorScheme: "dark" });
  // Force dark class if next-themes uses it
  await page.evaluate(`document.documentElement.classList.add("dark")`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/shots/payments-dark-1280.png`, fullPage: true });

  let measured = await measureNeedsAttention(page);
  if (!measured) {
    // Open first schedule if list only
    const link = page.locator('a[href*="/payments/"]').first();
    if (await link.count()) {
      await link.click();
      await page.waitForTimeout(1500);
      await page.evaluate(`document.documentElement.classList.add("dark")`);
      measured = await measureNeedsAttention(page);
      await page.screenshot({ path: `${OUT}/shots/schedule-dark-1280.png`, fullPage: true });
    }
  }

  if (!measured) {
    record("needs-attention-badge-found", false, "no Needs Attention badge on payments surfaces");
  } else {
    const r = ratio(measured.color, measured.backgroundColor);
    const rgb = parseRgb(measured.color);
    const isLightInk = rgb ? (rgb[0] + rgb[1] + rgb[2]) / 3 > 180 : false;
    record("needs-attention-badge-found", true, JSON.stringify(measured));
    record(
      "dark-ink-is-light",
      isLightInk,
      `color=${measured.color} avg=${rgb ? (rgb[0] + rgb[1] + rgb[2]) / 3 : "?"}`,
    );
    record(
      "dark-contrast-aa",
      r != null && r >= 4.5,
      `ratio=${r?.toFixed(2) ?? "n/a"}`,
    );
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${OUT}/shots/payments-dark-390.png`, fullPage: true });
  record("narrow-shot", true, "390");

  await browser.close();
  writeFileSync(`${OUT}/browser-results.json`, JSON.stringify({ expectedSha: EXPECTED_SHA, checks }, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
